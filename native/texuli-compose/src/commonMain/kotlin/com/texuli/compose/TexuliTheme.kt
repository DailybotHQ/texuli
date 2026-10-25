package com.texuli.compose

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

/**
 * A minimal token theme until `texuli-tokens` is generated from the spec's
 * token roles (design §3). The values mirror the default Texuli theme's
 * neutral roles; the host decides light or dark.
 */
@Composable
fun TexuliTheme(dark: Boolean = false, content: @Composable () -> Unit) {
    val colors = if (dark) {
        darkColorScheme(
            primary = Color(0xFF9DB7FF),
            background = Color(0xFF111318),
            surface = Color(0xFF181B21),
            onBackground = Color(0xFFE6E8EE),
            onSurface = Color(0xFFE6E8EE),
            outline = Color(0xFF3A3F4B),
        )
    } else {
        lightColorScheme(
            primary = Color(0xFF2F57D9),
            background = Color(0xFFFFFFFF),
            surface = Color(0xFFF7F8FA),
            onBackground = Color(0xFF15171C),
            onSurface = Color(0xFF15171C),
            outline = Color(0xFFD5D9E0),
        )
    }
    MaterialTheme(colorScheme = colors, content = content)
}
