package com.texuli.compose

import androidx.compose.runtime.Composable
import com.texuli.spec.JsonValue
import kotlin.math.floor
import kotlin.math.max
import kotlin.math.min

/*
 * The geo family natively (ADR-025): `charts-geo-map` and
 * `charts-geo-point-map` draw the web's schematic tile maps (`geo/model.ts`):
 * bundled tiles, never geographic borders, no tiles fetched, no network.
 */

internal data class GeoTile(val id: String, val label: String, val abbr: String, val col: Double, val row: Double)

internal class GeoCell(val tile: GeoTile, val x: Double, val y: Double, val size: Double)

/** The web's default shape (`WORLD_TILES`). */
internal val WORLD_TILES = listOf(
    GeoTile("north-america", "North America", "NAM", 0.0, 0.0),
    GeoTile("northern-europe", "Northern Europe", "NEU", 2.0, 0.0),
    GeoTile("eastern-europe", "Eastern Europe", "EEU", 3.0, 0.0),
    GeoTile("central-asia", "Central Asia", "CAS", 4.0, 0.0),
    GeoTile("east-asia", "East Asia", "EAS", 5.0, 0.0),
    GeoTile("central-america", "Central America & Caribbean", "CAM", 0.0, 1.0),
    GeoTile("western-europe", "Western Europe", "WEU", 2.0, 1.0),
    GeoTile("southern-europe", "Southern Europe", "SEU", 3.0, 1.0),
    GeoTile("middle-east", "Middle East", "MEA", 4.0, 1.0),
    GeoTile("south-asia", "South Asia", "SAS", 5.0, 1.0),
    GeoTile("south-america", "South America", "SAM", 1.0, 2.0),
    GeoTile("north-africa", "North Africa", "NAF", 3.0, 2.0),
    GeoTile("southeast-asia", "Southeast Asia", "SEA", 5.0, 2.0),
    GeoTile("sub-saharan-africa", "Sub-Saharan Africa", "SSA", 3.0, 3.0),
    GeoTile("oceania", "Oceania", "OCE", 6.0, 3.0),
)

private fun trunc(value: Double): Double = if (value < 0) -floor(-value) else floor(value)

/** `geoCells`: square tiles centered in `width` × `height`, row by row. */
internal fun geoCells(shape: List<GeoTile>, width: Double, height: Double, gap: Double = 4.0): List<GeoCell> {
    if (shape.isEmpty()) return emptyList()
    val w = if (width.isFinite()) max(1.0, width) else 1.0
    val h = if (height.isFinite()) max(1.0, height) else 1.0
    val columns = max(1.0, shape.maxOf { max(0.0, trunc(it.col)) + 1 })
    val rows = max(1.0, shape.maxOf { max(0.0, trunc(it.row)) + 1 })
    val g = if (gap.isFinite()) max(0.0, gap) else 0.0
    val size = max(1.0, min((w - g * (columns - 1)) / columns, (h - g * (rows - 1)) / rows))
    val left = (w - (columns * size + (columns - 1) * g)) / 2
    val top = (h - (rows * size + (rows - 1) * g)) / 2
    // A stable sort by row, then column, as the web's Array#sort.
    return shape.sortedWith(compareBy<GeoTile> { it.row }.thenBy { it.col }).map { tile ->
        GeoCell(tile, left + max(0.0, tile.col) * (size + g), top + max(0.0, tile.row) * (size + g), size)
    }
}

/** `geoColorIndex`: one of nine ramp steps, 4 when every value is equal, null without data. */
internal fun geoColorIndex(value: Double?, values: List<Double?>): Int? {
    if (value == null) return null
    val finite = values.filterNotNull()
    if (finite.isEmpty()) return null
    val (lo, hi) = extent(finite) ?: (0.0 to 0.0)
    if (hi == lo) return 4
    val t = (value / 2 - lo / 2) / (hi / 2 - lo / 2)
    return if (t.isFinite()) min(8.0, max(0.0, floor(t * 9))).toInt() else null
}

