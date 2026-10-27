package com.texuli.spec.runtime

import com.texuli.spec.BlueprintEnvelope
import com.texuli.spec.BlueprintNode
import com.texuli.spec.JsonValue
import com.texuli.spec.SpecComponent
import com.texuli.spec.SpecComponentCapability
import com.texuli.spec.SpecComponentPlacement
import com.texuli.spec.SpecDeprecation
import com.texuli.spec.SpecDiagnosticCode
import com.texuli.spec.SpecEventName
import com.texuli.spec.SpecPropKind
import com.texuli.spec.SpecProp
import com.texuli.spec.SpecPropSchema
import com.texuli.spec.SpecPropSchemaType
import com.texuli.spec.SpecWarningCode
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

class SpecValidatorTest {
    private fun component(
        id: String,
        props: List<SpecProp> = emptyList(),
        events: List<SpecEventName>? = null,
        bindable: List<String>? = null,
        deprecated: SpecDeprecation? = null,
    ) = SpecComponent(
        id = id,
        label = id,
        summary = id,
        group = "test",
        placement = SpecComponentPlacement.CONTENT,
        emit = emptyList(),
        capability = SpecComponentCapability.UNKNOWN,
        props = props,
        events = events,
        bindable = bindable,
        deprecated = deprecated,
    )

    private fun text(markdown: String) = BlueprintNode(
        id = "blocks-text",
        props = mapOf("block" to JsonValue.Obj(mapOf("type" to JsonValue.Str("text"), "markdown" to JsonValue.Str(markdown)))),
    )

    @Test
    fun acceptsAValidTree() {
        val tree = BlueprintNode(id = "layout-doc", props = mapOf("title" to JsonValue.Str("Week 42")), children = listOf(text("Shipped.")))
        assertEquals(emptyList(), validateTree(tree))
    }

    @Test
    fun reportsTheSameCodesAsTheTypeScriptValidator() {
        val tree = BlueprintNode(
            id = "layout-doc",
            props = mapOf("title" to JsonValue.Num(1.0), "colour" to JsonValue.Str("red")),
            children = listOf(BlueprintNode(id = "marquee"), BlueprintNode(id = "blocks-text")),
        )
        val codes = validateTree(tree).map { it.code }
        assertEquals(
            listOf(
                SpecDiagnosticCode.PROP_TYPE,
                SpecDiagnosticCode.UNKNOWN_PROP,
                SpecDiagnosticCode.UNKNOWN_ID,
                SpecDiagnosticCode.MISSING_REQUIRED,
            ),
            codes,
        )
    }

    @Test
    fun failsThePortableProfileClosed() {
        val diagnostics = validateTree(text("x"), portable = true)
        assertTrue(diagnostics.all { it.code == SpecDiagnosticCode.UNSUPPORTED_PROFILE })
        assertEquals(1, diagnostics.size)
    }

    @Test
    fun rejectsAnUndeclaredChildSlotAndAllowsADeclaredSlot() {
        val declaredSlot = "header"
        val child = BlueprintNode(id = "child", slot = declaredSlot)
        val components = listOf(
            component("plain-parent"),
            component("slot-parent", listOf(SpecProp(name = declaredSlot, kind = SpecPropKind.SLOT))),
            component("child"),
        )

        assertEquals(
            listOf(SpecDiagnosticCode.UNKNOWN_SLOT),
            validateTree(BlueprintNode(id = "plain-parent", children = listOf(child)), components).map { it.code },
        )
        assertTrue(validateTree(BlueprintNode(id = "slot-parent", children = listOf(child)), components).isEmpty())
    }

    @Test
    fun doesNotJudgeAChildSlotWhenItsParentIdIsUnknown() {
        val tree = BlueprintNode(id = "unknown-parent", children = listOf(BlueprintNode(id = "child", slot = "hero")))
        assertEquals(
            listOf(SpecDiagnosticCode.UNKNOWN_ID),
            validateTree(tree, components = listOf(component("child"))).map { it.code },
        )
    }

    // ---------------------------------------------------------------------
    // Spec 0.3.0: state, flow, bindings, bind, on and property schemas,
    // mirroring packages/spec/tests/contract.test.ts.

