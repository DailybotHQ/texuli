package com.texuli.spec.runtime

import com.texuli.spec.BlueprintAction
import com.texuli.spec.BlueprintBinding
import com.texuli.spec.BlueprintCanvas
import com.texuli.spec.BlueprintCondition
import com.texuli.spec.BlueprintDocument
import com.texuli.spec.BlueprintFormSchema
import com.texuli.spec.BlueprintReorder
import com.texuli.spec.JsonValue
import com.texuli.spec.SpecDecodeException
import com.texuli.spec.SpecDiagnosticCode
import com.texuli.spec.SpecPropSchema
import com.texuli.spec.SpecPropSchemaType
import com.texuli.spec.decodeBlueprintEventMap

private const val MAX_DEPTH = 64

/** One property-schema issue: a dialect code, a path from `$` and a message. */
data class PropSchemaIssue(val code: String, val path: String, val message: String)

/**
 * Checks a value against a catalog property schema (`SpecPropSchema`), the
 * Kotlin twin of the dialect walk `validateBlueprint` runs in TypeScript:
 * type, properties (objects closed unless `additionalProperties` gives a
 * map), required, items, enum, string bounds in code points, number and
 * array bounds. A `ref` dispatches to the generated decoders (`binding`,
 * `reorder`, `action`, `eventMap`, `condition`, `document`, `formSchema`) or to [validateWorkflowGraph].
 *
 * With a [context] (inside a blueprint), binding, reorder, action and
 * workflow positions also add their semantic diagnostics to the context,
 * and a nested binding is judged by the variable's first-paint value.
 * Without one it only checks shape. [base] prefixes the context's paths.
 */
internal class PropSchemaValidator(private val context: NodeContext?, private val base: String = "\$") {
    fun validate(schema: SpecPropSchema, value: JsonValue): List<PropSchemaIssue> {
        val issues = ArrayList<PropSchemaIssue>()
        visit(schema, value, "\$", 0, issues)
        return issues
    }

    private fun at(relative: String) = base + relative.drop(1)

    private fun visit(node: SpecPropSchema, value: JsonValue, path: String, depth: Int, issues: MutableList<PropSchemaIssue>) {
        if (depth > MAX_DEPTH) {
            issues += PropSchemaIssue("too-deep", path, "The value nests too deeply.")
            return
        }
        val ref = node.ref
        if (ref != null) {
            visitRef(ref.removePrefix("#/\$defs/"), value, path, issues)
            return
        }
        val context = context
        if (context != null && isSourceBinding(value)) {
            // Spec 0.8.0: a data-source binding reads only a whole top-level prop.
            context.fail(SpecDiagnosticCode.SOURCE, at(path), "A data-source binding reads only a whole top-level prop.")
            return
        }
        if (context != null && isBindingShaped(value)) {
            nestedBinding(value as JsonValue.Obj, at(path), context) { PropSchemaValidator(null).validate(node, it).isEmpty() }
            return
        }
        val allowed = node.enum
        if (allowed != null && (value !is JsonValue.Str || value.value !in allowed)) {
            issues += PropSchemaIssue("enum", path, "Must be one of ${allowed.joinToString(", ")}.")
            return
        }
        when (node.type) {
            null -> Unit
            SpecPropSchemaType.STRING -> {
                if (value !is JsonValue.Str) {
                    issues += PropSchemaIssue("type", path, "Must be a string.")
                    return
                }
                val length = value.value.codePointLength()
                node.minLength?.let { if (length < it) issues += PropSchemaIssue("min-length", path, "At least $it characters.") }
                node.maxLength?.let { if (length > it) issues += PropSchemaIssue("max-length", path, "At most $it characters.") }
            }
            SpecPropSchemaType.NUMBER, SpecPropSchemaType.INTEGER -> {
                if (value !is JsonValue.Num || !value.value.isFinite()) {
                    issues += PropSchemaIssue("type", path, "Must be a finite number.")
                    return
                }
                if (node.type == SpecPropSchemaType.INTEGER && value.value % 1.0 != 0.0) {
                    issues += PropSchemaIssue("type", path, "Must be an integer.")
                    return
                }
                node.minimum?.let { if (value.value < it) issues += PropSchemaIssue("minimum", path, "At least $it.") }
                node.maximum?.let { if (value.value > it) issues += PropSchemaIssue("maximum", path, "At most $it.") }
            }
            SpecPropSchemaType.BOOLEAN -> if (value !is JsonValue.Bool) issues += PropSchemaIssue("type", path, "Must be a boolean.")
            SpecPropSchemaType.ARRAY -> {
                if (value !is JsonValue.Arr) {
                    issues += PropSchemaIssue("type", path, "Must be an array.")
                    return
                }
                node.minItems?.let { if (value.items.size < it) issues += PropSchemaIssue("min-items", path, "At least $it items.") }
                val maxItems = node.maxItems
                if (maxItems != null && value.items.size > maxItems) {
                    issues += PropSchemaIssue("max-items", path, "At most $maxItems items.")
                    return
                }
                val items = node.items ?: return
                value.items.forEachIndexed { index, item -> visit(items, item, "$path[$index]", depth + 1, issues) }
            }
            SpecPropSchemaType.OBJECT -> {
                if (value !is JsonValue.Obj) {
                    issues += PropSchemaIssue("type", path, "Must be an object.")
                    return
                }
                val properties = node.properties.orEmpty()
                for (name in node.required.orEmpty()) {
                    if (name !in value.fields) issues += PropSchemaIssue("required", "$path.$name", "\"$name\" is required.")
                }
                for ((key, child) in value.fields) {
                    val declared = properties[key]
                    val map = node.additionalProperties
                    when {
                        declared != null -> visit(declared, child, "$path.$key", depth + 1, issues)
                        map != null -> visit(map, child, "$path.$key", depth + 1, issues)
                        else -> issues += PropSchemaIssue("additional-property", "$path.$key", "\"$key\" is not allowed.")
                    }
                }
            }
        }
    }

