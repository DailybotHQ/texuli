package com.texuli.compose

import com.texuli.spec.JsonValue
import kotlin.math.abs

/** A closed, display-only projection of a validated `blocks-data` table. */
internal data class NativeTable(
    val caption: String?,
    val columns: List<NativeTableColumn>,
    val rows: List<List<String>>,
)

internal data class NativeTableColumn(val id: String, val label: String)

/**
 * Project JSON data into a stable table shape. Unknown row keys are ignored,
 * absent cells become empty text, and all scalar values remain inert text.
 */
internal fun nativeTable(block: Map<String, JsonValue>?): NativeTable? {
    if (block?.get("type") != JsonValue.Str("table")) return null

    val columns = (block["columns"] as? JsonValue.Arr)?.items.orEmpty().mapNotNull { value ->
        val fields = (value as? JsonValue.Obj)?.fields ?: return@mapNotNull null
        val id = (fields["id"] as? JsonValue.Str)?.value ?: return@mapNotNull null
        val label = (fields["label"] as? JsonValue.Str)?.value ?: return@mapNotNull null
        NativeTableColumn(id = id, label = label)
    }
    if (columns.isEmpty()) return null
    val rows = (block["rows"] as? JsonValue.Arr)?.items.orEmpty().mapNotNull { value ->
        val fields = (value as? JsonValue.Obj)?.fields ?: return@mapNotNull null
        columns.map { column -> fields[column.id].displayScalar() }
    }
    return NativeTable(
        caption = (block["caption"] as? JsonValue.Str)?.value,
        columns = columns,
        rows = rows,
    )
}

/** Native grid layouts have a bounded, deterministic column count. */
internal fun nativeGridColumns(value: JsonValue?): Int =
    ((value as? JsonValue.Num)?.value?.toInt() ?: 2).coerceIn(1, 4)

/** Keep the final partial row at the same bounded column count as earlier rows. */
internal fun <T> nativeGridRows(items: List<T>, columns: Int): List<List<T>> =
    items.chunked(columns.coerceIn(1, 4))

private fun JsonValue?.displayScalar(): String = when (this) {
    is JsonValue.Str -> value
    // Whole numbers print without a fraction only inside the exact-integer range;
    // beyond it a Long would clamp (1e308 is not 9223372036854775807).
    is JsonValue.Num -> if (value % 1.0 == 0.0 && abs(value) <= MAX_SAFE_INTEGER) value.toLong().toString() else value.toString()
    is JsonValue.Bool -> value.toString()
    else -> ""
}

private const val MAX_SAFE_INTEGER = 9_007_199_254_740_991.0
