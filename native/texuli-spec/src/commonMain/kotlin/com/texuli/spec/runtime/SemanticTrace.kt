package com.texuli.spec.runtime

import com.texuli.spec.JsonValue

/**
 * One node of the canonical semantic trace (design §7.2): the component id,
 * its role, accessible name and heading level, and its children. Web and
 * native traces of the same golden must be equal; this is not a pixel test.
 */
data class TraceNode(
    val id: String,
    val role: String,
    val name: String? = null,
    val level: Long? = null,
    val children: List<TraceNode> = emptyList(),
) {
    /** The trace as JSON, in the shape the web target writes. */
    fun toJson(): JsonValue {
        val fields = LinkedHashMap<String, JsonValue>()
        fields["id"] = JsonValue.Str(id)
        fields["role"] = JsonValue.Str(role)
        if (name != null) fields["name"] = JsonValue.Str(name)
        if (level != null) fields["level"] = JsonValue.Num(level.toDouble())
        if (children.isNotEmpty()) fields["children"] = JsonValue.Arr(children.map { it.toJson() })
        return JsonValue.Obj(fields)
    }
}

/** The semantic trace of a render plan, under [SemanticRules] (generated from semantics.json). */
fun traceOf(plan: List<PlanNode>): List<TraceNode> = plan.map(::traceNode)

private fun ruleFor(id: String, block: Map<String, JsonValue>?): SemanticRule {
    val type = (block?.get("type") as? JsonValue.Str)?.value
    if (type != null) SemanticRules.blocks[type]?.let { return it }
    for ((key, rule) in SemanticRules.components) {
        val matches = when {
            key.startsWith("id:") -> id == key.removePrefix("id:")
            key.startsWith("prefix:") -> id.startsWith(key.removePrefix("prefix:"))
            else -> false
        }
        if (matches) return rule
    }
    return SemanticRules.default
}

private fun traceNode(node: PlanNode): TraceNode = when (node) {
    is PlanNode.Placeholder -> TraceNode(id = node.id, role = "placeholder", name = node.reason)
    is PlanNode.Component -> {
        val block = if (node.id.startsWith("blocks-")) (node.props["block"] as? JsonValue.Obj)?.fields else null
        val rule = ruleFor(node.id, block)
        val source = block ?: node.props
        val name = rule.name.firstNotNullOfOrNull { key ->
            (source[key] as? JsonValue.Str)?.value?.takeIf { it.isNotBlank() }
        }
        val level = rule.level?.let { key -> (source[key] as? JsonValue.Num)?.value?.toLong() }
        TraceNode(
            id = node.id,
            role = rule.role,
            name = name,
            level = level,
            children = node.children.map(::traceNode),
        )
    }
}
