package com.texuli.conformance

import com.texuli.compose.BindingStatus
import com.texuli.compose.NativeRegistry
import com.texuli.spec.SpecDiagnosticCode
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
 * The third KMP app migration check (native/docs/kmp-aichat-migration.md):
 * the KMPAIChat screen as a chat-thread blueprint is refused on the native
 * target today, and its fallback (text blocks in a card) loads with every
 * widget at its documented status. A change on either side fails here until
 * the migration doc is updated with it.
 */
class KmpAiChatMigrationTest {
    private val repo = File(System.getProperty("texuli.repo") ?: error("texuli.repo is not set"))
    private fun fixture(name: String) = File(repo, "native/conformance/fixtures/$name").readText()

    @Test
    fun theChatThreadFormIsRefusedBecauseTheSpecHasNoChatIds() {
        val refused = loadBlueprint(fixture("kmp-aichat-thread.json")) as? LoadResult.Refused
            ?: fail("kmp-aichat-thread.json loaded; chat ids reached the spec, revisit the KMPAIChat mapping")
        assertEquals(setOf(SpecDiagnosticCode.UNKNOWN_ID), refused.diagnostics.map { it.code }.toSet())
        assertEquals(setOf("chat-thread", "chat-message"), refused.diagnostics.mapNotNull { it.id }.toSet())
        assertTrue(SpecVocabulary.components.none { it.id.startsWith("chat-") }, "the spec vocabulary gained chat ids")
        assertEquals(BindingStatus.PLACEHOLDER, NativeRegistry.status("chat-thread"))
        assertEquals(BindingStatus.PLACEHOLDER, NativeRegistry.status("chat-message"))
    }

    @Test
    fun theFallbackScreenLoadsWithEveryWidgetPainted() {
        val plan = when (val result = loadBlueprint(fixture("kmp-aichat.json"))) {
            is LoadResult.Ready -> result.plan
            is LoadResult.Refused -> fail("kmp-aichat.json: refused on the native target: ${result.diagnostics}")
        }
        val root = plan.single() as PlanNode.Component
        assertEquals(listOf("blocks-text", "blocks-text", "layout-card"), root.children.map { it.id })
        val conversation = root.children[2] as PlanNode.Component
        assertEquals(3, conversation.children.size, "one text block per message")
        val ids = mutableListOf<String>()
        fun collect(node: PlanNode) {
            ids += node.id
            if (node is PlanNode.Component) node.children.forEach(::collect)
        }
        plan.forEach(::collect)
        // Scaffold -> layout-page; demo warning, error banner (callout) and messages -> blocks-text;
        // the message list -> layout-card.
        assertEquals(
            mapOf(
                "layout-page" to BindingStatus.IMPLEMENTED,
                "blocks-text" to BindingStatus.IMPLEMENTED,
                "layout-card" to BindingStatus.IMPLEMENTED,
            ),
            ids.associateWith(NativeRegistry::status),
        )
    }

    @Test
    fun theComposerHasNoBlueprintForm() {
        // OutlinedTextField + Send button are host chrome, never blueprint content.
        for (id in listOf("input", "textarea", "button", "form")) {
            val component = SpecVocabulary.components.single { it.id == id }
            assertTrue(component.emit.isEmpty(), "$id became emittable; revisit the KMPAIChat composer mapping")
        }
    }
}
