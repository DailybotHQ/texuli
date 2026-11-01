package com.texuli.compose

import androidx.compose.foundation.border
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clipToBounds
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import com.texuli.spec.JsonValue
import kotlin.math.PI
import kotlin.math.atan
import kotlin.math.floor
import kotlin.math.ln
import kotlin.math.log2
import kotlin.math.max
import kotlin.math.min
import kotlin.math.pow
import kotlin.math.sin
import kotlin.math.sinh

/*
 * Boards, maps, dashboards and filters natively (ADR-025): data-board,
 * data-map, data-dashboard, data-dashboard-widget and data-filter-builder.
 * The board grouping and WIP rules, the Mercator projection, clustering and
 * the bundled Port Meridian basemap, the dashboard layout engine and the
 * filter model are the web's (`@texuli/data` engines), ported and
 * vector-checked. Moving cards, panning, editing a layout and editing a
 * filter are interactive on the web; natively these views paint read-only.
 */

// --- data-board ------------------------------------------------------------------

internal class BoardColumnDef(val id: String, val title: String, val wipSoft: Int?, val wipHard: Int?)

internal class BoardCard(val id: String, val title: String, val column: String, val lane: String?, val rank: String, val detail: String?)

internal class BoardGrid(val columns: List<BoardColumnDef>, val lanes: List<Pair<String, String>>, val cells: List<List<List<BoardCard>>>, val counts: Map<String, Int>, val unplaced: List<BoardCard>)

/** `groupBoard`: cards into lane × column cells by rank then id; cards on unknown columns or lanes are unplaced. */
internal fun groupBoard(cards: List<BoardCard>, columns: List<BoardColumnDef>, lanes: List<Pair<String, String>>): BoardGrid {
    val useLanes = lanes.isNotEmpty()
    val laneList = if (useLanes) lanes else listOf("default" to "")
    val laneIndex = laneList.withIndex().associate { it.value.first to it.index }
    val columnIndex = columns.withIndex().associate { it.value.id to it.index }
    val cells = laneList.map { columns.map { mutableListOf<BoardCard>() } }
    val counts = columns.associate { it.id to 0 }.toMutableMap()
    val unplaced = mutableListOf<BoardCard>()
    for (card in cards) {
        val c = columnIndex[card.column]
        val l = laneIndex[if (useLanes) card.lane ?: "" else "default"]
        if (c == null || l == null) {
            unplaced += card
            continue
        }
        cells[l][c] += card
        counts[columns[c].id] = counts.getValue(columns[c].id) + 1
    }
    for (row in cells) for (cell in row) cell.sortWith(compareBy<BoardCard> { it.rank }.thenBy { it.id })
    return BoardGrid(columns, laneList, cells, counts, unplaced)
}

/** `evaluateWip`: blocked at the hard limit, warn at the soft one. */
internal fun evaluateWip(column: BoardColumnDef, count: Int): Pair<String, String?> {
    val hard = column.wipHard
    val soft = column.wipSoft
    fun sentence(limit: Int, kind: String) = "${column.title} ${if (count > limit) "is over" else "has reached"} its ${kind}WIP limit ($count of $limit)."
    if (hard != null && count >= hard) return "blocked" to sentence(hard, "")
    if (soft != null && count >= soft) return "warn" to sentence(soft, "soft ")
    return "ok" to null
}

internal class BoardView(val label: String, val grid: BoardGrid, val compact: Boolean)

internal fun nativeDataBoard(props: Map<String, JsonValue>): BoardView? {
    val label = props.propName("label") ?: return null
    val rawColumns = props.propArray("columns") ?: return null
    val rawItems = props.propArray("items") ?: return null
    if (rawColumns.isEmpty() || rawColumns.size > 24 || rawItems.size > DATA_MAX_ROWS) return null
    val columns = rawColumns.map { item ->
        val f = item.asObject ?: return null
        if (f.mistyped("wipSoft") { it is JsonValue.Num } || f.mistyped("wipHard") { it is JsonValue.Num }) return null
        BoardColumnDef(f.propName("id") ?: return null, f.propString("title") ?: return null, f.propNumber("wipSoft")?.toInt(), f.propNumber("wipHard")?.toInt())
    }
    val lanes = (props.propArray("lanes") ?: if ("lanes" in props) return null else emptyList()).map { item ->
        val f = item.asObject ?: return null
        (f.propName("id") ?: return null) to (f.propString("title") ?: return null)
    }
    if (lanes.size > 24) return null
    val seeded = rankSequence(rawItems.size)
    val cards = rawItems.mapIndexed { index, item ->
        val f = item.asObject ?: return null
        for (key in listOf("lane", "rank", "detail")) if (f.mistyped(key) { it is JsonValue.Str }) return null
        BoardCard(f.propName("id") ?: return null, f.propString("title") ?: return null, f.propString("column") ?: return null, f.propString("lane"), f.propString("rank")?.takeIf(String::isNotEmpty) ?: seeded[index], f.propString("detail"))
    }
    if (cards.map { it.id }.toSet().size != cards.size) return null
    val compact = when (props.propEnum("density", setOf("comfortable", "compact"))) {
        null, "comfortable" -> false
        "compact" -> true
        else -> return null
    }
    return BoardView(label, groupBoard(cards, columns, lanes), compact)
}

