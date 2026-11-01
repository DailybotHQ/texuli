package com.texuli.compose

import androidx.compose.runtime.Composable
import com.texuli.spec.JsonValue
import kotlin.math.PI
import kotlin.math.abs
import kotlin.math.asin
import kotlin.math.cos
import kotlin.math.max
import kotlin.math.min
import kotlin.math.sin
import kotlin.math.sqrt

/*
 * The part-whole family natively (ADR-025): pie, donut, sunburst and
 * treemap. `pie`, `arcPath`, `treemap` and `sunburst` are the web's
 * `@texuli/charts/math` shapes and layouts, ported and vector-checked; the
 * scenes follow `PieChart.svelte`, `SunburstChart.svelte` and
 * `TreemapChart.svelte`.
 */

private const val TAU = PI * 2
private const val ARC_EPSILON = 1e-9

internal data class PieSlice(val index: Int, val value: Double, val startAngle: Double, val endAngle: Double, val padAngle: Double)

/** `pie`: angles per value from 12 o'clock, clockwise; negative and non-finite values get an empty slice. */
internal fun pie(values: List<Double?>, startAngle: Double = 0.0, endAngle: Double = TAU, padAngle: Double = 0.0): List<PieSlice> {
    val span = endAngle - startAngle
    val clean = values.map { if (it != null && it.isFinite() && it > 0) it else 0.0 }
    val total = clean.sum()
    val nonZero = clean.count { it > 0 }
    val pad = if (nonZero > 1) min(abs(span) / nonZero, max(0.0, padAngle)) else 0.0
    var angle = startAngle
    return clean.mapIndexed { i, v ->
        val sweep = if (total == 0.0) 0.0 else (v / total) * span
        val slice = PieSlice(i, v, angle, angle + sweep, if (v > 0) min(pad, sweep / 2) else 0.0)
        angle += sweep
        slice
    }
}

private fun arcPoint(r: Double, a: Double): String = "${jsNumber(roundCoord(r * sin(a)))},${jsNumber(roundCoord(-r * cos(a)))}"

private fun arcTo(r: Double, sweep: Double, a: Double, clockwise: Boolean): String =
    "A${jsNumber(roundCoord(r))},${jsNumber(roundCoord(r))},0,${if (abs(sweep) > PI) 1 else 0},${if (clockwise) 1 else 0},${arcPoint(r, a)}"

/** `arcPath`: an annular sector (a pie slice when the inner radius is 0); "" for an empty slice. */
internal fun arcPath(innerRadius: Double, outerRadius: Double, startAngle: Double, endAngle: Double, cornerRadius: Double = 0.0, padAngle: Double = 0.0): String {
    val r0 = max(0.0, min(innerRadius, outerRadius))
    val r1 = maxOf(0.0, innerRadius, outerRadius)
    var a0 = min(startAngle, endAngle)
    var a1 = max(startAngle, endAngle)
    if (r1 <= 0 || a1 - a0 <= ARC_EPSILON) return ""
    val n = { v: Double -> jsNumber(roundCoord(v)) }
    if (a1 - a0 >= TAU - ARC_EPSILON) {
        val outer = "M0,${n(-r1)}A${n(r1)},${n(r1)},0,1,1,0,${n(r1)}A${n(r1)},${n(r1)},0,1,1,0,${n(-r1)}Z"
        if (r0 <= 0) return outer
        return "${outer}M0,${n(-r0)}A${n(r0)},${n(r0)},0,1,0,0,${n(r0)}A${n(r0)},${n(r0)},0,1,0,0,${n(-r0)}Z"
    }
    val pad = max(0.0, padAngle) / 2
    if (pad > 0) {
        val trim = min(pad, (a1 - a0) / 4)
        a0 += trim
        a1 -= trim
        if (a1 - a0 <= ARC_EPSILON) return ""
    }
    val span = a1 - a0
    val half = sin(min(span / 2, PI / 2))
    var rc = max(0.0, cornerRadius)
    rc = minOf(rc, (r1 - r0) / 2, (r1 * half) / (1 + half))
    if (r0 > 0 && half < 1) rc = min(rc, (r0 * half) / (1 - half))
    if (rc <= ARC_EPSILON) {
        val d = StringBuilder("M${arcPoint(r1, a0)}${arcTo(r1, span, a1, true)}")
        d.append(if (r0 > 0) "L${arcPoint(r0, a1)}${arcTo(r0, span, a0, false)}" else "L0,0")
        return "${d}Z"
    }
    val outerOffset = asin(rc / (r1 - rc))
    val outerEdge = sqrt((r1 - rc) * (r1 - rc) - rc * rc)
    val c = { r: Double -> "${n(r)},${n(r)}" }
    val d = StringBuilder("M${arcPoint(outerEdge, a0)}")
    d.append("A${c(rc)},0,0,1,${arcPoint(r1, a0 + outerOffset)}")
    d.append(arcTo(r1, span - 2 * outerOffset, a1 - outerOffset, true))
    d.append("A${c(rc)},0,0,1,${arcPoint(outerEdge, a1)}")
    if (r0 > 0) {
        val innerOffset = asin(rc / (r0 + rc))
        val innerEdge = sqrt((r0 + rc) * (r0 + rc) - rc * rc)
        d.append("L${arcPoint(innerEdge, a1)}")
        d.append("A${c(rc)},0,0,1,${arcPoint(r0, a1 - innerOffset)}")
        d.append(arcTo(r0, span - 2 * innerOffset, a0 + innerOffset, false))
        d.append("A${c(rc)},0,0,1,${arcPoint(innerEdge, a0)}")
    } else {
        d.append("L0,0")
    }
    return "${d}Z"
}

