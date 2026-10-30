package com.texuli.compose

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNull

class LayoutWidgetsTest {
    @Test
    fun `responsive grid never exceeds requested columns and honors minimum tile width`() {
        assertEquals(1, nativeResponsiveGridColumns(requested = 4, availableWidthDp = 359, gapDp = 16))
        assertEquals(2, nativeResponsiveGridColumns(requested = 4, availableWidthDp = 376, gapDp = 16))
        assertEquals(3, nativeResponsiveGridColumns(requested = 3, availableWidthDp = 900, gapDp = 16))
        assertEquals(1, nativeResponsiveGridColumns(requested = 0, availableWidthDp = 0, gapDp = 100))
    }

    @Test
    fun `grid gap maps only bounded spacing values to native dp`() {
        assertEquals(NativeGridSpec(requestedColumns = 3, gapDp = 16), nativeGridSpec(mapOf("columns" to num(3), "gap" to str("1rem"))))
        assertEquals(0, nativeGridSpec(mapOf("gap" to str("0px")))?.gapDp)
        assertNull(nativeGridSpec(mapOf("gap" to str("calc(1rem + 2px)"))))
    }

    @Test
    fun `document outline preserves nested heading reading order`() {
        val nested = component("layout-card", emptyMap(), heading("Second section"))

        assertEquals(listOf("First section", "Second section"), nativeDocumentOutline(listOf(heading("First section"), nested)))
    }

    @Test
    fun `deck slide label is plain data and missing ids stay absent`() {
        assertEquals("closing", nativeDeckSlideLabel(mapOf("slideId" to str("closing"))))
        assertNull(nativeDeckSlideLabel(mapOf("slideId" to str("  "))))
        assertEquals(true, nativeDeckFrameSupported(mapOf("title" to str("Review"))))
        assertEquals(false, nativeDeckFrameSupported(mapOf("title" to str("Review"), "aspect" to str("16:9"))))
        assertEquals(BindingStatus.IMPLEMENTED, NativeRegistry.status("deck-slide"))
        assertEquals(BindingStatus.IMPLEMENTED, NativeRegistry.status("layout-doc"))
        assertEquals(BindingStatus.IMPLEMENTED, NativeRegistry.status("layout-grid"))
        assertEquals(BindingStatus.PLACEHOLDER, NativeRegistry.status("layout-sidebar"))
        // Spec 0.7.0 documents validate natively but paint as a visible placeholder (planned).
        assertEquals(BindingStatus.PLACEHOLDER, NativeRegistry.status("document"))
        // Spec 0.8.0 forms validate natively but paint as a visible placeholder (planned).
        assertEquals(BindingStatus.PLACEHOLDER, NativeRegistry.status("schema-form"))
        // Spec 0.8.0 canvases validate natively but paint as a visible placeholder (planned).
        assertEquals(BindingStatus.PLACEHOLDER, NativeRegistry.status("canvas"))
    }
}
