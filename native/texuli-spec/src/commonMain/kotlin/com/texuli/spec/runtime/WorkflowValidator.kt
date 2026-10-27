package com.texuli.spec.runtime

import com.texuli.spec.JsonValue
import com.texuli.spec.SpecDecodeException
import com.texuli.spec.SpecDiagnostic
import com.texuli.spec.SpecDiagnosticCode
import com.texuli.spec.SpecValidation
import com.texuli.spec.WorkflowEndpoint
import com.texuli.spec.WorkflowField
import com.texuli.spec.WorkflowFieldKind
import com.texuli.spec.WorkflowGraph
import com.texuli.spec.WorkflowGraphCycles
import com.texuli.spec.WorkflowPortDirection
import com.texuli.spec.WorkflowPosition
import com.texuli.spec.WorkflowSize

/**
 * Workflow graphs as data, the Kotlin twin of `validateWorkflowGraph` in
 * `@texuli/spec`: the generated decoder, then the schema's patterns and
 * limits the decoder skips (500 nodes, 2,000 edges, 64 node types and
 * groups, ids, labels without control or bidirectional characters, ranges),
 * all as code `schema` and never cascading; then the graph rules as code
 * `workflow`, in the TypeScript order. Linear in nodes plus edges.
 */
fun validateWorkflowGraph(json: JsonValue): SpecValidation {
    val graph = try {
        WorkflowGraph.decode(json)
    } catch (error: SpecDecodeException) {
        return SpecValidation(ok = false, diagnostics = listOf(SpecDiagnostic(SpecDiagnosticCode.SCHEMA, error.path, error.message ?: "not a workflow graph")))
    }
    val schema = schemaIssues(graph)
    if (schema.isNotEmpty()) return SpecValidation(ok = false, diagnostics = schema)
    val out = workflowRules(graph)
    return SpecValidation(ok = out.isEmpty(), diagnostics = out)
}

/** The schema's patterns and limits on a decoded graph. */
private fun schemaIssues(graph: WorkflowGraph): List<SpecDiagnostic> {
    val out = ArrayList<SpecDiagnostic>()
    fun fail(path: String, message: String) {
        out += SpecDiagnostic(SpecDiagnosticCode.SCHEMA, path, message)
    }
    fun id(value: String, path: String) {
        if (!SpecContract.WORKFLOW_ID.matches(value)) fail(path, "pattern: not a workflow id.")
    }
    fun label(value: String?, path: String) {
        if (value == null) return
        val length = value.codePointLength()
        if (length < 1 || length > SpecContract.WORKFLOW_LABEL_LENGTH) fail(path, "length: 1–${SpecContract.WORKFLOW_LABEL_LENGTH} characters.")
        if (!SpecContract.WORKFLOW_LABEL.matches(value)) fail(path, "pattern: control or bidirectional characters.")
    }
    fun count(size: Int, min: Int, max: Int, path: String) {
        if (size < min) fail(path, "min-items: at least $min.")
        if (size > max) fail(path, "max-items: at most $max.")
    }
    fun position(value: WorkflowPosition?, path: String) {
        if (value == null) return
        for ((axis, n) in listOf("x" to value.x, "y" to value.y)) {
            if (n < -1_000_000.0 || n > 1_000_000.0) fail("$path.$axis", "range: ±1,000,000.")
        }
    }
    fun size(value: WorkflowSize?, path: String) {
        if (value == null) return
        for ((side, n) in listOf("width" to value.width, "height" to value.height)) {
            if (n < 1.0 || n > 10_000.0) fail("$path.$side", "range: 1–10,000.")
        }
    }
    count(graph.nodeTypes.size, 1, SpecContract.WORKFLOW_NODE_TYPES, "\$.nodeTypes")
    count(graph.nodes.size, 0, SpecContract.WORKFLOW_NODES, "\$.nodes")
    count(graph.edges.size, 0, SpecContract.WORKFLOW_EDGES, "\$.edges")
    graph.groups?.let { count(it.size, 0, SpecContract.WORKFLOW_GROUPS, "\$.groups") }
    if (out.isNotEmpty()) return out
    graph.nodeTypes.forEachIndexed { i, type ->
        val path = "\$.nodeTypes[$i]"
        id(type.id, "$path.id")
        label(type.label, "$path.label")
        label(type.category, "$path.category")
        count(type.ports.size, 0, SpecContract.WORKFLOW_PORTS, "$path.ports")
        type.fields?.let { count(it.size, 0, SpecContract.WORKFLOW_FIELDS, "$path.fields") }
        type.ports.forEachIndexed { j, port ->
            id(port.id, "$path.ports[$j].id")
            label(port.label, "$path.ports[$j].label")
            val kind = port.kind
            if (kind != null && !SpecContract.FLOW_NAME.matches(kind)) fail("$path.ports[$j].kind", "pattern: not a port kind.")
        }
        type.fields?.forEachIndexed { j, field ->
            val here = "$path.fields[$j]"
            if (!SpecContract.WORKFLOW_FIELD_NAME.matches(field.name)) fail("$here.name", "pattern: not a field name.")
            label(field.label, "$here.label")
            field.enumValues?.let { values ->
                count(values.size, 1, 32, "$here.enumValues")
                values.forEachIndexed { k, v -> if (v.isEmpty() || v.codePointLength() > 64) fail("$here.enumValues[$k]", "length: 1–64 characters.") }
            }
            field.maxLength?.let { if (it < 1 || it > SpecContract.WORKFLOW_STRING_LENGTH) fail("$here.maxLength", "range: 1–2000.") }
        }
    }
    graph.nodes.forEachIndexed { i, node ->
        val path = "\$.nodes[$i]"
        id(node.id, "$path.id")
        id(node.type, "$path.type")
        label(node.label, "$path.label")
        position(node.position, "$path.position")
        size(node.size, "$path.size")
        node.group?.let { id(it, "$path.group") }
    }
    graph.edges.forEachIndexed { i, edge ->
        val path = "\$.edges[$i]"
        id(edge.id, "$path.id")
        for ((end, value) in listOf("from" to edge.from, "to" to edge.to)) {
            id(value.node, "$path.$end.node")
            id(value.port, "$path.$end.port")
        }
        label(edge.label, "$path.label")
    }
    graph.groups?.forEachIndexed { i, group ->
        val path = "\$.groups[$i]"
        id(group.id, "$path.id")
        label(group.label, "$path.label")
        position(group.position, "$path.position")
        size(group.size, "$path.size")
    }
    graph.viewport?.let { viewport ->
        position(WorkflowPosition(viewport.x, viewport.y), "\$.viewport")
        if (viewport.zoom < 0.1 || viewport.zoom > 4.0) fail("\$.viewport.zoom", "range: 0.1–4.")
    }
    return out
}

