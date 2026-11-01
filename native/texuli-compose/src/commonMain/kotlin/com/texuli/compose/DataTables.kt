package com.texuli.compose

import androidx.compose.foundation.background
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.lerp
import androidx.compose.ui.semantics.CollectionInfo
import androidx.compose.ui.semantics.collectionInfo
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import com.texuli.spec.JsonValue
import kotlin.math.floor
import kotlin.math.max
import kotlin.math.min

/*
 * The tabular data views natively (ADR-025): data-grid, data-cohort-table,
 * data-tree-view and data-files. The ordering and number rules are the web's
 * (`@texuli/data` cohort model, tree engine, rank keys, file model), ported
 * and vector-checked. Sort, search, select, expand and navigation are
 * interactive on the web; natively these views paint read-only.
 */

// --- Exact decimals (Number#toFixed) ------------------------------------------

/** The exact decimal digits of a finite double's magnitude: digits and the count of them before the point. */
internal fun exactDecimal(value: Double): Pair<String, Int> {
    val bits = abs(value).toRawBits()
    val exponent = ((bits ushr 52) and 0x7FF).toInt()
    var mantissa = bits and 0xFFFFFFFFFFFFFL
    var e = if (exponent == 0) -1074 else exponent - 1075
    if (exponent != 0) mantissa = mantissa or (1L shl 52)
    if (mantissa == 0L) return "0" to 1
    // value = mantissa × 2^e, digits little-endian in base 10.
    var digits = mantissa.toString().reversed().map { it - '0' }.toMutableList()
    fun times(factor: Int) {
        var carry = 0
        for (i in digits.indices) {
            val v = digits[i] * factor + carry
            digits[i] = v % 10
            carry = v / 10
        }
        while (carry > 0) {
            digits += carry % 10
            carry /= 10
        }
    }
    var point = 0
    if (e >= 0) {
        repeat(e) { times(2) }
    } else {
        // m × 2^-k = m × 5^k / 10^k.
        repeat(-e) { times(5) }
        point = -e
    }
    val text = digits.reversed().joinToString("")
    val padded = if (text.length <= point) "0".repeat(point - text.length + 1) + text else text
    return padded to padded.length - point
}

private fun abs(value: Double): Double = if (value < 0) -value else value

/** `Number#toFixed`: the exact value rounded to `digits` decimals, ties to the larger magnitude. */
internal fun jsToFixed(value: Double, digits: Int): String {
    if (!value.isFinite()) return jsNumber(value)
    if (abs(value) >= 1e21) return jsNumber(value)
    val (all, intCount) = exactDecimal(value)
    val keep = intCount + digits
    var kept = all.substring(0, min(keep, all.length)).padEnd(keep, '0')
    if (keep < all.length && all[keep] >= '5') {
        val chars = kept.toCharArray()
        var i = chars.size - 1
        while (i >= 0 && chars[i] == '9') {
            chars[i] = '0'
            i--
        }
        kept = if (i < 0) "1" + chars.concatToString() else chars.also { it[i] = it[i] + 1 }.concatToString()
    }
    val split = kept.length - digits
    val intPart = kept.substring(0, split).trimStart('0').ifEmpty { "0" }
    val body = if (digits > 0) "$intPart.${kept.substring(split)}" else intPart
    // JS keeps the sign of a negative input even when it rounds to zero ("-0.0").
    return if (value < 0) "-$body" else body
}

// --- data-grid ----------------------------------------------------------------

internal enum class GridAlign { START, CENTER, END }

internal class GridColumn(val id: String, val header: String, val kind: String, val align: GridAlign)

internal class GridView(val caption: String, val columns: List<GridColumn>, val rows: List<Pair<String, List<String>>>, val density: String)

internal const val GRID_MAX_COLUMNS = 48
internal const val DATA_MAX_ROWS = 500

