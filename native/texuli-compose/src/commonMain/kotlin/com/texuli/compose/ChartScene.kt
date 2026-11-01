package com.texuli.compose

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.drawscope.scale
import androidx.compose.ui.graphics.drawscope.translate
import androidx.compose.ui.graphics.lerp
import androidx.compose.ui.graphics.vector.PathParser
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.role
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.drawText
import androidx.compose.ui.text.rememberTextMeasurer
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlin.math.max
import kotlin.math.min

/*
 * The scene every native chart draws (ADR-025): a pure layout ported from
 * the web returns marks and labels in the web's CSS pixel units, and one
 * Canvas draws them at 1 unit = 1 dp. Nothing here reads chart data.
 */

/** Where a mark's color comes from: a series slot, a sequential ramp position, or a chrome role. */
internal sealed interface Ink {
    data class Series(val index: Int) : Ink
    data class Ramp(val t: Double) : Ink
    data object Grid : Ink
    data object Axis : Ink
    data object Surface : Ink
    data object Muted : Ink
}

internal sealed interface Mark {
    data class PathMark(val d: String, val ink: Ink, val fill: Boolean, val alpha: Float = 1f, val strokeWidth: Float = 2.5f, val dx: Double = 0.0, val dy: Double = 0.0) : Mark
    data class RectMark(val x: Double, val y: Double, val width: Double, val height: Double, val ink: Ink, val alpha: Float = 1f) : Mark
    data class CircleMark(val cx: Double, val cy: Double, val r: Double, val ink: Ink, val alpha: Float = 1f, val fill: Boolean = true) : Mark
    data class LineMark(val x0: Double, val y0: Double, val x1: Double, val y1: Double, val ink: Ink, val strokeWidth: Float = 1f) : Mark
}

internal enum class TextAnchor { START, MIDDLE, END }

/** A label at an SVG-style baseline position. */
internal data class SceneText(val text: String, val x: Double, val y: Double, val anchor: TextAnchor = TextAnchor.MIDDLE, val size: Float = 11f, val strong: Boolean = false)

internal class ChartScene(val width: Double, val height: Double, val marks: List<Mark>, val texts: List<SceneText> = emptyList())

/** One legend entry: a label and its series slot. */
internal data class LegendItem(val label: String, val series: Int)

/** A text alternative: the rows the web's data table lists. */
internal class ChartTable(val columns: List<String>, val rows: List<List<String>>)

/**
 * The series colors. The web reads its theme's `--tx-chart-1…8`; native
 * token sets do not carry the chart palette yet, so the slots come from the
 * theme's semantic roles in a fixed order (a documented gap, ADR-025).
 */
internal val LocalChartPalette = staticCompositionLocalOf<List<Color>?> { null }

@Composable
internal fun chartPalette(): List<Color> {
    LocalChartPalette.current?.let { return it }
    val c = MaterialTheme.colorScheme
    return listOf(c.primary, c.tertiary, c.secondary, c.error, c.onPrimaryContainer, c.outline, c.inversePrimary, c.onSurfaceVariant)
}

private fun Ink.color(palette: List<Color>, grid: Color, axis: Color, surface: Color, rampLow: Color, rampHigh: Color): Color = when (this) {
    is Ink.Series -> palette[((index % palette.size) + palette.size) % palette.size]
    is Ink.Ramp -> lerp(rampLow, rampHigh, t.toFloat().coerceIn(0f, 1f))
    Ink.Grid -> grid
    Ink.Axis -> axis
    Ink.Surface -> surface
    Ink.Muted -> rampLow
}

