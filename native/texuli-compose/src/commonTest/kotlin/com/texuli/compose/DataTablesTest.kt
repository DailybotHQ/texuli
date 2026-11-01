package com.texuli.compose

import com.texuli.spec.JsonValue
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNull
import kotlin.test.assertTrue
import kotlin.test.fail

/**
 * The tabular data views natively (ADR-025): projection, the web's ordering
 * and number rules, and refusal of malformed input. The ported rules are
 * vector-checked in ChartMathParityTest.
 */
class DataTablesTest {
    private val grid = mapOf(
        "caption" to str("Open tickets"),
        "columns" to arr(obj("id" to str("subject"), "header" to str("Subject")), obj("id" to str("age"), "header" to str("Age"), "kind" to str("number"))),
        "rows" to arr(obj("id" to str("t1"), "cells" to obj("subject" to str("Login loop"), "age" to str("3"))), obj("id" to str("t2"), "cells" to obj("subject" to str("Invoice")))),
    )
    private val cohort = mapOf(
        "caption" to str("Retention"),
        "rows" to arr(obj("label" to str("W40"), "size" to num(1200), "cells" to arr(num(1), num(0.42))), obj("label" to str("W41"), "cells" to arr(num(1)), "incomplete" to bool(true))),
        "average" to bool(true),
        "heat" to bool(true),
    )
    private val tree = mapOf(
        "label" to str("Help"),
        "items" to arr(obj("id" to str("docs"), "label" to str("Docs")), obj("id" to str("api"), "label" to str("API"), "parent" to str("docs")), obj("id" to str("lost"), "label" to str("Lost"), "parent" to str("gone"))),
    )
    private val files = mapOf(
        "label" to str("Shared"),
        "entries" to arr(obj("id" to str("f1"), "name" to str("Reports"), "kind" to str("folder")), obj("id" to str("f2"), "name" to str("q1.csv"), "kind" to str("file"), "parent" to str("f1"), "size" to num(20480))),
    )

    @Test
    fun aGridKeepsCellTextAndAlignsNumbersAtTheEnd() {
        val view = nativeGrid(grid)!!
        assertEquals(listOf(GridAlign.START, GridAlign.END), view.columns.map { it.align })
        // A missing cell is empty text, as the web's `row.cells[column.id] ?? ''`.
        assertEquals(listOf("Invoice", ""), view.rows[1].second)
        assertNull(nativeGrid(grid + ("rows" to arr(obj("id" to str("t1"), "cells" to obj("subject" to num(1)))))))
        assertNull(nativeGrid(grid + ("columns" to arr(obj("id" to str("a"), "header" to str("A"), "kind" to str("money"))))))
        assertNull(nativeGrid(grid + ("rows" to arr(List(DATA_MAX_ROWS + 1) { obj("id" to str("r$it"), "cells" to obj()) }))))
    }

    @Test
    fun aCohortAveragesBySizeOnlyWhenEveryCohortHasOne() {
        val view = nativeCohort(cohort)!!
        // W41 has no size, so period 0 averages unweighted: (1 + 1) / 2.
        assertEquals(listOf(1.0, 0.42), cohortAverages(view.rows))
        assertTrue(view.rows[1].incompleteLast)
        assertEquals("42%", formatCohortValue(0.42, rate = true))
        assertEquals(2, heatLevel(0.42, 1.0))
        assertNull(nativeCohort(cohort + ("valueKind" to str("share"))))
    }

    @Test
    fun aTreeOrdersByRankAndKeepsOrphansAsRoots() {
        val view = nativeTree(tree)!!
        assertEquals(listOf("docs" to 1, "api" to 2, "lost" to 1), view.rows.map { it.entry.id to it.level })
        assertNull(nativeTree(tree + ("items" to arr(obj("id" to str("a"), "label" to str("A")), obj("id" to str("a"), "label" to str("B"))))))
    }

    @Test
    fun filesListFoldersFirstWithTheWebSizes() {
        val view = nativeFiles(files)!!
        assertEquals(listOf("f1"), childrenOf(view.entries, null).map { it.id })
        assertEquals("20 KB", formatSize(20480.0))
        assertEquals("Image", fileCategory(FileItem("x", null, "logo.PNG", false, null, null, null)))
        assertNull(nativeFiles(files + ("entries" to arr(obj("id" to str("x"), "name" to str("X"), "kind" to str("link"))))))
    }

    @Test
    fun theInteractiveViewsAreMarkedReadOnly() {
        assertEquals(setOf("data-grid", "data-tree-view", "data-files"), NativeRegistry.readOnly.intersect(setOf("data-grid", "data-tree-view", "data-files", "data-cohort-table")))
    }

    @Test
    fun hostilePropsNeverThrow() {
        val cases = listOf<Pair<Map<String, JsonValue>, (Map<String, JsonValue>) -> Any?>>(grid to ::nativeGrid, cohort to ::nativeCohort, tree to ::nativeTree, files to ::nativeFiles)
        for ((props, project) in cases) {
            for ((case, variant) in hostileVariants(props) + sequenceOf("valid" to props)) {
                try {
                    project(variant)
                } catch (error: Throwable) {
                    fail("$case threw ${error::class.simpleName}: ${error.message?.take(120)}")
                }
            }
        }
    }
}
