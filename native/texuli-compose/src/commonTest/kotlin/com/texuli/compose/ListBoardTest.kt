package com.texuli.compose

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNull

class ListBoardTest {
    @Test
    fun `text list projection preserves ordered mode and item text`() {
        val items = textItems("Draft", "Review")

        assertEquals(NativeList(ordered = true, items = listOf("Draft", "Review")), nativeList(block("list", "ordered" to bool(true), "items" to items)))
        assertEquals(NativeList(ordered = false, items = listOf("Draft", "Review")), nativeList(block("list", "items" to items)))
    }

    @Test
    fun `malformed list projection is rejected instead of inventing content`() {
        assertNull(nativeList(block("list", "ordered" to str("yes"))))
        assertNull(nativeList(block("list", "items" to arr())))
    }

    @Test
    fun `board projection retains column order empty states and card order`() {
        val board = nativeBoard(block(
            "board",
            "columns" to arr(boardColumn("todo", "To do", "first" to "Plan", "second" to "Build"), boardColumn("done", "Done")),
        ))

        assertEquals(listOf("todo", "done"), board?.columns?.map { it.id })
        assertEquals(listOf("Plan", "Build"), board?.columns?.first()?.cards?.map { it.title })
        assertEquals(2, board?.cardCount)
        assertEquals(emptyList(), board?.columns?.last()?.cards)
        assertEquals(BindingStatus.IMPLEMENTED, NativeRegistry.status("blocks-diagram"))
    }

    @Test
    fun `malformed or over-limit board is rejected`() {
        val tooManyColumns = (1..7).map { index -> boardColumn("col-$index", "Column $index") }
        assertNull(nativeBoard(block("board", "columns" to arr(tooManyColumns))))
        assertNull(nativeBoard(block("board", "columns" to arr())))
        val tooManyCards = (1..9).map { index -> "card-$index" to "Card $index" }.toTypedArray()
        assertNull(nativeBoard(block("board", "columns" to arr(boardColumn("todo", "To do", *tooManyCards)))))
        assertNull(nativeBoard(block("board", "columns" to arr(boardColumn("same", "A", "same" to "Card")))))
    }
}
