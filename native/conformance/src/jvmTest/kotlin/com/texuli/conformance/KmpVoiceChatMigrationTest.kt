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
 * The fourth KMP app migration check (native/docs/kmp-voicechat-migration.md):
 * the KMPAIVoiceChat chat and realtime screens, expressed as blueprints in the
 * portable vocabulary, load on the native target with every widget painted;
 * the transcript in its natural chat-thread / chat-message form is refused
 * with exact diagnostics, because those ids are not in the spec vocabulary.
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
    fun theChatThreadFormIsRefusedWithExactDiagnostics() {
        val result = loadBlueprint(fixture("kmp-voicechat-thread"))
        val refused = result as? LoadResult.Refused ?: fail("the chat-thread form loaded; update the migration doc")
        assertEquals(
            listOf(
                Triple("unknown-id", "\$.tree.children[1].id", "chat-thread"),
                Triple("unknown-id", "\$.tree.children[1].children[0].id", "chat-message"),
                Triple("unknown-id", "\$.tree.children[1].children[1].id", "chat-message"),
            ),
            refused.diagnostics.map { Triple(it.code.wire, it.path, it.id) },
        )
    }

    @Test
    fun theVocabularyHasNoChatOrAudioIdsYet() {
        val ids = SpecVocabulary.components.map { it.id }
        assertTrue(ids.none { it.startsWith("chat-") }, "a chat-* id reached the spec vocabulary; revisit the transcript mapping")
        assertTrue(ids.none { "audio" in it }, "an audio id reached the spec vocabulary; revisit the voice playback mapping")
    }

    @Test
    fun theComposerAndRecordingControlsHaveNoBlueprintForm() {
        // Text field, send, microphone, cancel and stop stay app code: none of these ids can be emitted.
        for (id in listOf("button", "icon-button", "input", "textarea")) {
            val component = SpecVocabulary.components.single { it.id == id }
            assertTrue(component.emit.isEmpty(), "$id became emittable; revisit the KMPAIVoiceChat composer mapping")
        }
    }
}
