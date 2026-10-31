package com.texuli.conformance

import com.texuli.spec.JsonValue
import com.texuli.spec.runtime.parseJson
import com.texuli.spec.tokens.DesignTokenColors
import com.texuli.spec.tokens.DesignTokenSet
import com.texuli.spec.tokens.DesignTokens
import java.io.File
import kotlin.math.PI
import kotlin.math.abs
import kotlin.math.cos
import kotlin.math.pow
import kotlin.math.roundToInt
import kotlin.math.sin
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNotNull
import kotlin.test.assertTrue
import kotlin.test.fail

/**
 * Web/native conformance on design-token values (ADR-024). The fixture
 * `native/conformance/fixtures/design-tokens.web.json` holds the web
 * compiler's own `--tx-*` output for each generated set (the default and
 * acme), verbatim. This test parses every web string independently in
 * Kotlin (hex, `rgb()` and `oklch()` with the same chroma-reduction gamut
 * mapping as the web) and checks it equals the generated native value,
 * channel by channel; fonts, the radius and the spacing step must match too.
 */
class DesignTokensConformanceTest {
    private val repo = File(System.getProperty("texuli.repo") ?: error("texuli.repo is not set"))
    private val fixture = File(repo, "native/conformance/fixtures/design-tokens.web.json")

    private fun obj(value: JsonValue?): Map<String, JsonValue> =
        (value as? JsonValue.Obj)?.fields ?: fail("expected an object")

    private fun str(value: JsonValue?): String = (value as? JsonValue.Str)?.value ?: fail("expected a string")

    private val systems: List<Map<String, JsonValue>> by lazy {
        val root = obj(parseJson(fixture.readText()))
        (root["systems"] as JsonValue.Arr).items.map { obj(it) }
    }

    private fun setNamed(name: String): DesignTokenSet = when (name) {
        "Default" -> DesignTokens.Default
        "Acme" -> DesignTokens.Acme
        else -> fail("no generated set $name")
    }

    @Test
    fun everyGeneratedSetHasItsWebCompileInTheFixture() {
        assertEquals(DesignTokens.all.map { it.id }, systems.map { str(it["id"]) })
        for (system in systems) {
            val set = setNamed(str(system["name"]))
            assertEquals(str(system["id"]), set.id)
            assertEquals(str(system["version"]), set.version)
            assertEquals(str(system["hash"]), set.hash)
        }
    }

    @Test
    fun colorsMatchTheWebVariablesPerModeAndRole() {
        var checked = 0
        for (system in systems) {
            val set = setNamed(str(system["name"]))
            val vars = obj(system["vars"])
            for (mode in listOf("light", "dark")) {
                val web = obj(vars[mode]).mapValues { (_, value) -> str(value) }
                val native: DesignTokenColors = assertNotNull(if (mode == "light") set.light else set.dark)
                for ((name, argb) in native.byVar) {
                    val expected = parseCssColor(web[name] ?: fail("${set.id} $mode: no $name on the web"))
                    assertArgbEquals(expected, argb, "${set.id} $mode $name (${web[name]})")
                    checked += 1
                }
            }
        }
        assertEquals(2 * 2 * DesignTokens.Default.light.byVar.size, checked)
    }

    @Test
    fun fontsRadiusAndSpacingMatchTheWebVariables() {
        for (system in systems) {
            val set = setNamed(str(system["name"]))
            val light = obj(obj(system["vars"])["light"]).mapValues { (_, value) -> str(value) }
            assertEquals(light["--tx-font-sans"], set.fontSans)
            assertEquals(light["--tx-font-heading"], set.fontHeading)
            assertEquals(light["--tx-font-mono"], set.fontMono)
            assertEquals(cssPixels(light.getValue("--tx-radius")), set.radius)
            assertEquals(cssPixels(light.getValue("--tx-space-1")), set.space)
        }
        assertEquals(8.0, DesignTokens.Acme.radius)
        assertEquals(0xFF4F46E5L, DesignTokens.Acme.light.primary)
    }

    @Test
    fun theKotlinParserAgreesWithKnownValues() {
        assertEquals(0xFF112233L, parseCssColor("#123"))
        assertEquals(0x66111827L, parseCssColor("#11182766"))
        assertEquals(0x5209090BL, parseCssColor("rgb(9 9 11 / 0.32)"))
        assertEquals(0xFFFFFFFFL, parseCssColor("oklch(1 0 0)"))
        assertEquals(0xFF000000L, parseCssColor("oklch(0 0 0)"))
        assertEquals(16.0, cssPixels("1rem"))
    }