    private val board = listOf(
        component(
            "test-board",
            props = listOf(
                SpecProp(name = "choice", kind = SpecPropKind.ENUM, enumValues = listOf("a", "b")),
                SpecProp(
                    name = "columns",
                    kind = SpecPropKind.ARRAY,
                    schema = SpecPropSchema(
                        type = SpecPropSchemaType.ARRAY,
                        maxItems = 8,
                        items = SpecPropSchema(
                            type = SpecPropSchemaType.OBJECT,
                            properties = mapOf(
                                "id" to SpecPropSchema(type = SpecPropSchemaType.STRING, maxLength = 64),
                                "title" to SpecPropSchema(type = SpecPropSchemaType.STRING),
                                "cards" to SpecPropSchema(ref = "#/\$defs/reorder"),
                            ),
                            required = listOf("id", "title", "cards"),
                        ),
                    ),
                ),
                SpecProp(name = "graph", kind = SpecPropKind.OBJECT, schema = SpecPropSchema(ref = "#/\$defs/workflowGraph")),
                SpecProp(name = "meta", kind = SpecPropKind.OBJECT),
                SpecProp(name = "open", kind = SpecPropKind.BOOLEAN),
                SpecProp(name = "title", kind = SpecPropKind.STRING),
            ),
            events = listOf(SpecEventName.CHANGE, SpecEventName.MOVE, SpecEventName.PRESS, SpecEventName.SELECT),
            bindable = listOf("choice", "open", "title"),
        ),
        component("action-form"),
        component("test-button", listOf(SpecProp(name = "label", kind = SpecPropKind.STRING, required = true)), events = listOf(SpecEventName.PRESS)),
        component("test-old", listOf(SpecProp(name = "note", kind = SpecPropKind.STRING, deprecated = SpecDeprecation(since = "0.3.0"))), deprecated = SpecDeprecation(since = "0.3.0")),
    )

    /** `@` stands for `$` so the JSON reads plainly inside a Kotlin raw string. */
    private val stateful = parseJson(
        """
        {"format": "texuli-blueprint", "version": 1, "id": "board-1", "spec": "0.3.0",
         "catalog": "48d6231182dcdb62ed2c8816ff3f620ae9b9683612403dc7e3db00ad85ad893a",
         "status": "draft", "createdAt": "2026-10-24T09:00:00Z", "updatedAt": "2026-10-24T09:00:00Z",
         "generator": {"kind": "agent", "name": "Harbor assistant"},
         "state": {
           "open": {"type": "boolean"},
           "count": {"type": "number", "min": 0, "max": 10, "initial": 2},
           "tab": {"type": "enum", "values": ["a", "b"]},
           "title": {"type": "string", "maxLength": 80, "initial": "Board"},
           "todo": {"type": "list", "initial": [{"id": "t1", "title": "Write"}, {"id": "t2", "done": false}]},
           "doneList": {"type": "list", "maxItems": 10},
           "feed": {"type": "string", "source": "tickets.title"}
         },
         "flow": {"views": ["edit", "review"], "transitions": [{"from": "edit", "to": "review", "on": "next"}]},
         "tree": {
           "id": "test-board",
           "props": {
             "title": {"@state": "title"},
             "columns": [
               {"id": "c1", "title": "Todo", "cards": {"bind": {"@state": "todo"}, "group": "cards", "locked": ["t1"]}},
               {"id": "c2", "title": "Done", "cards": {"bind": {"@state": "doneList"}, "group": "cards"}}
             ],
             "graph": {"version": 1,
               "nodeTypes": [{"id": "step", "label": "Step", "ports": [{"id": "in", "direction": "in"}, {"id": "out", "direction": "out", "multiple": true}]}],
               "nodes": [{"id": "a", "type": "step", "label": "A", "position": {"x": 0, "y": 0}},
                         {"id": "b", "type": "step", "label": "B", "position": {"x": 200, "y": 0}}],
               "edges": [{"id": "e1", "from": {"node": "a", "port": "out"}, "to": {"node": "b", "port": "in"}}]},
             "meta": {"owner": {"@state": "feed"}}
           },
           "bind": {"open": {"@state": "open"}, "choice": {"@state": "tab"}},
           "on": {
             "move": [{"op": "moveItem", "from": "todo", "to": "doneList", "item": "t2", "index": 0}],
             "change": [{"op": "setState", "state": "count", "fromEvent": "value"}],
             "press": [{"op": "toggleState", "state": "open"}, {"op": "flowGo", "event": "next"},
                       {"op": "emit", "intent": "board-saved", "values": {"count": {"@state": "count"}, "ok": true}}],
             "select": [{"op": "setState", "state": "tab", "value": "b"}]
           },
           "children": [{"id": "action-form", "children": [
             {"id": "test-button", "props": {"label": "Save"}, "on": {"press": [{"op": "submit"}]}}]}]
         }}
        """.trimIndent().replace('@', '$'),
    )

    /** A copy of [json] with the value at [path] replaced (or removed when [value] is null). */
    private fun edit(json: JsonValue, path: List<Any>, value: JsonValue?): JsonValue {
        if (path.isEmpty()) return value ?: JsonValue.Null
        val head = path.first()
        return when (json) {
            is JsonValue.Obj -> {
                val fields = LinkedHashMap(json.fields)
                val key = head as String
                if (path.size == 1 && value == null) fields.remove(key)
                else fields[key] = edit(fields[key] ?: JsonValue.Obj(emptyMap()), path.drop(1), value)
                JsonValue.Obj(fields)
            }
            is JsonValue.Arr -> {
                val items = json.items.toMutableList()
                items[head as Int] = edit(items[head], path.drop(1), value)
                JsonValue.Arr(items)
            }
            else -> error("cannot edit through $json")
        }
    }