private class PortInfo(val direction: WorkflowPortDirection, val kind: String?, val multiple: Boolean)

private class TypeInfo(val ports: Map<String, PortInfo>, val fields: Map<String, WorkflowField>, val fieldOrder: List<WorkflowField>)

private class End(val node: String, val key: String, val port: PortInfo)

/** The graph rules on a schema-valid graph, in the TypeScript order. */
private fun workflowRules(graph: WorkflowGraph): List<SpecDiagnostic> {
    val out = ArrayList<SpecDiagnostic>()
    fun fail(path: String, message: String) {
        out += SpecDiagnostic(SpecDiagnosticCode.WORKFLOW, path, message)
    }

    val types = HashMap<String, TypeInfo>()
    graph.nodeTypes.forEachIndexed { i, type ->
        val path = "\$.nodeTypes[$i]"
        if (type.id in types) {
            fail("$path.id", "Node type \"${type.id}\" is declared twice.")
            return@forEachIndexed
        }
        val ports = LinkedHashMap<String, PortInfo>()
        type.ports.forEachIndexed { j, port ->
            if (port.id in ports) fail("$path.ports[$j].id", "Port \"${port.id}\" is declared twice.")
            else ports[port.id] = PortInfo(port.direction, port.kind, port.multiple == true)
        }
        val fields = LinkedHashMap<String, WorkflowField>()
        type.fields?.forEachIndexed { j, field ->
            val here = "$path.fields[$j]"
            when {
                field.name in fields -> fail("$here.name", "Field \"${field.name}\" is declared twice.")
                (field.kind == WorkflowFieldKind.ENUM) != (field.enumValues != null) ->
                    fail(here, "enumValues is required for an enum field and only allowed there.")
                field.maxLength != null && field.kind != WorkflowFieldKind.STRING ->
                    fail("$here.maxLength", "maxLength is only allowed on a string field.")
                field.enumValues != null && field.enumValues.toSet().size != field.enumValues.size ->
                    fail("$here.enumValues", "enumValues must be distinct.")
                else -> fields[field.name] = field
            }
        }
        types[type.id] = TypeInfo(ports, fields, fields.values.toList())
    }

    val groups = HashSet<String>()
    graph.groups?.forEachIndexed { i, group ->
        if (!groups.add(group.id)) fail("\$.groups[$i].id", "Group \"${group.id}\" is declared twice.")
    }

    val nodes = LinkedHashMap<String, TypeInfo?>()
    graph.nodes.forEachIndexed { i, node ->
        val path = "\$.nodes[$i]"
        if (node.id in nodes) {
            fail("$path.id", "Node \"${node.id}\" is declared twice.")
            return@forEachIndexed
        }
        val type = types[node.type]
        nodes[node.id] = type
        if (type == null) {
            fail("$path.type", "Node type \"${node.type}\" is not declared.")
            return@forEachIndexed
        }
        if (node.group != null && node.group !in groups) fail("$path.group", "Group \"${node.group}\" is not declared.")
        val data = node.data ?: emptyMap()
        for ((name, value) in data) {
            val field = type.fields[name]
            val here = "$path.data.$name"
            if (field == null) fail(here, "\"$name\" is not a field of \"${node.type}\".")
            else fieldProblem(field, value)?.let { fail(here, it) }
        }
        for (field in type.fieldOrder) {
            if (field.required == true && field.name !in data) fail("$path.data.${field.name}", "\"${field.name}\" is required.")
        }
    }

    val edgeIds = HashSet<String>()
    val pairs = HashSet<String>()
    val used = HashMap<String, Int>()
    val adjacency = LinkedHashMap<String, MutableList<String>>()
    graph.edges.forEachIndexed { i, edge ->
        val path = "\$.edges[$i]"
        if (!edgeIds.add(edge.id)) {
            fail("$path.id", "Edge \"${edge.id}\" is declared twice.")
            return@forEachIndexed
        }
        val from = endpoint(edge.from, WorkflowPortDirection.OUT, "$path.from", nodes, ::fail)
        val to = endpoint(edge.to, WorkflowPortDirection.IN, "$path.to", nodes, ::fail)
        if (from == null || to == null) return@forEachIndexed
        if (from.port.kind != null && to.port.kind != null && from.port.kind != to.port.kind) {
            fail(path, "A \"${from.port.kind}\" port cannot connect to a \"${to.port.kind}\" port.")
            return@forEachIndexed
        }
        if (!pairs.add("${from.key}\u0000${to.key}")) {
            fail(path, "These two ports are already connected.")
            return@forEachIndexed
        }
        for ((end, label) in listOf(from to "from", to to "to")) {
            val count = (used[end.key] ?: 0) + 1
            used[end.key] = count
            if (!end.port.multiple && count > 1) fail("$path.$label.port", "This port takes one edge; set multiple to allow more.")
        }
        adjacency.getOrPut(from.node) { ArrayList() } += to.node
    }

    if (graph.cycles == WorkflowGraphCycles.FORBID && hasCycle(nodes.keys, adjacency)) {
        fail("\$.edges", "The graph has a cycle, and its cycle policy is \"forbid\".")
    }
    return out
}

