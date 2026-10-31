package com.texuli.spec.runtime

import com.texuli.spec.BlueprintAction
import com.texuli.spec.BlueprintActionOp
import com.texuli.spec.BlueprintBinding
import com.texuli.spec.BlueprintDesignSystemReference
import com.texuli.spec.BlueprintEnvelope
import com.texuli.spec.BlueprintFlow
import com.texuli.spec.BlueprintNode
import com.texuli.spec.BlueprintProfile
import com.texuli.spec.BlueprintStateDeclaration
import com.texuli.spec.BlueprintStateDeclarationType
import com.texuli.spec.JsonValue
import com.texuli.spec.SpecComponent
import com.texuli.spec.SpecComponentCapability
import com.texuli.spec.SpecDeprecation
import com.texuli.spec.SpecDiagnostic
import com.texuli.spec.SpecDiagnosticCode
import com.texuli.spec.SpecProp
import com.texuli.spec.SpecPropKind
import com.texuli.spec.SpecValidation
import com.texuli.spec.SpecVocabulary
import com.texuli.spec.SpecWarning
import com.texuli.spec.SpecWarningCode

private const val MAX_TREE_DEPTH = 64

/** One declared variable with its defaults applied; `valid` is false when its declaration was refused. */
data class SpecStateVariable(
    val type: BlueprintStateDeclarationType,
    val valid: Boolean,
    /** The first-paint value: the declared `initial` or the type's default. */
    val initial: JsonValue?,
    /** No `source`: the blueprint may write it. */
    val writable: Boolean,
    val values: List<String>? = null,
    val min: Double? = null,
    val max: Double? = null,
    val maxLength: Int? = null,
    val maxItems: Int? = null,
)

/** The declared flow: its views and the events its transitions handle. */
data class SpecFlowInfo(val views: List<String>, val events: Set<String>)

/**
 * The target-neutral blueprint check, the Kotlin twin of `validateBlueprint`
 * in `@texuli/spec`, rule for rule and in the same order: the declared state
 * and flow, then every node (slot, id and profile, props with bindings and
 * property schemas, required props, `bind`, `on` with the closed actions),
 * plus `deprecated` warnings. Envelope shape errors are the generated
 * decoder's (`SpecDecodeException`, code `schema`); the decoders check
 * types, required and unknown fields and enums, not patterns or limits.
 */
fun validateBlueprint(
    envelope: BlueprintEnvelope,
    components: List<SpecComponent> = SpecVocabulary.components,
    catalogHash: String? = null,
    /** The host's data sources (spec 0.8.0); without them every `$source` binding is refused. */
    sources: List<SourceDescriptor>? = null,
): SpecValidation {
    val out = ArrayList<SpecDiagnostic>()
    if (catalogHash != null && envelope.catalog != catalogHash) {
        out += SpecDiagnostic(SpecDiagnosticCode.CATALOG_MISMATCH, "\$.catalog", "The blueprint is bound to another catalog.")
    }
    checkDesignSystem(envelope.designSystem, out)
    val state = checkStateDeclarations(envelope.state, out)
    val flow = checkFlow(envelope.flow, out)
    // The state surface's node rules, as the player refuses them at paint time.
    checkStateSurface(envelope.tree, surfaceInputs(envelope), out)
    val warnings = ArrayList<SpecWarning>()
    out += validateTree(
        envelope.tree,
        components,
        envelope.profile == BlueprintProfile.PORTABLE,
        "\$.tree",
        state,
        flow,
        warnings,
        sources,
    )
    return SpecValidation(ok = out.isEmpty(), diagnostics = out, warnings = warnings.ifEmpty { null })
}

/**
 * Spec 0.10.0 (ADR-024): the envelope `designSystem` sets exactly one of
 * `ref` (an exact `id@x.y.z` or `texuli:<theme>`) and `inline` (code
 * `schema`, as in TypeScript). The inline document's own rules are the
 * TypeScript design-system validator's; `DesignSystem.decode` reads it.
 */
fun checkDesignSystem(reference: BlueprintDesignSystemReference?, out: MutableList<SpecDiagnostic>) {
    if (reference == null) return
    val ref = reference.ref
    if (ref != null && !SpecContract.DESIGN_SYSTEM_REF.matches(ref)) {
        out += SpecDiagnostic(SpecDiagnosticCode.SCHEMA, "\$.designSystem.ref", "pattern: A design-system ref is an exact id@x.y.z or texuli:<theme>.")
    }
    if ((ref != null) == (reference.inline != null)) {
        out += SpecDiagnostic(SpecDiagnosticCode.SCHEMA, "\$.designSystem", "one-of: A design system sets exactly one of ref and inline.")
    }
}

