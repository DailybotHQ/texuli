package com.texuli.spec.runtime

import com.texuli.spec.BlueprintActionOp
import com.texuli.spec.BlueprintStateDeclarationType

/**
 * The 0.3.0 interaction contract (ADR-008), the Kotlin twin of
 * `packages/spec/src/contract.ts`: binding keys, the fields each action op
 * and state type takes, the limits and the name patterns. The closed op,
 * event and type sets themselves are the generated enums.
 */
object SpecContract {
    const val STATE_BINDING_KEY: String = "\$state"
    const val DATA_BINDING_KEY: String = "\$data"
    const val FORM_ID: String = "action-form"

    /** The fields each op takes besides `op`, and the ones it needs (in declaration order). */
    val ACTION_FIELDS: Map<BlueprintActionOp, Pair<List<String>, List<String>>> = mapOf(
        BlueprintActionOp.SET_STATE to (listOf("state", "value", "fromEvent") to listOf("state")),
        BlueprintActionOp.TOGGLE_STATE to (listOf("state") to listOf("state")),
        BlueprintActionOp.MOVE_ITEM to (listOf("from", "item", "to", "index") to listOf("from", "item")),
        BlueprintActionOp.FLOW_GO to (listOf("event") to listOf("event")),
        BlueprintActionOp.EMIT to (listOf("intent", "values") to listOf("intent")),
        BlueprintActionOp.SUBMIT to (emptyList<String>() to emptyList()),
    )

    /** The fields each state type takes besides `type`. */
    val STATE_FIELDS: Map<BlueprintStateDeclarationType, Set<String>> = mapOf(
        BlueprintStateDeclarationType.BOOLEAN to setOf("initial", "source"),
        BlueprintStateDeclarationType.NUMBER to setOf("min", "max", "initial", "source"),
        BlueprintStateDeclarationType.ENUM to setOf("values", "initial", "source"),
        BlueprintStateDeclarationType.STRING to setOf("maxLength", "initial", "source"),
        BlueprintStateDeclarationType.LIST to setOf("maxItems", "initial"),
        BlueprintStateDeclarationType.WORKFLOW to setOf("initial"),
    )

    const val STATE_VARS: Int = 64
    const val DEFAULT_STRING_LENGTH: Int = 200
    const val STRING_LENGTH: Int = 1000
    const val EMIT_VALUES: Int = 32
    const val EMIT_VALUE_LENGTH: Int = 2048
    const val LIST_ITEMS: Int = 500
    const val LIST_ITEM_FIELDS: Int = 16
    const val PROP_DEPTH: Int = 32
    const val WORKFLOW_NODES: Int = 500
    const val WORKFLOW_EDGES: Int = 2000
    const val WORKFLOW_NODE_TYPES: Int = 64
    const val WORKFLOW_GROUPS: Int = 64
    const val WORKFLOW_PORTS: Int = 16
    const val WORKFLOW_FIELDS: Int = 32
    const val WORKFLOW_LABEL_LENGTH: Int = 200
    const val WORKFLOW_STRING_LENGTH: Int = 2000
    /** Top-level blocks a `document` node's doc may hold (spec 0.7.0 `$defs.document`). */
    const val DOCUMENT_BLOCKS: Int = 2000
    /** Shapes and connectors a `canvas` node's canvas may hold at its top level (spec 0.8.0 `$defs.canvas`). */
    const val CANVAS_SHAPES: Int = 5000
    const val CANVAS_CONNECTORS: Int = 5000
    /** Tabs, rows and columns of a `spreadsheet` node's sheet (spec 0.8.0 `$defs.sheet`, ADR-015). */
    const val SHEET_TABS: Int = 16
    const val SHEET_ROWS: Long = 10000L
    const val SHEET_COLUMNS: Long = 256L
    /** List caps of a `schema-form` node's schema (spec 0.8.0 `$defs.formSchema`, ADR-015). */
    const val FORM_FIELDS: Int = 200
    const val FORM_SECTIONS: Int = 50
    const val FORM_STEPS: Int = 20
    const val FORM_RULES: Int = 50

    val STATE_NAME: Regex = Regex("^[a-z][A-Za-z0-9_]{0,31}\$")
    val DATA_NAME: Regex = Regex("^[A-Za-z][A-Za-z0-9_]*(\\.[A-Za-z0-9_]+)*\$")
    val FLOW_NAME: Regex = Regex("^[a-z][a-z0-9-]{0,31}\$")
    val INTENT_NAME: Regex = Regex("^[A-Za-z][A-Za-z0-9_-]{0,63}\$")
    val ITEM_KEY: Regex = Regex("^[A-Za-z0-9._:-]{1,64}\$")
    /** A node's stable instance id (spec 0.7.0 `$defs.nodeKey`), unique in its tree. */
    val NODE_KEY: Regex = Regex("^[A-Za-z0-9._:-]{1,64}\$")
    /**
     * A design-system reference (spec 0.10.0 `$defs.designSystemReference.ref`):
     * an exact `id@x.y.z` or `texuli:<theme>`, never a range, a URL or a path.
     */
    val DESIGN_SYSTEM_REF: Regex = Regex(
        "^(?:texuli:[a-z][a-z0-9]*(?:-[a-z0-9]+)*|[a-z][a-z0-9]*(?:-[a-z0-9]+)*@(?:0|[1-9]\\d*)\\.(?:0|[1-9]\\d*)\\.(?:0|[1-9]\\d*)(?:-[0-9A-Za-z-]+(?:\\.[0-9A-Za-z-]+)*)?)\$",
    )
    val WORKFLOW_ID: Regex = Regex("^[A-Za-z0-9._:-]{1,64}\$")
    val WORKFLOW_FIELD_NAME: Regex = Regex("^[a-z][A-Za-z0-9_]{0,31}\$")

    /** Display text: no control characters and no bidirectional overrides or isolates. */
    val WORKFLOW_LABEL: Regex = Regex("^[^\\u0000-\\u001f\\u007f-\\u009f\\u202a-\\u202e\\u2066-\\u2069]*\$")

    /**
     * List item text (spec `listText`): the workflow label rule plus invisible
     * formatting characters (Arabic letter mark, Mongolian vowel separator,
     * zero-width space, direction marks, word joiner and invisible operators,
     * byte order mark). ZWNJ and ZWJ stay allowed.
     */
    val LIST_TEXT: Regex = Regex("^[^\\u0000-\\u001f\\u007f-\\u009f\\u061c\\u180e\\u200b\\u200e\\u200f\\u202a-\\u202e\\u2060-\\u2064\\u2066-\\u2069\\ufeff]*\$")

    /** Multi-line display text: tab and newline allowed, other controls and bidi controls refused. */
    val WORKFLOW_TEXT: Regex = Regex("^[^\\u0000-\\u0008\\u000b-\\u001f\\u007f-\\u009f\\u202a-\\u202e\\u2066-\\u2069]*\$")
}

/** Length in Unicode code points, as the dialect counts `minLength` and `maxLength`. */
internal fun String.codePointLength(): Int {
    var count = 0
    var i = 0
    while (i < length) {
        i += if (this[i].isHighSurrogate() && i + 1 < length && this[i + 1].isLowSurrogate()) 2 else 1
        count++
    }
    return count
}