    private fun obj(vararg pairs: Pair<String, JsonValue>) = JsonValue.Obj(linkedMapOf(*pairs))
    private fun str(value: String) = JsonValue.Str(value)
    private fun state(name: String) = obj("\$state" to str(name))

    private fun found(json: JsonValue) =
        validateBlueprint(BlueprintEnvelope.decode(json), board).diagnostics.map { "${it.code.wire} ${it.path}" }

    @Test
    fun acceptsAStatefulEnvelopeWithBindingsActionsAndSchemas() {
        assertEquals(emptyList(), found(stateful))
        assertEquals(emptyList(), found(edit(stateful, listOf("tree", "props", "title"), obj("\$data" to str("tickets.title")))))
    }

    @Test
    fun reportsTheSameCodesAndPathsAsTheTypeScriptContract() {
        val tree = listOf("tree")
        val cases: List<Triple<String, Pair<List<Any>, JsonValue?>, List<String>>> = listOf(
            Triple("repeated enum values", listOf("state", "tab") to obj("type" to str("enum"), "values" to JsonValue.Arr(listOf(str("a"), str("a")))), listOf("state \$.state.tab.values")),
            Triple("a bad state name", listOf("state", "Bad") to obj("type" to str("boolean")), listOf("state \$.state.Bad")),
            Triple("a host-bound list", listOf("state", "doneList") to obj("type" to str("list"), "source" to str("x")), listOf("state \$.state.doneList.source")),
            Triple("an undeclared variable", tree + listOf("props", "title") to state("nope"), listOf("unknown-state \$.tree.props.title")),
            Triple("two binding keys", tree + listOf("props", "title") to obj("\$state" to str("title"), "\$data" to str("x")), listOf("binding \$.tree.props.title")),
            Triple("a variable of another type", tree + listOf("props", "title") to state("count"), listOf("binding \$.tree.props.title")),
            Triple("nested host data", tree + listOf("props", "meta") to obj("a" to obj("\$data" to str("x"))), listOf("binding \$.tree.props.meta.a")),
            Triple("reorder bound to a number", tree + listOf("props", "columns", 0, "cards", "bind") to state("count"), listOf("binding \$.tree.props.columns[0].cards.bind")),
            Triple("reorder bound to an undeclared list", tree + listOf("props", "columns", 0, "cards", "bind") to state("nope"), listOf("unknown-state \$.tree.props.columns[0].cards.bind")),
            Triple("a column without a title", tree + listOf("props", "columns", 0, "title") to null, listOf("prop-type \$.tree.props.columns[0].title")),
            Triple("bind on a prop that is not bindable", tree + listOf("bind", "columns") to state("todo"), listOf("binding \$.tree.bind.columns")),
            Triple("bind and a prop at once", tree + listOf("bind", "title") to state("title"), listOf("binding \$.tree.bind.title")),
            Triple("an event the component lacks", tree + listOf("on", "dismiss") to JsonValue.Arr(listOf(obj("op" to str("toggleState"), "state" to str("open")))), listOf("unknown-event \$.tree.on.dismiss")),
            Triple("setState out of range", tree + listOf("on", "select", 0, "value") to JsonValue.Num(11.0), listOf("action \$.tree.on.select[0].value")),
            Triple("moveItem from nowhere", tree + listOf("on", "move", 0, "from") to str("nope"), listOf("unknown-state \$.tree.on.move[0].from")),
            Triple("flowGo on an unhandled event", tree + listOf("on", "press", 1, "event") to str("skip"), listOf("action \$.tree.on.press[1].event")),
            Triple("emit a list", tree + listOf("on", "press", 2, "values", "count") to state("todo"), listOf("action \$.tree.on.press[2].values.count")),
            Triple("submit outside a form", tree + listOf("on", "press", 0) to obj("op" to str("submit")), listOf("action \$.tree.on.press[0]")),
            Triple("a dangling workflow edge", tree + listOf("props", "graph", "edges", 0, "to", "node") to str("ghost"), listOf("workflow \$.tree.props.graph.edges[0].to.node")),
        )
        for ((label, change, expected) in cases) {
            assertEquals(expected, found(edit(stateful, change.first, change.second)), label)
        }
    }

    @Test
    fun warnsOnDeprecatedComponentsAndPropsWithoutFailing() {
        val tree = BlueprintNode(id = "test-old", props = mapOf("note" to JsonValue.Str("x")))
        val warnings = ArrayList<com.texuli.spec.SpecWarning>()
        assertTrue(validateTree(tree, board, warnings = warnings).isEmpty())
        assertEquals(listOf(SpecWarningCode.DEPRECATED, SpecWarningCode.DEPRECATED), warnings.map { it.code })
        assertEquals(listOf("\$.id", "\$.props.note"), warnings.map { it.path })
    }
}
