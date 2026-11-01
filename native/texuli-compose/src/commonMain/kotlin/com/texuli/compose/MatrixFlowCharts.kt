package com.texuli.compose

import androidx.compose.runtime.Composable
import com.texuli.spec.JsonValue
import kotlin.math.PI
import kotlin.math.cos
import kotlin.math.ln
import kotlin.math.max
import kotlin.math.min
import kotlin.math.pow
import kotlin.math.sin

/*
 * The matrix and flow families natively (ADR-025): scatter, bubble and
 * heatmap (`matrix/model.ts`), funnel, sankey and network (`flow/model.ts`,
 * `math/layout/funnel.ts`, `math/layout/sankey.ts`). Layouts are ported and
 * vector-checked; scenes follow the web components.
 */

// --- Matrix layouts ----------------------------------------------------------

internal data class HeatmapCell(val x: String, val y: String, val value: Double)

internal class HeatmapCellLayout(val id: String, val x: String, val y: String, val value: Double, val xPos: Double, val yPos: Double, val width: Double, val height: Double, val t: Double)

internal class HeatmapLayout(val xKeys: List<String>, val yKeys: List<String>, val cells: List<HeatmapCellLayout>, val valueDomain: Pair<Double, Double>, val xBand: BandScale, val yBand: BandScale)

internal data class Margin(val top: Double, val right: Double, val bottom: Double, val left: Double)

/** `assertHeatmapCells` as a predicate. */
internal fun validHeatmapCells(cells: List<HeatmapCell>): Boolean = cells.all { it.x.isNotBlank() && it.y.isNotBlank() && it.value.isFinite() }

/** `createHeatmapLayout`. */
internal fun createHeatmapLayout(cells: List<HeatmapCell>, width: Double = 640.0, height: Double = 360.0, margin: Margin = Margin(16.0, 16.0, 48.0, 72.0)): HeatmapLayout {
    val xKeys = cells.map { it.x }.distinct()
    val yKeys = cells.map { it.y }.distinct()
    val xBand = bandScale(xKeys, margin.left to width - margin.right, 0.08, 0.04)
    val yBand = bandScale(yKeys, margin.top to height - margin.bottom, 0.08, 0.04)
    val domain = extent(cells.map { it.value }) ?: (0.0 to 1.0)
    val span = (domain.second - domain.first).let { if (it == 0.0) 1.0 else it }
    val laid = cells.map { cell ->
        HeatmapCellLayout(
            "${cell.x}::${cell.y}", cell.x, cell.y, cell.value,
            xBand(cell.x) ?: margin.left, yBand(cell.y) ?: margin.top, xBand.bandwidth, yBand.bandwidth,
            (cell.value - domain.first) / span,
        )
    }
    return HeatmapLayout(xKeys, yKeys, laid, domain, xBand, yBand)
}

internal data class ScatterPoint(val id: String, val label: String, val x: Double, val y: Double, val r: Double?, val seriesId: String?)

internal data class ScatterSeries(val id: String, val label: String)

internal class ScatterPointLayout(val id: String, val label: String, val x: Double, val y: Double, val r: Double, val cx: Double, val cy: Double, val radius: Double, val seriesIndex: Int, val seriesId: String?)

internal class ScatterLayout(val points: List<ScatterPointLayout>, val xScale: ContinuousScale, val yScale: ContinuousScale, val xTicks: List<Double>, val yTicks: List<Double>, val series: List<ScatterSeries>)

/** `assertScatterPoints` as a predicate. */
internal fun validScatterPoints(points: List<ScatterPoint>, requireRadius: Boolean): Boolean {
    val ids = mutableSetOf<String>()
    for (point in points) {
        if (point.id.isBlank() || !ids.add(point.id) || point.label.isBlank()) return false
        if (!point.x.isFinite() || !point.y.isFinite()) return false
        if (requireRadius && (point.r == null || !point.r.isFinite() || point.r < 0)) return false
        if (!requireRadius && point.r != null && (!point.r.isFinite() || point.r < 0)) return false
    }
    return true
}