// ---------------------------------------------------------------------------
// State and flow

/**
 * Read the envelope's `state` (code `state`): at most 64 variables, safe
 * names, the fields each type takes and an initial value of the declared
 * type. A refused declaration stays declared, so its uses are not also
 * `unknown-state`.
 */
fun checkStateDeclarations(
    state: Map<String, BlueprintStateDeclaration>?,
    out: MutableList<SpecDiagnostic>,
): Map<String, SpecStateVariable> {
    val declared = LinkedHashMap<String, SpecStateVariable>()
    if (state == null) return declared
    if (state.size > SpecContract.STATE_VARS) {
        out += SpecDiagnostic(SpecDiagnosticCode.STATE, "\$.state", "At most ${SpecContract.STATE_VARS} state variables (got ${state.size}).")
    }
    for ((name, raw) in state) {
        val path = "\$.state.$name"
        if (!SpecContract.STATE_NAME.matches(name)) {
            out += SpecDiagnostic(SpecDiagnosticCode.STATE, path, "\"$name\" is not a valid state name.")
            continue
        }
        declared[name] = readDeclaration(name, raw, path, out)
    }
    return declared
}

private fun presentFields(raw: BlueprintStateDeclaration): List<String> = listOfNotNull(
    "initial".takeIf { raw.initial != null },
    "min".takeIf { raw.min != null },
    "max".takeIf { raw.max != null },
    "values".takeIf { raw.values != null },
    "maxLength".takeIf { raw.maxLength != null },
    "maxItems".takeIf { raw.maxItems != null },
    "source".takeIf { raw.source != null },
)

private fun readDeclaration(
    name: String,
    raw: BlueprintStateDeclaration,
    path: String,
    out: MutableList<SpecDiagnostic>,
): SpecStateVariable {
    val type = raw.type
    val writable = raw.source == null
    fun refuse(where: String, message: String): SpecStateVariable {
        out += SpecDiagnostic(SpecDiagnosticCode.STATE, where, message)
        return SpecStateVariable(type, valid = false, initial = null, writable = writable)
    }
    val allowed = SpecContract.STATE_FIELDS.getValue(type)
    val extra = presentFields(raw).firstOrNull { it !in allowed }
    if (extra != null) return refuse("$path.$extra", "A ${type.wire} variable takes no \"$extra\".")
    return when (type) {
        BlueprintStateDeclarationType.BOOLEAN -> {
            val initial = raw.initial ?: JsonValue.Bool(false)
            if (initial !is JsonValue.Bool) refuse("$path.initial", "\"$name\" needs a boolean.")
            else SpecStateVariable(type, true, initial, writable)
        }
        BlueprintStateDeclarationType.NUMBER -> {
            val min = raw.min
            val max = raw.max
            if (min == null || max == null || min > max) return refuse(path, "\"$name\" needs finite min ≤ max.")
            val initial = raw.initial ?: JsonValue.Num(min)
            if (initial !is JsonValue.Num || !initial.value.isFinite() || initial.value < min || initial.value > max) {
                refuse("$path.initial", "\"$name\" initial must be between $min and $max.")
            } else {
                SpecStateVariable(type, true, initial, writable, min = min, max = max)
            }
        }
        BlueprintStateDeclarationType.ENUM -> {
            val values = raw.values
            // The decoder skips limits; refuse what the schema would.
            if (values == null || values.isEmpty() || values.size > 32 || values.any { it.isEmpty() || it.codePointLength() > 64 }) {
                return refuse(path, "\"$name\" needs 1–32 values of 1–64 characters.")
            }
            if (values.toSet().size != values.size) return refuse("$path.values", "\"$name\" values must be distinct.")
            val initial = raw.initial ?: JsonValue.Str(values[0])
            if (initial !is JsonValue.Str || initial.value !in values) {
                refuse("$path.initial", "\"$name\" initial must be one of its values.")
            } else {
                SpecStateVariable(type, true, initial, writable, values = values)
            }
        }
        BlueprintStateDeclarationType.STRING -> {
            val maxLength = raw.maxLength ?: SpecContract.DEFAULT_STRING_LENGTH.toLong()
            if (maxLength !in 1L..SpecContract.STRING_LENGTH.toLong()) return refuse("$path.maxLength", "maxLength must be 1–1000.")
            val initial = raw.initial ?: JsonValue.Str("")
            if (initial !is JsonValue.Str || initial.value.length > maxLength) {
                refuse("$path.initial", "\"$name\" initial must be a string of at most $maxLength.")
            } else {
                SpecStateVariable(type, true, initial, writable, maxLength = maxLength.toInt())
            }
        }
        BlueprintStateDeclarationType.LIST -> {
            val maxItems = raw.maxItems ?: SpecContract.LIST_ITEMS.toLong()
            if (maxItems !in 0L..SpecContract.LIST_ITEMS.toLong()) return refuse("$path.maxItems", "maxItems must be 0–500.")
            val initial = raw.initial ?: JsonValue.Arr(emptyList())
            val problem = listProblem(initial, maxItems.toInt())
            if (problem != null) refuse("$path.initial${problem.first}", problem.second)
            else SpecStateVariable(type, true, initial, writable, maxItems = maxItems.toInt())
        }
        BlueprintStateDeclarationType.WORKFLOW -> {
            val initial = raw.initial ?: return refuse(path, "\"$name\" needs an initial workflow graph.")
            val result = validateWorkflowGraph(initial)
            for (d in result.diagnostics) out += d.copy(path = "$path.initial${d.path.drop(1)}")
            SpecStateVariable(type, result.ok, initial, writable)
        }
    }
}