@Composable
internal fun BoardPainter(view: BoardView) {
    val grid = view.grid
    Column(Modifier.fillMaxWidth().semantics { contentDescription = view.label }, verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Text(view.label, style = MaterialTheme.typography.titleSmall)
        Row(Modifier.horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            grid.columns.forEachIndexed { c, column ->
                val count = grid.counts.getValue(column.id)
                val (status, reason) = evaluateWip(column, count)
                Column(Modifier.width(220.dp).border(1.dp, if (status == "ok") MaterialTheme.colorScheme.outlineVariant else MaterialTheme.colorScheme.error, RoundedCornerShape(8.dp)).padding(8.dp), verticalArrangement = Arrangement.spacedBy(if (view.compact) 4.dp else 8.dp)) {
                    Text("${column.title}  $count" + (column.wipHard?.let { "/$it" } ?: ""), style = MaterialTheme.typography.labelLarge)
                    reason?.let { Text(it, style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.error) }
                    grid.lanes.forEachIndexed { l, lane ->
                        if (grid.lanes.size > 1) Text(lane.second, style = MaterialTheme.typography.labelMedium)
                        grid.cells[l][c].forEach { card ->
                            Column(Modifier.fillMaxWidth().border(1.dp, MaterialTheme.colorScheme.outline, RoundedCornerShape(6.dp)).padding(8.dp)) {
                                Text(card.title, style = MaterialTheme.typography.bodyMedium)
                                card.detail?.let { Text(it, style = MaterialTheme.typography.bodySmall) }
                            }
                        }
                    }
                }
            }
        }
        if (grid.unplaced.isNotEmpty()) {
            Text("Not on the board: ${grid.unplaced.size}", style = MaterialTheme.typography.labelMedium)
            grid.unplaced.forEach { Text(it.title, style = MaterialTheme.typography.bodySmall) }
        }
    }
}

// --- data-map -----------------------------------------------------------------------

internal data class LngLat(val lng: Double, val lat: Double)

internal data class MapViewState(val center: LngLat, val zoom: Double)

internal class BasemapFeature(val id: String, val kind: String, val name: String?, val label: List<Double>?, val geometry: String, val coords: List<Double>)

internal class Basemap(val id: String, val name: String, val bbox: List<Double>, val attribution: String, val features: List<BasemapFeature>)

private const val TILE = 256.0
private const val MAX_LAT = 85.05112878

/** `mercator`: lng/lat to the unit square. */
internal fun mercator(point: LngLat): Pair<Double, Double> {
    val lat = max(-MAX_LAT, min(MAX_LAT, point.lat))
    val s = sin((lat * PI) / 180)
    return (point.lng + 180) / 360 to 0.5 - ln((1 + s) / (1 - s)) / (4 * PI)
}

internal fun inverseMercator(x: Double, y: Double): LngLat = LngLat(x * 360 - 180, (atan(sinh(PI * (1 - 2 * y))) * 180) / PI)

private fun worldSize(zoom: Double) = TILE * 2.0.pow(zoom)

/** `project`: a point to screen px for a view. */
internal fun project(point: LngLat, view: MapViewState, width: Double, height: Double): Pair<Double, Double> {
    val world = worldSize(view.zoom)
    val (px, py) = mercator(point)
    val (cx, cy) = mercator(view.center)
    return (px - cx) * world + width / 2 to (py - cy) * world + height / 2
}

internal fun unproject(x: Double, y: Double, view: MapViewState, width: Double, height: Double): LngLat {
    val world = worldSize(view.zoom)
    val (cx, cy) = mercator(view.center)
    return inverseMercator(cx + (x - width / 2) / world, cy + (y - height / 2) / world)
}

/** `fitBounds`: the view that shows `bbox` whole with `padding` px around it. */
internal fun fitBounds(bbox: List<Double>, width: Double, height: Double, padding: Double = 24.0): MapViewState {
    val (ax, ay) = mercator(LngLat(bbox[0], bbox[3]))
    val (bx, by) = mercator(LngLat(bbox[2], bbox[1]))
    val w = max(1.0, width - 2 * padding)
    val h = max(1.0, height - 2 * padding)
    val zoom = max(0.0, min(22.0, log2(min(w / max(bx - ax, 1e-9), h / max(by - ay, 1e-9)) / TILE)))
    return MapViewState(inverseMercator((ax + bx) / 2, (ay + by) / 2), zoom)
}

internal fun viewBounds(view: MapViewState, width: Double, height: Double): List<Double> {
    val topLeft = unproject(0.0, 0.0, view, width, height)
    val bottomRight = unproject(width, height, view, width, height)
    return listOf(topLeft.lng, bottomRight.lat, bottomRight.lng, topLeft.lat)
}

internal class BasemapPath(val id: String, val kind: String, val closed: Boolean, val d: String, val label: Triple<Double, Double, String>?)