/** `createScatterLayout`. */
internal fun createScatterLayout(points: List<ScatterPoint>, width: Double = 640.0, height: Double = 360.0, margin: Margin = Margin(16.0, 16.0, 48.0, 56.0), series: List<ScatterSeries> = emptyList(), bubble: Boolean = false): ScatterLayout {
    val xExtent = extent(points.map { it.x }) ?: (0.0 to 1.0)
    val yExtent = extent(points.map { it.y }) ?: (0.0 to 1.0)
    val xScale = linearScale(if (xExtent.first == xExtent.second) xExtent.first - 1 to xExtent.second + 1 else xExtent, margin.left to width - margin.right, nice = 10)
    val yScale = linearScale(if (yExtent.first == yExtent.second) yExtent.first - 1 to yExtent.second + 1 else yExtent, height - margin.bottom to margin.top, nice = 10)
    val rExtent = extent(points.map { it.r ?: 1.0 }) ?: (1.0 to 1.0)
    val rScale = linearScale(
        if (rExtent.first == rExtent.second) 0.0 to (if (rExtent.second == 0.0) 1.0 else rExtent.second) else rExtent,
        if (bubble) 6.0 to 28.0 else 4.0 to 4.0,
        clamp = true,
    )
    val seriesMap = series.associateBy { it.id }
    val order = mutableListOf<ScatterSeries>()
    val seen = mutableSetOf<String>()
    for (point in points) {
        val sid = point.seriesId ?: "default"
        if (!seen.add(sid)) continue
        order += seriesMap[sid] ?: ScatterSeries(sid, if (sid == "default") "Points" else sid)
    }
    val seriesIndex = order.withIndex().associate { it.value.id to it.index }
    return ScatterLayout(
        points.map { point ->
            val sid = point.seriesId ?: "default"
            ScatterPointLayout(point.id, point.label, point.x, point.y, point.r ?: 1.0, xScale(point.x), yScale(point.y), rScale(point.r ?: 1.0), seriesIndex[sid] ?: 0, point.seriesId)
        },
        xScale, yScale,
        ticks(xScale.domain.first, xScale.domain.second, 5),
        ticks(yScale.domain.first, yScale.domain.second, 5),
        order,
    )
}

// --- Flow layouts ------------------------------------------------------------

internal data class FunnelStep(val id: String, val label: String?, val value: Double)

internal class FunnelStepLayout(
    val id: String, val label: String?, val value: Double, val conversion: Double?, val stepConversion: Double?, val dropOff: Double, val dropOffRate: Double?,
    val x: Double, val y: Double, val width: Double, val height: Double,
)

/** `funnelLayout`. */
internal fun funnelLayout(steps: List<FunnelStep>, width: Double, height: Double, vertical: Boolean = true, gap: Double = 8.0, minSize: Double = 2.0): List<FunnelStepLayout> {
    val g = max(0.0, gap)
    val minimum = max(0.0, minSize)
    val n = steps.size
    if (n == 0) return emptyList()
    val values = steps.map { if (it.value.isFinite() && it.value > 0) it.value else 0.0 }
    val top = values.max()
    val first = values[0]
    val along = if (vertical) height else width
    val across = if (vertical) width else height
    val band = max(0.0, (along - g * (n - 1)) / n)
    return steps.mapIndexed { i, step ->
        val value = values[i]
        val previous = if (i == 0) value else values[i - 1]
        val size = if (top > 0) max(minimum, (value / top) * across) else minimum
        val offset = (across - size) / 2
        val position = i * (band + g)
        FunnelStepLayout(
            step.id, step.label, value,
            if (first > 0) value / first else null,
            if (i == 0) 1.0 else if (previous > 0) value / previous else null,
            if (i == 0) 0.0 else previous - value,
            if (i == 0) 0.0 else if (previous > 0) (previous - value) / previous else null,
            if (vertical) offset else position,
            if (vertical) position else across - size,
            if (vertical) size else band,
            if (vertical) band else size,
        )
    }
}

