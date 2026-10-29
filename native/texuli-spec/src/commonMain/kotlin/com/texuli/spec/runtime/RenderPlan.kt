package com.texuli.spec.runtime

import com.texuli.spec.BlueprintEnvelope
import com.texuli.spec.BlueprintNode
import com.texuli.spec.BlueprintNodeMotion
import com.texuli.spec.JsonValue
import com.texuli.spec.SpecComponent
import com.texuli.spec.SpecComponentEmit
import com.texuli.spec.SpecDecodeException
import com.texuli.spec.SpecDiagnostic
import com.texuli.spec.SpecDiagnosticCode
import com.texuli.spec.SpecVocabulary

/** One node of the safe render plan a native target paints. */
sealed interface PlanNode {
    val id: String

    /**
     * A catalog component with its portable props only, and its spec 0.6.0
     * motion (presets and token steps; see [nativeMotionOf]).
     */
    data class Component(
        override val id: String,
        val props: Map<String, JsonValue>,
        val children: List<PlanNode>,
        val motion: BlueprintNodeMotion? = null,
    ) : PlanNode

    /** A visible placeholder: never a blank region, never a crash. */
    data class Placeholder(override val id: String, val reason: String) : PlanNode
}

/** The outcome of loading a blueprint: a plan, or a refusal with diagnostics. */
sealed interface LoadResult {
    data class Ready(val envelope: BlueprintEnvelope, val plan: List<PlanNode>) : LoadResult
    data class Refused(val diagnostics: List<SpecDiagnostic>) : LoadResult
}

/**
 * The native player flow, steps 1 to 3 (design §4): parse and decode into
 * the generated models, validate against the spec, then normalize to a safe
 * render plan. Invalid structure is refused, never repaired or guessed.
 */
fun loadBlueprint(
    text: String,
    components: List<SpecComponent> = SpecVocabulary.components,
    catalogHash: String? = null,
    tier: SpecComponentEmit = SpecComponentEmit.UNTRUSTED,
): LoadResult {
    val envelope = try {
        BlueprintEnvelope.decode(parseJson(text))
    } catch (error: JsonSyntaxException) {
        return LoadResult.Refused(listOf(SpecDiagnostic(SpecDiagnosticCode.SCHEMA, "\$", error.message ?: "not JSON")))
    } catch (error: SpecDecodeException) {
        return LoadResult.Refused(listOf(SpecDiagnostic(SpecDiagnosticCode.SCHEMA, error.path, error.message ?: "not a blueprint")))
    }
    val validation = validateBlueprint(envelope, components, catalogHash)
    if (!validation.ok) return LoadResult.Refused(validation.diagnostics)
    return LoadResult.Ready(envelope, listOf(planOf(envelope.tree, components, tier)))
}

/**
 * Normalize a validated tree: extension props dropped, unknown ids as
 * placeholders, and ids the catalog does not let this tier emit as
 * `tier-denied` placeholders (with their subtree), the same gate and code as
 * the web renderer. The tier is the host's decision, never the envelope's:
 * a blueprint's declared tier is display data, so the default is the stricter
 * `untrusted`. `validateBlueprint` (like its TypeScript twin) checks structure
 * only; tiers are a render-time policy on both targets.
 */
fun planOf(
    node: BlueprintNode,
    components: List<SpecComponent> = SpecVocabulary.components,
    tier: SpecComponentEmit = SpecComponentEmit.UNTRUSTED,
): PlanNode {
    val component = components.firstOrNull { it.id == node.id }
        ?: return PlanNode.Placeholder(node.id, "unknown-id")
    if (tier !in component.emit) return PlanNode.Placeholder(node.id, "tier-denied")
    val portable = component.props.filter { it.extension == null }.map { it.name }.toSet()
    return PlanNode.Component(
        id = node.id,
        props = (node.props ?: emptyMap()).filterKeys { it in portable },
        children = node.children.orEmpty().map { planOf(it, components, tier) },
        motion = node.motion,
    )
}