private fun r1(n: Double) = jsRound(n * 10) / 10

/** `basemapPaths`: the features in view as screen paths ("M x yL x y…"). */
internal fun basemapPaths(basemap: Basemap, view: MapViewState, width: Double, height: Double): List<BasemapPath> {
    val visible = viewBounds(view, width, height)
    return basemap.features.mapNotNull { feature ->
        var minLng = Double.POSITIVE_INFINITY
        var minLat = Double.POSITIVE_INFINITY
        var maxLng = Double.NEGATIVE_INFINITY
        var maxLat = Double.NEGATIVE_INFINITY
        for (i in feature.coords.indices step 2) {
            minLng = min(minLng, feature.coords[i])
            maxLng = max(maxLng, feature.coords[i])
            minLat = min(minLat, feature.coords[i + 1])
            maxLat = max(maxLat, feature.coords[i + 1])
        }
        if (!(minLng <= visible[2] && maxLng >= visible[0] && minLat <= visible[3] && maxLat >= visible[1])) return@mapNotNull null
        val d = StringBuilder()
        for (i in feature.coords.indices step 2) {
            val (x, y) = project(LngLat(feature.coords[i], feature.coords[i + 1]), view, width, height)
            d.append(if (i == 0) "M" else "L").append(jsNumber(r1(x))).append(' ').append(jsNumber(r1(y)))
        }
        val closed = feature.geometry == "polygon"
        if (closed) d.append('Z')
        val label = feature.name?.let { name ->
            val at = feature.label ?: listOf(feature.coords[0], feature.coords[1])
            val (x, y) = project(LngLat(at[0], at[1]), view, width, height)
            Triple(r1(x), r1(y), name)
        }
        BasemapPath(feature.id, feature.kind, closed, d.toString(), label)
    }
}

internal class MapMarker(val id: String, val label: String, val lat: Double, val lng: Double, val detail: String?, val tone: String)

internal sealed interface ClusterItem {
    class Point(val marker: MapMarker) : ClusterItem
    class Cluster(val id: String, val center: LngLat, val count: Int, val ids: List<String>) : ClusterItem
}

/** `cluster`: markers bucketed into `cellPx` cells of the zoom's world; a lone marker stays a point. */
internal fun cluster(points: List<MapMarker>, zoom: Double, cellPx: Double = 64.0): List<ClusterItem> {
    val z = floor(zoom)
    val world = 256 * 2.0.pow(z)
    val cell = max(1.0, cellPx)
    class Bucket(val cx: Int, val cy: Int, val members: MutableList<MapMarker>, var x: Double, var y: Double)
    val cells = linkedMapOf<String, Bucket>()
    for (point in points.sortedBy { it.id }) {
        val (mx, my) = mercator(LngLat(point.lng, point.lat))
        val cx = floor((mx * world) / cell).toInt()
        val cy = floor((my * world) / cell).toInt()
        val bucket = cells["$cx:$cy"]
        if (bucket != null) {
            bucket.members += point
            bucket.x += mx
            bucket.y += my
        } else {
            cells["$cx:$cy"] = Bucket(cx, cy, mutableListOf(point), mx, my)
        }
    }
    return cells.values.sortedWith(compareBy<Bucket>({ it.cy }, { it.cx })).map { b ->
        if (b.members.size == 1) ClusterItem.Point(b.members[0])
        else ClusterItem.Cluster("cluster:${jsNumber(z)}:${b.cx}:${b.cy}", inverseMercator(b.x / b.members.size, b.y / b.members.size), b.members.size, b.members.map { it.id })
    }
}

internal const val MAP_WIDTH = 800.0
internal const val MAP_HEIGHT = 480.0

internal class MapModel(val label: String, val markers: List<MapMarker>, val below: Boolean)

internal fun nativeMap(props: Map<String, JsonValue>): MapModel? {
    val label = props.propName("label") ?: return null
    val raw = props.propArray("markers") ?: return null
    if (raw.size > DATA_MAX_ROWS) return null
    val markers = raw.map { item ->
        val f = item.asObject ?: return null
        if (f.mistyped("detail") { it is JsonValue.Str } || f.mistyped("tone") { it is JsonValue.Str }) return null
        val lat = f.propNumber("lat")?.takeIf { it in -90.0..90.0 } ?: return null
        val lng = f.propNumber("lng")?.takeIf { it in -180.0..180.0 } ?: return null
        // `resolveMapTone`: the known tones, anything else primary.
        val tone = f.propString("tone")?.takeIf { it in setOf("info", "success", "warning", "danger", "neutral") } ?: "primary"
        MapMarker(f.propName("id") ?: return null, f.propString("label") ?: return null, lat, lng, f.propString("detail"), tone)
    }
    if (markers.map { it.id }.toSet().size != markers.size) return null
    val below = when (props.propEnum("listPlacement", setOf("side", "below"))) {
        null, "side" -> false
        "below" -> true
        else -> return null
    }
    return MapModel(label, markers, below)
}

