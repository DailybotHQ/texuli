package com.texuli.compose

import androidx.compose.runtime.Composable
import com.texuli.spec.JsonValue
import kotlin.math.abs
import kotlin.math.ceil
import kotlin.math.floor
import kotlin.math.max
import kotlin.math.min

/*
 * The cartesian family natively (ADR-025): line, area, bar, stacked-bar,
 * combo, the generic cartesian chart and the low-level canvas renderer.
 * The scene is the web's `CartesianChart.svelte` SVG model, ported; its
 * scales, stacks and paths are the vector-checked `ChartMath.kt`.
 */

internal enum class CartesianKind { LINE, AREA, BAR, STACKED_BAR, COMBO }

internal enum class CartesianXKind { LINEAR, CATEGORY, TIME }

internal val CARTESIAN_CHART_IDS = setOf("charts-line", "charts-area", "charts-bar", "charts-stacked-bar", "charts-combo", "charts-cartesian")

internal const val CARTESIAN_MAX_SERIES = 24
internal const val CARTESIAN_MAX_POINTS = 2_000

internal class CartesianChart(
    val kind: CartesianKind,
    val title: String,
    val description: String,
    val series: List<CartesianSeries>,
    val xKind: CartesianXKind?,
    val visibleDomain: Pair<Double, Double>?,
)

private fun kindOf(text: String?): CartesianKind? = when (text) {
    "line" -> CartesianKind.LINE
    "area" -> CartesianKind.AREA
    "bar" -> CartesianKind.BAR
    "stacked-bar" -> CartesianKind.STACKED_BAR
    "combo" -> CartesianKind.COMBO
    else -> null
}

/** Cartesian series from blueprint JSON, or null when anything is malformed or over the caps. */
internal fun cartesianSeriesOf(value: List<JsonValue>?): List<CartesianSeries>? {
    if (value == null || value.isEmpty() || value.size > CARTESIAN_MAX_SERIES) return null
    return value.map { item ->
        val fields = item.asObject ?: return null
        val points = fields.propArray("points") ?: return null
        if (points.size > CARTESIAN_MAX_POINTS) return null
        CartesianSeries(
            fields.propName("id") ?: return null,
            fields.propName("label") ?: return null,
            points.map { point ->
                val p = point.asObject ?: return null
                val x = when (val raw = p["x"]) {
                    is JsonValue.Num -> XValue.Num(raw.value)
                    is JsonValue.Str -> XValue.Cat(raw.value)
                    else -> return null
                }
                val y = when (val raw = p["y"]) {
                    is JsonValue.Num -> raw.value
                    JsonValue.Null -> null
                    else -> return null
                }
                CartesianPoint(x, y)
            },
        )
    }
}

/**
 * Project validated props. Honored: title, description, series, xKind,
 * visibleDomain (and `kind` on charts-cartesian). Ignored natively: class
 * and renderer (web), mode (the host theme), interactive and fullDomain
 * (static here), locale (en-US labels), series colors (the theme palette).
 * Annotations refuse to the placeholder rather than paint a chart without them.
 */
