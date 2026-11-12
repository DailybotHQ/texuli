package com.texuli.emojis

import com.texuli.emojis.generated.EmojiCatalogData
import com.texuli.emojis.generated.EmojiCatalogEntry

/** Input classes scanned by [findEmojis]. Offsets are UTF-16 code-unit offsets. */
enum class EmojiSource { UNICODE, SHORTCODE, BOTH }

data class EmojiMatch(
    val id: String,
    val unicode: String,
    val start: Int,
    val end: Int,
    val kind: String,
    val source: String,
)

sealed interface EmojiToken {
    data class Text(val text: String, val start: Int, val end: Int) : EmojiToken
    data class Emoji(val match: EmojiMatch) : EmojiToken
}

private class TrieNode {
    val children = mutableMapOf<Int, TrieNode>()
    var entry: EmojiCatalogEntry? = null
    var unicode: String? = null
}

/** Generated Unicode 18 / CLDR 49 catalog and the framework-independent tokenizer. */
object EmojiEngine {
    val catalogSize: Int get() = EmojiCatalogData.entries.size
    private val byId = EmojiCatalogData.entries.associateBy { it.id }
    private val byUnicode = EmojiCatalogData.entries.associateBy { it.unicode }
    private val byShortcode = EmojiCatalogData.entries.associateBy { it.shortcode }
    private val root = TrieNode().also { trie ->
        for (entry in EmojiCatalogData.entries) {
            for (sequence in entry.sequences) {
                var node = trie
                var cursor = 0
                while (cursor < sequence.length) {
                    val point = codePointAt(sequence, cursor)
                    val child = node.children.getOrPut(point.first) { TrieNode() }
                    node = child
                    cursor += point.second
                }
                node.entry = entry
                node.unicode = sequence
            }
        }
    }

    /** Matches the web catalog lookup: trimmed id, canonical Unicode or canonical shortcode. */
    fun getEmoji(query: String?): EmojiCatalogEntry? {
        if (query == null || query.length > 256) return null
        val value = query.trim()
        return byId[value] ?: byUnicode[value] ?: byShortcode[value]
    }

    fun findEmojis(text: String, source: EmojiSource = EmojiSource.BOTH): List<EmojiMatch> {
        if (text.isEmpty()) return emptyList()
        val matches = mutableListOf<EmojiMatch>()
        var cursor = 0
        while (cursor < text.length) {
            val unicode = if (source == EmojiSource.SHORTCODE) null else longestAt(text, cursor)
            val shortcode = if (source == EmojiSource.UNICODE) null else shortcodeAt(text, cursor)
            val match = when {
                unicode != null && shortcode != null -> if (unicode.end - cursor >= shortcode.end - cursor) unicode else shortcode
                else -> unicode ?: shortcode
            }
            if (match != null) {
                matches.add(match)
                cursor = match.end
            } else {
                cursor += codePointAt(text, cursor).second
            }
        }
        return matches
    }

    fun parseEmojiTokens(text: String, source: EmojiSource = EmojiSource.BOTH): List<EmojiToken> {
        val tokens = mutableListOf<EmojiToken>()
        var cursor = 0
        for (match in findEmojis(text, source)) {
            if (match.start > cursor) tokens.add(EmojiToken.Text(text.substring(cursor, match.start), cursor, match.start))
            tokens.add(EmojiToken.Emoji(match))
            cursor = match.end
        }
        if (cursor < text.length) tokens.add(EmojiToken.Text(text.substring(cursor), cursor, text.length))
        return tokens
    }

    fun toUnicode(text: String, source: EmojiSource = EmojiSource.SHORTCODE): String = replace(text, source) { it.unicode }

    fun toShortcodes(text: String, source: EmojiSource = EmojiSource.UNICODE): String =
        replace(text, source) { byId[it.id]?.shortcode ?: it.source }

    private fun replace(text: String, source: EmojiSource, replacement: (EmojiMatch) -> String): String {
        val matches = findEmojis(text, source)
        if (matches.isEmpty()) return text
        val output = StringBuilder()
        var cursor = 0
        for (match in matches) {
            output.append(text, cursor, match.start).append(replacement(match))
            cursor = match.end
        }
        return output.append(text, cursor, text.length).toString()
    }

    private fun longestAt(text: String, start: Int): EmojiMatch? {
        var node = root
        var cursor = start
        var best: EmojiMatch? = null
        while (cursor < text.length) {
            val (point, width) = codePointAt(text, cursor)
            node = node.children[point] ?: break
            cursor += width
            node.entry?.let { entry ->
                best = EmojiMatch(entry.id, node.unicode ?: entry.unicode, start, cursor, "unicode", text.substring(start, cursor))
            }
        }
        return best
    }

    private fun shortcodeAt(text: String, start: Int): EmojiMatch? {
        if (text[start] != ':') return null
        val end = text.indexOf(':', start + 1)
        if (end < 0 || end - start > 82) return null
        val alias = text.substring(start + 1, end)
        if (alias.length !in 1..80 || alias.any { !(it in 'a'..'z' || it in '0'..'9' || it == '_' || it == '+' || it == '-') }) return null
        val entry = byShortcode[":$alias:"] ?: return null
        return EmojiMatch(entry.id, entry.unicode, start, end + 1, "shortcode", text.substring(start, end + 1))
    }

    private fun codePointAt(text: String, index: Int): Pair<Int, Int> {
        val first = text[index].code
        if (first in 0xD800..0xDBFF && index + 1 < text.length) {
            val second = text[index + 1].code
            if (second in 0xDC00..0xDFFF) return (0x10000 + ((first - 0xD800) shl 10) + second - 0xDC00) to 2
        }
        return first to 1
    }
}