private fun toneInk(tone: String): Ink = when (tone) {
    "danger" -> Ink.Series(3)
    "warning" -> Ink.Series(4)
    "success" -> Ink.Series(2)
    "info" -> Ink.Series(1)
    "neutral" -> Ink.Axis
    else -> Ink.Series(0)
}

/** The map at its initial view (`initialMapView`: the basemap fit with 28 px padding), markers and clusters as the web places them. */
internal fun mapScene(model: MapModel, basemap: Basemap = PORT_MERIDIAN): ChartScene {
    val view = fitBounds(basemap.bbox, MAP_WIDTH, MAP_HEIGHT, 28.0)
    val marks = mutableListOf<Mark>()
    val texts = mutableListOf<SceneText>()
    marks += Mark.RectMark(0.0, 0.0, MAP_WIDTH, MAP_HEIGHT, Ink.Ramp(0.15))
    for (path in basemapPaths(basemap, view, MAP_WIDTH, MAP_HEIGHT)) {
        when (path.kind) {
            "land" -> marks += Mark.PathMark(path.d, Ink.Surface, fill = true)
            "water" -> marks += Mark.PathMark(path.d, Ink.Ramp(0.35), fill = path.closed, strokeWidth = 4f)
            "park" -> marks += Mark.PathMark(path.d, Ink.Series(2), fill = true, alpha = 0.25f)
            "district" -> marks += Mark.PathMark(path.d, Ink.Grid, fill = false, strokeWidth = 1f)
            "road" -> marks += Mark.PathMark(path.d, Ink.Axis, fill = false, strokeWidth = 2f)
            else -> marks += Mark.PathMark(path.d, Ink.Axis, fill = false, strokeWidth = 1f)
        }
        path.label?.let { (x, y, text) -> texts += SceneText(text, x, y, size = 10f) }
    }
    for (item in cluster(model.markers, view.zoom, 72.0)) {
        when (item) {
            is ClusterItem.Point -> {
                val (x, y) = project(LngLat(item.marker.lng, item.marker.lat), view, MAP_WIDTH, MAP_HEIGHT)
                if (x < -24 || x > MAP_WIDTH + 24 || y < -24 || y > MAP_HEIGHT + 24) continue
                marks += Mark.CircleMark(x, y, 7.0, toneInk(item.marker.tone))
                marks += Mark.CircleMark(x, y, 7.0, Ink.Surface, fill = false)
            }
            is ClusterItem.Cluster -> {
                val (x, y) = project(item.center, view, MAP_WIDTH, MAP_HEIGHT)
                if (x < -32 || x > MAP_WIDTH + 32 || y < -32 || y > MAP_HEIGHT + 32) continue
                marks += Mark.CircleMark(x, y, 14.0, Ink.Series(0), alpha = 0.85f)
                texts += SceneText("${item.count}", x, y + 4, strong = true)
            }
        }
    }
    texts += SceneText(basemap.attribution, MAP_WIDTH - 8, MAP_HEIGHT - 8, TextAnchor.END, size = 9f)
    return ChartScene(MAP_WIDTH, MAP_HEIGHT, marks, texts)
}

@Composable
internal fun MapPainter(model: MapModel) {
    Column(Modifier.fillMaxWidth().semantics { contentDescription = model.label }, verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Text(model.label, style = MaterialTheme.typography.titleSmall)
        // The web fits its map to the figure; natively the 800 × 480 scene scales down to the width.
        FittedScene(mapScene(model))
        // The place list: every marker, the map's non-visual path.
        model.markers.forEach { marker ->
            Text(marker.label + (marker.detail?.let { " · $it" } ?: ""), style = MaterialTheme.typography.bodySmall)
        }
    }
}

// --- data-dashboard -------------------------------------------------------------------

internal data class DashItem(val id: String, val x: Int, val y: Int, val w: Int, val h: Int, val minW: Int? = null, val minH: Int? = null, val maxW: Int? = null, val maxH: Int? = null, val locked: Boolean = false)

private val DASH_ID = Regex("^[A-Za-z0-9][A-Za-z0-9_-]*$")

internal fun isDashboardId(value: String?): Boolean = value != null && value.length in 1..64 && DASH_ID.matches(value)

/** `clampInt`: a finite number rounded into [min, max], else `fallback`. */
internal fun clampInt(value: Double?, lo: Int, hi: Int, fallback: Int): Int =
    if (value == null || !value.isFinite()) fallback else min(hi.toDouble(), max(lo.toDouble(), jsRound(value))).toInt()

internal fun clampColumns(columns: Double?): Int = clampInt(columns, 1, 24, 12)

private fun overlaps(a: DashItem, b: DashItem) = a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h

private val itemOrder = compareBy<DashItem>({ it.y }, { it.x }, { it.id })

private fun firstCollision(item: DashItem, placed: List<DashItem>): DashItem? = placed.firstOrNull { it.id != item.id && overlaps(item, it) }

private fun settle(item: DashItem, placed: List<DashItem>, vertical: Boolean): Int {
    var y = if (vertical) placed.filter { it.x < item.x + item.w && item.x < it.x + it.w && it.y + it.h <= item.y }.maxOfOrNull { it.y + it.h } ?: 0 else item.y
    repeat(placed.size + 1) {
        val hit = firstCollision(item.copy(y = y), placed) ?: return y
        y = hit.y + hit.h
    }
    return y
}

