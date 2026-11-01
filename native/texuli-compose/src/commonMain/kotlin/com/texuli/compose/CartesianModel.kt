package com.texuli.compose

import kotlin.math.max
import kotlin.math.min

/*
 * The cartesian model (`@texuli/charts/cartesian` `model.ts`), ported for the
 * native cartesian painters (ADR-025): series validation, the x domain and
 * the scaled layout with line and area paths.
 */

/** A category label or a number (epoch milliseconds on a time axis). */
internal sealed interface XValue {
    data class Num(val value: Double) : XValue
    data class Cat(val label: String) : XValue
}

internal data class CartesianPoint(val x: XValue, val y: Double?)

internal data class CartesianSeries(val id: String, val label: String, val points: List<CartesianPoint>)

/** `assertCartesianSeries` as a predicate: false where the web throws. */
internal fun validCartesianSeries(series: List<CartesianSeries>): Boolean {
    val ids = mutableSetOf<String>()
    for (item in series) {
        if (item.id.isBlank() || !ids.add(item.id)) return false
        if (item.label.isBlank()) return false
        val kinds = item.points.map { it.x::class }.toSet()
        if (kinds.size > 1) return false
        val seen = mutableSetOf<XValue>()
        for (point in item.points) {
            val x = point.x
            if (x is XValue.Num && !x.value.isFinite()) return false
            if (x is XValue.Cat && x.label.isEmpty()) return false
            if (point.y != null && !point.y.isFinite()) return false
            if (!seen.add(x)) return false
        }
    }
    return series.flatMap { item -> item.points.map { it.x::class } }.toSet().size <= 1
}

/** Stable union of x values in input order; numeric values sort ascending. */
internal fun xDomain(series: List<CartesianSeries>): List<XValue> {
    val values = series.flatMap { item -> item.points.map { it.x } }.distinct()
    return if (values.firstOrNull() is XValue.Num) values.sortedBy { (it as XValue.Num).value } else values
}

internal class CartesianLayout(
    val xKeys: List<XValue>,
    val xPosition: (XValue) -> Double,
    val yPosition: (Double) -> Double,
    val baseline: Double,
    val series: List<CartesianSeries>,
    val stacked: List<List<Pair<Double, Double>>>,
)

/** `createCartesianLayout`: scaled coordinates for line and area plots. */
internal fun createCartesianLayout(series: List<CartesianSeries>, width: Double = 640.0, height: Double = 320.0, stacked: Boolean = false): CartesianLayout {
    val left = 54.0
    val right = width - 16
    val top = 16.0
    val bottom = height - 42
    val xKeys = xDomain(series)
    val numericX = xKeys.all { it is XValue.Num }
    val xValues = if (numericX) xKeys.map { (it as XValue.Num).value } else xKeys.indices.map(Int::toDouble)
    val xScale = linearScale(extent(xValues) ?: (0.0 to 1.0), left to right)
    val pointX: (XValue) -> Double = { value ->
        if (numericX) {
            xScale((value as XValue.Num).value)
        } else {
            val index = xKeys.indexOf(value)
            if (xKeys.size <= 1) (left + right) / 2 else left + (index.toDouble() / (xKeys.size - 1)) * (right - left)
        }
    }
    val matrix = series.map { item ->
        val byX = item.points.associate { it.x to it.y }
        xKeys.map { byX[it] }
    }
    val stacks = if (stacked) stack(matrix, StackOffset.DIVERGING) else matrix.map { row -> row.map { 0.0 to (it ?: 0.0) } }
    val yValues = if (stacked) stacks.flatten().flatMap { listOf(it.first, it.second) } else matrix.flatten().filterNotNull()
    val (lo, hi) = extent(yValues) ?: (0.0 to 1.0)
    val yScale = linearScale(if (lo == hi) min(0.0, lo) to (if (hi == 0.0) 1.0 else hi) else lo to hi, bottom to top, nice = 10)
    val baseline = yScale(min(yScale.domain.second, max(yScale.domain.first, 0.0)))
    return CartesianLayout(xKeys, pointX, { yScale(it) }, baseline, series, stacks)
}

/** `lineCoordinates`: the line and (when `filled`) area paths of one series, with null gaps. */
internal fun lineCoordinates(layout: CartesianLayout, seriesIndex: Int, filled: Boolean = false): Pair<String, String> {
    val item = layout.series.getOrNull(seriesIndex) ?: return "" to ""
    val spans = layout.stacked.getOrNull(seriesIndex)
    val points = item.points.map { point ->
        val x = layout.xPosition(point.x)
        if (spans == null) {
            AreaPoint(x, layout.baseline, point.y)
        } else {
            val span = spans.getOrNull(layout.xKeys.indexOf(point.x))
            AreaPoint(
                x,
                if (span != null) layout.yPosition(span.first) else layout.baseline,
                if (point.y == null || span == null) null else layout.yPosition(span.second),
            )
        }
    }
    return linePath(points.map { PathPoint(it.x, it.y1) }) to (if (filled) areaPath(points) else "")
}
