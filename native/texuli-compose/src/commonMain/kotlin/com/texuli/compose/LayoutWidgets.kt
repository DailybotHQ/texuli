package com.texuli.compose

import com.texuli.spec.JsonValue
import com.texuli.spec.runtime.PlanNode
import kotlin.math.floor

/** A bounded native interpretation of the catalog's content-grid props. */
internal data class NativeGridSpec(val requestedColumns: Int, val gapDp: Int)

internal fun nativeGridSpec(props: Map<String, JsonValue>): NativeGridSpec? {
    val columns = nativeGridColumns(props["columns"])
    val gap = when (val value = props["gap"]) {
        null -> 16
        is JsonValue.Str -> NATIVE_GRID_GAPS[value.value] ?: return null
        else -> return null
    }
    return NativeGridSpec(columns, gap)
}

/**
 * Fit tiles with a 180dp minimum width where possible, never exceeding the
 * authored count (which is independently capped at four).
 */
internal fun nativeResponsiveGridColumns(requested: Int, availableWidthDp: Int, gapDp: Int): Int {
    val boundedRequest = requested.coerceIn(1, 4)
    val width = availableWidthDp.coerceAtLeast(0).toLong()
    val gap = gapDp.coerceIn(0, 64).toLong()
    val fitting = floor((width + gap).toDouble() / (180 + gap)).toInt().coerceAtLeast(1)
    return minOf(boundedRequest, fitting)
}

/** Heading text in reading order for a non-interactive document outline. */
internal fun nativeDocumentOutline(nodes: List<PlanNode>): List<String> = nodes.flatMap { node ->
    when (node) {
        is PlanNode.Placeholder -> emptyList()
        is PlanNode.Component -> {
            val fields = (node.props["block"] as? JsonValue.Obj)?.fields
            val heading = if (node.id == "blocks-text" && fields?.get("type") == JsonValue.Str("heading")) {
                (fields["text"] as? JsonValue.Str)?.value?.takeIf(String::isNotBlank)?.let(::listOf).orEmpty()
            } else {
                emptyList()
            }
            heading + nativeDocumentOutline(node.children)
        }
    }
}

internal fun nativeDeckSlideLabel(props: Map<String, JsonValue>): String? =
    (props["slideId"] as? JsonValue.Str)?.value?.takeIf(String::isNotBlank)

internal fun nativeDeckFrameSupported(props: Map<String, JsonValue>): Boolean =
    props.keys.all { it == "title" || it == "description" }

private val NATIVE_GRID_GAPS = mapOf(
    "0" to 0,
    "0px" to 0,
    "0rem" to 0,
    "4px" to 4,
    "0.25rem" to 4,
    "8px" to 8,
    "0.5rem" to 8,
    "12px" to 12,
    "0.75rem" to 12,
    "16px" to 16,
    "1rem" to 16,
    "20px" to 20,
    "1.25rem" to 20,
    "24px" to 24,
    "1.5rem" to 24,
    "32px" to 32,
    "2rem" to 32,
)