/** `compactLayout`: locked widgets stay; the rest float up (vertical) or only clear collisions. */
internal fun compactLayout(layout: List<DashItem>, vertical: Boolean = true): List<DashItem> {
    val sorted = layout.sortedWith(itemOrder)
    val placed = sorted.filter { it.locked }.toMutableList()
    val out = placed.toMutableList()
    for (item in sorted) {
        if (item.locked) continue
        val y = settle(item, placed, vertical)
        val next = if (y == item.y) item else item.copy(y = y)
        placed += next
        out += next
    }
    return out.sortedWith(itemOrder)
}

/** `normalizeItem`: sizes and positions clamped into the grid; null for a non-widget. */
internal fun normalizeItem(input: Map<String, JsonValue>, columns: Int): Pair<DashItem, Boolean>? {
    val id = input.propString("id")?.takeIf(::isDashboardId) ?: return null
    fun n(key: String) = (input[key] as? JsonValue.Num)?.value
    val cols = min(24, max(1, columns))
    val minW = clampInt(n("minW"), 1, cols, 1)
    val maxW = clampInt(n("maxW"), minW, cols, cols)
    val minH = clampInt(n("minH"), 1, 48, 1)
    val maxH = clampInt(n("maxH"), minH, 48, 48)
    val w = clampInt(n("w"), minW, maxW, max(minW, min(maxW, min(cols, 4))))
    val h = clampInt(n("h"), minH, maxH, max(minH, min(maxH, 3)))
    val placed = n("x")?.isFinite() == true && n("y")?.isFinite() == true
    val item = DashItem(
        id, clampInt(n("x"), 0, cols - w, 0), clampInt(n("y"), 0, 4096, 0), w, h,
        minW.takeIf { it > 1 }, minH.takeIf { it > 1 },
        maxW.takeIf { it < cols && n("maxW")?.isFinite() == true }, maxH.takeIf { it < 48 },
        (input["locked"] as? JsonValue.Bool)?.value == true,
    )
    return item to placed
}

/** `firstFit`: the first free cell scanning rows, then columns. */
internal fun firstFit(layout: List<DashItem>, w0: Int, h0: Int, columns: Int): Pair<Int, Int> {
    val w = min(columns, max(1, w0))
    val h = max(1, h0)
    val ys = sortedSetOf(0)
    val xs = sortedSetOf(0)
    for (item in layout) {
        ys += item.y + item.h
        if (item.x + item.w + w <= columns) xs += item.x + item.w
    }
    for (y in ys) for (x in xs) if (firstCollision(DashItem("", x, y, w, h), layout) == null) return x to y
    return 0 to (layout.maxOfOrNull { it.y + it.h } ?: 0)
}

/** `normalizeLayout`: at most 200 widgets, duplicates dropped, locks kept apart, unplaced widgets first-fit. */
internal fun normalizeLayout(input: List<Map<String, JsonValue>>, columns: Int, vertical: Boolean = true): List<DashItem> {
    val cols = min(24, max(1, columns))
    val seen = mutableSetOf<String>()
    val placed = mutableListOf<DashItem>()
    val unplaced = mutableListOf<DashItem>()
    for (raw in input.take(200)) {
        val (item, isPlaced) = normalizeItem(raw, cols) ?: continue
        if (!seen.add(item.id)) continue
        (if (isPlaced) placed else unplaced) += item
    }
    val locked = mutableListOf<DashItem>()
    val rest = mutableListOf<DashItem>()
    for (item in placed.sortedWith(itemOrder)) {
        if (item.locked && firstCollision(item, locked) == null) locked += item else rest += item.copy(locked = false)
    }
    var layout = compactLayout(locked + rest, vertical)
    for (item in unplaced) {
        val (x, y) = firstFit(layout, item.w, item.h, cols)
        layout = layout + item.copy(x = x, y = y)
    }
    return compactLayout(layout, vertical)
}

internal fun DashItem.toJson(): Map<String, JsonValue> = buildMap {
    put("id", JsonValue.Str(id))
    put("x", JsonValue.Num(x.toDouble()))
    put("y", JsonValue.Num(y.toDouble()))
    put("w", JsonValue.Num(w.toDouble()))
    put("h", JsonValue.Num(h.toDouble()))
    minW?.let { put("minW", JsonValue.Num(it.toDouble())) }
    minH?.let { put("minH", JsonValue.Num(it.toDouble())) }
    maxW?.let { put("maxW", JsonValue.Num(it.toDouble())) }
    maxH?.let { put("maxH", JsonValue.Num(it.toDouble())) }
    if (locked) put("locked", JsonValue.Bool(true))
}