/**
 * A list value: at most `maxItems` items, each `{ id, ...fields }` with a
 * unique item key and at most 16 scalar fields. Returns the relative path
 * and message of the first problem, or null.
 */
fun listProblem(value: JsonValue, maxItems: Int): Pair<String, String>? {
    if (value !is JsonValue.Arr) return "" to "A list value is an array of items."
    if (value.items.size > maxItems) return "" to "At most $maxItems items."
    val ids = HashSet<String>()
    value.items.forEachIndexed { index, item ->
        val at = "[$index]"
        val fields = (item as? JsonValue.Obj)?.fields
        val id = (fields?.get("id") as? JsonValue.Str)?.value
        if (fields == null || id == null || !SpecContract.ITEM_KEY.matches(id)) {
            return at to "An item is an object with an item key \"id\"."
        }
        if (!ids.add(id)) return "$at.id" to "Item \"$id\" appears twice."
        val others = fields.keys.filter { it != "id" }
        if (others.size > SpecContract.LIST_ITEM_FIELDS) return at to "At most ${SpecContract.LIST_ITEM_FIELDS} fields besides \"id\"."
        for (key in others) {
            val field = fields.getValue(key)
            val ok = SpecContract.STATE_NAME.matches(key) && when (field) {
                is JsonValue.Bool -> true
                is JsonValue.Num -> field.value.isFinite()
                is JsonValue.Str -> field.value.length <= SpecContract.STRING_LENGTH
                else -> false
            }
            if (!ok) return "$at.$key" to "Item fields are named scalars (strings of at most 1000)."
            if (field is JsonValue.Str && !SpecContract.LIST_TEXT.matches(field.value)) {
                return "$at.$key" to "Item text cannot hold control, bidirectional or invisible formatting characters."
            }
        }
    }
    return null
}

/** Read the envelope's `flow` (code `state`): distinct views, an initial and transitions between declared views. */
fun checkFlow(flow: BlueprintFlow?, out: MutableList<SpecDiagnostic>): SpecFlowInfo? {
    if (flow == null) return null
    val views = flow.views
    if (views.toSet().size != views.size) {
        out += SpecDiagnostic(SpecDiagnosticCode.STATE, "\$.flow.views", "Flow views must be distinct.")
    }
    if (flow.initial != null && flow.initial !in views) {
        out += SpecDiagnostic(SpecDiagnosticCode.STATE, "\$.flow.initial", "flow.initial must be one of the declared views.")
    }
    val events = LinkedHashSet<String>()
    flow.transitions.forEachIndexed { index, transition ->
        val path = "\$.flow.transitions[$index]"
        if (transition.from != "*" && transition.from !in views) {
            out += SpecDiagnostic(SpecDiagnosticCode.STATE, "$path.from", "from must be a declared view or \"*\".")
        }
        if (transition.to !in views) {
            out += SpecDiagnostic(SpecDiagnosticCode.STATE, "$path.to", "to must be a declared view.")
        }
        events += transition.on
    }
    return SpecFlowInfo(views, events)
}

// ---------------------------------------------------------------------------
// The tree

internal class NodeContext(
    val id: String,
    val state: Map<String, SpecStateVariable>,
    val flow: SpecFlowInfo?,
    val insideForm: Boolean,
    val out: MutableList<SpecDiagnostic>,
    val sources: List<SourceDescriptor>? = null,
) {
    fun withOut(other: MutableList<SpecDiagnostic>) = NodeContext(id, state, flow, insideForm, other, sources)

    fun fail(code: SpecDiagnosticCode, path: String, message: String) {
        out += SpecDiagnostic(code, path, message, id)
    }
}

