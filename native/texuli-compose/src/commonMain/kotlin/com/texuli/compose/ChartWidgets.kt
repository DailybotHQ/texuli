package com.texuli.compose

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.size
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.role
import androidx.compose.ui.unit.dp
import com.texuli.spec.JsonValue

/** The intentionally small native chart slice; unsupported families stay placeholders. */
internal enum class NativeChartKind { SPARKLINE, BULLET, GAUGE, PROGRESS_RING }

internal data class NativeChartWidget(
    val kind: NativeChartKind,
    val label: String,
    val description: String?,
    val values: List<Double?> = emptyList(),
    val value: Double = 0.0,
    val min: Double = 0.0,
    val max: Double = 100.0,
    val target: Double? = null,
    val variant: String = "line",
    val showLast: Boolean = true,
)

/** Project the supported compact-chart props into inert display data. */
internal fun nativeChartWidget(id: String, props: Map<String, JsonValue>): NativeChartWidget? {
    // The accessible name: a blank title falls back to the label, and a chart with no name is refused.
    val label = props.name("title") ?: props.name("label") ?: return null
    val description = props.string("description")
    return when (id) {
        "charts-sparkline" -> {
            if (!props.only("title", "label", "description", "values", "variant", "showLast")) return null
            val values = (props["values"] as? JsonValue.Arr)?.items?.map { item ->
                when (item) {
                    JsonValue.Null -> null
                    is JsonValue.Num -> item.value.takeIf(Double::isFinite)
                    else -> return null
                }
            } ?: return null
            if (values.isEmpty() || values.size > 2_000) return null
            val variant = props.string("variant") ?: "line"
            if (variant !in setOf("line", "area", "bar")) return null
            val showLast = (props["showLast"] as? JsonValue.Bool)?.value ?: ("showLast" !in props)
            if ("showLast" in props && props["showLast"] !is JsonValue.Bool) return null
            NativeChartWidget(NativeChartKind.SPARKLINE, label, description, values = values, variant = variant, showLast = showLast)
        }
        "charts-bullet", "charts-gauge", "charts-progress-ring" -> {
            val permitted = when (id) {
                "charts-bullet" -> setOf("title", "label", "description", "value", "max", "target")
                "charts-gauge" -> setOf("title", "label", "description", "value", "min", "max")
                else -> setOf("title", "label", "description", "value", "max")
            }
            if (!props.keys.all(permitted::contains)) return null
            val value = props.finiteNumber("value") ?: return null
            val min = if (id == "charts-gauge") props.finiteNumber("min") ?: 0.0 else 0.0
            val max = props.finiteNumber("max") ?: 100.0
            if (max <= min) return null
            val target = if (id == "charts-bullet") props.finiteNumber("target") else null
            val kind = when (id) {
                "charts-bullet" -> NativeChartKind.BULLET
                "charts-gauge" -> NativeChartKind.GAUGE
                else -> NativeChartKind.PROGRESS_RING
            }
            NativeChartWidget(kind, label, description, value = value, min = min, max = max, target = target)
        }
        else -> null
    }
}

@Composable
internal fun ChartWidget(widget: NativeChartWidget) {
    val primary = MaterialTheme.colorScheme.primary
    val track = MaterialTheme.colorScheme.surfaceVariant
    val summary = when (widget.kind) {
        NativeChartKind.SPARKLINE -> {
            val latest = widget.values.filterNotNull().lastOrNull()
            if (widget.showLast && latest != null) "Latest value $latest" else "Trend across ${widget.values.size} samples"
        }
        NativeChartKind.BULLET -> "${widget.value} of ${widget.max}" + (widget.target?.let { ", target $it" } ?: "")
        NativeChartKind.GAUGE -> "${widget.value} on a scale from ${widget.min} to ${widget.max}"
        NativeChartKind.PROGRESS_RING -> "${widget.value} of ${widget.max}"
    }
    val detail = listOf(widget.label, widget.description, summary).filterNotNull().joinToString(". ")
    Column(
        Modifier.fillMaxWidth().clearAndSetSemantics {
            role = Role.Image
            contentDescription = detail
        },
    ) {
        Text(widget.label, style = MaterialTheme.typography.labelLarge)
        when (widget.kind) {
            NativeChartKind.SPARKLINE -> Sparkline(widget, primary, track)
            NativeChartKind.BULLET -> BulletWidget(widget, primary, track)
            NativeChartKind.GAUGE -> GaugeWidget(widget, primary, track)
            NativeChartKind.PROGRESS_RING -> ProgressRingWidget(widget, primary, track)
        }
        Text(summary, style = MaterialTheme.typography.bodySmall)
    }
}

