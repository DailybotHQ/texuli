package com.texuli.compose

import com.texuli.spec.JsonValue
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNotNull
import kotlin.test.assertNull
import kotlin.test.assertTrue
import kotlin.test.fail

/**
 * The cartesian family natively (ADR-025): projection, refusal and the scene
 * ported from `CartesianChart.svelte`. The math under it is checked against
 * web vectors in `ChartMathParityTest`; these tests pin the component glue.
 */
class CartesianChartsTest {
    private val days = listOf("Mon", "Tue", "Wed", "Thu", "Fri")

    private fun series(id: String, vararg ys: Double?) = obj(
        "id" to str(id),
        "label" to str(id.replaceFirstChar(Char::uppercase)),
        "points" to arr(days.zip(ys.toList()).map { (x, y) -> obj("x" to str(x), "y" to (y?.let(::num) ?: JsonValue.Null)) }),
    )

    private val base = mapOf(
        "title" to str("Tickets per day"),
        "description" to str("Opened and solved tickets, week 42"),
        "series" to arr(series("opened", 210.0, 198.0, 187.0, 176.0, 164.0), series("solved", 190.0, 201.0, null, 188.0, 172.0)),
    )

    @Test
    fun projectsEveryCartesianIdAndTheGenericKind() {
        for (id in CARTESIAN_CHART_IDS - "charts-cartesian") assertNotNull(nativeCartesianChart(id, base), id)
        assertEquals(CartesianKind.STACKED_BAR, nativeCartesianChart("charts-cartesian", base + ("kind" to str("stacked-bar")))?.kind)
        assertNull(nativeCartesianChart("charts-cartesian", base))
        assertNull(nativeCartesianChart("charts-cartesian", base + ("kind" to str("pie"))))
    }

    @Test
    fun ignoresWebOnlyPropsAndRefusesWhatItCannotPaintFaithfully() {
        val ignored = base + ("class" to str("wide")) + ("renderer" to str("canvas")) + ("mode" to str("dark")) + ("locale" to str("de-DE")) + ("interactive" to str("zoom"))
        assertNotNull(nativeCartesianChart("charts-line", ignored))
        // Annotations would be missing: the placeholder is honest, a bare chart is not.
        assertNull(nativeCartesianChart("charts-line", base + ("annotations" to arr(obj("kind" to str("line"), "y" to num(200))))))
        assertNotNull(nativeCartesianChart("charts-line", base + ("annotations" to arr())))
        // A time or linear axis takes numbers only; the web throws on categories.
        assertNull(nativeCartesianChart("charts-line", base + ("xKind" to str("time"))))
        assertNull(nativeCartesianChart("charts-line", base + ("xKind" to str("polar"))))
        // Duplicate x values and mixed x kinds are refused, as the web throws.
        val duplicate = obj("id" to str("d"), "label" to str("D"), "points" to arr(obj("x" to str("Mon"), "y" to num(1)), obj("x" to str("Mon"), "y" to num(2))))
        assertNull(nativeCartesianChart("charts-bar", base + ("series" to arr(duplicate))))
        val mixed = obj("id" to str("m"), "label" to str("M"), "points" to arr(obj("x" to str("Mon"), "y" to num(1)), obj("x" to num(2), "y" to num(2))))
        assertNull(nativeCartesianChart("charts-bar", base + ("series" to arr(mixed))))
        val tooMany = arr(List(CARTESIAN_MAX_SERIES + 1) { series("s$it", 1.0, 2.0, 3.0, 4.0, 5.0) })
        assertNull(nativeCartesianChart("charts-line", base + ("series" to tooMany)))
    }

    @Test
    fun theSceneMatchesTheWebLayoutRules() {
        val line = cartesianScene(nativeCartesianChart("charts-line", base)!!, 640.0)
        assertEquals(320.0, line.height)
        val paths = line.marks.filterIsInstance<Mark.PathMark>()
        assertEquals(2, paths.size)
        // The null on Wednesday breaks the solved line into two runs.
        assertEquals(2, paths[1].d.count { it == 'M' })
        assertTrue(line.texts.map { it.text }.containsAll(days))
        val bars = cartesianScene(nativeCartesianChart("charts-bar", base)!!, 640.0).marks.filterIsInstance<Mark.RectMark>()
        // Grouped bars: nine values (one null), each 88% of its slot and side by side.
        assertEquals(9, bars.size)
        assertTrue(bars.all { it.height >= 0 && it.width > 0 })
        val stacked = cartesianScene(nativeCartesianChart("charts-stacked-bar", base)!!, 640.0).marks.filterIsInstance<Mark.RectMark>()
        val monday = stacked.filter { it.x == stacked.first().x }
        assertEquals(2, monday.size)
        assertEquals(monday[0].y, monday[1].y + monday[1].height, 1e-9)
        val combo = cartesianScene(nativeCartesianChart("charts-combo", base)!!, 640.0)
        assertEquals(5, combo.marks.filterIsInstance<Mark.RectMark>().size)
        assertEquals(1, combo.marks.filterIsInstance<Mark.PathMark>().size)
        val area = cartesianScene(nativeCartesianChart("charts-area", base)!!, 640.0).marks.filterIsInstance<Mark.PathMark>()
        assertEquals(4, area.size)
        assertTrue(area.filter { it.fill }.all { it.alpha == 0.2f })
    }