internal fun nativeCartesianChart(id: String, props: Map<String, JsonValue>): CartesianChart? {
    val kind = when (id) {
        "charts-cartesian" -> kindOf(props.propString("kind")) ?: return null
        else -> kindOf(id.removePrefix("charts-")) ?: return null
    }
    val title = props.propName("title") ?: return null
    val description = props.propName("description") ?: return null
    val series = cartesianSeriesOf(props.propArray("series")) ?: return null
    if (!validCartesianSeries(series)) return null
    val xKind = when (props.propEnum("xKind", setOf("linear", "category", "time"))) {
        null -> null
        "linear" -> CartesianXKind.LINEAR
        "category" -> CartesianXKind.CATEGORY
        "time" -> CartesianXKind.TIME
        else -> return null
    }
    // `assertCartesianXKind`: a linear or time axis takes numbers only.
    if ((xKind == CartesianXKind.LINEAR || xKind == CartesianXKind.TIME) && series.any { s -> s.points.any { it.x !is XValue.Num } }) return null
    val annotations = props["annotations"]
    if (annotations != null && annotations != JsonValue.Null && !(annotations is JsonValue.Arr && annotations.items.isEmpty())) return null
    val visible = props["visibleDomain"]?.let { raw ->
        val items = (raw as? JsonValue.Arr)?.items ?: return null
        val lo = (items.getOrNull(0) as? JsonValue.Num)?.value ?: return null
        val hi = (items.getOrNull(1) as? JsonValue.Num)?.value ?: return null
        if (items.size != 2 || !lo.isFinite() || !hi.isFinite() || lo > hi) return null
        if (series.any { s -> s.points.any { it.x !is XValue.Num } }) return null
        lo to hi
    }
    return CartesianChart(kind, title, description, series, xKind, visible)
}

/** `windowCartesianSeries`: the points in a numeric view plus one neighbor at each edge. */
internal fun windowCartesianSeries(series: List<CartesianSeries>, domain: Pair<Double, Double>): List<CartesianSeries> {
    val (start, end) = domain
    return series.map { item ->
        val inside = mutableListOf<CartesianPoint>()
        var before: CartesianPoint? = null
        var after: CartesianPoint? = null
        var previous = Double.NEGATIVE_INFINITY
        var sorted = true
        for (point in item.points) {
            val x = (point.x as XValue.Num).value
            if (x < previous) sorted = false
            previous = x
            if (x < start && (before == null || x > (before.x as XValue.Num).value)) before = point
            else if (x > end && (after == null || x < (after.x as XValue.Num).value)) after = point
            else if (x in start..end) inside += point
        }
        var points = if (inside.isEmpty()) {
            if (before != null && after != null) listOf(before, after) else emptyList()
        } else {
            listOfNotNull(before) + inside + listOfNotNull(after)
        }
        if (!sorted) points = points.sortedBy { (it.x as XValue.Num).value }
        CartesianSeries(item.id, item.label, points)
    }
}

/** A category key as the web's `String(key)`. */
internal fun XValue.key(): String = when (this) {
    is XValue.Num -> jsNumber(value)
    is XValue.Cat -> label
}

/** An axis label as the web's `formatAxisValue`. */
private fun XValue.axisLabel(): String = when (this) {
    is XValue.Num -> formatNumber(value)
    is XValue.Cat -> label
}

/** The web's chart width rule (`fitChartWidth`): the measured width, never under 240. */
internal fun fitChartWidth(measured: Double, preferred: Double): Double = if (measured > 0 && measured.isFinite()) max(240.0, min(preferred, measured)) else preferred

