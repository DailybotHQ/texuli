package com.texuli.compose

import com.texuli.spec.JsonValue
import com.texuli.spec.runtime.PlanNode
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue
import kotlin.test.fail

/**
 * The hostile-prop matrix (the native twin of the web hostile suites): every
 * projection gets a valid base, then every key of it replaced by each of
 * HOSTILE_VALUES or removed. A projection may refuse (placeholder) but never
 * throws, and whatever it accepts stays inside its documented bounds.
 */
class HostilePropsTest {
    private fun <T> survive(label: String, base: Map<String, JsonValue>, project: (Map<String, JsonValue>) -> T, check: (T) -> Unit = {}) {
        var cases = 0
        for ((case, props) in hostileVariants(base) + sequenceOf("valid base" to base)) {
            cases++
            val result = try {
                project(props)
            } catch (error: Throwable) {
                fail("$label with $case threw ${error::class.simpleName}: ${error.message?.take(120)}")
            }
            check(result)
        }
        assertTrue(cases > base.size * HOSTILE_VALUES.size, "$label ran its matrix")
    }

    private fun assertNoControls(label: String, text: String?) {
        if (text != null) assertTrue(text.none { it.code < 0x20 }, "$label leaked a control character")
    }

    @Test
    fun chartsRefuseOrStayFiniteAndOrdered() {
        val bases = mapOf(
            "charts-sparkline" to mapOf("title" to str("Arrivals"), "label" to str("Trend"), "description" to str("Weekly"), "values" to arr(num(1), JsonValue.Null, num(3)), "variant" to str("area"), "showLast" to bool(false)),
            "charts-bullet" to mapOf("label" to str("Done"), "value" to num(42), "max" to num(60), "target" to num(48)),
            "charts-gauge" to mapOf("label" to str("Load"), "value" to num(3), "min" to num(0), "max" to num(10)),
            "charts-progress-ring" to mapOf("label" to str("Uploaded"), "value" to num(25), "max" to num(50)),
        )
        for ((id, base) in bases) {
            survive(id, base, { nativeChartWidget(id, it) }) { widget ->
                if (widget == null) return@survive
                assertTrue(widget.label.isNotEmpty())
                assertTrue(widget.values.size in 0..2_000 && widget.values.all { it == null || it.isFinite() }, "$id values")
                assertTrue(widget.value.isFinite() && widget.min.isFinite() && widget.max.isFinite() && widget.max > widget.min, "$id scale")
                assertTrue(widget.target?.isFinite() ?: true, "$id target")
                assertTrue(widget.variant in setOf("line", "area", "bar"), "$id variant")
            }
        }
        // Unsupported families never become native widgets, whatever their props.
        survive("charts-line", bases.getValue("charts-bullet"), { nativeChartWidget("charts-line", it) }) { assertEquals(null, it) }
    }

    @Test
    fun tablesKeepTheirDeclaredShapeAndInertCells() {
        val base = block(
            "table",
            "caption" to str("Fictional queue"),
            "columns" to tableColumns("name" to "Name", "count" to "Count"),
            "rows" to arr(obj("name" to str("Example entry"), "count" to num(2)), obj("name" to str("Other"))),
        )
        survive("blocks-data table", base, ::nativeTable) { table ->
            if (table == null) return@survive
            assertTrue(table.columns.isNotEmpty())
            assertTrue(table.rows.all { it.size == table.columns.size }, "every row has one cell per column")
        }
        // Hostile cells: every value type lands as text, never as structure.
        for ((name, value) in HOSTILE_VALUES) {
            val table = nativeTable(base + ("rows" to arr(obj("name" to value, "count" to value))))
            assertEquals(1, table?.rows?.size, name)
        }
    }

    @Test
    fun listsAndBoardsStayWithinTheirCaps() {
        survive("blocks-text list", block("list", "ordered" to bool(true), "items" to textItems("Draft", "Review")), ::nativeList) { list ->
            if (list != null) assertTrue(list.items.isNotEmpty())
        }
        val board = block("board", "columns" to arr(boardColumn("todo", "To do", "a" to "Plan"), boardColumn("done", "Done")))
        survive("blocks-diagram board", board, ::nativeBoard) { projected ->
            if (projected == null) return@survive
            assertTrue(projected.columns.size in 1..6 && projected.columns.all { it.cards.size <= 8 }, "board caps")
            val ids = projected.columns.flatMap { column -> listOf(column.id) + column.cards.map { it.id } }
            assertEquals(ids.size, ids.toSet().size, "board ids stay unique")
        }
        // Hostile values inside a column or a card, not only at the top level.
        val column = (boardColumn("todo", "To do", "a" to "Plan") as JsonValue.Obj).fields
        survive("board column", column, { nativeBoard(block("board", "columns" to arr(JsonValue.Obj(it)))) })
        val card = mapOf("id" to str("a"), "title" to str("Plan"))
        survive("board card", card, { nativeBoard(block("board", "columns" to arr(obj("id" to str("c"), "title" to str("C"), "cards" to arr(JsonValue.Obj(it)))))) })
    }