internal data class FlowNode(val id: String, val label: String?, val value: Double? = null)

internal data class FlowLink(val source: String, val target: String, val value: Double?)

internal class SankeyNodeLayout(val id: String, val label: String?, val depth: Int, val value: Double, val x0: Double, val x1: Double, val y0: Double, val y1: Double)

internal class SankeyLinkLayout(val source: String, val target: String, val value: Double, val width: Double, val y0: Double, val y1: Double, val path: String)

private fun r2(v: Double): Double = jsRound(v * 100) / 100

/** `sankey`; null where the web throws (duplicate or unknown nodes, a value ≤ 0, a cycle). */
internal fun sankey(nodesIn: List<FlowNode>, linksIn: List<FlowLink>, width: Double, height: Double, nodeWidth: Double = 12.0, padding: Double = 8.0, iterations: Int = 6): Pair<List<SankeyNodeLayout>, List<SankeyLinkLayout>>? {
    val index = mutableMapOf<String, Int>()
    nodesIn.forEachIndexed { i, node -> if (index.put(node.id, i) != null) return null }
    val out = nodesIn.map { mutableListOf<Int>() }
    val inn = nodesIn.map { mutableListOf<Int>() }
    linksIn.forEachIndexed { k, link ->
        val s = index[link.source] ?: return null
        val t = index[link.target] ?: return null
        val v = link.value ?: return null
        if (!(v > 0) || !v.isFinite()) return null
        out[s] += k
        inn[t] += k
    }
    val n = nodesIn.size
    val depth = IntArray(n)
    val state = IntArray(n)
    val order = mutableListOf<Int>()
    for (start in 0 until n) {
        if (state[start] != 0) continue
        val stack = ArrayDeque<IntArray>()
        stack.addLast(intArrayOf(start, 0))
        state[start] = 1
        while (stack.isNotEmpty()) {
            val frame = stack.last()
            val v = frame[0]
            val edges = out[v]
            if (frame[1] < edges.size) {
                val next = frame[1]
                frame[1]++
                val w = index.getValue(linksIn[edges[next]].target)
                if (state[w] == 1) return null
                if (state[w] == 0) {
                    state[w] = 1
                    stack.addLast(intArrayOf(w, 0))
                }
            } else {
                state[v] = 2
                order += v
                stack.removeLast()
            }
        }
    }
    for (v in order.reversed()) {
        for (k in out[v]) {
            val w = index.getValue(linksIn[k].target)
            depth[w] = max(depth[w], depth[v] + 1)
        }
    }
    val columns = (depth.maxOrNull() ?: 0).coerceAtLeast(0) + 1
    for (v in 0 until n) if (out[v].isEmpty() && inn[v].isNotEmpty()) depth[v] = columns - 1
    fun sum(ks: List<Int>): Double = ks.sumOf { linksIn[it].value!! }
    val value = List(n) { max(sum(inn[it]), sum(out[it])) }
    val byColumn = List(columns) { mutableListOf<Int>() }
    for (v in 0 until n) byColumn[depth[v]] += v
    val ky = byColumn.minOf { col ->
        val total = col.sumOf { value[it] }
        if (total > 0) max(0.0, height - (col.size - 1) * padding) / total else Double.POSITIVE_INFINITY
    }
    val scale = if (ky.isFinite()) ky else 0.0
    val step = if (columns > 1) (width - nodeWidth) / (columns - 1) else 0.0
    val y0 = DoubleArray(n)
    val h = DoubleArray(n) { value[it] * scale }
    for (col in byColumn) {
        var y = 0.0
        for (v in col) {
            y0[v] = y
            y += h[v] + padding
        }
    }
    fun centre(v: Int) = y0[v] + h[v] / 2
    fun resolve(col: MutableList<Int>) {
        col.sortBy { y0[it] }
        var y = 0.0
        for (v in col) {
            y0[v] = max(y0[v], y)
            y = y0[v] + h[v] + padding
        }
        var bottom = height
        for (i in col.indices.reversed()) {
            val v = col[i]
            y0[v] = min(y0[v], bottom - h[v])
            bottom = y0[v] - padding
        }
    }
    for (i in 0 until iterations) {
        val alpha = 0.99.pow(i)
        val passes = listOf(
            Triple(byColumn.drop(1), inn, true),
            Triple(byColumn.dropLast(1).reversed(), out, false),
        )
        for ((cols, links, towardSource) in passes) {
            for (col in cols) {
                for (v in col) {
                    val ks = links[v]
                    val weight = sum(ks)
                    if (weight == 0.0) continue
                    val target = ks.fold(0.0) { t, k ->
                        val l = linksIn[k]
                        t + centre(index.getValue(if (towardSource) l.source else l.target)) * l.value!!
                    } / weight
                    y0[v] = y0[v] + (target - centre(v)) * alpha
                }
                resolve(col)
            }
        }
    }
    fun x0(v: Int) = depth[v] * step
    val nodes = nodesIn.mapIndexed { v, node ->
        SankeyNodeLayout(node.id, node.label, depth[v], value[v], r2(x0(v)), r2(x0(v) + nodeWidth), r2(y0[v]), r2(y0[v] + h[v]))
    }
    val sy = mutableMapOf<Int, Double>()
    val ty = mutableMapOf<Int, Double>()
    for (v in 0 until n) {
        var y = y0[v]
        for (k in out[v].sortedBy { centre(index.getValue(linksIn[it].target)) }) {
            val w = linksIn[k].value!! * scale
            sy[k] = y + w / 2
            y += w
        }
        y = y0[v]
        for (k in inn[v].sortedBy { centre(index.getValue(linksIn[it].source)) }) {
            val w = linksIn[k].value!! * scale
            ty[k] = y + w / 2
            y += w
        }
    }
    val links = linksIn.mapIndexed { k, l ->
        val s = index.getValue(l.source)
        val t = index.getValue(l.target)
        val xa = x0(s) + nodeWidth
        val xb = x0(t)
        val xm = (xa + xb) / 2
        val ya = sy.getValue(k)
        val yb = ty.getValue(k)
        val n2 = { x: Double -> jsNumber(r2(x)) }
        SankeyLinkLayout(l.source, l.target, l.value!!, r2(l.value * scale), r2(ya), r2(yb), "M${n2(xa)},${n2(ya)}C${n2(xm)},${n2(ya)},${n2(xm)},${n2(yb)},${n2(xb)},${n2(yb)}")
    }
    return nodes to links
}

