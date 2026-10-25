package com.texuli.compose

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNull

class AccessibilityTest {
    @Test
    fun `image alternative preserves meaningful text and treats empty alt as decorative`() {
        assertEquals("A quiet coastline", nativeImageAlternative(mapOf("alt" to str("A quiet coastline"))))
        assertNull(nativeImageAlternative(mapOf("alt" to str("  "))))
        assertNull(nativeImageAlternative(emptyMap()))
    }

    @Test
    fun `heading rank defaults to two and clamps to one through six`() {
        assertEquals(2, nativeHeadingLevel(emptyMap()))
        assertEquals(1, nativeHeadingLevel(mapOf("level" to num(1))))
        assertEquals(6, nativeHeadingLevel(mapOf("level" to num(6))))
        assertEquals(1, nativeHeadingLevel(mapOf("level" to num(0))))
        assertEquals(6, nativeHeadingLevel(mapOf("level" to num(8))))
    }
}
