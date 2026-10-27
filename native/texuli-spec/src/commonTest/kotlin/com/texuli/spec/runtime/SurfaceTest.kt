package com.texuli.spec.runtime

import com.texuli.spec.BlueprintEnvelope
import com.texuli.spec.BlueprintFlow
import com.texuli.spec.BlueprintFlowTransition
import com.texuli.spec.BlueprintNode
import com.texuli.spec.BlueprintStateDeclaration
import com.texuli.spec.BlueprintStateDeclarationType
import com.texuli.spec.JsonValue
import com.texuli.spec.SpecDiagnostic
import com.texuli.spec.SpecDiagnosticCode
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNull

/** The Kotlin twin of the spec's list item text rule and state surface rules (`surface.ts`). */
class SurfaceTest {
    private fun node(id: String, vararg props: Pair<String, String>, children: List<BlueprintNode>? = null) =
        BlueprintNode(id = id, props = props.associate { (k, v) -> k to JsonValue.Str(v) }, children = children)

    private val email = mapOf("email" to BlueprintStateDeclaration(type = BlueprintStateDeclarationType.STRING))

    private fun check(
        tree: BlueprintNode,
        state: Map<String, BlueprintStateDeclaration>? = email,
        flow: BlueprintFlow? = null,
    ): List<SpecDiagnostic> {
        val envelope = BlueprintEnvelope(
            id = "surface",
            catalog = "0".repeat(64),
            status = com.texuli.spec.BlueprintStatus.DRAFT,
            createdAt = "2026-10-27T09:00:00Z",
            updatedAt = "2026-10-27T09:00:00Z",
            generator = com.texuli.spec.BlueprintGenerator(kind = com.texuli.spec.BlueprintGeneratorKind.AGENT, name = "A"),
            state = state,
            flow = flow,
            tree = tree,
        )
        val out = ArrayList<SpecDiagnostic>()
        checkStateSurface(envelope.tree, surfaceInputs(envelope), out)
        return out
    }

    @Test
    fun listItemTextRefusesControlBidiAndInvisibleCharacters() {
        for (label in listOf("a\u202Eb", "a\u2067b", "a\u200Bb", "a\u200Eb", "a\u2060b", "a\uFEFFb", "a\u061Cb", "a\u0007b", "a\u0085b")) {
            val list = JsonValue.Arr(listOf(JsonValue.Obj(mapOf("id" to JsonValue.Str("t1"), "label" to JsonValue.Str(label)))))
            assertEquals(
                "[0].label" to "Item text cannot hold control, bidirectional or invisible formatting characters.",
                listProblem(list, 10),
                label,
            )
        }
        for (label in listOf("Bug report", "👩\u200D💻", "می\u200Cخواهم")) {
            val list = JsonValue.Arr(listOf(JsonValue.Obj(mapOf("id" to JsonValue.Str("t1"), "label" to JsonValue.Str(label)))))
            assertNull(listProblem(list, 10), label)
        }
    }

    @Test
    fun formNodesSitInsideAnActionForm() {
        val field = node("form-field", "name" to "email", "label" to "Email", "state" to "email")
        val outside = check(node("layout-doc", "title" to "T", children = listOf(field, node("form-submit", "label" to "Go"))))
        assertEquals(
            listOf(
                SpecDiagnostic(SpecDiagnosticCode.ACTION, "\$.tree.children[0]", "\"form-field\" must be inside an \"action-form\"."),
                SpecDiagnostic(SpecDiagnosticCode.ACTION, "\$.tree.children[1]", "\"form-submit\" must be inside an \"action-form\"."),
            ),
            outside,
        )
        val form = node("action-form", "action" to "send", "label" to "Send", children = listOf(field, node("form-submit", "label" to "Go")))
        assertEquals(emptyList(), check(node("layout-doc", "title" to "T", children = listOf(form))))
        val nested = node("action-form", "action" to "send", "label" to "Send", children = listOf(form))
        assertEquals(listOf(SpecDiagnosticCode.ACTION), check(node("layout-doc", "title" to "T", children = listOf(nested))).map { it.code })
    }

    @Test
    fun controlsAndFlowNodesNameWhatIsDeclared() {
        val tree = node(
            "layout-doc",
            "title" to "T",
            children = listOf(
                node("control-toggle", "label" to "L", "state" to "email"),
                node("flow-view", "name" to "start"),
                node("flow-action", "event" to "jump", "label" to "J"),
            ),
        )
        val flow = BlueprintFlow(views = listOf("start"), transitions = listOf(BlueprintFlowTransition(from = "start", to = "start", on = "next")))
        assertEquals(
            listOf(
                SpecDiagnostic(SpecDiagnosticCode.BINDING, "\$.tree.children[0]", "\"control-toggle\" writes a boolean, but \"email\" is a string."),
                SpecDiagnostic(SpecDiagnosticCode.STATE, "\$.tree.children[2]", "\"flow-action\" fires an event no transition handles."),
            ),
            check(tree, flow = flow),
        )
        assertEquals(
            listOf(SpecDiagnosticCode.BINDING, SpecDiagnosticCode.STATE, SpecDiagnosticCode.STATE),
            check(tree, state = null).map { it.code },
        )
    }
}
