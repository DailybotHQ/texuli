package com.texuli.compose

/**
 * The native side of the translation dictionary (design §5): catalog id to
 * native binding. Coverage is reported per id; an id without a binding paints
 * a visible placeholder. A binding never promotes an id to portable core:
 * that needs the audit and passing cross-target conformance.
 */
enum class BindingStatus { IMPLEMENTED, PLACEHOLDER }

object NativeRegistry {
    private val compactCharts = setOf("charts-sparkline", "charts-bullet", "charts-gauge", "charts-progress-ring")
    // PLAN_013 (ADR-025): chart and data families, painted from ported web math.
    private val cartesianCharts = setOf(
        "charts-line",
        "charts-area",
        "charts-bar",
        "charts-stacked-bar",
        "charts-combo",
        "charts-cartesian",
        "charts-canvas-renderer",
    )
    private val partWholeCharts = setOf("charts-pie", "charts-donut", "charts-sunburst", "charts-treemap")
    private val matrixFlowCharts = setOf(
        "charts-scatter",
        "charts-bubble",
        "charts-heatmap",
        "charts-funnel",
        "charts-sankey",
        "charts-network",
    )
    private val geoCharts = setOf("charts-geo-map", "charts-geo-point-map")
    private val dataTables = setOf("data-grid", "data-cohort-table", "data-tree-view", "data-files")
    private val dataTime = setOf("data-calendar", "data-timeline", "data-notification-inbox")
    /** Ids the first renderer slice paints natively. */
    val implemented: Set<String> = setOf(
        "layout-page",
        "layout-doc",
        "layout-deck",
        "layout-card",
        "layout-grid",
        "deck-slide",
        "blocks-text",
        "blocks-diagram",
        "blocks-data",
        "media-image",
        "blocks-media",
        // 0.8.0 (ADR-016): the composition layouts and the code and structure families.
        "layout-stack",
        "layout-row",
        "layout-split",
        "layout-tile",
        "blocks-code",
        "blocks-structure",
    ) + compactCharts + cartesianCharts + partWholeCharts + matrixFlowCharts + geoCharts + dataTables + dataTime

    /**
     * Painted ids whose web view is interactive (catalog interaction role
     * `interactive`): native paints them read-only (ADR-025). Interactivity
     * natively is a later wave.
     */
    val readOnly: Set<String> = setOf(
        "data-grid",
        "data-tree-view",
        "data-files",
        "data-calendar",
        "data-timeline",
        "data-notification-inbox",
    )

    fun status(id: String): BindingStatus =
        if (id in implemented) BindingStatus.IMPLEMENTED else BindingStatus.PLACEHOLDER
}

internal val NATIVE_CHART_IDS = setOf("charts-sparkline", "charts-bullet", "charts-gauge", "charts-progress-ring")