/** Check one tree against the vocabulary. See [validateBlueprint]. */
fun validateTree(
    tree: BlueprintNode,
    components: List<SpecComponent> = SpecVocabulary.components,
    portable: Boolean = false,
    path: String = "\$",
    state: Map<String, SpecStateVariable> = emptyMap(),
    flow: SpecFlowInfo? = null,
    warnings: MutableList<SpecWarning>? = null,
    sources: List<SourceDescriptor>? = null,
): List<SpecDiagnostic> {
    val byId = components.associateBy { it.id }
    val out = ArrayList<SpecDiagnostic>()
    // Spec 0.7.0 (ADR-014): a node key matches its pattern and is unique in the tree.
    val keys = HashSet<String>()
    fun visit(
        node: BlueprintNode,
        here: String,
        depth: Int,
        parent: SpecComponent?,
        parentKnown: Boolean,
        insideForm: Boolean,
    ) {
        if (depth > MAX_TREE_DEPTH) return
        node.key?.let { key ->
            if (!SpecContract.NODE_KEY.matches(key)) {
                out += SpecDiagnostic(SpecDiagnosticCode.SCHEMA, "$here.key", "pattern: A node key is 1–64 letters, digits or . _ : -.", node.id)
            } else if (!keys.add(key)) {
                out += SpecDiagnostic(SpecDiagnosticCode.DUPLICATE_KEY, "$here.key", "The key \"${key.take(64)}\" is already used in this tree.", node.id)
            }
        }
        checkSlot(node.slot, parent, parentKnown, node.id, here, out)
        val component = byId[node.id]
        if (component == null) {
            out += SpecDiagnostic(SpecDiagnosticCode.UNKNOWN_ID, "$here.id", "\"${node.id}\" is not in the catalog.", node.id)
        } else {
            if (portable && component.capability != SpecComponentCapability.PORTABLE_CORE) {
                out += SpecDiagnostic(
                    SpecDiagnosticCode.UNSUPPORTED_PROFILE,
                    here,
                    "\"${node.id}\" is ${component.capability.wire}, not portable core.",
                    node.id,
                )
            }
            val context = NodeContext(node.id, state, flow, insideForm, out, sources)
            val props = node.props ?: emptyMap()
            val bind = node.bind ?: emptyMap()
            checkProps(props, bind, component, "$here.props", context)
            checkBind(bind, props, component, "$here.bind", context)
            node.on?.let { checkOn(it, component, "$here.on", context) }
            component.deprecated?.let { warnings?.add(deprecation("$here.id", node.id, "\"${node.id}\"", it)) }
            for (prop in component.props) {
                val info = prop.deprecated ?: continue
                val where = when (prop.name) {
                    in props -> "$here.props.${prop.name}"
                    in bind -> "$here.bind.${prop.name}"
                    else -> null
                }
                if (where != null) warnings?.add(deprecation(where, node.id, "\"${prop.name}\"", info))
            }
        }
        val inside = insideForm || node.id == SpecContract.FORM_ID
        node.children?.forEachIndexed { index, child ->
            visit(child, "$here.children[$index]", depth + 1, component, component != null, inside)
        }
    }
    visit(tree, path, 0, parent = null, parentKnown = true, insideForm = false)
    return out
}

private fun deprecation(path: String, id: String, what: String, info: SpecDeprecation): SpecWarning {
    val instead = info.replacement?.let { "; use \"$it\"" } ?: ""
    return SpecWarning(SpecWarningCode.DEPRECATED, path, "$what is deprecated since ${info.since}$instead.", id)
}

/** A child's named slot must be declared by its known parent; children is default. */
private fun checkSlot(
    slot: String?,
    parent: SpecComponent?,
    parentKnown: Boolean,
    id: String,
    path: String,
    out: MutableList<SpecDiagnostic>,
) {
    if (slot == null || slot == "children" || !parentKnown) return
    val declared = parent?.props?.any { it.kind == SpecPropKind.SLOT && it.name == slot } == true
    if (declared) return
    out += SpecDiagnostic(
        SpecDiagnosticCode.UNKNOWN_SLOT,
        "$path.slot",
        if (parent == null) "A root node fills no slot." else "\"$slot\" is not a slot of \"${parent.id}\".",
        id,
    )
}

private fun kindProblem(prop: SpecProp, value: JsonValue): SpecDiagnosticCode? {
    val kindOk = when (prop.kind) {
        SpecPropKind.STRING, SpecPropKind.ENUM -> value is JsonValue.Str
        SpecPropKind.NUMBER -> value is JsonValue.Num && value.value.isFinite()
        SpecPropKind.BOOLEAN -> value is JsonValue.Bool
        SpecPropKind.ARRAY -> value is JsonValue.Arr
        SpecPropKind.OBJECT -> value is JsonValue.Obj
        else -> false
    }
    if (!kindOk) return SpecDiagnosticCode.PROP_TYPE
    if (prop.kind == SpecPropKind.ENUM && (value as JsonValue.Str).value !in prop.enumValues.orEmpty()) {
        return SpecDiagnosticCode.ENUM_VALUE
    }
    return null
}