/** The web DataGrid's alignment: an explicit `align`, else numbers at the end. */
private fun alignOf(raw: String?, kind: String): GridAlign? = when (raw) {
    null -> if (kind == "number") GridAlign.END else GridAlign.START
    "start" -> GridAlign.START
    "center" -> GridAlign.CENTER
    "end" -> GridAlign.END
    else -> null
}

internal fun nativeGrid(props: Map<String, JsonValue>): GridView? {
    val caption = props.propName("caption") ?: return null
    val rawColumns = props.propArray("columns") ?: return null
    val rawRows = props.propArray("rows") ?: return null
    if (rawColumns.isEmpty() || rawColumns.size > GRID_MAX_COLUMNS || rawRows.size > DATA_MAX_ROWS) return null
    val columns = rawColumns.map { item ->
        val f = item.asObject ?: return null
        val kind = when (val k = f.propEnum("kind", setOf("text", "number", "date"))) {
            null -> "text"
            INVALID -> return null
            else -> k
        }
        if (f.mistyped("align") { it is JsonValue.Str } || f.mistyped("sortable") { it is JsonValue.Bool }) return null
        GridColumn(f.propName("id") ?: return null, f.propString("header") ?: return null, kind, alignOf(f.propString("align"), kind) ?: return null)
    }
    if (columns.map { it.id }.toSet().size != columns.size) return null
    val rows = rawRows.map { item ->
        val f = item.asObject ?: return null
        val cells = f.propObject("cells") ?: return null
        if (cells.values.any { it !is JsonValue.Str }) return null
        (f.propName("id") ?: return null) to columns.map { column -> cells.propString(column.id) ?: "" }
    }
    if (rows.map { it.first }.toSet().size != rows.size) return null
    val density = when (val d = props.propEnum("density", setOf("compact", "default", "comfortable"))) {
        null -> "default"
        INVALID -> return null
        else -> d
    }
    return GridView(caption, columns, rows, density)
}

// --- data-cohort-table -------------------------------------------------------------

internal class CohortRow(val id: String?, val label: String, val size: Double?, val cells: List<Double?>, val incompleteLast: Boolean)

/** `cohortAverages`: per period, weighted by size when every cohort that reached it has one. */
internal fun cohortAverages(rows: List<CohortRow>): List<Double?> {
    val count = rows.maxOfOrNull { it.cells.size } ?: 0
    return List(count) { period ->
        val reached = rows.mapNotNull { row -> row.cells.getOrNull(period)?.let { it to row.size } }
        if (reached.isEmpty()) return@List null
        val weighted = reached.all { (_, size) -> size != null && size > 0 }
        var sum = 0.0
        var weight = 0.0
        for ((value, size) in reached) {
            val w = if (weighted) size!! else 1.0
            sum += value * w
            weight += w
        }
        sum / weight
    }
}

/** `formatCohortValue` (en-US): a rate as a percent with one decimal, a count as a whole number. */
internal fun formatCohortValue(value: Double, rate: Boolean): String = if (rate) formatPercent(value) else formatNumber(value, 0)

/** `heatLevel`: one of `levels` steps of `value / max`. */
internal fun heatLevel(value: Double?, max: Double, levels: Int = 5): Int? {
    if (value == null || !(max > 0) || levels < 1) return null
    val ratio = min(1.0, max(0.0, value / max))
    return min(levels - 1, floor(ratio * levels).toInt())
}

/** `heatMax`: 1 for rates, else the largest value. */
internal fun heatMax(rows: List<CohortRow>, rate: Boolean): Double =
    if (rate) 1.0 else rows.flatMap { it.cells }.filterNotNull().fold(0.0) { acc, v -> if (v > acc) v else acc }

internal class CohortView(
    val caption: String,
    val captionHidden: Boolean,
    val rows: List<CohortRow>,
    val periods: List<String>,
    val rate: Boolean,
    val heat: Boolean,
    val max: Double?,
    val average: Boolean,
)

