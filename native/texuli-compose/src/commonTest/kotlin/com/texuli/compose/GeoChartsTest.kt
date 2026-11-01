package com.texuli.compose

import com.texuli.spec.JsonValue
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNull
import kotlin.test.assertTrue
import kotlin.test.fail

/**
 * The geo family natively (ADR-025): the web's schematic tile maps, drawn
 * from the bundled world tiles or a shape in the props; nothing is fetched.
 */
class GeoChartsTest {
    private val map = mapOf(
        "title" to str("Tickets by region"),
        "description" to str("Week 42"),
        "data" to obj("north-america" to num(120), "western-europe" to num(88), "east-asia" to JsonValue.Null),
    )
    private val points = mapOf(
        "title" to str("Hubs"),
        "description" to str("By region"),
        "points" to arr(
            obj("id" to str("h1"), "label" to str("Harbor"), "regionId" to str("western-europe"), "value" to num(14)),
            obj("id" to str("h2"), "label" to str("Ridge"), "regionId" to str("nowhere"), "value" to num(6)),
        ),
    )

    @Test
    fun aChoroplethColorsByNineStepsAndGreysMissingData() {
        val chart = nativeGeoChart("charts-geo-map", map)!!
        val scene = geoScene(chart)
        assertEquals(WORLD_TILES.size + 9, scene.marks.size)
        val tiles = scene.marks.take(WORLD_TILES.size).filterIsInstance<Mark.RectMark>()
        assertEquals(Ink.Ramp(1.0), tiles.first().ink)
        assertTrue(tiles.count { it.ink == Ink.Muted } == WORLD_TILES.size - 2)
        assertEquals(listOf("Region", "Value"), geoTable(chart).columns)
        assertEquals("No data", geoTable(chart).rows.first { it[0] == "East Asia" }[1])
    }

    @Test
    fun pointsSitInTheirRegionAndUnknownRegionsAreSkipped() {
        val chart = nativeGeoChart("charts-geo-point-map", points)!!
        val circles = geoScene(chart).marks.filterIsInstance<Mark.CircleMark>()
        assertEquals(2, circles.size)
        assertEquals(listOf("Ridge", "No data", "6"), geoTable(chart).rows[1])
    }

    @Test
    fun aShapeInThePropsReplacesTheWorldTiles() {
        val shape = arr(obj("id" to str("a"), "label" to str("A"), "abbr" to str("A"), "col" to num(0), "row" to num(0)))
        assertEquals(1, nativeGeoChart("charts-geo-map", map + ("shape" to shape))!!.shape.size)
        val far = arr(obj("id" to str("a"), "label" to str("A"), "col" to num(1e9), "row" to num(0)))
        assertNull(nativeGeoChart("charts-geo-map", map + ("shape" to far)))
        assertNull(nativeGeoChart("charts-geo-map", map + ("data" to obj("north-america" to str("120")))))
        assertNull(nativeGeoChart("charts-geo-map", map - "description"))
    }

    @Test
    fun hostilePropsNeverThrow() {
        for ((id, props) in listOf("charts-geo-map" to map, "charts-geo-point-map" to points)) {
            for ((case, variant) in hostileVariants(props) + sequenceOf("valid" to props)) {
                try {
                    val chart = nativeGeoChart(id, variant) ?: continue
                    geoScene(chart)
                    geoTable(chart)
                } catch (error: Throwable) {
                    fail("$id with $case threw ${error::class.simpleName}: ${error.message?.take(120)}")
                }
            }
        }
    }
}