/** `reflowLayout`: a layout scaled from `from` to `to` columns, in reading order. */
internal fun reflowLayout(layout: List<DashItem>, from: Int, to: Int, vertical: Boolean = true): List<DashItem> {
    val ordered = layout.sortedWith(itemOrder)
    if (from == to) return compactLayout(ordered, vertical)
    val ratio = to.toDouble() / from
    val scaled = ordered.mapIndexed { index, item ->
        val minW = clampInt(item.minW?.toDouble(), 1, to, 1)
        val maxW = clampInt(item.maxW?.toDouble(), minW, to, to)
        val w = min(to, max(minW, min(maxW, jsRound(item.w * ratio).toInt().let { if (it == 0) 1 else it })))
        val x = min(to - w, max(0, jsRound(item.x * ratio).toInt()))
        item.copy(x = x, y = if (to == 1) index else item.y, w = w)
    }
    return normalizeLayout(scaled.map { it.toJson() }, to, vertical)
}

internal data class DashBreakpoint(val id: String, val minWidth: Int, val columns: Int)

/** `dashboardBreakpoints`: lg (≥ 1024), md (≥ 640, at most 6 columns), sm (one column). */
internal fun dashboardBreakpoints(columns: Int): List<DashBreakpoint> {
    val out = mutableListOf(DashBreakpoint("lg", 1024, columns))
    if (columns > 6) out += DashBreakpoint("md", 640, 6) else if (columns > 1) out += DashBreakpoint("md", 640, columns)
    out += DashBreakpoint("sm", 0, 1)
    return out
}

internal fun resolveBreakpoint(width: Double, points: List<DashBreakpoint>): DashBreakpoint =
    points.firstOrNull { width >= it.minWidth } ?: points.last()

/** The dashboard's resolved layout at a breakpoint: the design at the widest grid, reflowed, plus first-fit for widgets it does not know. */
internal fun resolveDashboard(design: List<Map<String, JsonValue>>, widgets: List<DashWidget>, active: DashBreakpoint, points: List<DashBreakpoint>, vertical: Boolean): List<DashItem> {
    val widest = points.first()
    val ids = widgets.map { it.id }.toSet()
    val read = normalizeLayout(design, widest.columns, vertical)
    var next = (if (active.id == widest.id) read else reflowLayout(read, widest.columns, active.columns, vertical)).filter { it.id in ids }
    for (widget in widgets) {
        if (next.any { it.id == widget.id }) continue
        val size = widget.place - "x" - "y"
        val (item, _) = normalizeItem(size + ("id" to JsonValue.Str(widget.id)), active.columns) ?: continue
        if (next.size >= 200) continue
        val (x, y) = firstFit(next, item.w, item.h, active.columns)
        next = compactLayout(next + item.copy(x = x, y = y), vertical)
    }
    return next
}

/** The deepest dashboard row native draws. */
internal const val DASHBOARD_MAX_ROWS = 400

internal class DashWidget(val id: String, val title: String, val place: Map<String, JsonValue>, val childIndex: Int)

internal class DashboardModel(val label: String, val columns: Int, val rowHeight: Int, val gap: Int, val vertical: Boolean, val layout: List<Map<String, JsonValue>>?, val widgets: List<DashWidget>)

internal fun nativeDashboard(props: Map<String, JsonValue>, children: List<Pair<String, Map<String, JsonValue>>>): DashboardModel? {
    val label = props.propName("label") ?: return null
    if (props.mistyped("columns") { it is JsonValue.Num } || props.mistyped("editable") { it is JsonValue.Bool }) return null
    val columns = clampColumns(props.propNumber("columns"))
    val rowHeight = when (props.propEnum("density", setOf("compact", "default", "comfortable"))) {
        "compact" -> 56
        null, "default" -> 80
        "comfortable" -> 112
        else -> return null
    }
    val gap = when (props.propEnum("gap", setOf("none", "small", "medium", "large"))) {
        "none" -> 0
        "small" -> 8
        null, "medium" -> 16
        "large" -> 24
        else -> return null
    }
    val vertical = when (props.propEnum("compaction", setOf("vertical", "none"))) {
        null, "vertical" -> true
        "none" -> false
        else -> return null
    }
    val layout = props["layout"]?.let { raw -> (raw as? JsonValue.Arr)?.items?.map { it.asObject ?: return null } ?: return null }
    val widgets = children.mapIndexedNotNull { index, (id, childProps) ->
        if (id != "data-dashboard-widget") return@mapIndexedNotNull null
        DashWidget(childProps.propString("widgetId")?.takeIf(::isDashboardId) ?: return null, childProps.propString("title") ?: return null, childProps.propObject("place") ?: emptyMap(), index)
    }
    if (widgets.map { it.id }.toSet().size != widgets.size) return null
    return DashboardModel(label, columns, rowHeight, gap, vertical, layout, widgets)
}

/** The design at the widest grid: the given layout plus the placed widgets it does not know. */
internal fun dashboardDesign(model: DashboardModel): List<Map<String, JsonValue>> {
    val placed = model.widgets.filter { (it.place["x"] as? JsonValue.Num)?.value?.isFinite() == true && (it.place["y"] as? JsonValue.Num)?.value?.isFinite() == true }
        .map { it.place + ("id" to JsonValue.Str(it.id)) }
    val layout = model.layout ?: return placed
    val known = layout.mapNotNull { it.propString("id") }.toSet()
    return layout + placed.filter { it.propString("id") !in known }
}