/** `clampGeoOffset`. */
internal fun clampGeoOffset(value: Double?): Double = if (value != null && value.isFinite()) min(0.4, max(-0.4, value)) else 0.0

internal class GeoLabels(val table: String, val region: String, val point: String, val location: String, val value: String, val noData: String, val low: String, val high: String)

internal fun geoLabels(value: Map<String, JsonValue>?): GeoLabels {
    fun pick(key: String, fallback: String) = value?.propString(key) ?: fallback
    return GeoLabels(pick("table", "View data table"), pick("region", "Region"), pick("point", "Point"), pick("location", "Location"), pick("value", "Value"), pick("noData", "No data"), pick("low", "Lower values"), pick("high", "Higher values"))
}

/** `formatGeoValue`. */
internal fun formatGeoValue(value: Double?, labels: GeoLabels): String = if (value == null) labels.noData else formatNumber(value)

internal data class GeoPoint(val id: String, val label: String, val regionId: String, val value: Double?, val offsetX: Double?, val offsetY: Double?)

internal class PositionedGeoPoint(val point: GeoPoint, val x: Double, val y: Double, val radius: Double, val regionLabel: String)

/** `GeoPointMap`'s positions: a point in its region tile, sized by its value. */
internal fun positionGeoPoints(points: List<GeoPoint>, cells: List<GeoCell>): List<PositionedGeoPoint> {
    val byId = cells.associateBy { it.tile.id }
    val range = extent(points.map { it.value })
    val lo = range?.first ?: 0.0
    val hi = range?.second ?: 0.0
    return points.mapNotNull { point ->
        val cell = byId[point.regionId] ?: return@mapNotNull null
        val ratio = if (point.value == null || hi == lo) 0.5 else (point.value - lo) / (hi - lo)
        PositionedGeoPoint(
            point,
            cell.x + cell.size * (0.5 + clampGeoOffset(point.offsetX)),
            cell.y + cell.size * (0.5 + clampGeoOffset(point.offsetY)),
            4 + max(0.0, min(1.0, ratio)) * 8,
            cell.tile.label,
        )
    }
}

internal val GEO_CHART_IDS = setOf("charts-geo-map", "charts-geo-point-map")

internal const val GEO_MAX_TILES = 500
internal const val GEO_MAX_GRID = 100.0

internal class GeoChart(
    val pointMap: Boolean,
    val title: String,
    val description: String,
    val shape: List<GeoTile>,
    val labels: GeoLabels,
    val width: Double,
    val height: Double,
    val data: Map<String, Double?> = emptyMap(),
    val points: List<GeoPoint> = emptyList(),
)

private fun shapeOf(value: JsonValue?): List<GeoTile>? {
    if (value == null) return WORLD_TILES
    val items = (value as? JsonValue.Arr)?.items ?: return null
    if (items.size > GEO_MAX_TILES) return null
    return items.map { item ->
        val f = item.asObject ?: return null
        val col = (f["col"] as? JsonValue.Num)?.value?.takeIf { it.isFinite() && it <= GEO_MAX_GRID } ?: return null
        val row = (f["row"] as? JsonValue.Num)?.value?.takeIf { it.isFinite() && it <= GEO_MAX_GRID } ?: return null
        GeoTile(f.propName("id") ?: return null, f.propString("label") ?: return null, f.propString("abbr") ?: "", col, row)
    }
}

/**
 * Project validated props. Honored: title, description, data or points,
 * shape (default the web's world tiles), labels, width, height. Tiles with
 * non-finite or very large grid positions refuse to the placeholder.
 */
