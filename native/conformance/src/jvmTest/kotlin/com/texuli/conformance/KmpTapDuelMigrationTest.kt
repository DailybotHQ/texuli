package com.texuli.conformance

import com.texuli.compose.BindingStatus
import com.texuli.compose.NativeRegistry
import com.texuli.spec.SpecDiagnosticCode
import com.texuli.spec.SpecVocabulary
import com.texuli.spec.runtime.LoadResult
import com.texuli.spec.runtime.PlanNode
import com.texuli.spec.runtime.loadBlueprint
import java.io.File
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue
import kotlin.test.fail

/**
 * The sixth KMP app migration check (native/docs/kmp-tapduel-migration.md):
 * a finished KMPTapDuelGame match as a static scoreboard loads with every
 * widget painted, the tap zones become tier-denied placeholders, and the
 * portable profile refuses the scoreboard. The game itself stays app code.
 */
class KmpTapDuelMigrationTest {
    private val repo = File(System.getProperty("texuli.repo") ?: error("texuli.repo is not set"))
    private fun fixture(name: String) = File(repo, "native/conformance/fixtures/$name").readText()

    private fun ready(text: String, name: String): List<PlanNode> = when (val result = loadBlueprint(text)) {
        is LoadResult.Ready -> result.plan
        is LoadResult.Refused -> fail("$name: refused on the native target: ${result.diagnostics}")
    }

    @Test
    fun theFinishedMatchScoreboardLoadsWithEveryWidgetPainted() {
        val plan = ready(fixture("kmp-tapduel.json"), "kmp-tapduel.json")
        val root = plan.single() as PlanNode.Component
        assertEquals("layout-page", root.id)
        assertEquals(listOf("blocks-data", "charts-progress-ring", "blocks-text"), root.children.map { it.id })
        assertTrue(root.children.all { it is PlanNode.Component }, "every scoreboard widget is a catalog component")
        // Header -> layout-page; tap counts -> stat row; divider position -> progress ring; winner -> callout.
        assertEquals(
            mapOf(
                "layout-page" to BindingStatus.IMPLEMENTED,
                "blocks-data" to BindingStatus.IMPLEMENTED,
                "charts-progress-ring" to BindingStatus.IMPLEMENTED,
                "blocks-text" to BindingStatus.IMPLEMENTED,
            ),
            (listOf(root) + root.children).associate { it.id to NativeRegistry.status(it.id) },
        )
    }

    @Test
    fun theTapZonesLoadAsTierDeniedPlaceholders() {
        val root = ready(fixture("kmp-tapduel-arena.json"), "kmp-tapduel-arena.json").single() as PlanNode.Component
        val grid = root.children.single() as PlanNode.Component
        assertEquals("layout-grid", grid.id)
        assertEquals(
            listOf(PlanNode.Placeholder("button", "tier-denied"), PlanNode.Placeholder("button", "tier-denied")),
            grid.children,
        )
        val button = SpecVocabulary.components.single { it.id == "button" }
        assertTrue(button.emit.isEmpty(), "button became emittable; revisit the KMPTapDuelGame tap zones")
        assertEquals(BindingStatus.PLACEHOLDER, NativeRegistry.status("button"))
    }

    @Test
    fun thePortableProfileRefusesTheScoreboard() {
        val portable = fixture("kmp-tapduel.json").replace("\"profile\": \"web\"", "\"profile\": \"portable\"")
        val refused = loadBlueprint(portable) as? LoadResult.Refused
            ?: fail("the portable scoreboard loaded; an id reached portable core, revisit the KMPTapDuelGame mapping")
        assertEquals(setOf(SpecDiagnosticCode.UNSUPPORTED_PROFILE), refused.diagnostics.map { it.code }.toSet())
        assertEquals(
            listOf("layout-page", "blocks-data", "charts-progress-ring", "blocks-text"),
            refused.diagnostics.map { it.id },
        )
    }

    @Test
    fun theGameSurfaceHasNoNativePainter() {
        // Timers, countdown, animated divider, canvas goal markers: no catalog id paints them natively.
        assertEquals(BindingStatus.PLACEHOLDER, NativeRegistry.status("media-composition-canvas"))
        assertTrue(
            NativeRegistry.implemented.none { id -> listOf("game", "timer", "countdown").any { it in id } },
            "a game, timer or countdown painter landed; review the KMPTapDuelGame mapping",
        )
    }
}