internal class NetworkNodeLayout(val id: String, val label: String?, val x: Double, val y: Double, val radius: Double)

internal class NetworkLinkLayout(val source: String, val target: String, val value: Double?, val sourceIndex: Int, val targetIndex: Int, val path: String)

/** `networkLayout`: nodes on a stable circle; null where the web throws. */
internal fun networkLayout(nodes: List<FlowNode>, links: List<FlowLink>, width: Double, height: Double): Pair<List<NetworkNodeLayout>, List<NetworkLinkLayout>>? {
    if (!width.isFinite() || width <= 0 || !height.isFinite() || height <= 0) return null
    val index = mutableMapOf<String, Int>()
    nodes.forEachIndexed { i, node -> if (node.id.isBlank() || index.put(node.id, i) != null) return null }
    val cx = width / 2
    val cy = height / 2
    val radius = max(0.0, min(width, height) * 0.36)
    val laid = nodes.mapIndexed { i, node ->
        val angle = -PI / 2 + (PI * 2 * i) / max(nodes.size, 1)
        val value = node.value?.takeIf { it.isFinite() && it > 0 } ?: 1.0
        NetworkNodeLayout(node.id, node.label, r2(cx + cos(angle) * radius), r2(cy + sin(angle) * radius), r2(max(4.0, min(10.0, 5 + ln(value + 1) / ln(2.0)))))
    }
    val laidLinks = links.map { link ->
        if (link.value != null && (!link.value.isFinite() || link.value <= 0)) return null
        val s = index[link.source] ?: return null
        val t = index[link.target] ?: return null
        NetworkLinkLayout(link.source, link.target, link.value, s, t, "M${jsNumber(laid[s].x)},${jsNumber(laid[s].y)}L${jsNumber(laid[t].x)},${jsNumber(laid[t].y)}")
    }
    return laid to laidLinks
}

