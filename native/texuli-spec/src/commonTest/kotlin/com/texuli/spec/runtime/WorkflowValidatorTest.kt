package com.texuli.spec.runtime

import com.texuli.spec.JsonValue
import com.texuli.spec.SpecDiagnosticCode
import kotlin.test.Test
import kotlin.test.assertEquals

/** The workflow graph rules, mirroring packages/spec/src/workflow.ts and its tests. */
class WorkflowValidatorTest {
    private fun str(value: String) = JsonValue.Str(value)
    private fun num(value: Int) = JsonValue.Num(value.toDouble())
    private fun obj(vararg pairs: Pair<String, JsonValue>) = JsonValue.Obj(linkedMapOf(*pairs))
    private fun arr(items: List<JsonValue>) = JsonValue.Arr(items)

    private fun port(id: String, direction: String, kind: String? = null, multiple: Boolean = true) = obj(
        *listOfNotNull(
            "id" to str(id),
            "direction" to str(direction),
            kind?.let { "kind" to str(it) },
            "multiple" to JsonValue.Bool(multiple),
        ).toTypedArray(),
    )

    private val step = obj(
        "id" to str("step"),
        "label" to str("Step"),
        "ports" to arr(listOf(port("in", "in", "flow"), port("out", "out", "flow"))),
        "fields" to arr(
            listOf(
                obj("name" to str("title"), "kind" to str("string"), "required" to JsonValue.Bool(true), "maxLength" to num(40)),
                obj("name" to str("level"), "kind" to str("enum"), "enumValues" to arr(listOf(str("low"), str("high")))),
            ),
        ),
    )

    private fun node(id: String, type: String = "step", label: String = id, data: JsonValue = obj("title" to str(id))) = obj(
        "id" to str(id),
        "type" to str(type),
        "label" to str(label),
        "position" to obj("x" to num(0), "y" to num(0)),
        "data" to data,
    )

    private fun edge(id: String, from: String, to: String, fromPort: String = "out", toPort: String = "in") = obj(
        "id" to str(id),
        "from" to obj("node" to str(from), "port" to str(fromPort)),
        "to" to obj("node" to str(to), "port" to str(toPort)),
    )

    private fun graph(nodes: List<JsonValue>, edges: List<JsonValue>, cycles: String? = null, types: List<JsonValue> = listOf(step)) = obj(
        *listOfNotNull(
            "version" to num(1),
            "nodeTypes" to arr(types),
            "nodes" to arr(nodes),
            "edges" to arr(edges),
            cycles?.let { "cycles" to str(it) },
        ).toTypedArray(),
    )

    private fun found(json: JsonValue) = validateWorkflowGraph(json).diagnostics.map { "${it.code.wire} ${it.path}" }

    @Test
    fun acceptsAValidGraphAndTheLargestAllowedOne() {
        assertEquals(emptyList(), found(graph(listOf(node("a"), node("b")), listOf(edge("e1", "a", "b")), "forbid")))
        val nodes = (0 until 500).map { node("n$it") }
        val edges = ArrayList<JsonValue>()
        var k = 1
        while (edges.size < 2000) {
            var i = 0
            while (i + k < 500 && edges.size < 2000) {
                edges += edge("e${edges.size}", "n$i", "n${i + k}")
                i++
            }
            k++
        }
        assertEquals(emptyList(), found(graph(nodes, edges, "forbid")))
        assertEquals(listOf("schema \$.nodes"), found(graph(nodes + node("n500"), emptyList())))
    }

    @Test
    fun reportsEachGraphRuleWithItsPath() {
        val cases = listOf(
            "a dangling edge" to graph(listOf(node("a")), listOf(edge("e1", "a", "missing"))) to listOf("workflow \$.edges[0].to.node"),
            "an undeclared type" to graph(listOf(node("a", type = "robot")), emptyList()) to listOf("workflow \$.nodes[0].type"),
            "a forbidden cycle" to graph(listOf(node("a"), node("b")), listOf(edge("e1", "a", "b"), edge("e2", "b", "a")), "forbid") to listOf("workflow \$.edges"),
            "a self-loop" to graph(listOf(node("a")), listOf(edge("e1", "a", "a")), "forbid") to listOf("workflow \$.edges"),
            "a cycle that is allowed" to graph(listOf(node("a"), node("b")), listOf(edge("e1", "a", "b"), edge("e2", "b", "a"))) to emptyList(),
            "a wrong direction" to graph(listOf(node("a"), node("b")), listOf(edge("e1", "a", "b", fromPort = "in"))) to listOf("workflow \$.edges[0].from.port"),
            "a duplicate connection" to graph(listOf(node("a"), node("b")), listOf(edge("e1", "a", "b"), edge("e2", "a", "b"))) to listOf("workflow \$.edges[1]"),
            "a duplicate node" to graph(listOf(node("a"), node("a")), emptyList()) to listOf("workflow \$.nodes[1].id"),
            "a missing required field" to graph(listOf(node("a", data = obj())), emptyList()) to listOf("workflow \$.nodes[0].data.title"),
            "an enum value outside the field" to graph(listOf(node("a", data = obj("title" to str("A"), "level" to str("max")))), emptyList()) to listOf("workflow \$.nodes[0].data.level"),
            "an undeclared field" to graph(listOf(node("a", data = obj("title" to str("A"), "owner" to str("x")))), emptyList()) to listOf("workflow \$.nodes[0].data.owner"),
            "a bidi override in a label" to graph(listOf(node("a", label = "Pay \u202Eeulav")), emptyList()) to listOf("schema \$.nodes[0].label"),
            "a control character in a label" to graph(listOf(node("a", label = "line\nbreak")), emptyList()) to listOf("schema \$.nodes[0].label"),
            "an unknown field" to obj("version" to num(1), "nodeTypes" to arr(listOf(step)), "nodes" to arr(emptyList()), "edges" to arr(emptyList()), "code" to str("1")) to listOf("schema \$.code"),
        )
        for ((case, expected) in cases) {
            val (label, json) = case
            assertEquals(expected, found(json), label)
        }
    }

    @Test
    fun enforcesPortMultiplicityAndKinds() {
        val single = obj(
            "id" to str("gate"),
            "label" to str("Gate"),
            "ports" to arr(listOf(port("in", "in", "flow", multiple = false), port("feed", "in", "data"))),
        )
        val json = graph(
            listOf(node("a"), node("b"), node("g", type = "gate", data = obj())),
            listOf(edge("e1", "a", "g"), edge("e2", "b", "g"), edge("e3", "a", "g", toPort = "feed")),
            types = listOf(step, single),
        )
        assertEquals(listOf("workflow \$.edges[1].to.port", "workflow \$.edges[2]"), found(json))
        assertEquals(SpecDiagnosticCode.WORKFLOW, validateWorkflowGraph(json).diagnostics.first().code)
    }
}