internal const val COHORT_MAX_ROWS = 120
internal const val COHORT_MAX_PERIODS = 60

internal fun nativeCohort(props: Map<String, JsonValue>): CohortView? {
    val caption = props.propName("caption") ?: return null
    val rawRows = props.propArray("rows") ?: return null
    if (rawRows.size > COHORT_MAX_ROWS) return null
    val rows = rawRows.map { item ->
        val f = item.asObject ?: return null
        val cells = f.propArray("cells") ?: return null
        if (cells.size > COHORT_MAX_PERIODS) return null
        if (f.mistyped("size") { it is JsonValue.Num } || f.mistyped("incomplete") { it is JsonValue.Bool } || f.mistyped("id") { it is JsonValue.Str }) return null
        CohortRow(
            f.propString("id"), f.propString("label") ?: return null, f.propNumber("size"),
            cells.map {
                when (it) {
                    is JsonValue.Num -> it.value.takeIf(Double::isFinite)
                    JsonValue.Null -> null
                    else -> return null
                }
            },
            f.propBool("incomplete") == true,
        )
    }
    val periods = props.propArray("periods")?.map { (it as? JsonValue.Str)?.value ?: return null } ?: if ("periods" in props) return null else emptyList()
    if (periods.size > COHORT_MAX_PERIODS) return null
    val rate = when (props.propEnum("valueKind", setOf("rate", "count"))) {
        null, "rate" -> true
        "count" -> false
        else -> return null
    }
    for (key in listOf("captionHidden", "heat", "average")) if (props.mistyped(key) { it is JsonValue.Bool }) return null
    if (props.mistyped("max") { it is JsonValue.Num && it.value.isFinite() }) return null
    return CohortView(caption, props.propBool("captionHidden") == true, rows, periods, rate, props.propBool("heat") == true, props.propNumber("max"), props.propBool("average") == true)
}

// --- data-tree-view ----------------------------------------------------------------

private const val RANK_DIGITS = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz"

/** The web's `increment` of a rank's integer part (the append step of `rankBetween`). */
private fun incrementRank(integer: String): String? {
    val head = integer[0]
    val digits = integer.substring(1).toMutableList()
    for (i in digits.indices.reversed()) {
        val next = RANK_DIGITS.indexOf(digits[i]) + 1
        if (next < RANK_DIGITS.length) {
            digits[i] = RANK_DIGITS[next]
            return head + digits.joinToString("")
        }
        digits[i] = '0'
    }
    if (head == 'Z') return "a0"
    if (head == 'z') return null
    val nextHead = head + 1
    if (nextHead > 'a') digits += '0' else digits.removeAt(digits.size - 1)
    return nextHead + digits.joinToString("")
}

/** `rankSequence(count)`: ascending rank keys from the start of a list. */
internal fun rankSequence(count: Int): List<String> {
    val ranks = mutableListOf<String>()
    var previous: String? = null
    repeat(count) {
        previous = if (previous == null) "a0" else incrementRank(previous!!) ?: return ranks
        ranks += previous!!
    }
    return ranks
}

internal class TreeEntry(val id: String, val label: String, val parent: String?, val rank: String)

internal class TreeRow(val entry: TreeEntry, val level: Int)

/** `buildTree` then a depth-first flatten: orphans and cycle members become roots; siblings by rank, then id. */
internal fun flattenTree(entries: List<TreeEntry>): List<TreeRow> {
    val byId = entries.associateBy { it.id }
    fun parentOf(entry: TreeEntry): String? {
        val parent = entry.parent ?: return null
        if (parent !in byId) return null
        val seen = mutableSetOf(entry.id)
        var at: String? = parent
        while (at != null) {
            if (!seen.add(at)) return null
            val next = byId[at]?.parent
            at = if (next != null && next in byId) next else null
        }
        return parent
    }
    val children = mutableMapOf<String?, MutableList<TreeEntry>>()
    for (entry in entries) children.getOrPut(parentOf(entry)) { mutableListOf() } += entry
    // Code-unit order, as the web's `compareRanks` (never a locale collation).
    for (list in children.values) list.sortWith(compareBy<TreeEntry> { it.rank }.thenBy { it.id })
    val rows = mutableListOf<TreeRow>()
    fun visit(parent: String?, level: Int) {
        for (entry in children[parent].orEmpty()) {
            rows += TreeRow(entry, level)
            visit(entry.id, level + 1)
        }
    }
    visit(null, 1)
    return rows
}