/** `arcCentroid`: the middle of a slice at the middle radius. */
internal fun arcCentroid(innerRadius: Double, outerRadius: Double, startAngle: Double, endAngle: Double): Pair<Double, Double> {
    val r = (innerRadius + outerRadius) / 2
    val a = (startAngle + endAngle) / 2
    return roundCoord(r * sin(a)) to roundCoord(-r * cos(a))
}

// --- Hierarchies -------------------------------------------------------------

/** A `TreemapNode`: id, optional label and value, children. */
internal data class TreeNode(val id: String, val label: String?, val value: Double?, val children: List<TreeNode>)

private class Sized(val node: TreeNode, val value: Double, val children: List<Sized>)

/** The web's `size()`: sums leaves; null where the web throws (duplicate id, bad leaf, parent mismatch). */
private fun sized(node: TreeNode, seen: MutableSet<String>): Sized? {
    if (!seen.add(node.id)) return null
    val children = node.children.map { sized(it, seen) ?: return null }
    if (children.isEmpty()) {
        val value = node.value ?: 0.0
        if (!value.isFinite() || value < 0) return null
        return Sized(node, value, children)
    }
    val sum = children.sumOf { it.value }
    if (node.value != null && abs(node.value - sum) > 1e-9 * max(1.0, abs(sum))) return null
    return Sized(node, sum, children)
}

internal data class TreemapRect(
    val id: String, val label: String?, val parentId: String?, val depth: Int, val value: Double, val leaf: Boolean,
    val x0: Double, val y0: Double, val x1: Double, val y1: Double,
)

private val PHI = (1 + sqrt(5.0)) / 2