/** Whether a value reads as a binding: `$state` or `$data` as a key. */
internal fun isBindingShaped(value: JsonValue): Boolean =
    value is JsonValue.Obj &&
        (SpecContract.STATE_BINDING_KEY in value.fields || SpecContract.DATA_BINDING_KEY in value.fields)

/** The binding's key and name when it has exactly one key with a string name. */
internal fun bindingTarget(value: JsonValue.Obj): Pair<String, String>? {
    val entry = value.fields.entries.singleOrNull() ?: return null
    if (entry.key != SpecContract.STATE_BINDING_KEY && entry.key != SpecContract.DATA_BINDING_KEY) return null
    val name = (entry.value as? JsonValue.Str)?.value ?: return null
    return entry.key to name
}

/** Whether `value` is a legal value of `prop` (kind, enum and property schema). */
private fun fits(prop: SpecProp, value: JsonValue?): Boolean {
    if (value == null || kindProblem(prop, value) != null) return false
    val schema = prop.schema
    if (schema != null && (prop.kind == SpecPropKind.ARRAY || prop.kind == SpecPropKind.OBJECT)) {
        return PropSchemaValidator(null).validate(schema, value).isEmpty()
    }
    return true
}

private fun checkProps(
    given: Map<String, JsonValue>,
    bind: Map<String, BlueprintBinding>,
    component: SpecComponent,
    path: String,
    context: NodeContext,
) {
    val id = component.id
    val out = context.out
    val declared = component.props.associateBy { it.name }
    for ((name, value) in given) {
        val here = "$path.$name"
        val prop = declared[name]
        if (prop == null) {
            out += SpecDiagnostic(SpecDiagnosticCode.UNKNOWN_PROP, here, "\"$id\" has no \"$name\" prop.", id)
            continue
        }
        if (prop.extension != null) {
            out += SpecDiagnostic(
                SpecDiagnosticCode.EXTENSION_PROP,
                here,
                "\"$name\" is a ${prop.extension.wire} extension (${prop.kind.wire}) and cannot come from data.",
                id,
            )
            continue
        }
        if (isSourceBinding(value)) {
            checkPropSource(value as JsonValue.Obj, prop, component, here, context)
            continue
        }
        if (isBindingShaped(value)) {
            checkPropBinding(value as JsonValue.Obj, prop, here, context)
            continue
        }
        val composite = prop.kind == SpecPropKind.ARRAY || prop.kind == SpecPropKind.OBJECT
        val schema = prop.schema
        when (kindProblem(prop, value)) {
            SpecDiagnosticCode.PROP_TYPE ->
                out += SpecDiagnostic(SpecDiagnosticCode.PROP_TYPE, here, "\"$name\" must be ${prop.kind.wire}.", id)
            SpecDiagnosticCode.ENUM_VALUE -> out += SpecDiagnostic(
                SpecDiagnosticCode.ENUM_VALUE,
                here,
                "\"$name\" must be one of ${prop.enumValues.orEmpty().joinToString(", ")}.",
                id,
            )
            else -> when {
                schema != null && composite -> checkPropSchemaValue(name, schema, value, here, context)
                composite -> walkOpaque(value, here, 0, context)
                else -> Unit
            }
        }
    }
    for (prop in component.props) {
        if (prop.required == true && prop.extension == null && prop.name !in given && prop.name !in bind) {
            out += SpecDiagnostic(SpecDiagnosticCode.MISSING_REQUIRED, "$path.${prop.name}", "\"$id\" needs \"${prop.name}\".", id)
        }
    }
}

/**
 * A whole prop read from a host data source (spec 0.8.0): a sourceable prop,
 * then the binding's shape and meaning against the host's sources (refused
 * without them), as in TypeScript.
 */
private fun checkPropSource(value: JsonValue.Obj, prop: SpecProp, component: SpecComponent, path: String, context: NodeContext) {
    if (prop.name !in component.sourceable.orEmpty()) {
        context.fail(SpecDiagnosticCode.SOURCE, path, "\"${prop.name}\" of \"${component.id}\" cannot read a data source.")
        return
    }
    val itemFields = prop.schema?.items?.properties?.keys?.toList()
    for (issue in checkSourceBinding(value, context.sources, itemFields)) {
        context.fail(issue.code, "$path${issue.at}", issue.message)
    }
}

