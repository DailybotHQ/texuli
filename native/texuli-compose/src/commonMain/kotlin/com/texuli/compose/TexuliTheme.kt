package com.texuli.compose

import androidx.compose.material3.ColorScheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color
import com.texuli.spec.tokens.DesignTokenColors
import com.texuli.spec.tokens.DesignTokenSet
import com.texuli.spec.tokens.DesignTokens

/**
 * The token theme (ADR-024): Material colors from a generated design-token
 * set (`DesignTokens.kt`, generated from a compiled design system by
 * `packages/spec/scripts/design-tokens.ts`), so the native twin paints with
 * the web's values. The default is the Texuli default design system; pass
 * any generated set (`DesignTokens.Acme`) to brand it. The host decides
 * light or dark; a set without a dark mode paints its light colors.
 */
@Composable
fun TexuliTheme(
    dark: Boolean = false,
    tokens: DesignTokenSet = DesignTokens.Default,
    content: @Composable () -> Unit,
) {
    MaterialTheme(colorScheme = texuliColorScheme(tokens, dark), content = content)
}

/** A Material color scheme from one mode of a token set. */
fun texuliColorScheme(tokens: DesignTokenSet, dark: Boolean): ColorScheme {
    val mode = if (dark) tokens.dark ?: tokens.light else tokens.light
    val c = colorsOf(mode)
    return if (dark && tokens.dark != null) {
        darkColorScheme(
            primary = c.primary, onPrimary = c.onPrimary,
            primaryContainer = c.primaryContainer, onPrimaryContainer = c.onPrimaryContainer,
            secondary = c.secondary, onSecondary = c.onSecondary,
            tertiary = c.tertiary, onTertiary = c.onTertiary,
            background = c.background, onBackground = c.onBackground,
            surface = c.surface, onSurface = c.onSurface,
            surfaceVariant = c.surfaceVariant, onSurfaceVariant = c.onSurfaceVariant,
            outline = c.outline, outlineVariant = c.outlineVariant,
            error = c.error, onError = c.onError,
            errorContainer = c.errorContainer, onErrorContainer = c.onErrorContainer,
            scrim = c.scrim,
        )
    } else {
        lightColorScheme(
            primary = c.primary, onPrimary = c.onPrimary,
            primaryContainer = c.primaryContainer, onPrimaryContainer = c.onPrimaryContainer,
            secondary = c.secondary, onSecondary = c.onSecondary,
            tertiary = c.tertiary, onTertiary = c.onTertiary,
            background = c.background, onBackground = c.onBackground,
            surface = c.surface, onSurface = c.onSurface,
            surfaceVariant = c.surfaceVariant, onSurfaceVariant = c.onSurfaceVariant,
            outline = c.outline, outlineVariant = c.outlineVariant,
            error = c.error, onError = c.onError,
            errorContainer = c.errorContainer, onErrorContainer = c.onErrorContainer,
            scrim = c.scrim,
        )
    }
}

/** The Material roles each token reads (the same roles the web's components use). */
private class MaterialColors(t: DesignTokenColors) {
    val primary = Color(t.primary)
    val onPrimary = Color(t.primaryForeground)
    val primaryContainer = Color(t.primarySoft)
    val onPrimaryContainer = Color(t.primarySoftForeground)
    val secondary = Color(t.secondary)
    val onSecondary = Color(t.secondaryForeground)
    val tertiary = Color(t.accent)
    val onTertiary = Color(t.accentForeground)
    val background = Color(t.background)
    val onBackground = Color(t.foreground)
    val surface = Color(t.surface)
    val onSurface = Color(t.surfaceForeground)
    val surfaceVariant = Color(t.muted)
    val onSurfaceVariant = Color(t.mutedForeground)
    val outline = Color(t.borderStrong)
    val outlineVariant = Color(t.border)
    val error = Color(t.destructive)
    val onError = Color(t.destructiveForeground)
    val errorContainer = Color(t.destructiveSoft)
    val onErrorContainer = Color(t.destructiveSoftForeground)
    val scrim = Color(t.scrim)
}

private fun colorsOf(mode: DesignTokenColors) = MaterialColors(mode)