// --- Projection --------------------------------------------------------------

internal enum class MatrixFlowKind { SCATTER, BUBBLE, HEATMAP, FUNNEL, SANKEY, NETWORK }

internal val MATRIX_FLOW_CHART_IDS = setOf("charts-scatter", "charts-bubble", "charts-heatmap", "charts-funnel", "charts-sankey", "charts-network")

internal const val MATRIX_MAX_POINTS = 2_000
internal const val FLOW_MAX_NODES = 500
internal const val FLOW_MAX_LINKS = 2_000

internal class FlowLabels(val table: String, val step: String, val count: String, val conversion: String, val from: String, val to: String, val value: String)

/** `flowChartLabels`: the defaults with the host's labels on top. */
internal fun flowLabels(value: Map<String, JsonValue>?): FlowLabels {
    fun pick(key: String, fallback: String) = value?.propString(key) ?: fallback
    return FlowLabels(pick("tableSummary", "View data table"), pick("step", "Step"), pick("count", "Count"), pick("conversion", "Conversion"), pick("from", "From"), pick("to", "To"), pick("value", "Value"))
}

internal class MatrixFlowChart(
    val kind: MatrixFlowKind,
    val title: String,
    val description: String?,
    val width: Double,
    val height: Double,
    val points: List<ScatterPoint> = emptyList(),
    val series: List<ScatterSeries> = emptyList(),
    val cells: List<HeatmapCell> = emptyList(),
    val steps: List<FunnelStep> = emptyList(),
    val vertical: Boolean = true,
    val nodes: List<FlowNode> = emptyList(),
    val links: List<FlowLink> = emptyList(),
    val labels: FlowLabels = flowLabels(null),
)

private fun Map<String, JsonValue>.size(key: String, default: Double): Double? =
    if (key !in this) default else propNumber(key)?.takeIf { it > 0 && it <= 4096 }

private fun noAnnotations(props: Map<String, JsonValue>): Boolean {
    val a = props["annotations"] ?: return true
    return a == JsonValue.Null || (a is JsonValue.Arr && a.items.isEmpty())
}

/**
 * Project validated props. Honored: title, description, the data props,
 * width, height, orientation and labels. Ignored natively: class, mode and
 * interactive. Annotations refuse to the placeholder; so does any input the
 * web's layout throws on (it shows an error state there).
 */
