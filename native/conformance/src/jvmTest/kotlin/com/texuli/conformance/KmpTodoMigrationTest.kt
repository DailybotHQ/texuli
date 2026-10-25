package com.texuli.conformance

import com.texuli.compose.BindingStatus
import com.texuli.compose.NativeRegistry
import com.texuli.spec.SpecVocabulary
import com.texuli.spec.runtime.LoadResult
import com.texuli.spec.runtime.PlanNode
import com.texuli.spec.runtime.loadBlueprint
import java.io.File
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue
import kotlin.test.fail

/**
 * KMPTodoApp migration snapshot (native/docs/kmp-todo-migration.md): the
 * display-only task list is a blueprint, while controls that cannot be emitted
 * remain in the app. Every represented widget and every omitted control keeps
 * its documented native registry status.
 */
class KmpTodoMigrationTest {
    private val repo = File(System.getProperty("texuli.repo") ?: error("texuli.repo is not set"))
    private val fixture = File(repo, "native/conformance/fixtures/kmp-todo.json")

    private fun plan(): List<PlanNode> = when (val result = loadBlueprint(fixture.readText())) {
        is LoadResult.Ready -> result.plan
        is LoadResult.Refused -> fail("kmp-todo.json: refused on the native target: ${result.diagnostics}")
    }

    @Test
    fun theTodoTaskListLoadsAsAWidgetTree() {
        val root = plan().single() as PlanNode.Component
        assertEquals("layout-page", root.id)
        assertEquals(listOf("blocks-text", "layout-card"), root.children.map { it.id })
        val taskCard = root.children[1] as PlanNode.Component
        assertEquals(listOf("blocks-text"), taskCard.children.map { it.id })
    }

    @Test
    fun eachRepresentedWidgetHasItsDocumentedNativeStatus() {
        val ids = mutableListOf<String>()
        fun collect(node: PlanNode) {
            ids += node.id
            if (node is PlanNode.Component) node.children.forEach(::collect)
        }
        plan().forEach(::collect)

        assertEquals(
            mapOf(
                "layout-page" to BindingStatus.IMPLEMENTED,
                "blocks-text" to BindingStatus.IMPLEMENTED,
                "layout-card" to BindingStatus.IMPLEMENTED,
            ),
            ids.toSet().associateWith(NativeRegistry::status),
        )
    }

    @Test
    fun interactiveTodoControlsStayOutsideTheBlueprintAndRemainPlaceholders() {
        // Search, filter chips, task checkboxes and action buttons depend on
        // app state or events. Their catalog entries are not agent-emittable.
        for (id in listOf("input", "chip", "checkbox", "button")) {
            val component = SpecVocabulary.components.single { it.id == id }
            assertTrue(component.emit.isEmpty(), "$id became emittable; revisit the migration boundary")
            assertEquals(BindingStatus.PLACEHOLDER, NativeRegistry.status(id), id)
        }
    }
}