internal class TreeView(val label: String, val rows: List<TreeRow>, val compact: Boolean)

internal fun nativeTree(props: Map<String, JsonValue>): TreeView? {
    val label = props.propName("label") ?: return null
    val raw = props.propArray("items") ?: return null
    if (raw.size > DATA_MAX_ROWS) return null
    val seeded = rankSequence(raw.size)
    val entries = raw.mapIndexed { index, item ->
        val f = item.asObject ?: return null
        if (f.mistyped("parent") { it is JsonValue.Str } || f.mistyped("rank") { it is JsonValue.Str }) return null
        TreeEntry(f.propName("id") ?: return null, f.propString("label") ?: return null, f.propString("parent"), f.propString("rank")?.takeIf(String::isNotEmpty) ?: seeded[index])
    }
    if (entries.map { it.id }.toSet().size != entries.size) return null
    if (props.mistyped("checkboxes") { it is JsonValue.Bool }) return null
    val compact = when (props.propEnum("density", setOf("comfortable", "compact"))) {
        null, "comfortable" -> false
        "compact" -> true
        else -> return null
    }
    return TreeView(label, flattenTree(entries), compact)
}

// --- data-files ---------------------------------------------------------------------

internal class FileItem(val id: String, val parent: String?, val name: String, val folder: Boolean, val type: String?, val size: Double?, val updatedAt: String?)

/** Natural, case-insensitive order (`Intl.Collator('en', { numeric: true, sensitivity: 'base' })` for plain names). */
internal fun compareNatural(a: String, b: String): Int {
    var i = 0
    var j = 0
    while (i < a.length && j < b.length) {
        val ca = a[i]
        val cb = b[j]
        if (ca.isDigit() && cb.isDigit()) {
            var ei = i
            while (ei < a.length && a[ei].isDigit()) ei++
            var ej = j
            while (ej < b.length && b[ej].isDigit()) ej++
            val na = a.substring(i, ei).trimStart('0')
            val nb = b.substring(j, ej).trimStart('0')
            if (na.length != nb.length) return na.length.compareTo(nb.length)
            val c = na.compareTo(nb)
            if (c != 0) return c
            i = ei
            j = ej
            continue
        }
        val c = ca.lowercaseChar().compareTo(cb.lowercaseChar())
        if (c != 0) return c
        i++
        j++
    }
    return (a.length - i).compareTo(b.length - j)
}

/** `childrenOf`: folders first, then names in natural order. */
internal fun childrenOf(entries: List<FileItem>, folder: String?): List<FileItem> =
    entries.filter { it.parent == folder }.sortedWith { a, b -> if (a.folder == b.folder) compareNatural(a.name, b.name) else if (a.folder) -1 else 1 }

/** `formatSize`: "1.4 MB" (base 1024, one decimal under 10). */
internal fun formatSize(bytes: Double?): String {
    if (bytes == null || !bytes.isFinite() || bytes < 0) return ""
    if (bytes < 1024) return "${jsNumber(bytes)} B"
    val units = listOf("KB", "MB", "GB", "TB")
    var value = bytes / 1024
    var unit = 0
    while (value >= 1024 && unit < units.size - 1) {
        value /= 1024
        unit++
    }
    return "${if (value >= 10) jsNumber(jsRound(value)) else jsToFixed(value, 1)} ${units[unit]}"
}