internal fun nativeMatrixFlowChart(id: String, props: Map<String, JsonValue>): MatrixFlowChart? {
    val title = props.propName("title") ?: return null
    if (props.mistyped("description") { it is JsonValue.Str }) return null
    val description = props.propName("description")
    return when (id) {
        "charts-scatter", "charts-bubble" -> {
            if (description == null || !noAnnotations(props)) return null
            val bubble = id == "charts-bubble"
            val raw = props.propArray("points") ?: return null
            if (raw.size > MATRIX_MAX_POINTS) return null
            val points = raw.map { item ->
                val f = item.asObject ?: return null
                if (f.mistyped("r") { it is JsonValue.Num } || f.mistyped("seriesId") { it is JsonValue.Str }) return null
                ScatterPoint(f.propString("id") ?: return null, f.propString("label") ?: return null, (f["x"] as? JsonValue.Num)?.value ?: return null, (f["y"] as? JsonValue.Num)?.value ?: return null, (f["r"] as? JsonValue.Num)?.value, f.propString("seriesId"))
            }
            if (!validScatterPoints(points, bubble)) return null
            val series = (props.propArray("series") ?: if ("series" in props) return null else emptyList()).map { item ->
                val f = item.asObject ?: return null
                ScatterSeries(f.propName("id") ?: return null, f.propString("label") ?: return null)
            }
            MatrixFlowChart(if (bubble) MatrixFlowKind.BUBBLE else MatrixFlowKind.SCATTER, title, description, props.size("width", 640.0) ?: return null, props.size("height", 360.0) ?: return null, points = points, series = series)
        }
        "charts-heatmap" -> {
            if (description == null || !noAnnotations(props)) return null
            val raw = props.propArray("cells") ?: return null
            if (raw.size > MATRIX_MAX_POINTS) return null
            val cells = raw.map { item ->
                val f = item.asObject ?: return null
                HeatmapCell(f.propString("x") ?: return null, f.propString("y") ?: return null, (f["value"] as? JsonValue.Num)?.value ?: return null)
            }
            if (!validHeatmapCells(cells)) return null
            MatrixFlowChart(MatrixFlowKind.HEATMAP, title, description, props.size("width", 640.0) ?: return null, props.size("height", 360.0) ?: return null, cells = cells)
        }
        "charts-funnel" -> {
            val raw = props.propArray("steps") ?: return null
            if (raw.size > FLOW_MAX_NODES) return null
            val steps = raw.map { item ->
                val f = item.asObject ?: return null
                if (f.mistyped("label") { it is JsonValue.Str }) return null
                FunnelStep(f.propName("id") ?: return null, f.propString("label"), (f["value"] as? JsonValue.Num)?.value ?: return null)
            }
            val vertical = when (props.propEnum("orientation", setOf("vertical", "horizontal"))) {
                null, "vertical" -> true
                "horizontal" -> false
                else -> return null
            }
            MatrixFlowChart(MatrixFlowKind.FUNNEL, title, description, props.size("width", 640.0) ?: return null, props.size("height", 320.0) ?: return null, steps = steps, vertical = vertical, labels = flowLabels(props.propObject("labels")))
        }
        "charts-sankey", "charts-network" -> {
            val network = id == "charts-network"
            val rawNodes = props.propArray("nodes") ?: return null
            val rawLinks = props.propArray("links") ?: return null
            if (rawNodes.size > FLOW_MAX_NODES || rawLinks.size > FLOW_MAX_LINKS) return null
            val nodes = rawNodes.map { item ->
                val f = item.asObject ?: return null
                if (f.mistyped("label") { it is JsonValue.Str } || f.mistyped("value") { it is JsonValue.Num }) return null
                FlowNode(f.propString("id") ?: return null, f.propString("label"), (f["value"] as? JsonValue.Num)?.value)
            }
            val links = rawLinks.map { item ->
                val f = item.asObject ?: return null
                if (f.mistyped("value") { it is JsonValue.Num }) return null
                FlowLink(f.propString("source") ?: return null, f.propString("target") ?: return null, (f["value"] as? JsonValue.Num)?.value)
            }
            val chart = MatrixFlowChart(
                if (network) MatrixFlowKind.NETWORK else MatrixFlowKind.SANKEY, title, description,
                props.size("width", if (network) 480.0 else 640.0) ?: return null, props.size("height", 360.0) ?: return null,
                nodes = nodes, links = links, labels = flowLabels(props.propObject("labels")),
            )
            // The web shows an error instead of the graph; natively that is the placeholder.
            if (network && networkLayout(nodes, links, chart.width, chart.height) == null) return null
            if (!network && sankey(nodes, links, max(40.0, chart.width - 32), chart.height, 14.0, 12.0) == null) return null
            chart
        }
        else -> null
    }
}

// --- Scenes ------------------------------------------------------------------

private fun matrixAxes(marks: MutableList<Mark>, texts: MutableList<SceneText>, xTicks: List<Pair<String, Double>>, yTicks: List<Pair<String, Double>>, width: Double, height: Double, margin: Margin, grid: Boolean) {
    for ((label, y) in yTicks) {
        if (grid) marks += Mark.LineMark(margin.left, y, width - margin.right, y, Ink.Grid)
        texts += SceneText(label, margin.left - 8, y + 4, TextAnchor.END)
    }
    marks += Mark.LineMark(margin.left, height - margin.bottom, width - margin.right, height - margin.bottom, Ink.Axis)
    for ((label, x) in xTicks) texts += SceneText(label, x, height - margin.bottom + 18)
}

