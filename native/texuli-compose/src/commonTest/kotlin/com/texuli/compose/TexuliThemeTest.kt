package com.texuli.compose

import androidx.compose.ui.graphics.Color
import com.texuli.spec.tokens.DesignTokens
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNotEquals

/** `TexuliTheme` paints with generated design tokens, not hardcoded colors (ADR-024). */
class TexuliThemeTest {
    @Test
    fun lightAndDarkSchemesReadTheGeneratedTokens() {
        for (set in DesignTokens.all) {
            val light = texuliColorScheme(set, dark = false)
            assertEquals(Color(set.light.primary), light.primary)
            assertEquals(Color(set.light.background), light.background)
            assertEquals(Color(set.light.foreground), light.onBackground)
            assertEquals(Color(set.light.surface), light.surface)
            assertEquals(Color(set.light.border), light.outlineVariant)
            assertEquals(Color(set.light.destructive), light.error)
            val dark = texuliColorScheme(set, dark = true)
            val tokens = set.dark ?: set.light
            assertEquals(Color(tokens.primary), dark.primary)
            assertEquals(Color(tokens.background), dark.background)
            assertEquals(Color(tokens.surfaceForeground), dark.onSurface)
        }
    }

    @Test
    fun aBrandSetChangesTheScheme() {
        val brand = texuliColorScheme(DesignTokens.Acme, dark = false)
        assertEquals(Color(0xFF4F46E5L), brand.primary)
        assertNotEquals(texuliColorScheme(DesignTokens.Default, dark = false).primary, brand.primary)
    }
}