/** The scene of `CartesianChart.svelte` (SVG marks) at `width`; height 320 as on the web. */
internal fun cartesianScene(chart: CartesianChart, width: Double): ChartScene {
    val height = 320.0
    val mTop = 18.0
    val mRight = 18.0
    val mBottom = 48.0
    val mLeft = 58.0
    val innerWidth = width - mLeft - mRight
    val kind = chart.kind
    val continuousX = chart.xKind == CartesianXKind.LINEAR || chart.xKind == CartesianXKind.TIME
    val active = chart.series
    val rendered = chart.visibleDomain?.let { windowCartesianSeries(active, it) } ?: active
    val keys = xDomain(rendered)
    val keyIndex = keys.withIndex().associate { it.value to it.index }
    val categories = keys.map { it.key() }
    val stackedMode = kind == CartesianKind.STACKED_BAR || (kind == CartesianKind.AREA && active.size > 1)
    val layout = createCartesianLayout(rendered, width, height, kind == CartesianKind.AREA && stackedMode)
    val category = bandScale(categories, mLeft to width - mRight, 0.18, 0.1)
    val band = category.bandwidth
    val hasBars = kind == CartesianKind.BAR || kind == CartesianKind.STACKED_BAR || kind == CartesianKind.COMBO
    val keyExtent = if (continuousX) extent(keys.map { (it as XValue.Num).value }) else null
    val edgePad = if (hasBars) innerWidth / max(2, keys.size) / 2 else 0.0
    val visibleXScale = when {
        chart.visibleDomain != null -> linearScale(chart.visibleDomain, mLeft to width - mRight)
        keyExtent != null -> linearScale(
            if (keyExtent.first == keyExtent.second) keyExtent.first - 1 to keyExtent.second + 1 else keyExtent,
            mLeft + edgePad to width - mRight - edgePad,
        )
        else -> null
    }
    val rows = rendered.map { item ->
        val values = item.points.associate { it.x to it.y }
        keys.map { values[it] }
    }
    val stacking = kind == CartesianKind.STACKED_BAR || (kind == CartesianKind.AREA && stackedMode)
    val stackSpans = if (stacking) stack(rows, StackOffset.DIVERGING) else rows.map { row -> row.map { 0.0 to (it ?: 0.0) } }
    val yValues = if (stacking) stackSpans.flatten().flatMap { listOf(it.first, it.second) } else rows.flatten().filterNotNull()
    val domain = extent(yValues) ?: (0.0 to 1.0)
    val yDomain = if (kind != CartesianKind.LINE) min(0.0, domain.first) to max(0.0, domain.second) else domain
    val yScale = linearScale(
        if (yDomain.first == yDomain.second) min(yDomain.first, 0.0) to max(yDomain.second, 1.0) else yDomain,
        height - mBottom to mTop,
        nice = 10,
    )
    val yTicks = ticks(yScale.domain.first, yScale.domain.second, 5)
    fun xPosition(key: XValue): Double {
        if (visibleXScale != null && key is XValue.Num) return visibleXScale(key.value)
        return (category(key.key()) ?: mLeft) + band / 2
    }
    fun markBandWidth(index: Int): Double {
        if (visibleXScale == null) return band
        val current = keys[index] as? XValue.Num ?: return band
        val distances = listOfNotNull(keys.getOrNull(index - 1), keys.getOrNull(index + 1))
            .filterIsInstance<XValue.Num>()
            .map { abs(xPosition(it) - xPosition(current)) }
            .filter { it > 0 }
        return max(1.0, (distances + (if (edgePad > 0) edgePad * 2 else innerWidth)).min())
    }
    val chartLayout = CartesianLayout(layout.xKeys, ::xPosition, { yScale(it) }, yScale(0.0), layout.series, layout.stacked)

    val marks = mutableListOf<Mark>()
    // Gridlines and the y axis, under the marks.
    for (value in yTicks) {
        val y = yScale(value)
        marks += Mark.LineMark(mLeft, y, width - mRight, y, Ink.Grid)
    }
    marks += Mark.LineMark(mLeft, height - mBottom, width - mRight, height - mBottom, Ink.Axis)

    val seriesIndexOf = { item: CartesianSeries -> chart.series.indexOfFirst { it.id == item.id }.let { if (it < 0) 0 else it } }
    val grouped = kind == CartesianKind.BAR && rendered.size > 1
    val barSeries = if (kind == CartesianKind.COMBO) rendered.take(1) else rendered
    if (hasBars) {
        for (item in barSeries) {
            val seriesIndex = rendered.indexOf(item)
            for (point in item.points) {
                if (point.y == null) continue
                val index = keyIndex[point.x] ?: 0
                val categoryStart = category(categories[index]) ?: mLeft
                val markBand = markBandWidth(index)
                val slot = if (grouped) markBand / (rendered.size + 0.2) else null
                val groupOffset = if (slot != null) seriesIndex * slot else 0.0
                val x = if (visibleXScale != null) xPosition(point.x) - markBand / 2 + groupOffset else categoryStart + groupOffset
                val span = stackSpans.getOrNull(seriesIndex)?.getOrNull(index) ?: (0.0 to point.y)
                val y0 = yScale(span.first)
                val y1 = yScale(span.second)
                marks += Mark.RectMark(x, min(y0, y1), if (slot != null) slot * 0.88 else markBand * 0.72, max(0.0, abs(y1 - y0)), Ink.Series(seriesIndexOf(item)))
            }
        }
    }
    val lineSeries = if (kind == CartesianKind.COMBO) rendered.drop(1) else rendered
    if (kind == CartesianKind.LINE || kind == CartesianKind.AREA || kind == CartesianKind.COMBO) {
        for (item in lineSeries) {
            val sourceIndex = rendered.indexOf(item)
            val (line, area) = lineCoordinates(chartLayout, sourceIndex, filled = kind == CartesianKind.AREA)
            val ink = Ink.Series(seriesIndexOf(item))
            if (area.isNotEmpty()) marks += Mark.PathMark(area, ink, fill = true, alpha = 0.2f)
            marks += Mark.PathMark(line, ink, fill = false)
        }
    }

    val texts = mutableListOf<SceneText>()
    for (value in yTicks) texts += SceneText(formatNumber(value), mLeft - 8, yScale(value) + 4, TextAnchor.END)
    // The x axis: nice continuous ticks, or up to six of the keys.
    val vd = chart.visibleDomain
    val visibleKeys: List<XValue> = if (vd != null) {
        (listOf(XValue.Num(vd.first)) + keys.filter { it is XValue.Num && it.value >= vd.first && it.value <= vd.second } + XValue.Num(vd.second)).distinct()
    } else keys
    val tickKeys = if (visibleKeys.size > 8) List(6) { visibleKeys[jsRound(it * (visibleKeys.size - 1) / 5.0).toInt()] } else visibleKeys
    if (visibleXScale != null && continuousX) {
        val (lo, hi) = visibleXScale.domain.let { if (it.first <= it.second) it else it.second to it.first }
        val count = max(2, min(8, floor(innerWidth / 96).toInt()))
        if (chart.xKind == CartesianXKind.TIME) {
            val interval = chooseTimeInterval(lo, hi, count)
            for (value in timeTicks(lo, hi, interval)) texts += SceneText(formatTimeTick(value, interval), visibleXScale(value), height - mBottom + 18)
        } else {
            for (value in ticks(lo, hi, count)) texts += SceneText(formatNumber(value), visibleXScale(value), height - mBottom + 18)
        }
    } else {
        tickKeys.forEachIndexed { index, value ->
            val start = category(value.key())
            val x = when {
                visibleXScale != null -> xPosition(value)
                start != null -> start + band / 2
                else -> mLeft + (index.toDouble() / max(1, tickKeys.size - 1)) * innerWidth
            }
            texts += SceneText(value.axisLabel(), x, height - mBottom + 18)
        }
    }
    return ChartScene(width, height, marks, texts)
}

