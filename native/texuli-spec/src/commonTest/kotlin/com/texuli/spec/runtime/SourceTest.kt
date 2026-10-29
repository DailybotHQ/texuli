package com.texuli.spec.runtime

import com.texuli.spec.BlueprintNode
import com.texuli.spec.JsonValue
import com.texuli.spec.SpecDiagnosticCode
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertTrue

/**
 * Spec 0.8.0 parity (ADR-012, ADR-015): data-source bindings are judged as
 * `validateBlueprint` judges them in TypeScript: a sourceable prop, the
 * closed shape, then the host's sources, refused without them. The native
 * renderer paints a bound node as an `unsupported-source` placeholder.
 */
class SourceTest {
    private fun str(value: String) = JsonValue.Str(value)
    private fun num(value: Double) = JsonValue.Num(value)
    private fun arr(vararg items: JsonValue) = JsonValue.Arr(items.toList())
    private fun obj(vararg pairs: Pair<String, JsonValue>) = JsonValue.Obj(mapOf(*pairs))

    private val sources = listOf(
        SourceDescriptor(
            name = "tickets",
            key = "id",
            fields = listOf(
                SourceField("id", "text"),
                SourceField("title", "text", filter = listOf("eq", "neq", "contains", "in", "isEmpty", "isNotEmpty"), sort = true, editable = true),
                SourceField("status", "enum", options = listOf("open", "doing", "done"), filter = listOf("eq", "neq", "in"), sort = true),
                SourceField("points", "number", filter = listOf("eq", "between"), sort = true),
                SourceField("due", "date", filter = listOf("before", "after")),
                SourceField("assignee", "text", filter = listOf("eq")),
            ),
            operations = listOf("list", "update", "search"),
            maxPageSize = 100,
        ),
    )

    private fun grid(rows: JsonValue) = BlueprintNode(
        id = "data-grid",
        props = mapOf(
            "caption" to str("Tickets"),
            "columns" to arr(obj("id" to str("title"), "header" to str("Title"))),
            "rows" to rows,
        ),
    )

    private fun codes(rows: JsonValue, withSources: Boolean = true) =
        validateTree(grid(rows), sources = if (withSources) sources else null).map { it.code }

    private fun condition(field: String, operator: String, value: JsonValue? = null) = obj(
        *listOfNotNull("type" to str("condition"), "field" to str(field), "operator" to str(operator), value?.let { "value" to it }).toTypedArray(),
    )

    @Test
    fun acceptsAValidBindingAndFailsClosedWithoutSources() {
        val binding = obj(
            "\$source" to str("tickets"),
            "query" to obj(
                "fields" to arr(str("title"), str("status")),
                "filter" to obj("type" to str("group"), "op" to str("and"), "children" to arr(condition("status", "in", arr(str("open"))), condition("points", "between", arr(num(1.0), num(5.0))))),
                "sort" to arr(obj("field" to str("points"), "direction" to str("desc"))),
                "search" to str("printer"),
                "pageSize" to num(25.0),
            ),
            "map" to obj("cells" to str("title")),
        )
        assertEquals(emptyList(), codes(binding))
        assertEquals(listOf(SpecDiagnosticCode.SOURCE), codes(binding, withSources = false))
    }

    @Test
    fun refusesWhatTheTypeScriptValidatorRefuses() {
        val cases = listOf(
            obj("\$source" to str("payments")) to SpecDiagnosticCode.UNKNOWN_SOURCE,
            obj("\$source" to str("https://attacker.example/rows")) to SpecDiagnosticCode.SOURCE,
            obj("\$source" to str("tickets"), "endpoint" to str("/api")) to SpecDiagnosticCode.SOURCE,
            obj("\$source" to str("tickets"), "query" to obj("pageSize" to num(101.0))) to SpecDiagnosticCode.SOURCE,
            obj("\$source" to str("tickets"), "query" to obj("pageSize" to num(2.5))) to SpecDiagnosticCode.SOURCE,
            obj("\$source" to str("tickets"), "query" to obj("fields" to arr(str("ssn")))) to SpecDiagnosticCode.SOURCE,
            obj("\$source" to str("tickets"), "query" to obj("sort" to arr(obj("field" to str("assignee"))))) to SpecDiagnosticCode.SOURCE,
            obj("\$source" to str("tickets"), "query" to obj("filter" to condition("assignee", "contains", str("a")))) to SpecDiagnosticCode.SOURCE,
            obj("\$source" to str("tickets"), "query" to obj("filter" to condition("status", "eq", str("lost")))) to SpecDiagnosticCode.SOURCE,
            obj("\$source" to str("tickets"), "query" to obj("filter" to condition("due", "before", str("tomorrow")))) to SpecDiagnosticCode.SOURCE,
            obj("\$source" to str("tickets"), "map" to obj("avatarUrl" to str("title"))) to SpecDiagnosticCode.SOURCE,
            obj("\$source" to str("tickets"), "\$state" to str("rows")) to SpecDiagnosticCode.SOURCE,
        )
        for ((binding, code) in cases) assertEquals(listOf(code), codes(binding), binding.toString())
        // Injection-looking text is a value like any other: legal where the field allows it.
        val injection = obj("\$source" to str("tickets"), "query" to obj("filter" to condition("title", "eq", str("'; DROP TABLE tickets; --"))))
        assertEquals(emptyList(), codes(injection))
    }

    @Test
    fun refusesBindingsOutsideAWholeSourceableProp() {
        val columns = BlueprintNode(
            id = "data-grid",
            props = mapOf("caption" to str("x"), "columns" to obj("\$source" to str("tickets")), "rows" to arr()),
        )
        assertEquals(listOf(SpecDiagnosticCode.SOURCE), validateTree(columns, sources = sources).map { it.code })
        val nested = arr(obj("id" to str("a"), "cells" to obj("\$source" to str("tickets"))))
        assertEquals(listOf(SpecDiagnosticCode.SOURCE), codes(nested))
    }

    @Test
    fun refusesADeepFilterWithoutRecursingIntoIt() {
        var filter: JsonValue = condition("title", "eq", str("x"))
        repeat(10_000) { filter = obj("type" to str("group"), "op" to str("and"), "children" to arr(filter)) }
        assertEquals(listOf(SpecDiagnosticCode.SOURCE), codes(obj("\$source" to str("tickets"), "query" to obj("filter" to filter))))
    }

    @Test
    fun decodesHostDescriptorsAndMarksBoundPlanNodes() {
        val decoded = decodeSourceDescriptors(
            obj("sources" to arr(obj("name" to str("tickets"), "key" to str("id"), "operations" to arr(str("list")), "maxPageSize" to num(50.0), "fields" to arr(obj("name" to str("id"), "type" to str("text")))))),
        )
        assertEquals(listOf("tickets"), decoded.map { it.name })
        assertEquals(50, decoded.single().maxPageSize)
        val plan = planOf(grid(obj("\$source" to str("tickets")))) as PlanNode.Component
        assertTrue(plan.readsDataSource())
        assertFalse((planOf(grid(arr())) as PlanNode.Component).readsDataSource())
    }
}