/** The web component's scene at `width` (the measured width rule, `fitChartWidth`). */
internal fun matrixFlowScene(chart: MatrixFlowChart, measured: Double): ChartScene {
    val width = fitChartWidth(measured, chart.width)
    val height = chart.height
    val marks = mutableListOf<Mark>()
    val texts = mutableListOf<SceneText>()
    when (chart.kind) {
        MatrixFlowKind.SCATTER, MatrixFlowKind.BUBBLE -> {
            val margin = Margin(16.0, 16.0, 48.0, 56.0)
            val layout = createScatterLayout(chart.points, width, height, margin, chart.series, chart.kind == MatrixFlowKind.BUBBLE)
            matrixAxes(marks, texts, layout.xTicks.map { formatNumber(it) to layout.xScale(it) }, layout.yTicks.map { formatNumber(it) to layout.yScale(it) }, width, height, margin, grid = true)
            for (point in layout.points) {
                val ink = Ink.Series(point.seriesIndex)
                if (chart.kind == MatrixFlowKind.BUBBLE) {
                    marks += Mark.CircleMark(point.cx, point.cy, point.radius, ink, alpha = 0.55f)
                    marks += Mark.CircleMark(point.cx, point.cy, point.radius, ink, fill = false)
                } else {
                    marks += Mark.CircleMark(point.cx, point.cy, point.radius, ink, alpha = 0.85f)
                }
            }
        }
        MatrixFlowKind.HEATMAP -> {
            val margin = Margin(16.0, 16.0, 48.0, 80.0)
            val layout = createHeatmapLayout(chart.cells, width, height, margin)
            matrixAxes(
                marks, texts,
                layout.xKeys.map { it to (layout.xBand(it) ?: margin.left) + layout.xBand.bandwidth / 2 },
                layout.yKeys.map { it to (layout.yBand(it) ?: margin.top) + layout.yBand.bandwidth / 2 },
                width, height, margin, grid = false,
            )
            for (cell in layout.cells) marks += Mark.RectMark(cell.xPos, cell.yPos, cell.width, cell.height, Ink.Ramp(cell.t))
        }
        MatrixFlowKind.FUNNEL -> {
            funnelLayout(chart.steps, width, height, chart.vertical).forEachIndexed { index, step ->
                marks += Mark.RectMark(step.x, step.y, step.width, step.height, Ink.Series(index))
                val label = "${step.label ?: step.id}: ${formatNumber(step.value)} (${flowPercent(step.conversion)})"
                texts += SceneText(label, if (chart.vertical) width / 2 else step.x + step.width / 2, if (chart.vertical) step.y + step.height / 2 + 4 else height - 8, strong = true)
            }
        }
        MatrixFlowKind.SANKEY -> {
            val (nodes, links) = sankey(chart.nodes, chart.links, max(40.0, width - 32), height, 14.0, 12.0) ?: (emptyList<SankeyNodeLayout>() to emptyList())
            val last = nodes.maxOfOrNull { it.depth } ?: 0
            links.forEach { link ->
                marks += Mark.PathMark(link.path, Ink.Series(chart.nodes.indexOfFirst { it.id == link.source }), fill = false, alpha = 0.45f, strokeWidth = max(1.0, link.width).toFloat(), dx = 16.0)
            }
            nodes.forEachIndexed { index, node ->
                marks += Mark.RectMark(node.x0 + 16, node.y0, node.x1 - node.x0, max(2.0, node.y1 - node.y0), Ink.Series(index))
                val atEnd = node.depth == last
                texts += SceneText(node.label ?: node.id, (if (atEnd) node.x0 - 6 else node.x1 + 6) + 16, (node.y0 + node.y1) / 2 + 4, if (atEnd) TextAnchor.END else TextAnchor.START)
            }
        }
        MatrixFlowKind.NETWORK -> {
            val (nodes, links) = networkLayout(chart.nodes, chart.links, width, height) ?: (emptyList<NetworkNodeLayout>() to emptyList())
            links.forEachIndexed { index, link ->
                marks += Mark.PathMark(link.path, Ink.Series(index), fill = false, alpha = 0.55f, strokeWidth = max(1.0, min(8.0, link.value ?: 1.0)).toFloat())
            }
            nodes.forEachIndexed { index, node ->
                marks += Mark.CircleMark(node.x, node.y, node.radius, Ink.Series(index))
                texts += SceneText(node.label ?: node.id, node.x, node.y + node.radius + 14)
            }
        }
    }
    return ChartScene(width, height, marks, texts)
}