/** The rows the web's chart table lists: one per x key, a column per series. */
internal fun cartesianTable(chart: CartesianChart): ChartTable {
    // The web's table lists the rendered (windowed) keys.
    val rendered = chart.visibleDomain?.let { windowCartesianSeries(chart.series, it) } ?: chart.series
    val keys = xDomain(rendered).let { all ->
        if (all.size > 48) List(24) { all[jsRound(it * (all.size - 1) / 23.0).toInt()] } else all
    }
    fun xLabel(key: XValue): String = when {
        chart.xKind == CartesianXKind.TIME && key is XValue.Num -> {
            val withTime = keys.any { it is XValue.Num && it.value % DAY_MS != 0.0 }
            formatDate(key.value, withTime)
        }
        key is XValue.Num -> formatNumber(key.value)
        else -> (key as XValue.Cat).label
    }
    val rows = keys.map { key ->
        listOf(xLabel(key)) + chart.series.map { item -> item.points.firstOrNull { it.x == key }?.y?.let { formatNumber(it) } ?: "No value" }
    }
    return ChartTable(listOf("") + chart.series.map { it.label }, rows)
}

internal fun cartesianSummary(chart: CartesianChart): String {
    val count = chart.series.sumOf { it.points.size }
    return "${chart.series.size} series, $count points"
}