/** `extensionOf` and `categoryOf`: the label a file shows when it has no size. */
internal fun fileCategory(item: FileItem): String {
    if (item.folder) return "Folder"
    val type = (item.type ?: "").lowercase()
    val ext = Regex("\\.([a-z0-9]{1,5})$", RegexOption.IGNORE_CASE).find(item.name)?.groupValues?.get(1)?.uppercase() ?: ""
    return when {
        type.startsWith("image/") || Regex("^(PNG|JPE?G|GIF|WEBP|SVG|AVIF)$").matches(ext) -> "Image"
        type.startsWith("video/") || Regex("^(MP4|MOV|WEBM)$").matches(ext) -> "Video"
        type.startsWith("audio/") || Regex("^(MP3|WAV|OGG|M4A)$").matches(ext) -> "Audio"
        type == "application/pdf" || ext == "PDF" -> "PDF"
        type.startsWith("text/") || Regex("^(TXT|MD|CSV|JSON)$").matches(ext) -> "Text"
        Regex("zip|tar|gzip|compressed").containsMatchIn(type) || Regex("^(ZIP|TAR|GZ|7Z|RAR)$").matches(ext) -> "Archive"
        else -> "File"
    }
}

internal class FilesView(val label: String, val entries: List<FileItem>, val grid: Boolean)

internal fun nativeFiles(props: Map<String, JsonValue>): FilesView? {
    val label = props.propName("label") ?: return null
    val raw = props.propArray("entries") ?: return null
    if (raw.size > DATA_MAX_ROWS) return null
    val entries = raw.map { item ->
        val f = item.asObject ?: return null
        val folder = when (f.propString("kind")) {
            "folder" -> true
            "file" -> false
            else -> return null
        }
        for (key in listOf("parent", "type", "updatedAt")) if (f.mistyped(key) { it is JsonValue.Str }) return null
        if (f.mistyped("size") { it is JsonValue.Num }) return null
        FileItem(f.propName("id") ?: return null, f.propString("parent"), f.propString("name") ?: return null, folder, f.propString("type"), f.propNumber("size"), f.propString("updatedAt"))
    }
    if (entries.map { it.id }.toSet().size != entries.size) return null
    val grid = when (props.propEnum("layout", setOf("grid", "list"))) {
        null, "grid" -> true
        "list" -> false
        else -> return null
    }
    if (props.propEnum("density", setOf("comfortable", "compact")) == INVALID) return null
    return FilesView(label, entries, grid)
}

// --- Views ----------------------------------------------------------------------------

@Composable
private fun TableText(text: String, width: Int, align: TextAlign = TextAlign.Start, header: Boolean = false, padding: Int = 6) {
    Text(
        text,
        Modifier.width(width.dp).padding(padding.dp),
        style = if (header) MaterialTheme.typography.labelMedium else MaterialTheme.typography.bodySmall,
        textAlign = align,
    )
}

@Composable
internal fun GridViewPainter(grid: GridView) {
    val padding = when (grid.density) {
        "compact" -> 3
        "comfortable" -> 10
        else -> 6
    }
    Column(
        Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()).semantics {
            contentDescription = grid.caption
            collectionInfo = CollectionInfo(grid.rows.size + 1, grid.columns.size)
        },
    ) {
        Text(grid.caption, style = MaterialTheme.typography.titleSmall)
        Row { grid.columns.forEach { TableText(it.header, 140, it.align.text(), header = true, padding = padding) } }
        grid.rows.forEach { (_, cells) ->
            Row { cells.forEachIndexed { index, cell -> TableText(cell, 140, grid.columns[index].align.text(), padding = padding) } }
        }
    }
}

private fun GridAlign.text(): TextAlign = when (this) {
    GridAlign.START -> TextAlign.Start
    GridAlign.CENTER -> TextAlign.Center
    GridAlign.END -> TextAlign.End
}

