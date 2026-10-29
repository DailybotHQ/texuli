package com.texuli.compose

import com.texuli.spec.JsonValue
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNull
import kotlin.test.assertTrue

class CompositionWidgetsTest {
    @Test
    fun `composition layouts and the code and structure families paint natively`() {
        for (id in listOf("layout-stack", "layout-row", "layout-split", "layout-tile", "blocks-code", "blocks-structure")) {
            assertEquals(BindingStatus.IMPLEMENTED, NativeRegistry.status(id), id)
        }
        assertEquals(BindingStatus.PLACEHOLDER, NativeRegistry.status("blocks-interactive"))
    }

    @Test
    fun `layout gaps rows and splits map only closed values`() {
        assertEquals(16, nativeLayoutGapDp(null))
        assertEquals(0, nativeLayoutGapDp(str("none")))
        assertEquals(24, nativeLayoutGapDp(str("large")))
        assertNull(nativeLayoutGapDp(str("2rem")))
        assertNull(nativeLayoutGapDp(num(8)))

        assertEquals(NativeRowSpec(16, NativeRowAlign.STRETCH, wrap = true), nativeRowSpec(emptyMap()))
        assertEquals(
            NativeRowSpec(8, NativeRowAlign.CENTER, wrap = false),
            nativeRowSpec(mapOf("gap" to str("small"), "align" to str("center"), "wrap" to bool(false))),
        )
        assertNull(nativeRowSpec(mapOf("align" to str("baseline"))))
        assertNull(nativeRowSpec(mapOf("wrap" to str("yes"))))

        assertEquals(NativeSplitSpec(1f, 1f, 16), nativeSplitSpec(emptyMap()))
        assertEquals(NativeSplitSpec(2f, 1f, 0), nativeSplitSpec(mapOf("ratio" to str("2:1"), "gap" to str("none"))))
        assertNull(nativeSplitSpec(mapOf("ratio" to str("5:1"))))
    }

    @Test
    fun `tiles clamp their spans to the catalog bounds`() {
        assertEquals(NativeTileSpec("Trend", span = 2, rowSpan = 1), nativeTileSpec(mapOf("title" to str("Trend"), "span" to num(2))))
        assertEquals(NativeTileSpec(null, span = 4, rowSpan = 2), nativeTileSpec(mapOf("span" to num(99), "rowSpan" to num(9), "title" to str(" "))))
        assertEquals(NativeTileSpec(null, span = 1, rowSpan = 1), nativeTileSpec(mapOf("span" to num(Double.NaN), "rowSpan" to num(-3))))
    }

    @Test
    fun `code blocks are inert text and cta links keep only https`() {
        val code = nativeCodeBlock(block("code", "code" to str("<script>alert(1)</script>"), "lang" to str("ts"), "filename" to str("a.ts")))
        assertEquals(NativeCode("<script>alert(1)</script>", "ts", "a.ts", null), code)
        assertNull(nativeCodeBlock(block("code", "code" to str("x".repeat(NATIVE_CODE_MAX_CHARS + 1)))))
        assertNull(nativeCodeBlock(block("text", "code" to str("x"))))

        val actions = nativeCtaActions(
            block(
                "cta",
                "actions" to arr(
                    obj("label" to str("Open"), "href" to str("https://example.com/report")),
                    obj("label" to str("Script"), "href" to str("javascript:alert(1)")),
                    obj("label" to str("Plain"), "href" to str("http://example.com")),
                ),
            ),
        )
        assertEquals(
            listOf(NativeAction("Open", "https://example.com/report"), NativeAction("Script", null), NativeAction("Plain", null)),
            actions,
        )
        assertNull(nativeCtaActions(block("cta", "actions" to arr())))
        assertNull(nativeCtaActions(block("cta", "actions" to arr(obj("href" to str("https://example.com"))))))
    }

    @Test
    fun `columns and dividers accept only their documented shapes`() {
        val columns = nativeColumns(
            block("columns", "columns" to arr(arr(obj("type" to str("text"), "markdown" to str("A"))), arr(obj("type" to str("code"), "code" to str("b"))))),
        )
        assertEquals(2, columns?.size)
        assertEquals("blocks-text", nativeBlockFamily("text"))
        assertEquals("blocks-code", nativeBlockFamily("code"))
        assertEquals("blocks-structure", nativeBlockFamily("cta"))
        assertNull(nativeBlockFamily("poll"))
        assertNull(nativeColumns(block("columns", "columns" to arr(arr()))))
        assertNull(nativeColumns(block("columns", "columns" to arr(arr(str("x")), arr()))))

        assertEquals(NativeDivider(null, space = false), nativeDivider(block("divider")))
        assertEquals(NativeDivider("Part two", space = false), nativeDivider(block("divider", "label" to str("Part two"))))
        assertEquals(NativeDivider(null, space = true), nativeDivider(block("divider", "variant" to str("space"), "label" to str("x"))))
        assertNull(nativeDivider(block("divider", "variant" to str("dots"))))
    }

    @Test
    fun `new projections never throw on hostile values`() {
        val bases: List<Pair<String, Map<String, JsonValue>>> = listOf(
            "row" to mapOf("gap" to str("small"), "align" to str("center"), "wrap" to bool(true)),
            "split" to mapOf("ratio" to str("1:2"), "gap" to str("large")),
            "tile" to mapOf("title" to str("T"), "span" to num(2), "rowSpan" to num(1)),
            "code" to block("code", "code" to str("x"), "lang" to str("ts"), "filename" to str("f"), "caption" to str("c")),
            "cta" to block("cta", "actions" to arr(obj("label" to str("Go"), "href" to str("https://example.com")))),
            "columns" to block("columns", "columns" to arr(arr(obj("type" to str("text"))), arr())),
            "divider" to block("divider", "label" to str("x"), "variant" to str("line")),
        )
        var checked = 0
        for ((name, base) in bases) {
            for ((variant, props) in hostileVariants(base)) {
                runCatching {
                    nativeRowSpec(props)
                    nativeSplitSpec(props)
                    nativeTileSpec(props)
                    nativeCodeBlock(props)
                    nativeCtaActions(props)
                    nativeColumns(props)
                    nativeDivider(props)
                }.onFailure { throw AssertionError("$name / $variant threw", it) }
                checked += 1
            }
        }
        assertTrue(checked > 100)
    }
}
