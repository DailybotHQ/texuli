package com.texuli.compose

import com.texuli.spec.JsonValue

/*
 * Bounded native projections for the composition layouts (layout-stack,
 * layout-row, layout-split, layout-tile) and the code and structure block
 * families (spec 0.8.0 targets, ADR-016). Every value is a closed enum or a
 * clamped number; anything else is refused (null) and paints a placeholder.
 */

/** Gap names of the catalog's `LAYOUT_GAPS` in dp; an absent gap is `medium`. */
internal fun nativeLayoutGapDp(value: JsonValue?): Int? = when (value) {
    null -> 16
    is JsonValue.Str -> NATIVE_LAYOUT_GAPS[value.value]
    else -> null
}

private val NATIVE_LAYOUT_GAPS = mapOf("none" to 0, "small" to 8, "medium" to 16, "large" to 24)

internal enum class NativeRowAlign { START, CENTER, END, STRETCH }

internal data class NativeRowSpec(val gapDp: Int, val align: NativeRowAlign, val wrap: Boolean)

internal fun nativeRowSpec(props: Map<String, JsonValue>): NativeRowSpec? {
    val gap = nativeLayoutGapDp(props["gap"]) ?: return null
    val align = when (val value = props["align"]) {
        null -> NativeRowAlign.STRETCH
        is JsonValue.Str -> when (value.value) {
            "start" -> NativeRowAlign.START
            "center" -> NativeRowAlign.CENTER
            "end" -> NativeRowAlign.END
            "stretch" -> NativeRowAlign.STRETCH
            else -> return null
        }
        else -> return null
    }
    val wrap = when (val value = props["wrap"]) {
        null -> true
        is JsonValue.Bool -> value.value
        else -> return null
    }
    return NativeRowSpec(gap, align, wrap)
}

/** A split's pane weights (inline start : inline end) and gap. */
internal data class NativeSplitSpec(val startWeight: Float, val endWeight: Float, val gapDp: Int)

internal fun nativeSplitSpec(props: Map<String, JsonValue>): NativeSplitSpec? {
    val gap = nativeLayoutGapDp(props["gap"]) ?: return null
    val ratio = when (val value = props["ratio"]) {
        null -> "1:1"
        is JsonValue.Str -> value.value
        else -> return null
    }
    val (start, end) = NATIVE_SPLIT_RATIOS[ratio] ?: return null
    return NativeSplitSpec(start, end, gap)
}

private val NATIVE_SPLIT_RATIOS = mapOf(
    "1:1" to (1f to 1f),
    "1:2" to (1f to 2f),
    "2:1" to (2f to 1f),
    "1:3" to (1f to 3f),
    "3:1" to (3f to 1f),
)

/** Below this width a split stacks its panes (the web stacks on narrow screens too). */
internal const val NATIVE_SPLIT_STACK_BELOW_DP = 600

internal data class NativeTileSpec(val title: String?, val span: Int, val rowSpan: Int)

/** A grid tile: its title, and spans clamped to the catalog's bounds (1 to 4 columns, 1 or 2 rows). */
internal fun nativeTileSpec(props: Map<String, JsonValue>): NativeTileSpec {
    val title = (props["title"] as? JsonValue.Str)?.value?.takeIf(String::isNotBlank)
    return NativeTileSpec(title, nativeSpan(props["span"], 4), nativeSpan(props["rowSpan"], 2))
}

private fun nativeSpan(value: JsonValue?, max: Int): Int {
    val number = (value as? JsonValue.Num)?.value ?: return 1
    if (!number.isFinite()) return 1
    return number.toInt().coerceIn(1, max)
}

/** The longest code a native code block shows (the web block caps code at this size too). */
internal const val NATIVE_CODE_MAX_CHARS = 20_000

internal data class NativeCode(val code: String, val lang: String?, val filename: String?, val caption: String?)

/** A validated `code` block as inert text; never highlighted or run. */
internal fun nativeCodeBlock(block: Map<String, JsonValue>?): NativeCode? {
    if (block?.get("type") != JsonValue.Str("code")) return null
    val code = (block["code"] as? JsonValue.Str)?.value ?: return null
    if (code.length > NATIVE_CODE_MAX_CHARS) return null
    fun optional(key: String): String? = (block[key] as? JsonValue.Str)?.value?.takeIf(String::isNotBlank)
    return NativeCode(code, optional("lang"), optional("filename"), optional("caption"))
}

/** A call to action: its label, and an https href (null when the link is refused; the label stays text). */
internal data class NativeAction(val label: String, val href: String?)

internal fun nativeCtaActions(block: Map<String, JsonValue>?): List<NativeAction>? {
    if (block?.get("type") != JsonValue.Str("cta")) return null
    val actions = (block["actions"] as? JsonValue.Arr)?.items ?: return null
    if (actions.isEmpty() || actions.size > 4) return null
    return actions.map { action ->
        val fields = (action as? JsonValue.Obj)?.fields ?: return null
        val label = (fields["label"] as? JsonValue.Str)?.value?.takeIf(String::isNotBlank) ?: return null
        val href = (fields["href"] as? JsonValue.Str)?.value?.let { navigateIntent("", it)?.href }
        NativeAction(label, href)
    }
}

/** A `columns` block: two to four columns of block objects. */
internal fun nativeColumns(block: Map<String, JsonValue>?): List<List<Map<String, JsonValue>>>? {
    if (block?.get("type") != JsonValue.Str("columns")) return null
    val columns = (block["columns"] as? JsonValue.Arr)?.items ?: return null
    if (columns.size !in 2..4) return null
    return columns.map { column ->
        val items = (column as? JsonValue.Arr)?.items ?: return null
        if (items.size > 32) return null
        items.map { (it as? JsonValue.Obj)?.fields ?: return null }
    }
}

/** A `divider` block: its visible label (null for a plain rule) and whether it is blank space. */
internal data class NativeDivider(val label: String?, val space: Boolean)

internal fun nativeDivider(block: Map<String, JsonValue>?): NativeDivider? {
    if (block?.get("type") != JsonValue.Str("divider")) return null
    val space = when (val variant = block["variant"]) {
        null -> false
        is JsonValue.Str -> when (variant.value) {
            "line" -> false
            "space" -> true
            else -> return null
        }
        else -> return null
    }
    val label = (block["label"] as? JsonValue.Str)?.value?.takeIf(String::isNotBlank)
    return NativeDivider(if (space) null else label, space)
}

/** Which family paints a block nested in `columns` (by its type), or null when none does natively. */
internal fun nativeBlockFamily(type: String?): String? = when (type) {
    "heading", "text", "list", "quote", "callout" -> "blocks-text"
    "table", "stat", "kpi" -> "blocks-data"
    "code" -> "blocks-code"
    "image", "figure", "gallery", "video" -> "blocks-media"
    "cta", "columns", "divider" -> "blocks-structure"
    else -> null
}