/** `formatFlowPercent`: a ratio as a percentage, or a dash when undefined. */
internal fun flowPercent(value: Double?): String = if (value == null || !value.isFinite()) "—" else formatPercent(value)

/** The summary line the web shows when no description is given. */
internal fun matrixFlowSummary(chart: MatrixFlowChart): String = when (chart.kind) {
    MatrixFlowKind.FUNNEL -> chart.description ?: "${chart.title}: ${formatNumber(chart.steps.firstOrNull()?.value ?: 0.0)} entered; ${formatNumber(chart.steps.lastOrNull()?.value ?: 0.0)} reached ${chart.steps.lastOrNull()?.label ?: "the final step"}."
    MatrixFlowKind.SANKEY -> chart.description ?: "${chart.title}: ${chart.nodes.size} nodes and ${chart.links.size} flows."
    MatrixFlowKind.NETWORK -> chart.description ?: "${chart.title}: ${chart.nodes.size} nodes and ${chart.links.size} connections."
    else -> chart.description ?: ""
}

/** The data table each web component offers. */
internal fun matrixFlowTable(chart: MatrixFlowChart): ChartTable = when (chart.kind) {
    MatrixFlowKind.SCATTER, MatrixFlowKind.BUBBLE -> {
        val bubble = chart.kind == MatrixFlowKind.BUBBLE
        ChartTable(
            listOfNotNull("Point", "Series", "X", "Y", if (bubble) "Size" else null),
            chart.points.map { listOfNotNull(it.label, it.seriesId ?: "—", formatNumber(it.x), formatNumber(it.y), if (bubble) formatNumber(it.r ?: 1.0) else null) },
        )
    }
    MatrixFlowKind.HEATMAP -> ChartTable(listOf("Row", "Column", "Value"), chart.cells.map { listOf(it.y, it.x, formatNumber(it.value)) })
    MatrixFlowKind.FUNNEL -> ChartTable(
        listOf(chart.labels.step, chart.labels.count, chart.labels.conversion),
        funnelLayout(chart.steps, chart.width, chart.height, chart.vertical).map { listOf(it.label ?: it.id, formatNumber(it.value), flowPercent(it.conversion)) },
    )
    MatrixFlowKind.SANKEY, MatrixFlowKind.NETWORK -> {
        val name = { id: String -> chart.nodes.firstOrNull { it.id == id }?.label ?: id }
        ChartTable(listOf(chart.labels.from, chart.labels.to, chart.labels.value), chart.links.map { listOf(name(it.source), name(it.target), formatNumber(it.value ?: 1.0)) })
    }
}

@Composable
internal fun MatrixFlowChartView(chart: MatrixFlowChart) {
    val legend = when (chart.kind) {
        MatrixFlowKind.SCATTER, MatrixFlowKind.BUBBLE -> {
            val series = createScatterLayout(chart.points, series = chart.series).series
            if (series.size > 1) series.mapIndexed { index, item -> LegendItem(item.label, index) } else emptyList()
        }
        else -> emptyList()
    }
    ChartFrame(chart.title, matrixFlowSummary(chart).ifEmpty { null }, "${chart.kind.name.lowercase()} chart", legend = legend, table = matrixFlowTable(chart)) {
        SceneCanvas(maxUnits = chart.width) { width -> matrixFlowScene(chart, width) }
    }
}