    @Test
    fun aTimeAxisGetsNiceUtcTicks() {
        val day = 86_400_000.0
        val t0 = 1_772_409_600_000.0
        val timeSeries = obj("id" to str("latency"), "label" to str("Latency"), "points" to arr(List(6) { obj("x" to num(t0 + it * day), "y" to num(120 + it)) }))
        val chart = nativeCartesianChart("charts-cartesian", base + ("kind" to str("line")) + ("xKind" to str("time")) + ("series" to arr(timeSeries)))!!
        val labels = cartesianScene(chart, 640.0).texts.map { it.text }
        assertTrue("Mar 2" in labels, labels.toString())
        assertEquals(listOf("", "Latency"), cartesianTable(chart).columns)
        assertEquals("Mar 2, 2026", cartesianTable(chart).rows.first().first())
    }

    @Test
    fun aVisibleDomainWindowsTheSeries() {
        val wide = obj("id" to str("w"), "label" to str("W"), "points" to arr(listOf(1, 2, 3, 4, 5, 6).map { obj("x" to num(it), "y" to num(it * 2)) }))
        val chart = nativeCartesianChart("charts-line", base + ("series" to arr(wide)) + ("visibleDomain" to arr(num(2.5), num(4.5))))!!
        assertEquals(listOf(2.0, 3.0, 4.0, 5.0), windowCartesianSeries(chart.series, chart.visibleDomain!!).single().points.map { (it.x as XValue.Num).value })
        assertNull(nativeCartesianChart("charts-line", base + ("visibleDomain" to arr(num(2), num(4)))))
        assertNull(nativeCartesianChart("charts-line", base + ("series" to arr(wide)) + ("visibleDomain" to arr(num(5), num(1)))))
    }

    @Test
    fun theCanvasRendererDrawsTheWebsMarks() {
        val points = arr(obj("x" to num(10), "y" to num(120), "y0" to num(150)), obj("x" to num(60), "y" to JsonValue.Null, "y0" to num(150)), obj("x" to num(110), "y" to num(70), "y0" to num(150)))
        val props = mapOf("kind" to str("area"), "width" to num(320), "height" to num(160), "series" to arr(obj("id" to str("cpu"), "label" to str("CPU"), "points" to points)))
        val scene = canvasScene(nativeCanvasChart(props)!!)
        val marks = scene.marks.filterIsInstance<Mark.PathMark>()
        assertEquals(listOf("M10,150L10,120L10,150Z", "M110,150L110,70L110,150Z", "M10,120M110,70"), marks.map { it.d })
        assertNull(nativeCanvasChart(props + ("width" to num(0))))
        assertNull(nativeCanvasChart(props + ("kind" to str("pie"))))
    }

    @Test
    fun hostilePropsNeverThrowAndAcceptedScenesStayFinite() {
        for (id in CARTESIAN_CHART_IDS) {
            val props = if (id == "charts-cartesian") base + ("kind" to str("combo")) else base
            for ((case, variant) in hostileVariants(props) + sequenceOf("valid" to props)) {
                try {
                    val chart = nativeCartesianChart(id, variant) ?: continue
                    val scene = cartesianScene(chart, 360.0)
                    for (mark in scene.marks) {
                        val numbers = when (mark) {
                            is Mark.RectMark -> listOf(mark.x, mark.y, mark.width, mark.height)
                            is Mark.LineMark -> listOf(mark.x0, mark.y0, mark.x1, mark.y1)
                            else -> emptyList()
                        }
                        assertTrue(numbers.all(Double::isFinite), "$id $case: a non-finite mark")
                    }
                } catch (error: Throwable) {
                    if (error is AssertionError) throw error
                    fail("$id with $case threw ${error::class.simpleName}: ${error.message?.take(120)}")
                }
            }
        }
    }
}