private fun endpoint(
    value: WorkflowEndpoint,
    direction: WorkflowPortDirection,
    path: String,
    nodes: Map<String, TypeInfo?>,
    fail: (String, String) -> Unit,
): End? {
    if (value.node !in nodes) {
        fail("$path.node", "Node \"${value.node}\" does not exist.")
        return null
    }
    val type = nodes[value.node] ?: return null
    val port = type.ports[value.port]
    if (port == null) {
        fail("$path.port", "Node \"${value.node}\" has no port \"${value.port}\".")
        return null
    }
    if (port.direction != direction) {
        fail("$path.port", "Port \"${value.port}\" is not an ${direction.wire} port.")
        return null
    }
    return End(value.node, "${value.node}\u0000${value.port}", port)
}

/** Why `value` does not fit `field`, or null. */
private fun fieldProblem(field: WorkflowField, value: JsonValue): String? = when (field.kind) {
    WorkflowFieldKind.STRING -> when {
        value !is JsonValue.Str -> "Must be a string."
        value.value.codePointLength() > (field.maxLength ?: SpecContract.WORKFLOW_STRING_LENGTH.toLong()) ->
            "At most ${field.maxLength ?: SpecContract.WORKFLOW_STRING_LENGTH} characters."
        !SpecContract.WORKFLOW_TEXT.matches(value.value) -> "Control and bidirectional characters are not allowed."
        else -> null
    }
    WorkflowFieldKind.NUMBER -> if (value is JsonValue.Num && value.value.isFinite()) null else "Must be a finite number."
    WorkflowFieldKind.BOOLEAN -> if (value is JsonValue.Bool) null else "Must be a boolean."
    WorkflowFieldKind.ENUM ->
        if (value is JsonValue.Str && value.value in field.enumValues.orEmpty()) null else "Must be one of the field's enumValues."
}

/** Kahn's algorithm over node ids; a self-loop is a cycle. */
private fun hasCycle(nodes: Collection<String>, adjacency: Map<String, List<String>>): Boolean {
    val indegree = LinkedHashMap<String, Int>()
    for (id in nodes) indegree[id] = 0
    for (targets in adjacency.values) for (target in targets) indegree[target] = (indegree[target] ?: 0) + 1
    val queue = ArrayDeque(indegree.filterValues { it == 0 }.keys)
    var seen = 0
    while (queue.isNotEmpty()) {
        val id = queue.removeFirst()
        seen++
        for (target in adjacency[id].orEmpty()) {
            val degree = (indegree[target] ?: 0) - 1
            indegree[target] = degree
            if (degree == 0) queue.addLast(target)
        }
    }
    return seen < indegree.size
}