private fun squarify(nodes: List<Sized>, bx0: Double, by0: Double, x1: Double, y1: Double, out: MutableMap<Sized, DoubleArray>) {
    var x0 = bx0
    var y0 = by0
    var value = nodes.sumOf { it.value }
    var i0 = 0
    var i1 = 0
    val n = nodes.size
    while (i0 < n) {
        val dx = x1 - x0
        val dy = y1 - y0
        var sum: Double
        do sum = nodes[i1++].value while (sum == 0.0 && i1 < n)
        var lo = sum
        var hi = sum
        val alpha = max(dy / dx, dx / dy) / (value * PHI)
        var beta = sum * sum * alpha
        var best = max(hi / beta, beta / lo)
        while (i1 < n) {
            val v = nodes[i1].value
            sum += v
            if (v < lo) lo = v
            if (v > hi) hi = v
            beta = sum * sum * alpha
            val ratio = max(hi / beta, beta / lo)
            if (ratio > best) {
                sum -= v
                break
            }
            best = ratio
            i1++
        }
        val row = nodes.subList(i0, i1)
        if (dx < dy) {
            val band = if (value != 0.0) (dy * sum) / value else dy
            var x = x0
            for (node in row) {
                val w = if (sum != 0.0) (dx * node.value) / sum else 0.0
                out[node] = doubleArrayOf(x, y0, x + w, y0 + band)
                x += w
            }
            y0 += band
        } else {
            val band = if (value != 0.0) (dx * sum) / value else dx
            var y = y0
            for (node in row) {
                val h = if (sum != 0.0) (dy * node.value) / sum else 0.0
                out[node] = doubleArrayOf(x0, y, x0 + band, y + h)
                y += h
            }
            x0 += band
        }
        value -= sum
        i0 = i1
    }
}

/** `treemap`: every node's rectangle, parents first; null where the web throws. */
internal fun treemap(root: TreeNode, width: Double, height: Double, padding: Double = 0.0, paddingTop: Double? = null): List<TreemapRect>? {
    val tree = sized(root, mutableSetOf()) ?: return null
    val pad = max(0.0, padding)
    val padTop = max(0.0, paddingTop ?: pad)
    val out = mutableListOf<TreemapRect>()
    fun visit(node: Sized, parentId: String?, depth: Int, box: DoubleArray) {
        val (x0, y0, x1, y1) = box.toList()
        out += TreemapRect(node.node.id, node.node.label, parentId, depth, node.value, node.children.isEmpty(), x0, y0, x1, y1)
        if (node.children.isEmpty()) return
        val inner = doubleArrayOf(x0 + pad, y0 + padTop, max(x0 + pad, x1 - pad), max(y0 + padTop, y1 - pad))
        // A stable sort, largest first, as the web's Array#sort.
        val ordered = node.children.sortedByDescending { it.value }
        val boxes = mutableMapOf<Sized, DoubleArray>()
        if (node.value > 0) squarify(ordered, inner[0], inner[1], inner[2], inner[3], boxes)
        for (child in ordered) visit(child, node.node.id, depth + 1, boxes[child] ?: doubleArrayOf(inner[0], inner[1], inner[0], inner[1]))
    }
    visit(tree, null, 0, doubleArrayOf(0.0, 0.0, max(0.0, width), max(0.0, height)))
    return out
}

internal data class SunburstArc(
    val id: String, val label: String?, val parentId: String?, val depth: Int, val value: Double, val leaf: Boolean,
    val x0: Double, val x1: Double, val y0: Double, val y1: Double,
)

private fun maxDepth(node: Sized): Int = if (node.children.isEmpty()) 0 else 1 + max(0, node.children.maxOf(::maxDepth))

/** `sunburst`: angles proportional to value, equal rings per depth; null where the web throws. */
internal fun sunburst(root: TreeNode, radius: Double = 1.0, innerRadius: Double = 0.0, startAngle: Double = 0.0, endAngle: Double = TAU, padAngle: Double = 0.0): List<SunburstArc>? {
    val tree = sized(root, mutableSetOf()) ?: return null
    val outer = max(0.0, radius)
    val inner = min(outer, max(0.0, innerRadius))
    val pad = max(0.0, padAngle)
    val ring = (outer - inner) / max(1, maxDepth(tree))
    val out = mutableListOf<SunburstArc>()
    fun visit(node: Sized, parentId: String?, depth: Int, start: Double, end: Double) {
        val y0 = if (depth == 0) 0.0 else inner + (depth - 1) * ring
        val y1 = if (depth == 0) inner else inner + depth * ring
        out += SunburstArc(node.node.id, node.node.label, parentId, depth, node.value, node.children.isEmpty(), start, end, y0, min(outer, y1))
        if (node.children.isEmpty() || node.value <= 0) return
        val usable = max(0.0, end - start - pad * max(0, node.children.size - 1))
        var cursor = start
        for (child in node.children) {
            val childSpan = usable * (child.value / node.value)
            visit(child, node.node.id, depth + 1, cursor, cursor + childSpan)
            cursor += childSpan + pad
        }
    }
    visit(tree, null, 0, startAngle, endAngle)
    return out
}