internal fun nativeGeoChart(id: String, props: Map<String, JsonValue>): GeoChart? {
    val title = props.propName("title") ?: return null
    val description = props.propName("description") ?: return null
    val shape = shapeOf(props["shape"]) ?: return null
    if (props.mistyped("labels") { it is JsonValue.Obj }) return null
    val labels = geoLabels(props.propObject("labels"))
    val width = if ("width" in props) props.propNumber("width")?.takeIf { it > 0 && it <= 4096 } ?: return null else 560.0
    val height = if ("height" in props) props.propNumber("height")?.takeIf { it > 0 && it <= 4096 } ?: return null else 320.0
    return when (id) {
        "charts-geo-map" -> {
            val raw = props.propObject("data") ?: return null
            if (raw.size > GEO_MAX_TILES) return null
            val data = raw.mapValues { (_, v) ->
                when (v) {
                    is JsonValue.Num -> v.value.takeIf(Double::isFinite)
                    JsonValue.Null -> null
                    else -> return null
                }
            }
            GeoChart(false, title, description, shape, labels, width, height, data = data)
        }
        "charts-geo-point-map" -> {
            val raw = props.propArray("points") ?: return null
            if (raw.size > GEO_MAX_TILES) return null
            val points = raw.map { item ->
                val f = item.asObject ?: return null
                val value = when (val v = f["value"]) {
                    is JsonValue.Num -> v.value.takeIf(Double::isFinite)
                    JsonValue.Null, null -> null
                    else -> return null
                }
                val offset = f["offset"]?.let { it.asObject ?: return null }
                GeoPoint(f.propName("id") ?: return null, f.propString("label") ?: return null, f.propString("regionId") ?: return null, value, offset?.propNumber("x"), offset?.propNumber("y"))
            }
            GeoChart(true, title, description, shape, labels, width, height, points = points)
        }
        else -> null
    }
}

/** The web component's scene, plus the low-to-high ramp legend of the choropleth under it. */
internal fun geoScene(chart: GeoChart): ChartScene {
    val cells = geoCells(chart.shape, chart.width, chart.height)
    val marks = mutableListOf<Mark>()
    val texts = mutableListOf<SceneText>()
    var height = chart.height
    if (!chart.pointMap) {
        val values = chart.shape.map { chart.data[it.id] }
        for (cell in cells) {
            val color = geoColorIndex(chart.data[cell.tile.id], values)
            marks += Mark.RectMark(cell.x, cell.y, cell.size, cell.size, if (color == null) Ink.Muted else Ink.Ramp(color / 8.0))
        }
        val y = chart.height + 12
        texts += SceneText(chart.labels.low, 0.0, y + 10, TextAnchor.START)
        for (step in 0 until 9) marks += Mark.RectMark(110.0 + step * 18, y, 16.0, 12.0, Ink.Ramp(step / 8.0))
        texts += SceneText(chart.labels.high, 110.0 + 9 * 18 + 8, y + 10, TextAnchor.START)
        height += 32
    } else {
        for (cell in cells) marks += Mark.RectMark(cell.x, cell.y, cell.size, cell.size, Ink.Muted)
        for (point in positionGeoPoints(chart.points, cells)) {
            marks += Mark.CircleMark(point.x, point.y, point.radius, Ink.Series(0))
            marks += Mark.CircleMark(point.x, point.y, point.radius, Ink.Surface, fill = false)
        }
    }
    return ChartScene(chart.width, height, marks, texts)
}

/** `GeoDataTable`: regions and values, or points with their location. */
internal fun geoTable(chart: GeoChart): ChartTable = if (!chart.pointMap) {
    ChartTable(listOf(chart.labels.region, chart.labels.value), chart.shape.map { listOf(it.label, formatGeoValue(chart.data[it.id], chart.labels)) })
} else {
    val byId = chart.shape.associateBy { it.id }
    ChartTable(
        listOf(chart.labels.point, chart.labels.location, chart.labels.value),
        chart.points.map { listOf(it.label, byId[it.regionId]?.label ?: chart.labels.noData, formatGeoValue(it.value, chart.labels)) },
    )
}

@Composable
internal fun GeoChartView(chart: GeoChart) {
    val scene = geoScene(chart)
    val summary = if (chart.pointMap) "${chart.points.size} points" else "${chart.shape.size} regions"
    ChartFrame(chart.title, chart.description, summary, table = geoTable(chart)) {
        SceneCanvas(minUnits = scene.width, maxUnits = scene.width) { scene }
    }
}