@Composable
private fun Sparkline(widget: NativeChartWidget, primary: Color, track: Color) {
    Canvas(Modifier.fillMaxWidth().height(48.dp)) {
        val finite = widget.values.filterNotNull()
        if (finite.isEmpty()) return@Canvas
        val low = minOf(0.0, finite.minOrNull() ?: 0.0)
        val high = maxOf(low + 1.0, finite.maxOrNull() ?: 1.0)
        val step = if (widget.values.size > 1) size.width / (widget.values.size - 1) else size.width
        if (widget.variant == "bar") {
            val barWidth = size.width / widget.values.size
            widget.values.forEachIndexed { index, point ->
                if (point != null) {
                    val fraction = ((point - low) / (high - low)).toFloat().coerceIn(0f, 1f)
                    drawRect(primary, Offset(index * barWidth, size.height * (1f - fraction)), Size(barWidth * 0.7f, size.height * fraction))
                }
            }
        } else {
            val points = mutableListOf<Offset>()
            fun drawSegment() {
                if (points.isEmpty()) return
                if (widget.variant == "area") {
                    val area = Path().apply {
                        moveTo(points.first().x, size.height)
                        points.forEach { lineTo(it.x, it.y) }
                        lineTo(points.last().x, size.height)
                        close()
                    }
                    drawPath(area, primary.copy(alpha = 0.2f))
                }
                val line = Path().apply {
                    moveTo(points.first().x, points.first().y)
                    points.drop(1).forEach { lineTo(it.x, it.y) }
                }
                drawPath(line, primary, style = Stroke(width = 3.dp.toPx(), cap = StrokeCap.Round))
                points.clear()
            }
            widget.values.forEachIndexed { index, point ->
                if (point == null) {
                    drawSegment()
                } else {
                    val y = size.height * (1f - ((point - low) / (high - low)).toFloat())
                    points += Offset(index * step, y)
                }
            }
            drawSegment()
        }
        drawLine(track, Offset.Zero, Offset(size.width, 0f), strokeWidth = 1.dp.toPx())
    }
}

@Composable
private fun BulletWidget(widget: NativeChartWidget, primary: Color, track: Color) {
    val targetColor = MaterialTheme.colorScheme.onSurface
    Canvas(Modifier.fillMaxWidth().height(40.dp)) {
        val fraction = ((widget.value - widget.min) / (widget.max - widget.min)).toFloat().coerceIn(0f, 1f)
        val top = size.height * 0.3f
        val barHeight = size.height * 0.4f
        drawRect(track, Offset(0f, top), Size(size.width, barHeight))
        drawRect(primary, Offset(0f, top), Size(size.width * fraction, barHeight))
        widget.target?.let { target ->
            val targetX = size.width * ((target - widget.min) / (widget.max - widget.min)).toFloat().coerceIn(0f, 1f)
            drawLine(targetColor, Offset(targetX, 0f), Offset(targetX, size.height), strokeWidth = 2.dp.toPx())
        }
    }
}

@Composable
private fun GaugeWidget(widget: NativeChartWidget, primary: Color, track: Color) {
    Canvas(Modifier.fillMaxWidth().height(72.dp)) {
        val stroke = 9.dp.toPx()
        val arcSide = minOf(size.width * 0.72f, size.height * 1.5f)
        val arcSize = Size(arcSide, arcSide)
        val topLeft = Offset((size.width - arcSide) / 2f, size.height - arcSide / 2f)
        drawArc(track, 180f, 180f, false, topLeft, arcSize, style = Stroke(stroke, cap = StrokeCap.Round))
        val fraction = ((widget.value - widget.min) / (widget.max - widget.min)).toFloat().coerceIn(0f, 1f)
        drawArc(primary, 180f, 180f * fraction, false, topLeft, arcSize, style = Stroke(stroke, cap = StrokeCap.Round))
    }
}

@Composable
private fun ProgressRingWidget(widget: NativeChartWidget, primary: Color, track: Color) {
    Canvas(Modifier.size(64.dp)) {
        val stroke = 7.dp.toPx()
        val inset = stroke / 2
        val arcSize = Size(size.width - stroke, size.height - stroke)
        val topLeft = Offset(inset, inset)
        drawArc(track, 0f, 360f, false, topLeft, arcSize, style = Stroke(stroke, cap = StrokeCap.Round))
        val fraction = (widget.value / widget.max).toFloat().coerceIn(0f, 1f)
        drawArc(primary, -90f, 360f * fraction, false, topLeft, arcSize, style = Stroke(stroke, cap = StrokeCap.Round))
    }
}

private fun Map<String, JsonValue>.string(key: String): String? = (this[key] as? JsonValue.Str)?.value

private fun Map<String, JsonValue>.name(key: String): String? = string(key)?.takeIf(String::isNotBlank)

private fun Map<String, JsonValue>.finiteNumber(key: String): Double? =
    (this[key] as? JsonValue.Num)?.value?.takeIf(Double::isFinite)

private fun Map<String, JsonValue>.only(vararg names: String): Boolean = keys.all(names.toSet()::contains)