internal data class PartWholeRow(val id: String, val label: String, val value: Double, val depth: Int?)

/** `treeTableRows`: every node, depth first, with its leaf total. */
internal fun treeTableRows(root: TreeNode): List<PartWholeRow> {
    fun total(node: TreeNode): Double = if (node.children.isNotEmpty()) node.children.sumOf(::total)
    else if (node.value != null && node.value.isFinite() && node.value > 0) node.value else 0.0
    val rows = mutableListOf<PartWholeRow>()
    fun visit(node: TreeNode, depth: Int) {
        rows += PartWholeRow(node.id, node.label ?: node.id, total(node), depth)
        node.children.forEach { visit(it, depth + 1) }
    }
    visit(root, 0)
    return rows
}

/** `formatPartWholeValue`: at most two decimals (en-US). */
internal fun formatPartWholeValue(value: Double): String = if (!value.isFinite()) "0" else formatNumber(value)

/** `centerTotalFits`: whether the donut's center total fits inside the hole. */
internal fun centerTotalFits(text: String, innerRadius: Double, fontSize: Double): Boolean {
    if (!(innerRadius > 0) || !(fontSize > 0)) return false
    return text.length * 0.62 * fontSize <= innerRadius * 2
}

// --- Projection, scenes and views --------------------------------------------

internal const val PART_WHOLE_MAX_ITEMS = 500
internal const val TREE_MAX_DEPTH = 32

internal class PartWholeLabels(val table: String, val category: String, val value: String)

/** `partWholeTableLabels`: a missing or blank label keeps its default. */
internal fun partWholeLabels(value: Map<String, JsonValue>?): PartWholeLabels {
    fun pick(key: String, fallback: String) = value?.propString(key)?.takeIf(String::isNotBlank) ?: fallback
    return PartWholeLabels(pick("table", "View data table"), pick("category", "Category"), pick("value", "Value"))
}

internal enum class PartWholeKind { PIE, DONUT, SUNBURST, TREEMAP }

internal val PART_WHOLE_CHART_IDS = setOf("charts-pie", "charts-donut", "charts-sunburst", "charts-treemap")

internal class PartWholeDatum(val id: String, val label: String, val value: Double)

internal class PartWholeChart(
    val kind: PartWholeKind,
    val title: String,
    val description: String,
    val labels: PartWholeLabels,
    val data: List<PartWholeDatum> = emptyList(),
    val root: TreeNode? = null,
    val size: Double = 240.0,
    val innerRatio: Double = 0.0,
    val padAngle: Double = 0.0,
    val width: Double = 640.0,
    val height: Double = 360.0,
    val padding: Double = 2.0,
)

/** A number, or a numeric string the web coerces (`innerRatio` and `padAngle` are string-kind props). */
private fun Map<String, JsonValue>.coercedNumber(key: String): Double? = when (val v = this[key]) {
    is JsonValue.Num -> v.value.takeIf(Double::isFinite)
    is JsonValue.Str -> v.value.trim().toDoubleOrNull()?.takeIf(Double::isFinite)
    else -> null
}

/** A tree from blueprint JSON; null when malformed, deeper than [TREE_MAX_DEPTH] or larger than [PART_WHOLE_MAX_ITEMS]. */
internal fun treeOf(value: JsonValue?): TreeNode? {
    var count = 0
    fun read(node: JsonValue?, depth: Int): TreeNode? {
        if (depth > TREE_MAX_DEPTH || ++count > PART_WHOLE_MAX_ITEMS) return null
        val fields = node?.asObject ?: return null
        val children = when (val raw = fields["children"]) {
            null -> emptyList()
            is JsonValue.Arr -> raw.items.map { read(it, depth + 1) ?: return null }
            else -> return null
        }
        if (fields.mistyped("label") { it is JsonValue.Str } || fields.mistyped("value") { it is JsonValue.Num }) return null
        return TreeNode(fields.propName("id") ?: return null, fields.propString("label"), (fields["value"] as? JsonValue.Num)?.value, children)
    }
    return read(value, 0)
}

