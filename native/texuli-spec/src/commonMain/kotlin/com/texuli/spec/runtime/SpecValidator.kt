package com.texuli.spec.runtime

import com.texuli.spec.BlueprintEnvelope
import com.texuli.spec.BlueprintNode
import com.texuli.spec.BlueprintProfile
import com.texuli.spec.JsonValue
import com.texuli.spec.SpecComponent
import com.texuli.spec.SpecComponentCapability
import com.texuli.spec.SpecDiagnostic
import com.texuli.spec.SpecDiagnosticCode
import com.texuli.spec.SpecPropKind
import com.texuli.spec.SpecValidation
import com.texuli.spec.SpecVocabulary

private const val MAX_TREE_DEPTH = 64

/**
 * The target-neutral blueprint check, the Kotlin twin of `validateBlueprint`
 * in `@texuli/spec`: closed ids, closed prop names, prop kinds and enum
 * values, required props, no platform-extension props from data, the portable
 * profile failing closed, and an optional catalog binding. Envelope shape
 * errors are the generated decoder's (`SpecDecodeException`, code `schema`).
 */
fun validateBlueprint(
    envelope: BlueprintEnvelope,
    components: List<SpecComponent> = SpecVocabulary.components,
    catalogHash: String? = null,
): SpecValidation {
    val out = ArrayList<SpecDiagnostic>()
    if (catalogHash != null && envelope.catalog != catalogHash) {
        out += SpecDiagnostic(SpecDiagnosticCode.CATALOG_MISMATCH, "\$.catalog", "The blueprint is bound to another catalog.")
    }
    out += validateTree(envelope.tree, components, envelope.profile == BlueprintProfile.PORTABLE, "\$.tree")
    return SpecValidation(ok = out.isEmpty(), diagnostics = out)
}

/** Check one tree against the vocabulary. */
fun validateTree(
    tree: BlueprintNode,
    components: List<SpecComponent> = SpecVocabulary.components,
    portable: Boolean = false,
    path: String = "\$",
): List<SpecDiagnostic> {
    val byId = components.associateBy { it.id }
    val out = ArrayList<SpecDiagnostic>()
    fun visit(
        node: BlueprintNode,
        here: String,
        depth: Int,
        parent: SpecComponent?,
        parentKnown: Boolean,
    ) {
        if (depth > MAX_TREE_DEPTH) return
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
            checkProps(node.props ?: emptyMap(), component, "$here.props", out)
        }
        node.children?.forEachIndexed { index, child ->
            visit(child, "$here.children[$index]", depth + 1, component, component != null)
        }
    }
    visit(tree, path, 0, parent = null, parentKnown = true)
    return out
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

private fun checkProps(given: Map<String, JsonValue>, component: SpecComponent, path: String, out: MutableList<SpecDiagnostic>) {
    val id = component.id
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
        val kindOk = when (prop.kind) {
            SpecPropKind.STRING, SpecPropKind.ENUM -> value is JsonValue.Str
            SpecPropKind.NUMBER -> value is JsonValue.Num && value.value.isFinite()
            SpecPropKind.BOOLEAN -> value is JsonValue.Bool
            SpecPropKind.ARRAY -> value is JsonValue.Arr
            SpecPropKind.OBJECT -> value is JsonValue.Obj
            else -> false
        }
        if (!kindOk) {
            out += SpecDiagnostic(SpecDiagnosticCode.PROP_TYPE, here, "\"$name\" must be ${prop.kind.wire}.", id)
        } else if (prop.kind == SpecPropKind.ENUM && (value as JsonValue.Str).value !in prop.enumValues.orEmpty()) {
            out += SpecDiagnostic(
                SpecDiagnosticCode.ENUM_VALUE,
                here,
                "\"$name\" must be one of ${prop.enumValues.orEmpty().joinToString(", ")}.",
                id,
            )
        }
    }
    for (prop in component.props) {
        if (prop.required == true && prop.extension == null && prop.name !in given) {
            out += SpecDiagnostic(SpecDiagnosticCode.MISSING_REQUIRED, "$path.${prop.name}", "\"$id\" needs \"${prop.name}\".", id)
        }
    }
}