    /** Decodes with a generated decoder; a refusal becomes one issue. */
    private fun <T> decode(path: String, issues: MutableList<PropSchemaIssue>, block: () -> T): T? = try {
        block()
    } catch (error: SpecDecodeException) {
        issues += PropSchemaIssue("schema", error.path, error.message ?: "does not match")
        null
    }

    private fun visitRef(name: String, value: JsonValue, path: String, issues: MutableList<PropSchemaIssue>) {
        val context = context
        when (name) {
            "binding" -> {
                if (context != null && value is JsonValue.Obj) bindingPosition(value, at(path), context)
                decode(path, issues) { BlueprintBinding.decode(value, path) }
            }
            "reorder" -> {
                val bind = (value as? JsonValue.Obj)?.fields?.get("bind") as? JsonValue.Obj
                if (context != null && bind != null) {
                    reorderPosition(bind, at("$path.bind"), context)
                    bindingPosition(bind, at("$path.bind"), context)
                }
                decode(path, issues) { BlueprintReorder.decode(value, path) }
            }
            "action" -> {
                val action = decode(path, issues) { BlueprintAction.decode(value, path) }
                if (context != null && action != null) checkAction(action, at(path), null, context)
            }
            "eventMap" -> {
                if (context != null && isBindingShaped(value)) {
                    nestedBinding(value as JsonValue.Obj, at(path), context) { runCatching { decodeBlueprintEventMap(it, "\$") }.isSuccess }
                    return
                }
                val map = decode(path, issues) { decodeBlueprintEventMap(value, path) } ?: return
                if (context != null) {
                    for ((event, actions) in map) {
                        actions.forEachIndexed { index, action -> checkAction(action, at("$path.$event[$index]"), null, context) }
                    }
                }
            }
            "condition" -> {
                if (context != null && isBindingShaped(value)) {
                    nestedBinding(value as JsonValue.Obj, at(path), context) { runCatching { BlueprintCondition.decode(it) }.isSuccess }
                    return
                }
                decode(path, issues) { BlueprintCondition.decode(value, path) }
            }
            "document" -> {
                // Spec 0.7.0: the document's envelope only (format, version, members, the block cap);
                // its closed vocabulary is the runtime validator's (`@texuli/document/schema`).
                val document = decode(path, issues) { BlueprintDocument.decode(value, path) } ?: return
                if (document.blocks.size > SpecContract.DOCUMENT_BLOCKS) {
                    issues += PropSchemaIssue("max-items", "$path.blocks", "At most ${SpecContract.DOCUMENT_BLOCKS} items.")
                }
            }
            "canvas" -> {
                // Spec 0.8.0 (ADR-012): the canvas's envelope only (format, version, members, the grid
                // range, the shape and connector caps); its closed shape vocabulary, palette, text
                // safety and URL policy are the runtime validator's (`@texuli/canvas/model`).
                val canvas = decode(path, issues) { BlueprintCanvas.decode(value, path) } ?: return
                canvas.grid?.let { grid ->
                    if (grid < 1.0) issues += PropSchemaIssue("minimum", "$path.grid", "At least 1.")
                    if (grid > 1000.0) issues += PropSchemaIssue("maximum", "$path.grid", "At most 1000.")
                }
                if (canvas.shapes.size > SpecContract.CANVAS_SHAPES) {
                    issues += PropSchemaIssue("max-items", "$path.shapes", "At most ${SpecContract.CANVAS_SHAPES} items.")
                }
                if (canvas.connectors.size > SpecContract.CANVAS_CONNECTORS) {
                    issues += PropSchemaIssue("max-items", "$path.connectors", "At most ${SpecContract.CANVAS_CONNECTORS} items.")
                }
            }
            "formSchema" -> {
                // Spec 0.8.0 (ADR-015): the closed form schema's shape (closed members, field types,
                // formats, autocomplete tokens and expression ops are enums) and its list caps; names,
                // members per type, ranges, links and the conditions' field references are the runtime
                // validator's (`@texuli/forms/model`, validateDraft on the web).
                val form = decode(path, issues) { BlueprintFormSchema.decode(value, path) } ?: return
                fun cap(size: Int, max: Int, where: String) {
                    if (size > max) issues += PropSchemaIssue("max-items", where, "At most $max items.")
                }
                cap(form.fields?.size ?: 0, SpecContract.FORM_FIELDS, "$path.fields")
                cap(form.sections?.size ?: 0, SpecContract.FORM_SECTIONS, "$path.sections")
                cap(form.steps?.size ?: 0, SpecContract.FORM_STEPS, "$path.steps")
                cap(form.rules?.size ?: 0, SpecContract.FORM_RULES, "$path.rules")
                form.sections?.forEachIndexed { i, section -> cap(section.fields.size, SpecContract.FORM_FIELDS, "$path.sections[$i].fields") }
                form.steps?.forEachIndexed { i, step ->
                    cap(step.fields?.size ?: 0, SpecContract.FORM_FIELDS, "$path.steps[$i].fields")
                    cap(step.sections?.size ?: 0, SpecContract.FORM_SECTIONS, "$path.steps[$i].sections")
                    step.sections?.forEachIndexed { j, section ->
                        cap(section.fields.size, SpecContract.FORM_FIELDS, "$path.steps[$i].sections[$j].fields")
                    }
                }
            }
            "workflowGraph" -> {
                for (d in validateWorkflowGraph(value).diagnostics) {
                    val where = path + d.path.drop(1)
                    if (d.code == SpecDiagnosticCode.SCHEMA) issues += PropSchemaIssue("schema", where, d.message)
                    else context?.out?.add(d.copy(path = at(where), id = context.id))
                }
            }
            else -> issues += PropSchemaIssue("bad-ref", path, "Unresolved #/\$defs/$name.")
        }
    }

