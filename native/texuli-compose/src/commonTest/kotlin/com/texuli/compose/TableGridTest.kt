package com.texuli.compose

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNull

class TableGridTest {
    @Test
    fun `table projection keeps declared column order and inert scalar values`() {
        val model = nativeTable(block(
            "table",
            "caption" to str("Fictional queue"),
            "columns" to tableColumns("name" to "Name", "count" to "Count", "active" to "Active"),
            "rows" to arr(
                obj("active" to bool(true), "count" to num(2), "ignored" to str("not rendered"), "name" to str("Example entry")),
                obj("name" to str("Missing count")),
            ),
        ))

        assertEquals("Fictional queue", model?.caption)
        assertEquals(listOf("Name", "Count", "Active"), model?.columns?.map { it.label })
        assertEquals(listOf(listOf("Example entry", "2", "true"), listOf("Missing count", "", "")), model?.rows)
    }

    @Test
    fun `whole numbers keep their value beyond the exact-integer range`() {
        val model = nativeTable(block(
            "table",
            "columns" to tableColumns("n" to "N"),
            "rows" to arr(obj("n" to num(9_007_199_254_740_991.0)), obj("n" to num(1e308)), obj("n" to num(-0.0)), obj("n" to num(2.5))),
        ))

        assertEquals(listOf("9007199254740991", "1.0E308", "0", "2.5"), model?.rows?.map { it.single() })
    }

    @Test
    fun `non-table block is not interpreted as a table`() {
        assertNull(nativeTable(block("stat")))
        assertNull(nativeTable(null))
        assertNull(nativeTable(block("table")))
    }

    @Test
    fun `layout grid columns use bounded deterministic fallback`() {
        assertEquals(2, nativeGridColumns(null))
        assertEquals(1, nativeGridColumns(num(1)))
        assertEquals(4, nativeGridColumns(num(8)))
        assertEquals(2, nativeGridColumns(str("wide")))
        assertEquals(listOf(listOf(1, 2, 3), listOf(4, 5, 6), listOf(7)), nativeGridRows((1..7).toList(), 3))
    }
}