    private fun assertArgbEquals(expected: Long, actual: Long, what: String) {
        for (shift in listOf(24, 16, 8, 0)) {
            val a = (expected shr shift) and 0xFF
            val b = (actual shr shift) and 0xFF
            assertTrue(abs(a - b) <= 1, "$what: channel at $shift is $b on native, $a on the web")
        }
    }

    private fun cssPixels(value: String): Double {
        val match = Regex("""^(\d+(?:\.\d+)?)(px|rem)$""").matchEntire(value) ?: fail("not a length: $value")
        val amount = match.groupValues[1].toDouble()
        return if (match.groupValues[2] == "rem") amount * 16 else amount
    }

    private fun byte(unit: Double): Long = (unit.coerceIn(0.0, 1.0) * 255).roundToInt().toLong()

    private fun alpha(text: String?, percent: String?): Long =
        if (text.isNullOrEmpty()) 0xFF else byte(text.toDouble() / if (percent == "%") 100 else 1)

    /** A CSS color the compiler emits, as `0xAARRGGBB`. */
    private fun parseCssColor(value: String): Long {
        val color = value.trim().lowercase()
        Regex("""^#([0-9a-f]{3})$""").matchEntire(color)?.let { m ->
            val hex = m.groupValues[1].map { "$it$it" }.joinToString("")
            return 0xFF000000L or hex.toLong(16)
        }
        Regex("""^#([0-9a-f]{6})([0-9a-f]{2})?$""").matchEntire(color)?.let { m ->
            val alpha = if (m.groupValues[2].isEmpty()) 0xFFL else m.groupValues[2].toLong(16)
            return (alpha shl 24) or m.groupValues[1].toLong(16)
        }
        Regex("""^rgba?\(\s*(\d{1,3})[\s,]+(\d{1,3})[\s,]+(\d{1,3})\s*(?:[,/]\s*([\d.]+)(%?)\s*)?\)$""")
            .matchEntire(color)?.let { m ->
                val (r, g, b) = (1..3).map { m.groupValues[it].toLong().coerceIn(0, 255) }
                return (alpha(m.groupValues[4], m.groupValues[5]) shl 24) or (r shl 16) or (g shl 8) or b
            }
        Regex("""^oklch\(\s*([\d.]+)(%?)\s+([\d.]+)\s+([\d.]+)(?:deg)?\s*(?:/\s*([\d.]+)(%?)\s*)?\)$""")
            .matchEntire(color)?.let { m ->
                val l = m.groupValues[1].toDouble() / if (m.groupValues[2] == "%") 100 else 1
                val (r, g, b) = oklchToSrgb(l.coerceIn(0.0, 1.0), m.groupValues[3].toDouble(), m.groupValues[4].toDouble())
                return (alpha(m.groupValues[5], m.groupValues[6]) shl 24) or (r shl 16) or (g shl 8) or b
            }
        fail("a color the compiler does not emit: $value")
    }

    private fun linear(l: Double, c: Double, h: Double): DoubleArray {
        val a = c * cos(h * PI / 180)
        val b = c * sin(h * PI / 180)
        val lc = (l + 0.3963377774 * a + 0.2158037573 * b).pow(3)
        val mc = (l - 0.1055613458 * a - 0.0638541728 * b).pow(3)
        val sc = (l - 0.0894841775 * a - 1.291485548 * b).pow(3)
        return doubleArrayOf(
            4.0767416621 * lc - 3.3077115913 * mc + 0.2309699292 * sc,
            -1.2684380046 * lc + 2.6097574011 * mc - 0.3413193965 * sc,
            -0.0041960863 * lc - 0.7034186147 * mc + 1.707614701 * sc,
        )
    }

    /** OKLCH to sRGB bytes, reducing chroma (24 bisection steps) until the color fits the gamut. */
    private fun oklchToSrgb(l: Double, c: Double, h: Double): List<Long> {
        val fits = { rgb: DoubleArray -> rgb.all { it in 0.0..1.0 } }
        var rgb = linear(l, c, h)
        if (!fits(rgb)) {
            var low = 0.0
            var high = c
            repeat(24) {
                val candidate = (low + high) / 2
                val mapped = linear(l, candidate, h)
                if (fits(mapped)) {
                    low = candidate
                    rgb = mapped
                } else {
                    high = candidate
                }
            }
        }
        return rgb.map { v -> byte(if (v <= 0.0031308) 12.92 * v else 1.055 * v.pow(1 / 2.4) - 0.055) }
    }
}
