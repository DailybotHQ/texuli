package com.texuli.compose

import com.texuli.spec.JsonValue
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNotNull
import kotlin.test.assertNull
import kotlin.test.assertTrue
import kotlin.test.fail

/**
 * Boards, maps, dashboards and filters natively (ADR-025): projection,
 * refusal, and the web engines' rules (vector-checked in
 * ChartMathParityTest) as the views use them.
 */
class DataBoardsTest {
    private val board = mapOf(
        "label" to str("Support"),
        "columns" to arr(obj("id" to str("todo"), "title" to str("To do")), obj("id" to str("doing"), "title" to str("Doing"), "wipHard" to num(1))),
        "items" to arr(
            obj("id" to str("c1"), "title" to str("Login"), "column" to str("doing")),
            obj("id" to str("c2"), "title" to str("Invoice"), "column" to str("doing")),
            obj("id" to str("c3"), "title" to str("Lost"), "column" to str("gone")),
        ),
    )
    private val map = mapOf("label" to str("Sites"), "markers" to arr(obj("id" to str("m1"), "label" to str("Pier"), "lat" to num(-30.4), "lng" to num(-18.7))))
    private val filter = mapOf(
        "label" to str("Filter"),
        "fields" to arr(obj("key" to str("status"), "header" to str("Status"), "type" to str("enum"), "options" to arr(str("open"), str("closed")), "optionLabels" to obj("open" to str("Open")))),
        "value" to obj("type" to str("condition"), "field" to str("status"), "operator" to str("in"), "value" to arr(str("open"))),
    )

    @Test
    fun aBoardKeepsListOrderAndShowsUnplacedCardsAndWip() {
        val view = nativeDataBoard(board)!!
        assertEquals(listOf("c1", "c2"), view.grid.cells[0][1].map { it.id })
        assertEquals(listOf("c3"), view.grid.unplaced.map { it.id })
        assertEquals("blocked" to "Doing is over its WIP limit (2 of 1).", evaluateWip(view.grid.columns[1], 2))
        assertNull(nativeDataBoard(board + ("columns" to arr())))
    }

    @Test
    fun aMapDrawsPortMeridianAndRefusesOutOfRangeMarkers() {
        val scene = mapScene(nativeMap(map)!!)
        assertEquals(800.0, scene.width)
        assertTrue(scene.marks.filterIsInstance<Mark.PathMark>().size >= PORT_MERIDIAN.features.size / 2)
        assertTrue(scene.texts.any { it.text == PORT_MERIDIAN.attribution })
        assertNull(nativeMap(map + ("markers" to arr(obj("id" to str("x"), "label" to str("X"), "lat" to num(91), "lng" to num(0))))))
    }

    @Test
    fun aDashboardPlacesWidgetsByTheWebEngine() {
        val children = listOf(
            "data-dashboard-widget" to mapOf("widgetId" to str("volume"), "title" to str("Volume"), "place" to obj("x" to num(0), "y" to num(0), "w" to num(6), "h" to num(3))),
            "data-dashboard-widget" to mapOf("widgetId" to str("mix"), "title" to str("Mix"), "place" to obj("w" to num(6), "h" to num(3))),
        )
        val model = nativeDashboard(mapOf("label" to str("Overview")), children)!!
        val points = dashboardBreakpoints(model.columns)
        val wide = resolveDashboard(dashboardDesign(model), model.widgets, points[0], points, true)
        assertEquals(listOf(DashItem("volume", 0, 0, 6, 3), DashItem("mix", 6, 0, 6, 3)), wide)
        // On a phone (one column) the widgets stack in reading order.
        val narrow = resolveDashboard(dashboardDesign(model), model.widgets, points.last(), points, true)
        assertEquals(listOf(0 to 0, 0 to 3), narrow.map { it.x to it.y })
        assertNull(nativeDashboard(mapOf("label" to str("Overview")), children + children))
    }

    @Test
    fun aFilterReadsLikeTheWebAndStartsEmptyWhenItDoesNotFit() {
        val model = nativeFilterBuilder(filter)!!
        val condition = model.root.children.single() as FilterNode.Condition
        assertEquals("Status is any of Open", describeCondition(condition, model.fields))
        val wrong = filter + ("value" to obj("type" to str("condition"), "field" to str("status"), "operator" to str("contains"), "value" to str("o")))
        assertTrue(nativeFilterBuilder(wrong)!!.root.children.isEmpty())
    }

    @Test
    fun hostilePropsNeverThrow() {
        val cases = listOf<Pair<Map<String, JsonValue>, (Map<String, JsonValue>) -> Any?>>(
            board to ::nativeDataBoard,
            map to { p -> nativeMap(p)?.let { mapScene(it) } },
            filter to ::nativeFilterBuilder,
            mapOf("label" to str("D"), "layout" to arr(obj("id" to str("a"), "x" to num(0), "y" to num(0)))) to { p -> nativeDashboard(p, emptyList())?.let(::dashboardDesign) },
        )
        for ((props, project) in cases) {
            for ((case, variant) in hostileVariants(props) + sequenceOf("valid" to props)) {
                try {
                    project(variant)
                } catch (error: Throwable) {
                    fail("$case threw ${error::class.simpleName}: ${error.message?.take(120)}")
                }
            }
        }
        assertNotNull(PORT_MERIDIAN)
    }
}
