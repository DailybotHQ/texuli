package com.texuli.compose

import com.texuli.spec.JsonValue
import com.texuli.spec.runtime.PlanNode

/*
 * Shared test fixtures for the widget suites: JSON builders, blueprint
 * builders and the hostile value matrix (HostilePropsTest). Every widget test
 * builds its props here instead of spelling out JsonValue chains.
 */

internal fun str(value: String) = JsonValue.Str(value)
internal fun num(value: Number) = JsonValue.Num(value.toDouble())
internal fun bool(value: Boolean) = JsonValue.Bool(value)
internal fun arr(vararg items: JsonValue) = JsonValue.Arr(items.toList())
internal fun arr(items: List<JsonValue>) = JsonValue.Arr(items)
internal fun obj(vararg fields: Pair<String, JsonValue>) = JsonValue.Obj(mapOf(*fields))

/** A block's fields: `type` first, then the given fields. */
internal fun block(type: String, vararg fields: Pair<String, JsonValue>): Map<String, JsonValue> =
    mapOf("type" to str(type)) + fields

/** A plan component; `blocks-*` nodes carry their block under `block`. */
internal fun component(id: String, props: Map<String, JsonValue> = emptyMap(), vararg children: PlanNode) =
    PlanNode.Component(id, props, children.toList())

internal fun blockNode(id: String, type: String, vararg fields: Pair<String, JsonValue>) =
    component(id, mapOf("block" to JsonValue.Obj(block(type, *fields))))

internal fun heading(text: String, level: Int = 2) =
    blockNode("blocks-text", "heading", "text" to str(text), "level" to num(level))

internal fun textItems(vararg texts: String) = arr(texts.map { obj("text" to str(it)) })

internal fun tableColumns(vararg columns: Pair<String, String>) =
    arr(columns.map { (id, label) -> obj("id" to str(id), "label" to str(label)) })

internal fun boardColumn(id: String, title: String, vararg cards: Pair<String, String>) = obj(
    "id" to str(id),
    "title" to str(title),
    "cards" to arr(cards.map { (cardId, cardTitle) -> obj("id" to str(cardId), "title" to str(cardTitle)) }),
)

/** A 1x1 PNG data URI, inside every media cap. */
internal const val PNG = "data:image/png;base64,iVBORw0KGgo="

internal fun imageItem(alt: String = "Tile") = obj("src" to str(PNG), "alt" to str(alt), "width" to num(1), "height" to num(1))

/**
 * Values an agent can put in any prop slot, named for failure messages:
 * wrong types, JSON null, non-finite and extreme numbers, empty, blank, huge,
 * bidi, zero-width, control and surrogate strings, and empty, huge and deeply
 * nested containers. Projections must never throw on any of them.
 */
internal val HOSTILE_VALUES: List<Pair<String, JsonValue>> = run {
    var deep: JsonValue = obj()
    repeat(200) { level -> deep = if (level % 2 == 0) obj("next" to deep) else arr(deep) }
    listOf(
        "json null" to JsonValue.Null,
        "true" to bool(true),
        "false" to bool(false),
        "NaN" to num(Double.NaN),
        "+infinity" to num(Double.POSITIVE_INFINITY),
        "-infinity" to num(Double.NEGATIVE_INFINITY),
        "-0" to num(-0.0),
        "max double" to num(Double.MAX_VALUE),
        "-max double" to num(-Double.MAX_VALUE),
        "min double" to num(Double.MIN_VALUE),
        "2^53+1" to num(9_007_199_254_740_993.0),
        "fraction" to num(2.5),
        "negative" to num(-3),
        "empty string" to str(""),
        "blank string" to str(" \t "),
        "huge string" to str("x".repeat(200_000)),
        "bidi override" to str("\u202Egnp.exe\u202C"),
        "zero-width" to str("\u200B\u200C\u200D\uFEFF"),
        "emoji zwj" to str("👩\u200D💻"),
        "lone surrogate" to str("\uD800"),
        "control chars" to str("a\u0000b\nc\u007F"),
        "script url" to str("javascript:alert(1)"),
        "markup" to str("<img src=x onerror=alert(1)>"),
        "empty array" to arr(),
        "huge array" to arr(List(20_000) { num(it) }),
        "mixed array" to arr(JsonValue.Null, str("a"), num(1), bool(true), obj(), arr()),
        "empty object" to obj(),
        "deep object" to deep,
    )
}

/** Every variant of [base] with one key replaced by a hostile value, plus one with the key removed. */
internal fun hostileVariants(base: Map<String, JsonValue>): Sequence<Pair<String, Map<String, JsonValue>>> = sequence {
    for (key in base.keys) {
        yield("$key removed" to base - key)
        for ((name, value) in HOSTILE_VALUES) yield("$key = $name" to base + (key to value))
    }
}
