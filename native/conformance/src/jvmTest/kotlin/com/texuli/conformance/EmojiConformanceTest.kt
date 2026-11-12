package com.texuli.conformance

import com.texuli.emojis.EmojiEngine
import com.texuli.emojis.EmojiMatch
import com.texuli.emojis.EmojiToken
import com.texuli.spec.JsonValue
import com.texuli.spec.runtime.parseJson
import java.io.File
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNotNull

/** Web-generated corpus; Kotlin String indexes and JS spans both count UTF-16 code units. */
class EmojiConformanceTest {
    private val repo = File(System.getProperty("texuli.repo") ?: error("texuli.repo is not set"))
    private val fixture = File(repo, "tests/fixtures/emojis/conformance.jsonl")

    private fun obj(value: JsonValue?): Map<String, JsonValue> =
        (value as? JsonValue.Obj)?.fields ?: error("expected object, got $value")
    private fun str(value: JsonValue?): String =
        (value as? JsonValue.Str)?.value ?: error("expected string, got $value")
    private fun num(value: JsonValue?): Int =
        (value as? JsonValue.Num)?.value?.toInt() ?: error("expected number, got $value")

    private fun matchJson(match: EmojiMatch): JsonValue = JsonValue.Obj(linkedMapOf(
        "id" to JsonValue.Str(match.id),
        "unicode" to JsonValue.Str(match.unicode),
        "start" to JsonValue.Num(match.start.toDouble()),
        "end" to JsonValue.Num(match.end.toDouble()),
        "kind" to JsonValue.Str(match.kind),
        "source" to JsonValue.Str(match.source),
    ))

    private fun tokenJson(token: EmojiToken): JsonValue = when (token) {
        is EmojiToken.Text -> JsonValue.Obj(linkedMapOf(
            "type" to JsonValue.Str("text"), "text" to JsonValue.Str(token.text),
            "start" to JsonValue.Num(token.start.toDouble()), "end" to JsonValue.Num(token.end.toDouble()),
        ))
        is EmojiToken.Emoji -> {
            val fields = (matchJson(token.match) as JsonValue.Obj).fields
            JsonValue.Obj(linkedMapOf("type" to JsonValue.Str("emoji")) + fields)
        }
    }

    private fun inputFrom(case: Map<String, JsonValue>): String {
        val units = case["inputUnits"] as? JsonValue.Arr
        if (units != null) return buildString {
            units.items.forEach { append(num(it).toChar()) }
        }
        val template = case["inputTemplate"] as? JsonValue.Obj
        if (template != null) {
            val fields = template.fields
            val prefix = str(fields["prefix"])
            val segment = str(fields["segment"])
            val repetitions = num(fields["repeat"])
            val suffix = str(fields["suffix"])
            return buildString(prefix.length + segment.length * repetitions + suffix.length) {
                append(prefix)
                repeat(repetitions) { append(segment) }
                append(suffix)
            }
        }
        return str(case["input"])
    }

    @Test
    fun generatedCatalogLegacyAndHostileCorpusMatchesTheWebEngine() {
        fixture.bufferedReader().use { reader ->
            val header = obj(parseJson(reader.readLine() ?: error("missing fixture header")))
            assertEquals("texuli-emoji-conformance/v2", str(header["schemaVersion"]))
            assertEquals("UTF-16 code units", str(header["offsetUnit"]))
            val expectedCatalog = num(header["catalogSequences"])
            val expectedLegacy = num(header["legacyInputs"])
            val expectedHostile = num(header["hostileInputs"])
            val expectedCases = num(header["cases"])
            var casesChecked = 0
            var catalogChecked = 0
            var legacyChecked = 0
            var hostileChecked = 0
            var matchesChecked = 0
            var spansChecked = 0
            var roundTripsChecked = 0
            while (true) {
                val line = reader.readLine() ?: break
                if (line.isBlank()) continue
                val case = obj(parseJson(line))
                val input = inputFrom(case)
                val name = str(case["name"])
                val matches = EmojiEngine.findEmojis(input)
                val tokens = EmojiEngine.parseEmojiTokens(input)
                assertEquals(num(case["matchCount"]), matches.size, "$name match count")
                assertEquals(num(case["tokenCount"]), tokens.size, "$name token count")
                matchesChecked += matches.size

                val expectedMatches = case["matches"] as? JsonValue.Arr
                if (expectedMatches != null) {
                    assertEquals(expectedMatches, JsonValue.Arr(matches.map(::matchJson)), "$name matches and UTF-16 spans")
                    spansChecked += matches.size
                    val expectedTokens = case["tokens"] as JsonValue.Arr
                    assertEquals(expectedTokens, JsonValue.Arr(tokens.map(::tokenJson)), "$name tokens")
                    assertEquals(str(case["toUnicode"]), EmojiEngine.toUnicode(input), "$name toUnicode")
                    assertEquals(str(case["toShortcodes"]), EmojiEngine.toShortcodes(input), "$name toShortcodes")
                    assertEquals(str(case["roundTrip"]), EmojiEngine.toUnicode(EmojiEngine.toShortcodes(input)), "$name round trip")
                    roundTripsChecked += if (name.startsWith("catalog:")) 1 else 0
                } else {
                    assertEquals(true, case["toUnicodePreservesInput"] == JsonValue.Bool(EmojiEngine.toUnicode(input) == input), "$name toUnicode preservation")
                    assertEquals(true, case["toShortcodesPreservesInput"] == JsonValue.Bool(EmojiEngine.toShortcodes(input) == input), "$name shortcode preservation")
                    assertEquals(true, case["roundTripPreservesInput"] == JsonValue.Bool(EmojiEngine.toUnicode(EmojiEngine.toShortcodes(input)) == input), "$name round trip preservation")
                }

                when {
                    name.startsWith("catalog:") -> catalogChecked++
                    name.startsWith("legacy:") -> legacyChecked++
                    name.startsWith("hostile:") -> hostileChecked++
                }
                casesChecked++
            }
            assertEquals(expectedCases, casesChecked)
            assertEquals(expectedCatalog, catalogChecked)
            assertEquals(expectedLegacy, legacyChecked)
            assertEquals(expectedHostile, hostileChecked)
            assertEquals(3963, EmojiEngine.catalogSize)
            println("Emoji Kotlin parity: cases=$casesChecked, catalog=$catalogChecked, legacy=$legacyChecked, hostile=$hostileChecked, matches=$matchesChecked, UTF-16 spans=$spansChecked, catalog round trips=$roundTripsChecked")
        }
    }

    @Test
    fun generatedCatalogResolvesOnlyCanonicalEntries() {
        assertEquals(3963, EmojiEngine.catalogSize)
        assertNotNull(EmojiEngine.getEmoji(":thumbs_up:"))
        assertNotNull(EmojiEngine.getEmoji("  1f44d  "))
        assertNotNull(EmojiEngine.getEmoji("\uD83D\uDC4D"))
        assertEquals(null, EmojiEngine.getEmoji(":thumbsup:"))
        assertEquals(null, EmojiEngine.getEmoji("x".repeat(257)))
    }
}
