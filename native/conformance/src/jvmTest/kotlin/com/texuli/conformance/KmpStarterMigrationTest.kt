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
 * The first KMP app migration check (native/docs/kmp-starter-migration.md):
 * the KMPStarter screen, expressed as a blueprint, loads on the native target
 * and every widget maps to a native binding or a documented visible
 * placeholder. A binding that lands, or one that regresses, fails here until
 * the migration doc is updated with it.
 */
class KmpStarterMigrationTest {
    private val repo = File(System.getProperty("texuli.repo") ?: error("texuli.repo is not set"))
    private val fixture = File(repo, "native/conformance/fixtures/kmp-starter.json")

    private fun plan(): List<PlanNode> = when (val result = loadBlueprint(fixture.readText())) {
        is LoadResult.Ready -> result.plan
        is LoadResult.Refused -> fail("kmp-starter.json: refused on the native target: ${result.diagnostics}")
    }

    @Test
    fun theStarterScreenLoadsAsOneNativePlan() {
        val root = plan().single() as PlanNode.Component
        assertEquals("layout-page", root.id)
        assertEquals(listOf("blocks-text", "blocks-media"), root.children.map { it.id })
        assertTrue(root.children.all { it is PlanNode.Component }, "every starter widget is a catalog component")
    }

    @Test
    fun everyStarterWidgetHasItsDocumentedNativeStatus() {
        val ids = mutableListOf<String>()
        fun collect(node: PlanNode) {
            ids += node.id
            if (node is PlanNode.Component) node.children.forEach(::collect)
        }
        plan().forEach(::collect)
        // Column -> layout-page, Text -> blocks-text: painted natively.
        // Column -> layout-page, Text -> blocks-text, Image -> blocks-media:
        // all painted natively (the media widgets landed 2026-10-25; the
        // frame shows the alt text — no image bytes are decoded in common
        // code yet).
        assertEquals(
            mapOf(
                "layout-page" to BindingStatus.IMPLEMENTED,
                "blocks-text" to BindingStatus.IMPLEMENTED,
                "blocks-media" to BindingStatus.IMPLEMENTED,
            ),
            ids.associateWith(NativeRegistry::status),
        )
    }

    @Test
    fun theStarterToggleHasNoBlueprintForm() {
        // Button + remembered state + AnimatedVisibility stay app code: a blueprint
        // cannot emit a button, so the toggle is not part of the migrated screen.
        val button = SpecVocabulary.components.single { it.id == "button" }
        assertTrue(button.emit.isEmpty(), "button became emittable; revisit the KMPStarter toggle mapping")
    }
}
