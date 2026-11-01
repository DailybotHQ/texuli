package com.texuli.compose

import com.texuli.spec.JsonValue
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNotNull
import kotlin.test.assertNull
import kotlin.test.assertTrue
import kotlin.test.fail

/**
 * The part-whole family natively (ADR-025): projection, refusal where the
 * web's layouts throw, and the scenes of the web components. The arcs,
 * treemap and sunburst themselves are vector-checked in ChartMathParityTest.
 */
class PartWholeChartsTest {
    private val labels = obj("table" to str("View data table"), "category" to str("Channel"), "value" to str("Tickets"))
    private val data = arr(
        obj("id" to str("email"), "label" to str("Email"), "value" to num(420)),
        obj("id" to str("chat"), "label" to str("Chat"), "value" to num(610)),
        obj("id" to str("phone"), "label" to str("Phone"), "value" to num(75)),
    )
    private val pieProps = mapOf("title" to str("Tickets by channel"), "description" to str("Week 42"), "data" to data, "labels" to labels)

    private fun leaf(id: String, value: Number) = obj("id" to str(id), "label" to str(id.uppercase()), "value" to num(value))
    private val root = obj(
        "id" to str("support"),
        "children" to arr(obj("id" to str("email"), "children" to arr(leaf("billing", 42), leaf("login", 18))), leaf("chat", 61)),
    )
    private val treeProps = mapOf("title" to str("Topics"), "description" to str("Per channel"), "root" to root, "labels" to labels)

    @Test
    fun projectsEachIdWithTheWebDefaults() {
        assertEquals(0.0, nativePartWholeChart("charts-pie", pieProps)!!.innerRatio)
        assertEquals(0.58, nativePartWholeChart("charts-donut", pieProps)!!.innerRatio)
        // innerRatio and padAngle are string-kind props: the web coerces numeric strings.
        assertEquals(0.6, nativePartWholeChart("charts-donut", pieProps + ("innerRatio" to str("0.6")))!!.innerRatio)
        assertNull(nativePartWholeChart("charts-donut", pieProps + ("innerRatio" to str("wide"))))
        assertEquals(0.24, nativePartWholeChart("charts-sunburst", treeProps)!!.innerRatio)
        assertEquals(640.0, nativePartWholeChart("charts-treemap", treeProps)!!.width)
        // Blank labels keep the defaults.
        assertEquals("Category", nativePartWholeChart("charts-pie", pieProps + ("labels" to obj("category" to str(" "))))!!.labels.category)
    }

    @Test
    fun refusesWhereTheWebLayoutThrows() {
        val duplicate = obj("id" to str("r"), "children" to arr(leaf("a", 1), leaf("a", 2)))
        assertNull(nativePartWholeChart("charts-treemap", treeProps + ("root" to duplicate)))
        val negative = obj("id" to str("r"), "children" to arr(leaf("a", -1)))
        assertNull(nativePartWholeChart("charts-sunburst", treeProps + ("root" to negative)))
        val mismatch = obj("id" to str("r"), "value" to num(10), "children" to arr(leaf("a", 1)))
        assertNull(nativePartWholeChart("charts-treemap", treeProps + ("root" to mismatch)))
        var deep: JsonValue = leaf("leaf", 1)
        repeat(TREE_MAX_DEPTH + 1) { deep = obj("id" to str("n$it"), "children" to arr(deep)) }
        assertNull(nativePartWholeChart("charts-sunburst", treeProps + ("root" to deep)))
        val wide = obj("id" to str("r"), "children" to arr(List(PART_WHOLE_MAX_ITEMS) { leaf("l$it", 1) }))
        assertNull(nativePartWholeChart("charts-treemap", treeProps + ("root" to wide)))
        assertNull(nativePartWholeChart("charts-pie", pieProps + ("data" to arr(obj("id" to str("a"), "label" to str("A"), "value" to str("1"))))))
    }

    @Test
    fun aPieKeepsNegativeValuesAsEmptySlicesLikeTheWeb() {
        val withNegative = arr(obj("id" to str("a"), "label" to str("A"), "value" to num(-4)), obj("id" to str("b"), "label" to str("B"), "value" to num(10)))
        val chart = nativePartWholeChart("charts-pie", pieProps + ("data" to withNegative))!!
        val fills = partWholeScene(chart).marks.filterIsInstance<Mark.PathMark>().filter { it.fill }
        assertEquals(listOf("", "M0,-108A108,108,0,1,1,0,108A108,108,0,1,1,0,-108Z"), fills.map { it.d })
    }

    @Test
    fun scenesFollowTheWebComponents() {
        val donut = partWholeScene(nativePartWholeChart("charts-donut", pieProps)!!)
        assertEquals(240.0, donut.width)
        assertEquals(6, donut.marks.size)
        assertEquals(listOf("1,105"), donut.texts.map { it.text })
        assertTrue(partWholeScene(nativePartWholeChart("charts-pie", pieProps)!!).texts.isEmpty())
        val treemap = partWholeScene(nativePartWholeChart("charts-treemap", treeProps)!!)
        assertEquals(3, treemap.marks.filterIsInstance<Mark.RectMark>().size)
        val sunburst = nativePartWholeChart("charts-sunburst", treeProps)!!
        assertEquals(4, partWholeScene(sunburst).marks.count { it is Mark.PathMark && it.fill })
        assertEquals(listOf("email", "billing", "login", "chat"), partWholeLegend(sunburst).map { it.label.lowercase() })
        val table = partWholeTable(sunburst)
        assertEquals(listOf("Channel", "Tickets"), table.columns)
        assertEquals(listOf("support", "121"), table.rows.first())
        assertEquals("    BILLING", table.rows[2][0])
    }

    @Test
    fun hostilePropsNeverThrow() {
        for ((id, props) in listOf("charts-pie" to pieProps, "charts-donut" to pieProps, "charts-sunburst" to treeProps, "charts-treemap" to treeProps)) {
            for ((case, variant) in hostileVariants(props) + sequenceOf("valid" to props)) {
                try {
                    val chart = nativePartWholeChart(id, variant) ?: continue
                    partWholeScene(chart)
                    partWholeTable(chart)
                } catch (error: Throwable) {
                    fail("$id with $case threw ${error::class.simpleName}: ${error.message?.take(120)}")
                }
            }
        }
        assertNotNull(nativePartWholeChart("charts-pie", pieProps))
    }
}