@Composable
internal fun DashboardGrid(model: DashboardModel, widget: @Composable (DashWidget) -> Unit) {
    BoxWithConstraints(Modifier.fillMaxWidth().semantics { contentDescription = model.label }) {
        val points = dashboardBreakpoints(model.columns)
        val active = resolveBreakpoint(maxWidth.value.toDouble(), points)
        val items = resolveDashboard(dashboardDesign(model), model.widgets, active, points, model.vertical)
        val byId = model.widgets.associateBy { it.id }
        val columnWidth = (maxWidth.value - model.gap * (active.columns - 1)) / active.columns
        // Rows past the cap are not drawn (Compose measures in Int pixels); `compaction: none` can leave y at 4096.
        val shown = items.filter { it.y + it.h <= DASHBOARD_MAX_ROWS }
        val rows = shown.maxOfOrNull { it.y + it.h } ?: 0
        Box(Modifier.fillMaxWidth().height((rows * model.rowHeight + max(0, rows - 1) * model.gap).dp)) {
            for (item in shown) {
                val w = byId[item.id] ?: continue
                Column(
                    Modifier
                        .offset(x = (item.x * (columnWidth + model.gap)).dp, y = (item.y * (model.rowHeight + model.gap)).dp)
                        .width((item.w * columnWidth + (item.w - 1) * model.gap).dp)
                        .height((item.h * model.rowHeight + (item.h - 1) * model.gap).dp)
                        .border(1.dp, MaterialTheme.colorScheme.outlineVariant, RoundedCornerShape(8.dp))
                        .clipToBounds()
                        .padding(8.dp),
                ) {
                    widget(w)
                }
            }
        }
    }
}

// --- data-filter-builder ----------------------------------------------------------------

internal class FilterFieldDef(val key: String, val header: String, val type: String, val options: List<String>, val optionLabels: Map<String, String>)

internal sealed interface FilterNode {
    class Group(val op: String, val children: List<FilterNode>) : FilterNode
    class Condition(val field: String, val operator: String, val value: JsonValue?) : FilterNode
}

private val OPERATORS_BY_TYPE = mapOf(
    "text" to listOf("eq", "neq", "contains", "in", "isEmpty", "isNotEmpty"),
    "enum" to listOf("eq", "neq", "in", "isEmpty", "isNotEmpty"),
    "number" to listOf("eq", "neq", "in", "between", "isEmpty", "isNotEmpty"),
    "date" to listOf("eq", "neq", "between", "before", "after", "isEmpty", "isNotEmpty"),
    "boolean" to listOf("eq", "neq", "isEmpty", "isNotEmpty"),
)

internal val OPERATOR_LABELS = mapOf(
    "eq" to "is", "neq" to "is not", "contains" to "contains", "in" to "is any of", "between" to "is between",
    "before" to "is before", "after" to "is after", "isEmpty" to "is empty", "isNotEmpty" to "is not empty",
)

private fun isScalar(v: JsonValue): Boolean = v == JsonValue.Null || v is JsonValue.Bool || (v is JsonValue.Num && v.value.isFinite()) || (v is JsonValue.Str && v.value.length <= 500)

/** `parseFilter` against the fields: null where the web throws (it then starts from an empty filter). */
internal fun parseFilter(input: JsonValue, fields: List<FilterFieldDef>): FilterNode.Group? {
    val byKey = fields.associateBy { it.key }
    var nodes = 0
    fun valueFits(field: FilterFieldDef, v: JsonValue): Boolean = when {
        v == JsonValue.Null -> true
        field.type == "number" -> v is JsonValue.Num
        field.type == "boolean" -> v is JsonValue.Bool
        field.type == "date" -> (v is JsonValue.Str && (parseIsoDate(v.value.take(10)) != null)) || v is JsonValue.Num
        field.type == "enum" && field.options.isNotEmpty() -> (v as? JsonValue.Str)?.value in field.options || (v is JsonValue.Num && jsNumber(v.value) in field.options)
        else -> true
    }
    fun parse(node: JsonValue, depth: Int): FilterNode? {
        if (++nodes > 200 || depth > 6) return null
        val f = node.asObject ?: return null
        if (f["type"] == JsonValue.Str("group")) {
            if (!f.keys.all { it in setOf("type", "op", "children") }) return null
            val op = f.propString("op")?.takeIf { it == "and" || it == "or" } ?: return null
            val children = f.propArray("children") ?: return null
            if (children.size > 200) return null
            return FilterNode.Group(op, children.map { parse(it, depth + 1) ?: return null })
        }
        if (f["type"] != JsonValue.Str("condition") || !f.keys.all { it in setOf("type", "field", "operator", "value") }) return null
        val operator = f.propString("operator")?.takeIf { it in OPERATOR_LABELS } ?: return null
        val key = f.propString("field")?.takeIf { it.length in 1..64 } ?: return null
        val value = f["value"]
        if (value != null) {
            val ok = if (value is JsonValue.Arr) value.items.size <= 100 && value.items.all(::isScalar) else isScalar(value)
            if (!ok) return null
        }
        val list = (value as? JsonValue.Arr)?.items
        when (operator) {
            "isEmpty", "isNotEmpty" -> if (value != null) return null
            "in" -> if (list.isNullOrEmpty()) return null
            "between" -> if (list?.size != 2) return null
            "contains" -> if ((value as? JsonValue.Str)?.value.isNullOrEmpty()) return null
            "before", "after" -> if (value !is JsonValue.Str && value !is JsonValue.Num) return null
            else -> if (value == null || value is JsonValue.Arr) return null
        }
        val field = byKey[key] ?: return null
        if (operator !in OPERATORS_BY_TYPE.getValue(field.type)) return null
        if (!(list ?: listOfNotNull(value)).all { valueFits(field, it) }) return null
        return FilterNode.Condition(key, operator, value)
    }
    return when (val root = parse(input, 1)) {
        null -> null
        is FilterNode.Group -> root
        is FilterNode.Condition -> FilterNode.Group("and", listOf(root))
    }
}

