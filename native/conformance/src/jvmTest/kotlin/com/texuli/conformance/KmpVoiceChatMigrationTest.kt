package com.texuli.conformance

import com.texuli.compose.BindingStatus
import com.texuli.compose.NativeRegistry
import com.texuli.spec.JsonValue
import com.texuli.spec.SpecComponentCapability
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
 * The fourth KMP app migration check (native/docs/kmp-voicechat-migration.md):
 * the KMPAIVoiceChat chat and realtime screens, expressed as blueprints in the
 * portable vocabulary, load on the native target with every widget painted;
 * the transcript in its natural chat-thread / chat-message form validates
 * once the app's roles are mapped (spec 0.3.0), but has no native painter yet.
 * A binding or vocabulary change that lands fails here until the doc moves too.
 */
class KmpVoiceChatMigrationTest {
    private val repo = File(System.getProperty("texuli.repo") ?: error("texuli.repo is not set"))
    private fun fixture(name: String) = File(repo, "native/conformance/fixtures/$name.json").readText()

    private fun plan(name: String): PlanNode.Component = when (val result = loadBlueprint(fixture(name))) {
        is LoadResult.Ready -> result.plan.single() as PlanNode.Component
        is LoadResult.Refused -> fail("$name.json: refused on the native target: ${result.diagnostics}")
    }

    private fun ids(node: PlanNode): List<String> =
        listOf(node.id) + if (node is PlanNode.Component) node.children.flatMap(::ids) else emptyList()

    @Test
    fun theChatScreenLoadsInThePortableVocabulary() {
        // Demo note, error callout, two transcript turns as text, the transcribing line.
        val root = plan("kmp-voicechat-chat")
        assertEquals("layout-page", root.id)
        assertEquals(List(5) { "blocks-text" }, root.children.map { it.id })
    }

    @Test
    fun theRealtimeScreenLoadsInThePortableVocabulary() {
        // Status, action hint, and the two transcript cards (you said / assistant).
        val root = plan("kmp-voicechat-realtime")
        assertEquals(listOf("blocks-text", "blocks-text", "layout-card", "layout-card"), root.children.map { it.id })
        val cards = root.children.drop(2).map { it as PlanNode.Component }
        assertTrue(cards.all { card -> card.children.map { it.id } == listOf("blocks-text") })
    }

    @Test
    fun everyMigratedWidgetHasItsDocumentedNativeStatus() {
        val all = (ids(plan("kmp-voicechat-chat")) + ids(plan("kmp-voicechat-realtime"))).toSortedSet()
        assertEquals(
            mapOf(
                "blocks-text" to BindingStatus.IMPLEMENTED,
                "layout-card" to BindingStatus.IMPLEMENTED,
                "layout-page" to BindingStatus.IMPLEMENTED,
            ),
            all.associateWith(NativeRegistry::status),
        )
    }

    @Test
    fun theChatThreadFormValidatesWithTheAppRolesMapped() {
        // The app's "assistant" turn is the catalog's `agent` role, and every
        // message names an author: the shape the TypeScript validator accepts
        // too (native/conformance/web/structure.ts checks the same fixture).
        val root = plan("kmp-voicechat-thread")
        assertEquals(listOf("blocks-text", "chat-thread"), root.children.map { it.id })
        val messages = (root.children[1] as PlanNode.Component).children.map { it as PlanNode.Component }
        assertEquals(listOf("chat-message", "chat-message"), messages.map { it.id })
        assertEquals(listOf("user", "agent"), messages.map { (it.props["role"] as JsonValue.Str).value })
        assertTrue(messages.all { it.props["author"] is JsonValue.Str })
        // Validated and planned, but painted as a `not-on-this-target` placeholder:
        // the portable chat fixture stays the form that paints natively.
        for (id in listOf("chat-thread", "chat-message")) {
            assertEquals(BindingStatus.PLACEHOLDER, NativeRegistry.status(id), "$id gained a native painter; revisit the transcript mapping")
        }
    }

    @Test
    fun theUnmappedAppTranscriptIsRefusedWithExactDiagnostics() {
        // The transcript copied as the app models it (no author, role "assistant").
        val unmapped = fixture("kmp-voicechat-thread")
            .replace("\"author\": \"Fictional Person\",", "")
            .replace("\"author\": \"Fictional Agent\",", "")
            .replace("\"role\": \"agent\"", "\"role\": \"assistant\"")
        val refused = loadBlueprint(unmapped) as? LoadResult.Refused ?: fail("the unmapped transcript loaded; update the migration doc")
        assertEquals(
            listOf(
                Triple("missing-required", "\$.tree.children[1].children[0].props.author", "chat-message"),
                Triple("enum-value", "\$.tree.children[1].children[1].props.role", "chat-message"),
                Triple("missing-required", "\$.tree.children[1].children[1].props.author", "chat-message"),
            ),
            refused.diagnostics.map { Triple(it.code.wire, it.path, it.id) },
        )
    }

    @Test
    fun theVocabularyHasChatIdsButNoAudioIds() {
        val ids = SpecVocabulary.components.map { it.id }
        assertTrue(ids.containsAll(listOf("chat-thread", "chat-message")), "a chat id left the spec vocabulary")
        assertTrue("chat-composer" !in ids, "chat-composer reached the spec vocabulary; a composer is host chrome")
        assertTrue(ids.none { "audio" in it }, "an audio id reached the spec vocabulary; revisit the voice playback mapping")
    }

    @Test
    fun theComposerAndRecordingControlsHaveNoBlueprintForm() {
        // Microphone, cancel and stop stay app code: none of these ids can be emitted.
        for (id in listOf("button", "icon-button", "input", "textarea")) {
            val component = SpecVocabulary.components.single { it.id == id }
            assertTrue(component.emit.isEmpty(), "$id became emittable; revisit the KMPAIVoiceChat recording controls mapping")
        }
        // The text field + send pair is host chrome on every target (player design
        // section 8): a blueprint never supplies a composer.
        assertTrue(SpecVocabulary.components.none { it.id == "chat-composer" }, "chat-composer reached the spec vocabulary; a composer is host chrome")
    }
}