/** A whole prop given as a binding: `$state` of a fitting variable, or `$data` for a scalar prop. */
private fun checkPropBinding(value: JsonValue.Obj, prop: SpecProp, path: String, context: NodeContext) {
    val target = bindingTarget(value)
    if (target == null) {
        context.fail(SpecDiagnosticCode.BINDING, path, "A binding is exactly {\"\$state\": name} or {\"\$data\": name}.")
        return
    }
    val (key, name) = target
    if (key == SpecContract.DATA_BINDING_KEY) {
        if (!SpecContract.DATA_NAME.matches(name) || name.length > 64) {
            context.fail(SpecDiagnosticCode.BINDING, path, "\"$name\" is not a host data name.")
        } else if (prop.kind !in setOf(SpecPropKind.STRING, SpecPropKind.NUMBER, SpecPropKind.BOOLEAN, SpecPropKind.ENUM)) {
            context.fail(SpecDiagnosticCode.BINDING, path, "Host data binds only a whole string, number, boolean or enum prop.")
        }
        return
    }
    val variable = context.state[name]
    if (variable == null) {
        context.fail(SpecDiagnosticCode.UNKNOWN_STATE, path, "No state variable named \"$name\".")
    } else if (variable.valid && !fits(prop, variable.initial)) {
        context.fail(SpecDiagnosticCode.BINDING, path, "\"$name\" (${variable.type.wire}) does not fit \"${prop.name}\" (${prop.kind.wire}).")
    }
}

/** Nested bindings inside an array or object prop without a property schema. */
private fun walkOpaque(value: JsonValue, path: String, depth: Int, context: NodeContext) {
    if (depth > SpecContract.PROP_DEPTH) return
    when (value) {
        is JsonValue.Arr -> value.items.forEachIndexed { index, item -> walkOpaque(item, "$path[$index]", depth + 1, context) }
        is JsonValue.Obj -> {
            if (isSourceBinding(value)) {
                context.fail(SpecDiagnosticCode.SOURCE, path, "A data-source binding reads only a whole top-level prop.")
                return
            }
            if (isBindingShaped(value)) {
                nestedBinding(value, path, context, null)
                return
            }
            for ((key, item) in value.fields) walkOpaque(item, "$path.$key", depth + 1, context)
        }
        else -> Unit
    }
}

/** A binding nested in a prop value; `fitsPosition` (when known) judges the variable's value there. */
internal fun nestedBinding(
    value: JsonValue.Obj,
    path: String,
    context: NodeContext,
    fitsPosition: ((JsonValue) -> Boolean)?,
) {
    val target = bindingTarget(value)
    when {
        target == null -> context.fail(SpecDiagnosticCode.BINDING, path, "A binding is exactly {\"\$state\": name} or {\"\$data\": name}.")
        target.first == SpecContract.DATA_BINDING_KEY ->
            context.fail(SpecDiagnosticCode.BINDING, path, "Host data binds only a whole top-level prop.")
        else -> {
            val variable = context.state[target.second]
            if (variable == null) {
                context.fail(SpecDiagnosticCode.UNKNOWN_STATE, path, "No state variable named \"${target.second}\".")
            } else if (fitsPosition != null && variable.valid && variable.initial != null && !fitsPosition(variable.initial)) {
                context.fail(SpecDiagnosticCode.BINDING, path, "\"${target.second}\" (${variable.type.wire}) does not fit this position.")
            }
        }
    }
}

/**
 * An array or object prop with a property schema: its first schema issue is
 * the prop's `prop-type`, then binding, reorder, action and workflow
 * positions add their own diagnostics (as in TypeScript).
 */
private fun checkPropSchemaValue(
    name: String,
    schema: com.texuli.spec.SpecPropSchema,
    value: JsonValue,
    path: String,
    context: NodeContext,
) {
    val extra = ArrayList<SpecDiagnostic>()
    val issues = PropSchemaValidator(context.withOut(extra), path).validate(schema, value)
    val first = issues.firstOrNull()
    if (first != null) {
        context.fail(SpecDiagnosticCode.PROP_TYPE, "$path${first.path.drop(1)}", "\"$name\" does not match its schema: ${first.message}")
    }
    context.out += extra
}

/** `reorder.bind` must be `$state` of a writable list. */
internal fun reorderBinding(bind: BlueprintBinding, path: String, context: NodeContext) {
    val name = bind.state
    if (name == null || bind.data != null) {
        if (bind.data != null) context.fail(SpecDiagnosticCode.BINDING, path, "reorder needs a writable list, not host data.")
        return
    }
    val variable = context.state[name] ?: return
    if (variable.valid && (variable.type != BlueprintStateDeclarationType.LIST || !variable.writable)) {
        context.fail(SpecDiagnosticCode.BINDING, path, "reorder binds a writable list; \"$name\" is not one.")
    }
}