    @Test
    fun mediaRefusesUnsafeSourcesAndClampsFrames() {
        val image = mapOf(
            "src" to str("https://images.example.com/harbor.png"), "alt" to str("Harbor"), "width" to num(1600), "height" to num(900),
            "href" to str("https://www.example.com/story"), "actionLabel" to str("Read"), "decorative" to bool(false),
        )
        survive("media-image", image, ::nativeImageWidget) { widget ->
            if (widget == null) return@survive
            assertTrue(widget.frame.alt?.isNotBlank() == true, "media-image always has alt text")
            assertTrue(widget.frame.aspectRatio?.let { it in 0.1f..10f } ?: true, "aspect ratio clamps")
            assertTrue(widget.href?.startsWith("https://") ?: true, "only https links")
            assertNoControls("media-image href", widget.href)
        }
        val blocks = listOf(
            block("image", "src" to str(PNG), "alt" to str("Chart"), "width" to num(4), "height" to num(3), "credit" to str("Studio")),
            block("figure", "src" to str("avatar:av-012"), "alt" to str("Portrait"), "caption" to str("Lead")),
            block("video", "src" to str("media/tour.webm"), "label" to str("Tour"), "poster" to str("media/tour.png"), "width" to num(16), "height" to num(9)),
            block("gallery", "title" to str("Tiles"), "columns" to num(3), "items" to arr(imageItem(), imageItem("Second"))),
        )
        for (base in blocks) {
            survive("blocks-media ${(base["type"] as JsonValue.Str).value}", base, ::nativeMediaBlock) { media ->
                when (media) {
                    null -> Unit
                    is NativeMedia.Image -> assertEquals(null, media.href, "block images never link")
                    is NativeMedia.Figure -> assertTrue(media.frame.caption != null)
                    is NativeMedia.Video -> assertTrue(media.label.isNotBlank())
                    is NativeMedia.Gallery -> assertTrue(media.columns in 2..4 && media.items.size in 1..NATIVE_GALLERY_MAX_ITEMS)
                }
                if (media is NativeMedia.Image) assertTrue(media.frame.source != NativeMediaSource.HTTPS, "no remote block media")
            }
        }
        survive("gallery item", (imageItem() as JsonValue.Obj).fields, { nativeMediaBlock(block("gallery", "items" to arr(JsonValue.Obj(it)))) })
    }

    @Test
    fun hostileStringsNeverBecomeSourcesOrIntents() {
        for ((name, value) in HOSTILE_VALUES) {
            val text = (value as? JsonValue.Str)?.value ?: continue
            for (kind in NativeMediaKind.entries) {
                assertEquals(null, nativeMediaSource(text, kind, allowRemote = true), "$name as a $kind source")
            }
            assertEquals(null, navigateIntent("p", text), "$name as a link")
        }
        // Controls, spaces and credentials anywhere in an https link are refused.
        for (bad in listOf("https://a.example/\u0000", "https://a.example/ x", "https://user@a.example/", "https:// a.example", "https://")) {
            assertEquals(null, nativeMediaSource(bad, NativeMediaKind.IMAGE, allowRemote = true), bad)
        }
    }

    @Test
    fun headingLevelsAlternativesAndDeckLabelsStayBounded() {
        survive("heading level", block("heading", "text" to str("Title"), "level" to num(3)), ::nativeHeadingLevel) { level ->
            assertTrue(level in 1..6, "heading rank $level")
        }
        survive("image alt", mapOf("alt" to str("Coast")), ::nativeImageAlternative) { alt ->
            assertTrue(alt?.isNotBlank() ?: true)
        }
        survive("deck slide", mapOf("slideId" to str("closing"), "title" to str("Review")), ::nativeDeckSlideLabel) { label ->
            assertTrue(label?.isNotBlank() ?: true)
        }
        survive("deck frame", mapOf("title" to str("Review"), "description" to str("Notes")), ::nativeDeckFrameSupported)
    }

    @Test
    fun gridsAndColumnMathNeverLeaveOneToFour() {
        survive("layout-grid", mapOf("columns" to num(3), "gap" to str("1rem")), ::nativeGridSpec) { spec ->
            if (spec == null) return@survive
            assertTrue(spec.requestedColumns in 1..4 && spec.gapDp in 0..64, "grid spec $spec")
        }
        for ((name, value) in HOSTILE_VALUES + ("absent" to JsonValue.Null)) {
            assertTrue(nativeGridColumns(value) in 1..4, "grid columns from $name")
        }
        val extremes = listOf(Int.MIN_VALUE, -1, 0, 1, 2, 3, 4, 5, 179, 180, 1_000, Int.MAX_VALUE)
        for (requested in extremes) for (width in extremes) for (gap in extremes) {
            val grid = nativeResponsiveGridColumns(requested, width, gap)
            assertTrue(grid in 1..4 && grid <= requested.coerceIn(1, 4), "grid($requested, $width, $gap) = $grid")
            val gallery = nativeGalleryColumns(requested, width, gap)
            assertTrue(gallery in 1..4 && gallery <= requested.coerceIn(2, 4), "gallery($requested, $width, $gap) = $gallery")
        }
        // A very wide surface fits every authored column instead of overflowing to one.
        assertEquals(4, nativeGalleryColumns(4, Int.MAX_VALUE))
        assertEquals(4, nativeResponsiveGridColumns(4, Int.MAX_VALUE, 16))
        for (columns in extremes) {
            val rows = nativeGridRows((1..10).toList(), columns)
            assertEquals((1..10).toList(), rows.flatten(), "rows keep every item at $columns columns")
            assertTrue(rows.all { it.size in 1..4 })
        }
    }

    @Test
    fun theOutlineSkipsHostileHeadingsAndSurvivesDeepTrees() {
        var deep: PlanNode = heading("Bottom")
        repeat(500) { deep = component("layout-card", emptyMap(), deep) }
        assertEquals(listOf("Bottom"), nativeDocumentOutline(listOf(deep)))
        for ((name, value) in HOSTILE_VALUES) {
            val outline = nativeDocumentOutline(listOf(
                blockNode("blocks-text", "heading", "text" to value),
                component("blocks-text", mapOf("block" to value)),
                PlanNode.Placeholder("button", "tier-denied"),
            ))
            assertTrue(outline.all(String::isNotBlank), "outline with $name")
        }
    }
}