/**
 * Project validated props. Honored: title, description, data or root,
 * labels, size, innerRatio, padAngle, width, height, padding. A tree the
 * web's layout throws on (duplicate ids, negative leaves, a parent value
 * that does not match its children) refuses to the placeholder.
 */
internal fun nativePartWholeChart(id: String, props: Map<String, JsonValue>): PartWholeChart? {
    val title = props.propName("title") ?: return null
    val description = props.propName("description") ?: return null
    if (props.mistyped("labels") { it is JsonValue.Obj }) return null
    val labels = partWholeLabels(props.propObject("labels"))
    fun optional(key: String, default: Double): Double? = if (key !in props) default else props.coercedNumber(key)
    return when (id) {
        "charts-pie", "charts-donut" -> {
            val raw = props.propArray("data") ?: return null
            if (raw.size > PART_WHOLE_MAX_ITEMS) return null
            val data = raw.map { item ->
                val f = item.asObject ?: return null
                PartWholeDatum(f.propName("id") ?: return null, f.propString("label") ?: return null, (f["value"] as? JsonValue.Num)?.value ?: return null)
            }
            if (data.map { it.id }.toSet().size != data.size) return null
            val size = optional("size", 240.0)?.takeIf { it > 0 && it <= 2048 } ?: return null
            val innerRatio = optional("innerRatio", if (id == "charts-donut") 0.58 else 0.0) ?: return null
            val padAngle = optional("padAngle", 0.01) ?: return null
            PartWholeChart(if (id == "charts-donut") PartWholeKind.DONUT else PartWholeKind.PIE, title, description, labels, data = data, size = size, innerRatio = innerRatio, padAngle = padAngle)
        }
        "charts-sunburst" -> {
            val root = treeOf(props["root"]) ?: return null
            val size = optional("size", 240.0)?.takeIf { it > 0 && it <= 2048 } ?: return null
            val chart = PartWholeChart(PartWholeKind.SUNBURST, title, description, labels, root = root, size = size, innerRatio = optional("innerRatio", 0.24) ?: return null, padAngle = optional("padAngle", 0.008) ?: return null)
            if (sunburst(root) == null) return null
            chart
        }
        "charts-treemap" -> {
            val root = treeOf(props["root"]) ?: return null
            val width = optional("width", 640.0)?.takeIf { it > 0 && it <= 4096 } ?: return null
            val height = optional("height", 360.0)?.takeIf { it > 0 && it <= 4096 } ?: return null
            val padding = optional("padding", 2.0) ?: return null
            if (treemap(root, width, height, padding) == null) return null
            PartWholeChart(PartWholeKind.TREEMAP, title, description, labels, root = root, width = width, height = height, padding = padding)
        }
        else -> null
    }
}