/** `bind`: two-way bindings to bindable props, `$state` only, writable and fitting. */
private fun checkBind(
    bind: Map<String, BlueprintBinding>,
    props: Map<String, JsonValue>,
    component: SpecComponent,
    path: String,
    context: NodeContext,
) {
    val id = component.id
    for ((name, binding) in bind) {
        val here = "$path.$name"
        val prop = component.props.firstOrNull { it.name == name }
        if (prop == null) {
            context.fail(SpecDiagnosticCode.UNKNOWN_PROP, here, "\"$id\" has no \"$name\" prop.")
            continue
        }
        if (name !in component.bindable.orEmpty()) {
            context.fail(SpecDiagnosticCode.BINDING, here, "\"$name\" is not bindable on \"$id\".")
            continue
        }
        if (name in props) {
            context.fail(SpecDiagnosticCode.BINDING, here, "\"$name\" is set both as a prop and as a binding.")
            continue
        }
        val target = binding.state
        if (target == null || binding.data != null) {
            context.fail(SpecDiagnosticCode.BINDING, here, "bind takes exactly {\"\$state\": name}; host data is read-only.")
            continue
        }
        val variable = context.state[target]
        if (variable == null) {
            context.fail(SpecDiagnosticCode.UNKNOWN_STATE, here, "No state variable named \"$target\".")
            continue
        }
        if (!variable.valid) continue
        if (!variable.writable) {
            context.fail(SpecDiagnosticCode.BINDING, here, "\"$target\" is host-bound and read-only.")
        } else if (!fits(prop, variable.initial)) {
            context.fail(SpecDiagnosticCode.BINDING, here, "\"$target\" (${variable.type.wire}) does not fit \"$name\" (${prop.kind.wire}).")
        }
    }
}

/** `on`: events the component declares, each with its closed actions. */
private fun checkOn(
    on: Map<String, List<BlueprintAction>>,
    component: SpecComponent,
    path: String,
    context: NodeContext,
) {
    val events = component.events.orEmpty().map { it.wire }
    for ((event, actions) in on) {
        val here = "$path.$event"
        if (event !in events) {
            context.fail(SpecDiagnosticCode.UNKNOWN_EVENT, here, "\"${component.id}\" fires no \"$event\" event.")
        }
        actions.forEachIndexed { index, action -> checkAction(action, "$here[$index]", event, context) }
    }
}

private fun presentFields(action: BlueprintAction): List<String> = listOfNotNull(
    "state".takeIf { action.state != null },
    "value".takeIf { action.value != null },
    "fromEvent".takeIf { action.fromEvent != null },
    "from".takeIf { action.from != null },
    "to".takeIf { action.to != null },
    "item".takeIf { action.item != null },
    "index".takeIf { action.index != null },
    "event".takeIf { action.event != null },
    "intent".takeIf { action.intent != null },
    "values".takeIf { action.values != null },
)

/**
 * One closed action: the fields its op takes, then its targets. At most one
 * diagnostic per action. `event` is null for an action given as a prop value.
 */