/** Draws a scene laid out at the available width (the web's charts measure their width too). */
@Composable
internal fun SceneCanvas(minUnits: Double = 240.0, maxUnits: Double = 640.0, layout: (Double) -> ChartScene) {
    val palette = chartPalette()
    val scheme = MaterialTheme.colorScheme
    val measurer = rememberTextMeasurer()
    val textColor = scheme.onSurfaceVariant
    val strongColor = scheme.onSurface
    BoxWithConstraints(Modifier.fillMaxWidth()) {
        val width = max(minUnits, min(maxUnits, maxWidth.value.toDouble()))
        val scene = remember(width, layout) { layout(width) }
        Canvas(Modifier.width(scene.width.dp).height(scene.height.dp)) {
            scale(density, density, pivot = Offset.Zero) {
                for (mark in scene.marks) {
                    when (mark) {
                        is Mark.PathMark -> {
                            if (mark.d.isEmpty()) continue
                            val path = PathParser().parsePathString(mark.d).toPath()
                            val color = mark.ink.color(palette, scheme.outlineVariant, scheme.outline, scheme.surface, scheme.surfaceVariant, scheme.primary)
                            translate(mark.dx.toFloat(), mark.dy.toFloat()) {
                                if (mark.fill) drawPath(path, color, alpha = mark.alpha)
                                else drawPath(path, color, alpha = mark.alpha, style = Stroke(width = mark.strokeWidth))
                            }
                        }
                        is Mark.RectMark -> drawRect(
                            mark.ink.color(palette, scheme.outlineVariant, scheme.outline, scheme.surface, scheme.surfaceVariant, scheme.primary),
                            Offset(mark.x.toFloat(), mark.y.toFloat()),
                            Size(mark.width.toFloat(), mark.height.toFloat()),
                            alpha = mark.alpha,
                        )
                        is Mark.CircleMark -> {
                            val color = mark.ink.color(palette, scheme.outlineVariant, scheme.outline, scheme.surface, scheme.surfaceVariant, scheme.primary)
                            val center = Offset(mark.cx.toFloat(), mark.cy.toFloat())
                            if (mark.fill) drawCircle(color, mark.r.toFloat(), center, alpha = mark.alpha)
                            else drawCircle(color, mark.r.toFloat(), center, alpha = mark.alpha, style = Stroke(1.5f))
                        }
                        is Mark.LineMark -> drawLine(
                            mark.ink.color(palette, scheme.outlineVariant, scheme.outline, scheme.surface, scheme.surfaceVariant, scheme.primary),
                            Offset(mark.x0.toFloat(), mark.y0.toFloat()),
                            Offset(mark.x1.toFloat(), mark.y1.toFloat()),
                            strokeWidth = mark.strokeWidth,
                        )
                    }
                }
            }
            for (label in scene.texts) {
                val style = TextStyle(fontSize = label.size.sp, color = if (label.strong) strongColor else textColor)
                val measured = measurer.measure(label.text, style)
                val w = measured.size.width.toFloat()
                val x = label.x.toFloat() * density - when (label.anchor) {
                    TextAnchor.START -> 0f
                    TextAnchor.MIDDLE -> w / 2
                    TextAnchor.END -> w
                }
                // SVG text sits on its baseline; Compose draws from the top of the line box.
                val y = label.y.toFloat() * density - measured.firstBaseline
                drawText(measured, topLeft = Offset(x, y))
            }
        }
    }
}

/**
 * The chart frame: title, description, the scene, a legend, and a "Show
 * data" table. Semantics follow the shared rule (figure, named by the
 * title): one image node whose description carries the title, the
 * description and the summary; the table stays readable as text.
 */
@Composable
internal fun ChartFrame(
    title: String,
    description: String?,
    summary: String,
    legend: List<LegendItem> = emptyList(),
    table: ChartTable? = null,
    scene: @Composable () -> Unit,
) {
    var showTable by remember { mutableStateOf(false) }
    val palette = chartPalette()
    Column(Modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(6.dp)) {
        Column(
            Modifier.fillMaxWidth().clearAndSetSemantics {
                role = Role.Image
                contentDescription = listOfNotNull(title, description, summary).joinToString(". ")
            },
            verticalArrangement = Arrangement.spacedBy(6.dp),
        ) {
            Text(title, style = MaterialTheme.typography.titleSmall)
            description?.let { Text(it, style = MaterialTheme.typography.bodySmall) }
            scene()
        }
        if (legend.isNotEmpty()) {
            Row(Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                legend.forEach { item ->
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Spacer(Modifier.size(10.dp).background(palette[item.series % palette.size]))
                        Spacer(Modifier.width(6.dp))
                        Text(item.label, style = MaterialTheme.typography.labelSmall)
                    }
                }
            }
        }
        if (table != null && table.rows.isNotEmpty()) {
            TextButton(onClick = { showTable = !showTable }) {
                Text(if (showTable) "Hide data" else "Show data")
            }
            if (showTable) ChartDataTable(table)
        }
    }
}

@Composable
internal fun ChartDataTable(table: ChartTable) {
    Column(Modifier.fillMaxWidth().horizontalScroll(rememberScrollState())) {
        Row {
            table.columns.forEach { Text(it, Modifier.width(120.dp).padding(4.dp), style = MaterialTheme.typography.labelMedium) }
        }
        table.rows.forEach { row ->
            Row {
                row.forEach { Text(it, Modifier.width(120.dp).padding(4.dp), style = MaterialTheme.typography.bodySmall) }
            }
        }
    }
}