/** The scene of the web component for each kind (pie and sunburst centered in a size × size box). */
internal fun partWholeScene(chart: PartWholeChart): ChartScene = when (chart.kind) {
    PartWholeKind.PIE, PartWholeKind.DONUT -> {
        val center = chart.size / 2
        val radius = max(0.0, chart.size * 0.45)
        val inner = radius * min(0.85, max(0.0, chart.innerRatio))
        val slices = pie(chart.data.map { it.value }, padAngle = chart.padAngle)
        val marks = mutableListOf<Mark>()
        for (slice in slices) {
            val d = arcPath(inner, radius, slice.startAngle, slice.endAngle, padAngle = slice.padAngle)
            marks += Mark.PathMark(d, Ink.Series(slice.index), fill = true, dx = center, dy = center)
            marks += Mark.PathMark(d, Ink.Surface, fill = false, strokeWidth = 2f, dx = center, dy = center)
        }
        val total = slices.sumOf { it.value }
        val totalText = formatPartWholeValue(total)
        val fontSize = chart.size * 0.0533
        val texts = if (inner > 0 && centerTotalFits(totalText, inner, fontSize)) {
            listOf(SceneText(totalText, center, center + fontSize * 0.35, TextAnchor.MIDDLE, fontSize.toFloat(), strong = true))
        } else emptyList()
        ChartScene(chart.size, chart.size, marks, texts)
    }
    PartWholeKind.SUNBURST -> {
        val center = chart.size / 2
        val radius = max(0.0, chart.size * 0.48)
        val arcs = sunburst(chart.root!!, radius, radius * min(0.75, max(0.0, chart.innerRatio))).orEmpty()
        val marks = mutableListOf<Mark>()
        arcs.filter { it.depth > 0 && it.value > 0 }.forEachIndexed { index, arc ->
            val d = arcPath(arc.y0, arc.y1, arc.x0 + PI / 2, arc.x1 + PI / 2, padAngle = chart.padAngle)
            marks += Mark.PathMark(d, Ink.Series(index), fill = true, dx = center, dy = center)
            marks += Mark.PathMark(d, Ink.Surface, fill = false, strokeWidth = 1.5f, dx = center, dy = center)
        }
        ChartScene(chart.size, chart.size, marks)
    }
    PartWholeKind.TREEMAP -> {
        val rects = treemap(chart.root!!, chart.width, chart.height, chart.padding).orEmpty()
        val marks = mutableListOf<Mark>()
        rects.filter { it.leaf && it.value > 0 }.forEachIndexed { index, rect ->
            marks += Mark.RectMark(rect.x0, rect.y0, max(0.0, rect.x1 - rect.x0), max(0.0, rect.y1 - rect.y0), Ink.Series(index))
            marks += Mark.PathMark("M${jsNumber(rect.x0)},${jsNumber(rect.y0)}H${jsNumber(rect.x1)}V${jsNumber(rect.y1)}H${jsNumber(rect.x0)}Z", Ink.Surface, fill = false, strokeWidth = 2f)
        }
        ChartScene(chart.width, chart.height, marks)
    }
}

/** The legend the web shows: data items, visible arcs or leaves, in color order. */
internal fun partWholeLegend(chart: PartWholeChart): List<LegendItem> = when (chart.kind) {
    PartWholeKind.PIE, PartWholeKind.DONUT -> chart.data.mapIndexed { index, datum -> LegendItem(datum.label, index) }
    PartWholeKind.SUNBURST -> sunburst(chart.root!!).orEmpty().filter { it.depth > 0 && it.value > 0 }.mapIndexed { index, arc -> LegendItem(arc.label ?: arc.id, index) }
    PartWholeKind.TREEMAP -> treemap(chart.root!!, chart.width, chart.height, chart.padding).orEmpty().filter { it.leaf && it.value > 0 }.mapIndexed { index, rect -> LegendItem(rect.label ?: rect.id, index) }
}

/** `PartWholeDataTable`: category and value, indented by depth for trees. */
internal fun partWholeTable(chart: PartWholeChart): ChartTable {
    val rows = when (chart.kind) {
        PartWholeKind.PIE, PartWholeKind.DONUT -> {
            val slices = pie(chart.data.map { it.value })
            chart.data.mapIndexed { index, datum -> PartWholeRow(datum.id, datum.label, slices[index].value, null) }
        }
        else -> treeTableRows(chart.root!!)
    }
    return ChartTable(
        listOf(chart.labels.category, chart.labels.value),
        rows.map { listOf("  ".repeat(it.depth ?: 0) + it.label, formatPartWholeValue(it.value)) },
    )
}

@Composable
internal fun PartWholeChartView(chart: PartWholeChart) {
    val scene = partWholeScene(chart)
    val legend = partWholeLegend(chart)
    ChartFrame(chart.title, chart.description, "${legend.size} ${chart.labels.category.lowercase()} items", legend = legend, table = partWholeTable(chart)) {
        SceneCanvas(minUnits = scene.width, maxUnits = scene.width) { scene }
    }
}