internal class FilterModel(val label: String, val fields: List<FilterFieldDef>, val root: FilterNode.Group, val issues: List<Pair<List<Int>, String>>, val disabled: Boolean)

internal fun nativeFilterBuilder(props: Map<String, JsonValue>): FilterModel? {
    val label = props.propName("label") ?: return null
    val raw = props.propArray("fields") ?: return null
    if (raw.size > 48) return null
    val fields = raw.map { item ->
        val f = item.asObject ?: return null
        val type = f.propString("type")?.takeIf { it in OPERATORS_BY_TYPE } ?: return null
        val options = f.propArray("options")?.map { (it as? JsonValue.Str)?.value ?: return null } ?: if ("options" in f) return null else emptyList()
        val labels = f.propObject("optionLabels")?.mapValues { (_, v) -> (v as? JsonValue.Str)?.value ?: return null } ?: emptyMap()
        FilterFieldDef(f.propName("key") ?: return null, f.propString("header") ?: return null, type, options, labels)
    }
    val issues = (props.propArray("issues") ?: emptyList()).map { item ->
        val f = item.asObject ?: return null
        (f.propArray("path")?.map { (it as? JsonValue.Num)?.value?.toInt() ?: return null } ?: return null) to (f.propString("message") ?: return null)
    }
    if (props.mistyped("disabled") { it is JsonValue.Bool } || props.mistyped("maxDepth") { it is JsonValue.Num }) return null
    // A starting filter that does not fit the fields starts empty, as on the web.
    val root = props["value"]?.let { parseFilter(it, fields) } ?: FilterNode.Group("and", emptyList())
    return FilterModel(label, fields, root, issues, props.propBool("disabled") == true)
}

/** A condition as text: "Status is any of Open, Pending". */
internal fun describeCondition(condition: FilterNode.Condition, fields: List<FilterFieldDef>): String {
    val field = fields.firstOrNull { it.key == condition.field }
    fun text(v: JsonValue): String = when (v) {
        is JsonValue.Str -> field?.optionLabels?.get(v.value) ?: v.value
        is JsonValue.Num -> jsNumber(v.value)
        is JsonValue.Bool -> if (v.value) "Yes" else "No"
        else -> ""
    }
    val value = when (val v = condition.value) {
        null -> ""
        is JsonValue.Arr -> if (condition.operator == "between") " ${text(v.items[0])} and ${text(v.items[1])}" else " " + v.items.joinToString(", ", transform = ::text)
        else -> " ${text(v)}"
    }
    return "${field?.header ?: condition.field} ${OPERATOR_LABELS.getValue(condition.operator)}$value"
}

@Composable
private fun FilterNodeView(model: FilterModel, node: FilterNode, path: List<Int>) {
    run {
        when (node) {
            is FilterNode.Group -> Column(
                Modifier.fillMaxWidth().border(1.dp, MaterialTheme.colorScheme.outlineVariant, RoundedCornerShape(8.dp)).padding(8.dp),
                verticalArrangement = Arrangement.spacedBy(6.dp),
            ) {
                Text(if (node.op == "and") "All of these" else "Any of these", style = MaterialTheme.typography.labelLarge)
                if (node.children.isEmpty()) Text("No conditions: every row matches.", style = MaterialTheme.typography.bodySmall)
                node.children.forEachIndexed { index, child -> FilterNodeView(model, child, path + index) }
            }
            is FilterNode.Condition -> Text(describeCondition(node, model.fields), style = MaterialTheme.typography.bodyMedium)
        }
        model.issues.filter { it.first == path }.forEach { Text(it.second, style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.error) }
    }
}

@Composable
internal fun FilterBuilderPainter(model: FilterModel) {
    Column(Modifier.fillMaxWidth().semantics { contentDescription = model.label }, verticalArrangement = Arrangement.spacedBy(6.dp)) {
        Text(model.label, style = MaterialTheme.typography.titleSmall)
        FilterNodeView(model, model.root, emptyList())
    }
}