@Composable
internal fun CartesianChartView(chart: CartesianChart) {
    ChartFrame(
        chart.title,
        chart.description,
        cartesianSummary(chart),
        legend = chart.series.mapIndexed { index, item -> LegendItem(item.label, index) },
        table = cartesianTable(chart),
    ) {
        SceneCanvas { width -> cartesianScene(chart, width) }
    }
}

// --- charts-canvas-renderer ---------------------------------------------------

internal class CanvasBar(val x: Double, val y: Double, val width: Double, val height: Double)

internal class CanvasPoint(val x: Double, val y: Double?, val y0: Double, val bar: CanvasBar?)

internal class CanvasSeriesData(val id: String, val label: String, val points: List<CanvasPoint>)

internal class CanvasChart(val kind: CartesianKind, val series: List<CanvasSeriesData>, val width: Double, val height: Double)

/** `charts-canvas-renderer`: pixel-space marks (kind, series, width, height), as the web's canvas layer takes them. */
internal fun nativeCanvasChart(props: Map<String, JsonValue>): CanvasChart? {
    val kind = kindOf(props.propString("kind")) ?: return null
    val width = props.propNumber("width")?.takeIf { it > 0 && it <= 4096 } ?: return null
    val height = props.propNumber("height")?.takeIf { it > 0 && it <= 4096 } ?: return null
    val raw = props.propArray("series") ?: return null
    if (raw.size > CARTESIAN_MAX_SERIES) return null
    val series = raw.map { item ->
        val fields = item.asObject ?: return null
        val points = fields.propArray("points") ?: return null
        if (points.size > CARTESIAN_MAX_POINTS * 10) return null
        CanvasSeriesData(
            fields.propName("id") ?: return null,
            fields.propString("label") ?: "",
            points.map { point ->
                val p = point.asObject ?: return null
                val bar = p["bar"]?.let { b ->
                    val f = b.asObject ?: return null
                    CanvasBar(f.propNumber("x") ?: return null, f.propNumber("y") ?: return null, f.propNumber("width") ?: return null, f.propNumber("height") ?: return null)
                }
                val y = when (val v = p["y"]) {
                    is JsonValue.Num -> v.value.takeIf(Double::isFinite) ?: return null
                    JsonValue.Null, null -> null
                    else -> return null
                }
                CanvasPoint(p.propNumber("x") ?: return null, y, p.propNumber("y0") ?: return null, bar)
            },
        )
    }
    return CanvasChart(kind, series, width, height)
}

/** `minMaxBuckets`: per pixel column keep the first, lowest, highest and last sample, and one gap. */
internal fun minMaxBuckets(xs: List<Double>, ys: List<Double>, buckets: Int, x0: Double? = null, x1: Double? = null): List<Int> {
    val n = min(xs.size, ys.size)
    val count = max(1, buckets)
    if (n == 0) return emptyList()
    val lo = x0 ?: xs[0]
    val hi = x1 ?: xs[n - 1]
    val span = hi - lo
    if (n <= count * 4 && x0 == null && x1 == null) return List(n) { it }
    val out = mutableListOf<Int>()
    var current = -1
    var first = -1
    var last = -1
    var minIndex = -1
    var maxIndex = -1
    var gap = -1
    fun flush() {
        if (current == -1) return
        var previous = -1
        for (i in listOf(first, minIndex, maxIndex, last, gap).filter { it != -1 }.sorted()) {
            if (i != previous) out += i
            previous = i
        }
    }
    for (i in 0 until n) {
        val x = xs[i]
        if (x < lo || x > hi) continue
        val bucket = if (span > 0) min(count - 1, floor(((x - lo) / span) * count).toInt()) else 0
        if (bucket != current) {
            flush()
            current = bucket
            first = -1
            last = -1
            minIndex = -1
            maxIndex = -1
            gap = -1
        }
        val y = ys[i]
        if (!y.isFinite()) {
            if (gap == -1) gap = i
            continue
        }
        if (first == -1) first = i
        last = i
        if (minIndex == -1 || y < ys[minIndex]) minIndex = i
        if (maxIndex == -1 || y > ys[maxIndex]) maxIndex = i
    }
    flush()
    return out
}