    /** A binding position: exactly one key, and a `$state` name that is declared. */
    private fun bindingPosition(value: JsonValue.Obj, path: String, context: NodeContext) {
        val name = (value.fields[SpecContract.STATE_BINDING_KEY] as? JsonValue.Str)?.value
        if (value.fields.size != 1) {
            context.fail(SpecDiagnosticCode.BINDING, path, "A binding is exactly {\"\$state\": name} or {\"\$data\": name}.")
        } else if (name != null && name !in context.state) {
            context.fail(SpecDiagnosticCode.UNKNOWN_STATE, path, "No state variable named \"$name\".")
        }
    }

    /** `reorder.bind` on the raw value, as TypeScript reads it: `$state` of a writable list. */
    private fun reorderPosition(bind: JsonValue.Obj, path: String, context: NodeContext) {
        val name = (bind.fields[SpecContract.STATE_BINDING_KEY] as? JsonValue.Str)?.value
        if (name == null || bind.fields.size != 1) {
            if (bind.fields[SpecContract.DATA_BINDING_KEY] is JsonValue.Str) {
                context.fail(SpecDiagnosticCode.BINDING, path, "reorder needs a writable list, not host data.")
            }
            return
        }
        reorderBinding(BlueprintBinding(state = name), path, context)
    }
}
