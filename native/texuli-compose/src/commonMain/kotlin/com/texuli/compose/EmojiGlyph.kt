package com.texuli.compose

import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import com.texuli.emojis.EmojiEngine

/**
 * Displays a catalog emoji with the platform's system emoji font. No emoji
 * artwork is bundled yet. Unknown queries render [fallbackGlyph] verbatim.
 */
@Composable
fun EmojiGlyph(
    query: String,
    modifier: Modifier = Modifier,
    fallbackGlyph: String = "□",
    fallbackDescription: String = "Unknown emoji",
) {
    val emoji = EmojiEngine.getEmoji(query)
    val value = emoji?.unicode ?: fallbackGlyph
    Text(
        text = value,
        modifier = modifier.semantics {
            contentDescription = emoji?.name ?: fallbackDescription
        },
    )
}
