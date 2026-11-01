package com.texuli.compose

import com.texuli.spec.JsonValue
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNull

class ChartWidgetsTest {
    @Test
    fun `sparkline keeps gaps and declared variant`() {
        val widget = nativeChartWidget(
            "charts-sparkline",
            mapOf("label" to str("Weekly arrivals"), "variant" to str("area"), "values" to arr(num(2), JsonValue.Null, num(5))),
        )

        assertEquals(NativeChartKind.SPARKLINE, widget?.kind)
        assertEquals(listOf(2.0, null, 5.0), widget?.values)
        assertEquals("area", widget?.variant)

        val withoutLast = nativeChartWidget(
            "charts-sparkline",
            mapOf("label" to str("Trend"), "values" to arr(num(1)), "showLast" to bool(false)),
        )
        assertEquals(false, withoutLast?.showLast)
    }

    @Test
    fun `chart title takes semantic name priority over label`() {
        val widget = nativeChartWidget(
            "charts-sparkline",
            mapOf("title" to str("Quarterly trend"), "label" to str("Trend"), "values" to arr(num(4))),
        )

        assertEquals("Quarterly trend", widget?.label)
    }

    @Test
    fun `compact scalar charts project bounded scale and target`() {
        val bullet = nativeChartWidget(
            "charts-bullet",
            mapOf("label" to str("Completed"), "value" to num(42), "max" to num(60), "target" to num(48)),
        )
        val ring = nativeChartWidget("charts-progress-ring", mapOf("label" to str("Uploaded"), "value" to num(25), "max" to num(50)))

        assertEquals(42.0, bullet?.value)
        assertEquals(60.0, bullet?.max)
        assertEquals(48.0, bullet?.target)
        assertEquals(0.0, ring?.min)
        assertEquals(50.0, ring?.max)
    }

    @Test
    fun `invalid or unsupported charts are not coerced into native widgets`() {
        assertNull(nativeChartWidget("charts-line", mapOf("title" to str("Trend"))))
        assertNull(nativeChartWidget("charts-gauge", mapOf("label" to str("Load"), "value" to num(3), "max" to num(0))))
        assertNull(nativeChartWidget("charts-sparkline", mapOf("label" to str("Trend"), "values" to arr(str("bad")))))
        assertNull(nativeChartWidget("charts-gauge", mapOf("label" to str("Load"), "value" to num(3), "thresholds" to arr())))
    }

    @Test
    fun `registry paints the compact and cartesian charts and nothing it has no painter for`() {
        assertEquals(BindingStatus.IMPLEMENTED, NativeRegistry.status("charts-progress-ring"))
        assertEquals(BindingStatus.IMPLEMENTED, NativeRegistry.status("charts-line"))
        assertEquals(BindingStatus.PLACEHOLDER, NativeRegistry.status("charts-heatmap"))
    }
}
