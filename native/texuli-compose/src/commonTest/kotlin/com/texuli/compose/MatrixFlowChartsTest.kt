package com.texuli.compose

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNotNull
import kotlin.test.assertNull
import kotlin.test.assertTrue
import kotlin.test.fail

/**
 * The matrix and flow families natively (ADR-025): projection, refusal where
 * the web throws, and the scenes of the web components. The layouts are
 * vector-checked in ChartMathParityTest.
 */
class MatrixFlowChartsTest {
    private fun point(id: String, x: Number, y: Number, r: Number? = null) =
        obj(*listOfNotNull("id" to str(id), "label" to str(id.uppercase()), "x" to num(x), "y" to num(y), r?.let { "r" to num(it) }).toTypedArray())

    private val scatter = mapOf("title" to str("Sites"), "description" to str("Volume and time"), "points" to arr(point("a", 1, 2, 3), point("b", 4, 5, 6)))
    private val heatmap = mapOf("title" to str("Shifts"), "description" to str("Per day"), "cells" to arr(obj("x" to str("Mon"), "y" to str("Day"), "value" to num(3)), obj("x" to str("Tue"), "y" to str("Day"), "value" to num(9))))
    private val funnel = mapOf("title" to str("Trial"), "steps" to arr(obj("id" to str("visit"), "label" to str("Visited"), "value" to num(1200)), obj("id" to str("paid"), "label" to str("Paid"), "value" to num(85))))
    private val nodes = arr(obj("id" to str("web"), "label" to str("Website")), obj("id" to str("trial")), obj("id" to str("paid")))
    private val links = arr(obj("source" to str("web"), "target" to str("trial"), "value" to num(320)), obj("source" to str("trial"), "target" to str("paid"), "value" to num(210)))
    private val flow = mapOf("title" to str("Flow"), "nodes" to nodes, "links" to links)

    @Test
    fun projectsEachId() {
        assertEquals(MatrixFlowKind.SCATTER, nativeMatrixFlowChart("charts-scatter", scatter)?.kind)
        assertEquals(MatrixFlowKind.BUBBLE, nativeMatrixFlowChart("charts-bubble", scatter)?.kind)
        assertEquals(MatrixFlowKind.HEATMAP, nativeMatrixFlowChart("charts-heatmap", heatmap)?.kind)
        assertEquals(MatrixFlowKind.FUNNEL, nativeMatrixFlowChart("charts-funnel", funnel)?.kind)
        assertEquals(MatrixFlowKind.SANKEY, nativeMatrixFlowChart("charts-sankey", flow)?.kind)
        assertEquals(480.0, nativeMatrixFlowChart("charts-network", flow)?.width)
    }

    @Test
    fun refusesWhereTheWebThrowsOrShowsAnError() {
        // A bubble needs r on every point; a scatter only refuses a bad one.
        assertNull(nativeMatrixFlowChart("charts-bubble", scatter + ("points" to arr(point("a", 1, 2)))))
        assertNotNull(nativeMatrixFlowChart("charts-scatter", scatter + ("points" to arr(point("a", 1, 2)))))
        assertNull(nativeMatrixFlowChart("charts-scatter", scatter + ("points" to arr(point("a", 1, 2), point("a", 3, 4)))))
        assertNull(nativeMatrixFlowChart("charts-scatter", scatter - "description"))
        assertNull(nativeMatrixFlowChart("charts-heatmap", heatmap + ("annotations" to arr(obj("y" to str("Day"))))))
        assertNull(nativeMatrixFlowChart("charts-heatmap", heatmap + ("cells" to arr(obj("x" to str(" "), "y" to str("Day"), "value" to num(1))))))
        val cycle = arr(obj("source" to str("web"), "target" to str("trial"), "value" to num(1)), obj("source" to str("trial"), "target" to str("web"), "value" to num(1)))
        assertNull(nativeMatrixFlowChart("charts-sankey", flow + ("links" to cycle)))
        // A network may loop: it is a circle layout, not a flow.
        assertNotNull(nativeMatrixFlowChart("charts-network", flow + ("links" to cycle)))
        val unknown = arr(obj("source" to str("web"), "target" to str("nowhere"), "value" to num(1)))
        assertNull(nativeMatrixFlowChart("charts-sankey", flow + ("links" to unknown)))
        assertNull(nativeMatrixFlowChart("charts-network", flow + ("links" to unknown)))
        val zero = arr(obj("source" to str("web"), "target" to str("trial"), "value" to num(0)))
        assertNull(nativeMatrixFlowChart("charts-sankey", flow + ("links" to zero)))
        assertNull(nativeMatrixFlowChart("charts-funnel", funnel + ("orientation" to str("diagonal"))))
    }

    @Test
    fun scenesFollowTheWebComponents() {
        val bubble = matrixFlowScene(nativeMatrixFlowChart("charts-bubble", scatter)!!, 640.0)
        assertEquals(4, bubble.marks.filterIsInstance<Mark.CircleMark>().size)
        val heat = matrixFlowScene(nativeMatrixFlowChart("charts-heatmap", heatmap)!!, 640.0)
        val ramps = heat.marks.filterIsInstance<Mark.RectMark>().map { (it.ink as Ink.Ramp).t }
        assertEquals(listOf(0.0, 1.0), ramps)
        val funnelScene = matrixFlowScene(nativeMatrixFlowChart("charts-funnel", funnel)!!, 640.0)
        assertEquals(listOf("Visited: 1,200 (100%)", "Paid: 85 (7.1%)"), funnelScene.texts.map { it.text })
        val sankeyScene = matrixFlowScene(nativeMatrixFlowChart("charts-sankey", flow)!!, 640.0)
        assertEquals(2, sankeyScene.marks.count { it is Mark.PathMark })
        assertEquals(TextAnchor.END, sankeyScene.texts.single { it.text == "paid" }.anchor)
        // The web lays out at the measured width but never under 240.
        assertEquals(240.0, matrixFlowScene(nativeMatrixFlowChart("charts-network", flow)!!, 120.0).width)
        assertEquals(listOf("Website", "trial", "320"), matrixFlowTable(nativeMatrixFlowChart("charts-sankey", flow)!!).rows.first())
        assertEquals("Trial: 1,200 entered; 85 reached Paid.", matrixFlowSummary(nativeMatrixFlowChart("charts-funnel", funnel)!!))
    }

    @Test
    fun hostilePropsNeverThrow() {
        val bases = listOf("charts-scatter" to scatter, "charts-bubble" to scatter, "charts-heatmap" to heatmap, "charts-funnel" to funnel, "charts-sankey" to flow, "charts-network" to flow)
        for ((id, props) in bases) {
            for ((case, variant) in hostileVariants(props) + sequenceOf("valid" to props)) {
                try {
                    val chart = nativeMatrixFlowChart(id, variant) ?: continue
                    val scene = matrixFlowScene(chart, 360.0)
                    matrixFlowTable(chart)
                    assertTrue(scene.width.isFinite() && scene.height.isFinite(), "$id $case")
                } catch (error: Throwable) {
                    if (error is AssertionError) throw error
                    fail("$id with $case threw ${error::class.simpleName}: ${error.message?.take(120)}")
                }
            }
        }
    }
}
