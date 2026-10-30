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
    ) + compactCharts

    fun status(id: String): BindingStatus =
        if (id in implemented) BindingStatus.IMPLEMENTED else BindingStatus.PLACEHOLDER
}

internal val NATIVE_CHART_IDS = setOf("charts-sparkline", "charts-bullet", "charts-gauge", "charts-progress-ring")