/** `downsampleCanvasPoints`: the points a canvas line needs at `width` pixels. */
internal fun downsampleCanvasPoints(points: List<CanvasPoint>, width: Double): List<CanvasPoint> {
    if (points.isEmpty()) return emptyList()
    val xs = points.map { it.x }
    val indices = minMaxBuckets(xs, points.map { it.y ?: Double.NaN }, max(1, ceil(width).toInt()), xs.first(), xs.last())
    return indices.map { points[it] }
}

/** The web's `drawCanvasChart` as scene marks. */
internal fun canvasScene(chart: CanvasChart): ChartScene {
    val marks = mutableListOf<Mark>()
    chart.series.forEachIndexed { seriesIndex, item ->
        val isBar = chart.kind == CartesianKind.BAR || chart.kind == CartesianKind.STACKED_BAR || (chart.kind == CartesianKind.COMBO && seriesIndex == 0)
        val ink = Ink.Series(seriesIndex)
        if (isBar) {
            item.points.forEach { p -> p.bar?.let { marks += Mark.RectMark(it.x, it.y, it.width, it.height, ink) } }
        }
        val isLine = chart.kind == CartesianKind.LINE || chart.kind == CartesianKind.AREA || (chart.kind == CartesianKind.COMBO && seriesIndex > 0)
        if (!isLine) return@forEachIndexed
        val points = downsampleCanvasPoints(item.points, chart.width)
        if (chart.kind == CartesianKind.AREA) {
            val runs = mutableListOf<List<CanvasPoint>>()
            var run = mutableListOf<CanvasPoint>()
            for (p in points) {
                if (p.y == null) {
                    if (run.isNotEmpty()) runs += run
                    run = mutableListOf()
                } else run += p
            }
            if (run.isNotEmpty()) runs += run
            for (area in runs) {
                val d = StringBuilder("M${jsNumber(area.first().x)},${jsNumber(area.first().y0)}")
                area.forEach { d.append("L${jsNumber(it.x)},${jsNumber(it.y!!)}") }
                d.append("L${jsNumber(area.last().x)},${jsNumber(area.last().y0)}")
                for (i in area.size - 2 downTo 0) d.append("L${jsNumber(area[i].x)},${jsNumber(area[i].y0)}")
                d.append("Z")
                marks += Mark.PathMark(d.toString(), ink, fill = true, alpha = 0.2f)
            }
        }
        val line = StringBuilder()
        var activeRun = false
        for (p in points) {
            if (p.y == null) {
                activeRun = false
                continue
            }
            line.append(if (activeRun) "L" else "M").append("${jsNumber(p.x)},${jsNumber(p.y)}")
            activeRun = true
        }
        marks += Mark.PathMark(line.toString(), ink, fill = false)
    }
    return ChartScene(chart.width, chart.height, marks)
}

@Composable
internal fun CanvasChartView(chart: CanvasChart) {
    // The web paints this layer aria-hidden inside a chart that carries the name; natively it is a named figure.
    ChartFrame("Chart", null, "${chart.series.size} series") {
        SceneCanvas(minUnits = chart.width, maxUnits = chart.width) { canvasScene(chart) }
    }
}