@Composable
internal fun CohortViewPainter(view: CohortView) {
    val count = view.rows.maxOfOrNull { it.cells.size } ?: 0
    val headers = List(count) { view.periods.getOrNull(it) ?: "Period $it" }
    val sized = view.rows.any { it.size != null }
    val top = view.max ?: heatMax(view.rows, view.rate)
    val low = MaterialTheme.colorScheme.surfaceVariant
    val high = MaterialTheme.colorScheme.primary
    @Composable
    fun cell(value: Double?, incomplete: Boolean) {
        val level = if (view.heat) heatLevel(value, top) else null
        val text = if (value == null) "—" else formatCohortValue(value, view.rate) + if (incomplete) "*" else ""
        val modifier = if (level != null) Modifier.background(lerp(low, high, (level + 1) / 5f)) else Modifier
        Row(modifier) { TableText(text, 84, TextAlign.End) }
    }
    Column(Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()).semantics { contentDescription = view.caption }) {
        if (!view.captionHidden) Text(view.caption, style = MaterialTheme.typography.titleSmall)
        Row {
            TableText("Cohort", 120, header = true)
            if (sized) TableText("Users", 84, TextAlign.End, header = true)
            headers.forEach { TableText(it, 84, TextAlign.End, header = true) }
        }
        view.rows.forEach { row ->
            Row {
                TableText(row.label, 120, header = true)
                if (sized) TableText(row.size?.let { formatCohortValue(it, false) } ?: "", 84, TextAlign.End)
                repeat(count) { period -> cell(row.cells.getOrNull(period), row.incompleteLast && period == row.cells.size - 1) }
            }
        }
        if (view.average) {
            val averages = cohortAverages(view.rows)
            val sizes = view.rows.mapNotNull { it.size }
            Row {
                TableText("Average", 120, header = true)
                if (sized) TableText(if (sizes.isEmpty()) "" else formatCohortValue(sizes.sum() / sizes.size, false), 84, TextAlign.End)
                repeat(count) { cell(averages.getOrNull(it), false) }
            }
        }
    }
}

@Composable
internal fun TreeViewPainter(tree: TreeView) {
    Column(
        Modifier.fillMaxWidth().semantics {
            contentDescription = tree.label
            collectionInfo = CollectionInfo(tree.rows.size, 1)
        },
        verticalArrangement = Arrangement.spacedBy(if (tree.compact) 0.dp else 4.dp),
    ) {
        // The web indents 1.25rem per level (`depthIndentRem`).
        tree.rows.forEach { row -> Text(row.entry.label, Modifier.padding(start = (20 * (row.level - 1)).dp), style = MaterialTheme.typography.bodyMedium) }
    }
}

@Composable
internal fun FilesViewPainter(files: FilesView) {
    var showAll by remember { mutableStateOf(false) }
    Column(Modifier.fillMaxWidth().semantics { contentDescription = files.label }, verticalArrangement = Arrangement.spacedBy(6.dp)) {
        Text(files.label, style = MaterialTheme.typography.titleSmall)
        // The web opens at the root folder; moving into a folder is interactive there.
        childrenOf(files.entries, null).forEach { item ->
            Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                Text(item.name, Modifier.width(200.dp), style = MaterialTheme.typography.bodyMedium)
                Text(if (item.folder) "Folder" else formatSize(item.size).ifEmpty { fileCategory(item) }, style = MaterialTheme.typography.bodySmall)
            }
        }
        if (files.entries.any { it.parent != null }) {
            TextButton(onClick = { showAll = !showAll }) { Text(if (showAll) "Hide all files" else "Show all files") }
            if (showAll) {
                fun visit(folder: String?, level: Int): List<Pair<FileItem, Int>> = childrenOf(files.entries, folder).flatMap { listOf(it to level) + if (it.folder && level < 32) visit(it.id, level + 1) else emptyList() }
                visit(null, 0).forEach { (item, level) -> Text(item.name, Modifier.padding(start = (16 * level).dp), style = MaterialTheme.typography.bodySmall) }
            }
        }
    }
}