internal fun checkAction(action: BlueprintAction, path: String, event: String?, context: NodeContext) {
    val (allowed, required) = SpecContract.ACTION_FIELDS.getValue(action.op)
    val present = presentFields(action)
    val extra = present.firstOrNull { it !in allowed }
    if (extra != null) {
        context.fail(SpecDiagnosticCode.ACTION, "$path.$extra", "${action.op.wire} takes no \"$extra\".")
        return
    }
    val missing = required.firstOrNull { it !in present }
    if (missing != null) {
        context.fail(SpecDiagnosticCode.ACTION, "$path.$missing", "${action.op.wire} needs \"$missing\".")
        return
    }
    fun variable(key: String, name: String?): SpecStateVariable? {
        if (name == null) return null
        val found = context.state[name]
        if (found == null) {
            context.fail(SpecDiagnosticCode.UNKNOWN_STATE, "$path.$key", "No state variable named \"$name\".")
            return null
        }
        if (!found.valid) return null
        if (!found.writable) {
            context.fail(SpecDiagnosticCode.ACTION, "$path.$key", "\"$name\" is host-bound and read-only.")
            return null
        }
        return found
    }
    when (action.op) {
        BlueprintActionOp.SET_STATE -> {
            val value = action.value
            if ((value != null) == (action.fromEvent != null)) {
                context.fail(SpecDiagnosticCode.ACTION, path, "setState takes exactly one of \"value\" and \"fromEvent\".")
                return
            }
            val target = variable("state", action.state) ?: return
            when {
                target.type == BlueprintStateDeclarationType.LIST || target.type == BlueprintStateDeclarationType.WORKFLOW ->
                    context.fail(SpecDiagnosticCode.ACTION, "$path.state", "setState cannot replace a ${target.type.wire}; use moveItem.")
                value != null && !fitsVariable(target, value) ->
                    context.fail(SpecDiagnosticCode.ACTION, "$path.value", "The value does not fit \"${action.state}\".")
                value == null && event != null && event != "change" && event != "select" ->
                    context.fail(SpecDiagnosticCode.ACTION, "$path.fromEvent", "fromEvent reads the value of a change or select event.")
            }
        }
        BlueprintActionOp.TOGGLE_STATE -> {
            val target = variable("state", action.state)
            if (target != null && target.type != BlueprintStateDeclarationType.BOOLEAN) {
                context.fail(SpecDiagnosticCode.ACTION, "$path.state", "toggleState flips a boolean.")
            }
        }
        BlueprintActionOp.MOVE_ITEM -> {
            for ((key, name) in listOf("from" to action.from, "to" to action.to)) {
                if (name == null) continue
                val target = variable(key, name) ?: return
                if (target.type != BlueprintStateDeclarationType.LIST) {
                    context.fail(SpecDiagnosticCode.ACTION, "$path.$key", "moveItem moves items between lists.")
                    return
                }
            }
        }
        BlueprintActionOp.FLOW_GO -> {
            val flow = context.flow
            if (flow == null) {
                context.fail(SpecDiagnosticCode.ACTION, path, "flowGo needs a declared flow.")
            } else if (action.event !in flow.events) {
                context.fail(SpecDiagnosticCode.ACTION, "$path.event", "No transition handles \"${action.event}\".")
            }
        }
        BlueprintActionOp.EMIT -> checkEmitValues(action.values ?: return, "$path.values", context)
        BlueprintActionOp.SUBMIT -> {
            if (!context.insideForm) {
                context.fail(SpecDiagnosticCode.ACTION, path, "submit runs only inside an ${SpecContract.FORM_ID}.")
            }
        }
    }
}

private fun checkEmitValues(values: Map<String, JsonValue>, path: String, context: NodeContext) {
    if (values.size > SpecContract.EMIT_VALUES) {
        context.fail(SpecDiagnosticCode.ACTION, path, "At most ${SpecContract.EMIT_VALUES} values.")
        return
    }
    for ((name, value) in values) {
        val here = "$path.$name"
        if (!SpecContract.INTENT_NAME.matches(name)) {
            context.fail(SpecDiagnosticCode.ACTION, here, "\"$name\" is not a value name.")
            return
        }
        if (value is JsonValue.Obj) {
            val target = bindingTarget(value)
            if (target == null || target.first != SpecContract.STATE_BINDING_KEY) {
                context.fail(SpecDiagnosticCode.ACTION, here, "An emitted value is a scalar or {\"\$state\": name}.")
                return
            }
            val found = context.state[target.second]
            if (found == null) {
                context.fail(SpecDiagnosticCode.UNKNOWN_STATE, here, "No state variable named \"${target.second}\".")
                return
            }
            if (found.valid && (found.type == BlueprintStateDeclarationType.LIST || found.type == BlueprintStateDeclarationType.WORKFLOW)) {
                context.fail(SpecDiagnosticCode.ACTION, here, "Only scalar variables can be emitted.")
                return
            }
        } else {
            val ok = when (value) {
                is JsonValue.Bool -> true
                is JsonValue.Num -> value.value.isFinite()
                is JsonValue.Str -> value.value.length <= SpecContract.EMIT_VALUE_LENGTH
                else -> false
            }
            if (!ok) {
                context.fail(SpecDiagnosticCode.ACTION, here, "An emitted value is a boolean, a number or a short string.")
                return
            }
        }
    }
}

/** Whether `value` is a legal value of a scalar variable. */
private fun fitsVariable(variable: SpecStateVariable, value: JsonValue): Boolean = when (variable.type) {
    BlueprintStateDeclarationType.BOOLEAN -> value is JsonValue.Bool
    BlueprintStateDeclarationType.NUMBER -> value is JsonValue.Num && value.value.isFinite() &&
        value.value >= (variable.min ?: Double.NEGATIVE_INFINITY) && value.value <= (variable.max ?: Double.POSITIVE_INFINITY)
    BlueprintStateDeclarationType.ENUM -> value is JsonValue.Str && value.value in variable.values.orEmpty()
    BlueprintStateDeclarationType.STRING -> value is JsonValue.Str && value.value.length <= (variable.maxLength ?: 0)
    else -> false
}
