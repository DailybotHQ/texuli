package com.texuli.spec.runtime

import com.texuli.spec.BlueprintEnvelope
import com.texuli.spec.BlueprintNode
import com.texuli.spec.JsonValue
import com.texuli.spec.SpecDiagnostic
import com.texuli.spec.SpecDiagnosticCode

/**
 * The Kotlin twin of `@texuli/spec`'s `surface.ts`: the state surface's node
 * rules, exactly as `@texuli/player` refuses them at paint time, so a
 * blueprint that validates always paints. Forms (code `action`), controls
 * and host-bound writers (code `binding`), flow nodes (code `state`), with
 * the same messages and in the same order as the TypeScript validator.
 */
object SpecSurface {
    /** The state type each control writes (the catalog's `CONTROL_STATE_TYPES`). */
    val CONTROL_STATE_TYPES: Map<String, String> = mapOf(
        "control-toggle" to "boolean",
        "control-choice" to "enum",
        "control-slider" to "number",
        "control-filter" to "string",
    )
}

/** Declared variables (type, writable) or null without `state` and `flow`; the flow's views and events or null. */
data class SurfaceInputs(
    val declarations: Map<String, Pair<String, Boolean>>?,
    val views: List<String>?,
    val events: Set<String>,
)

/** Read the surface inputs as the player does: `state` or `flow` gives declarations (empty with only a flow). */
fun surfaceInputs(envelope: BlueprintEnvelope): SurfaceInputs {
    val declarations = if (envelope.state != null || envelope.flow != null) {
        envelope.state.orEmpty().mapValues { (_, raw) -> raw.type.wire to (raw.source == null) }
    } else {
        null
    }
    val flow = envelope.flow
    return SurfaceInputs(declarations, flow?.views, flow?.transitions?.map { it.on }?.toSet() ?: emptySet())
}

/** Check the tree against the surface rules; one diagnostic per refused node and rule, paths under `$.tree`. */
fun checkStateSurface(root: BlueprintNode, inputs: SurfaceInputs, out: MutableList<SpecDiagnostic>) {
    val declarations = inputs.declarations

    fun visit(node: BlueprintNode, path: String, depth: Int, form: MutableSet<String>?) {
        if (depth > 64) return
        fun fail(code: SpecDiagnosticCode, message: String) {
            out += SpecDiagnostic(code, path, message)
        }
        val id = node.id
        val props = node.props.orEmpty()
        fun text(name: String): String? = (props[name] as? JsonValue.Str)?.value
        var scope = form

        // Controls.
        val wanted = SpecSurface.CONTROL_STATE_TYPES[id]
        if (wanted != null) {
            val name = text("state")
            val declaration = name?.let { declarations?.get(it) }
            when {
                declarations == null ->
                    fail(SpecDiagnosticCode.BINDING, "\"$id\" needs declared local state; this blueprint declares none.")
                name == null || declaration == null ->
                    fail(SpecDiagnosticCode.BINDING, "\"$id\" names no declared state variable.")
                declaration.first != wanted ->
                    fail(SpecDiagnosticCode.BINDING, "\"$id\" writes a $wanted, but \"$name\" is a ${declaration.first}.")
            }
        }

        // Flow nodes.
        if (id == "flow-view" || id == "flow-action") {
            val views = inputs.views
            when {
                views == null ->
                    fail(SpecDiagnosticCode.STATE, "\"$id\" needs a declared flow; this blueprint declares none.")
                id == "flow-view" && text("name").let { it == null || it !in views } ->
                    fail(SpecDiagnosticCode.STATE, "\"flow-view\" names no declared view.")
                id == "flow-action" && text("event").let { it == null || it !in inputs.events } ->
                    fail(SpecDiagnosticCode.STATE, "\"flow-action\" fires an event no transition handles.")
            }
        }

        // Forms.
        if (id == "action-form") {
            if (form != null) fail(SpecDiagnosticCode.ACTION, "\"action-form\" cannot nest inside another form.")
            val action = text("action")
            if (action == null || !SpecContract.INTENT_NAME.matches(action)) {
                fail(SpecDiagnosticCode.ACTION, "\"action-form\" needs an action name like \"request-access\".")
            }
            scope = HashSet()
        } else if (id == "form-field" || id == "form-submit") {
            if (form == null) {
                fail(SpecDiagnosticCode.ACTION, "\"$id\" must be inside an \"action-form\".")
            } else if (id == "form-field") {
                val name = text("name")
                val state = text("state")
                val kind = props["kind"]
                val declaration = state?.let { declarations?.get(it) }
                val type = if ((kind as? JsonValue.Str)?.value == "number") "number" else "string"
                when {
                    name == null || !SpecContract.INTENT_NAME.matches(name) ->
                        fail(SpecDiagnosticCode.ACTION, "\"form-field\" needs a field name.")
                    name in form -> fail(SpecDiagnosticCode.ACTION, "Field name \"$name\" is used twice in one form.")
                    else -> form += name
                }
                when {
                    declarations == null ->
                        fail(SpecDiagnosticCode.ACTION, "\"form-field\" needs declared local state; this blueprint declares none.")
                    declaration == null -> fail(SpecDiagnosticCode.ACTION, "\"form-field\" names no declared state variable.")
                    declaration.first != type -> fail(
                        SpecDiagnosticCode.ACTION,
                        "A ${jsText(kind) ?: "text"} field writes a $type, but \"${jsText(props["state"])}\" is a ${declaration.first}.",
                    )
                }
            }
        }

        // Host-bound variables are the host's to write.
        if (wanted != null || id == "form-field") {
            val name = text("state")
            val declaration = name?.let { declarations?.get(it) }
            if (declaration != null && !declaration.second) {
                fail(SpecDiagnosticCode.BINDING, "\"$id\" cannot write \"$name\": its value comes from the host.")
            }
        }

        node.children?.forEachIndexed { index, child -> visit(child, "$path.children[$index]", depth + 1, scope) }
    }

    visit(root, "\$.tree", 0, null)
}

/** A scalar as JavaScript's `String(value)` writes it (for messages); null when absent. */
private fun jsText(value: JsonValue?): String? = when (value) {
    null -> null
    is JsonValue.Str -> value.value
    is JsonValue.Bool -> value.value.toString()
    is JsonValue.Num -> if (value.value % 1.0 == 0.0 && kotlin.math.abs(value.value) < 1e15) value.value.toLong().toString() else value.value.toString()
    JsonValue.Null -> "null"
    else -> "[object Object]"
}
