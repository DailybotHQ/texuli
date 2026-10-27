package com.texuli.conformance

import com.texuli.compose.BindingStatus
import com.texuli.compose.NativeRegistry
import com.texuli.spec.JsonValue
import com.texuli.spec.SpecComponentCapability
import com.texuli.spec.SpecComponentEmit
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
 * the KMPAIChat screen as a chat-thread blueprint validates on both targets
 * (spec 0.3.0 has the chat ids) but has no native painter yet, and its
 * fallback (text blocks in a card) loads with every widget painted. A change on either side fails here until
 * the migration doc is updated with it.
 */
class KmpAiChatMigrationTest {
    private val repo = File(System.getProperty("texuli.repo") ?: error("texuli.repo is not set"))
    private fun fixture(name: String) = File(repo, "native/conformance/fixtures/$name").readText()

    @Test
    fun theChatThreadFormValidatesAndPlansWithItsChatProps() {
        // Spec 0.3.0 carries chat-thread and chat-message, so the intended form
        // validates here exactly as under the TypeScript validator
        // (native/conformance/web/structure.ts checks the same fixture there).
        val plan = when (val result = loadBlueprint(fixture("kmp-aichat-thread.json"))) {
            is LoadResult.Ready -> result.plan
            is LoadResult.Refused -> fail("kmp-aichat-thread.json: refused on the native target: ${result.diagnostics}")
        }
        val root = plan.single() as PlanNode.Component
        assertEquals(listOf("blocks-text", "chat-thread"), root.children.map { it.id })
        val thread = root.children[1] as PlanNode.Component
        assertEquals(mapOf("label" to JsonValue.Str("Conversation")), thread.props)
        val messages = thread.children.map { it as PlanNode.Component }
        assertEquals(List(3) { "chat-message" }, messages.map { it.id })
        assertEquals(listOf("user", "agent", "user"), messages.map { (it.props["role"] as JsonValue.Str).value })
        assertTrue(messages.all { setOf("author", "role", "at", "text") == it.props.keys })
        for (id in listOf("chat-thread", "chat-message")) {
            val component = SpecVocabulary.components.single { it.id == id }
            assertTrue(SpecComponentEmit.UNTRUSTED in component.emit, "$id is no longer emittable at the untrusted tier")
            assertEquals(SpecComponentCapability.WEB_ONLY, component.capability)
        }
    }

    @Test
    fun theChatIdsStillPaintAPlaceholderNatively() {
        // No native chat painter yet: the thread plans as a component and paints
        // `not-on-this-target`, so the native screen keeps the fallback below.
        assertEquals(BindingStatus.PLACEHOLDER, NativeRegistry.status("chat-thread"), "chat-thread gained a native painter; revisit the KMPAIChat mapping")
        assertEquals(BindingStatus.PLACEHOLDER, NativeRegistry.status("chat-message"), "chat-message gained a native painter; revisit the KMPAIChat mapping")
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
    fun theComposerStaysAppCodeNatively() {
        // OutlinedTextField + Send: the generic form ids stay host chrome.
        for (id in listOf("input", "textarea", "button", "form")) {
            val component = SpecVocabulary.components.single { it.id == id }
            assertTrue(component.emit.isEmpty(), "$id became emittable; revisit the KMPAIChat composer mapping")
        }
        // A composer is host chrome on every target (player design section 8): a
        // blueprint never supplies one, so the vocabulary has no composer id.
        assertTrue(SpecVocabulary.components.none { it.id == "chat-composer" }, "chat-composer reached the spec vocabulary; the host-chrome rule says a blueprint never supplies a composer")
    }
}
