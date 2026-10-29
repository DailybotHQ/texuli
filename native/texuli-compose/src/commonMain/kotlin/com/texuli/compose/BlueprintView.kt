package com.texuli.compose

import androidx.compose.foundation.border
import androidx.compose.foundation.focusable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Card
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.role
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.isTraversalGroup
import androidx.compose.ui.semantics.paneTitle
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.collectionInfo
import androidx.compose.ui.semantics.collectionItemInfo
import androidx.compose.ui.semantics.CollectionInfo
import androidx.compose.ui.semantics.CollectionItemInfo
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.unit.dp
import androidx.compose.runtime.CompositionLocalProvider
import com.texuli.spec.BlueprintMotionLevel
import com.texuli.spec.JsonValue
import com.texuli.spec.runtime.PlanNode
import com.texuli.spec.runtime.childMotionDelays
import com.texuli.spec.runtime.nativeMotionOf

/**
 * Paint a validated render plan (design §4, step 5). Each id resolves through
 * [NativeRegistry]; anything else paints a visible placeholder. Text is shown
 * as text: nothing in a blueprint is executed or interpreted as markup.
 *
 * `motionLevel` is the level spec 0.6.0 motion plays at
 * (`resolveMotionLevel(host, envelope.motion?.level, reducedMotion)`);
 * `NONE` paints every node at once.
 */
@Composable
fun BlueprintView(
    plan: List<PlanNode>,
    onIntent: (TexuliIntent) -> Unit = {},
    motionLevel: BlueprintMotionLevel = BlueprintMotionLevel.FULL,
) {
    CompositionLocalProvider(LocalMotionLevel provides motionLevel) {
        Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
            plan.forEachIndexed { index, node -> PlanNodeView(node, "$index", onIntent) }
        }
    }
}

@Composable
private fun PlanNodeView(node: PlanNode, path: String, onIntent: (TexuliIntent) -> Unit, delayMs: Int = 0) {
    val motion = (node as? PlanNode.Component)?.let { nativeMotionOf(it.motion, LocalMotionLevel.current, delayMs) }
    if (motion != null) {
        MotionNode(motion) { PlanNodeContent(node, path, onIntent) }
    } else {
        PlanNodeContent(node, path, onIntent)
    }
}

@Composable
private fun PlanNodeContent(node: PlanNode, path: String, onIntent: (TexuliIntent) -> Unit) {
    when (node) {
        is PlanNode.Placeholder -> Placeholder(node.id, node.reason)
        is PlanNode.Component -> when (node.id) {
            "layout-page" -> Frame(node, path, onIntent)
            "layout-doc" -> DocumentFrame(node, path, onIntent)
            "layout-deck" -> DeckFrame(node, path, onIntent)
            "layout-card" -> CardLayout(node, path, onIntent)
            "layout-grid" -> GridLayout(node, path, onIntent)
            "deck-slide" -> DeckSlide(node, path, onIntent)
            "blocks-text" -> TextBlock(node.props.obj("block"))
            "blocks-diagram" -> DiagramBlock(node.props.obj("block"))
            "blocks-data" -> DataBlock(node.props.obj("block"))
            "media-image" -> {
                val media = nativeImageWidget(node.props)
                if (media == null) Placeholder(node.id, "invalid-media") else MediaWidget(media, path, onIntent)
            }
            "blocks-media" -> {
                val media = nativeMediaBlock(node.props.obj("block"))
                if (media == null) Placeholder(node.id, "invalid-media") else MediaWidget(media, path, onIntent)
            }
            in NATIVE_CHART_IDS -> {
                val widget = nativeChartWidget(node.id, node.props)
                if (widget == null) Placeholder(node.id, "invalid-chart-data") else ChartWidget(widget)
            }
            else -> Placeholder(node.id, "not-on-this-target")
        }
    }
}

@Composable
private fun Children(node: PlanNode.Component, path: String, onIntent: (TexuliIntent) -> Unit) {
    val delays = childMotionDelays(node.children, node.motion?.stagger)
    node.children.forEachIndexed { index, child ->
        PlanNodeView(child, "$path.children.$index", onIntent, delays.getOrElse(index) { 0 })
    }
}

@Composable
private fun Frame(node: PlanNode.Component, path: String, onIntent: (TexuliIntent) -> Unit) {
    Column(
        Modifier.fillMaxWidth().semantics {
            isTraversalGroup = true
            node.props.str("title")?.let { paneTitle = it }
        }.padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        node.props.str("title")?.let { Heading(it, level = 1) }
        node.props.str("description")?.let { Text(it, style = MaterialTheme.typography.bodyLarge) }
        Children(node, path, onIntent)
    }
}

@Composable
private fun DocumentFrame(node: PlanNode.Component, path: String, onIntent: (TexuliIntent) -> Unit) {
    val showOutline = (node.props["toc"] as? JsonValue.Bool)?.value ?: true
    Column(
        Modifier.fillMaxWidth().semantics {
            isTraversalGroup = true
            node.props.str("title")?.let { paneTitle = it }
        }.padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        node.props.str("title")?.let { Heading(it, level = 1) }
        if (showOutline) {
            val headings = nativeDocumentOutline(node.children)
            if (headings.isNotEmpty()) {
                Column(
                    Modifier.fillMaxWidth()
                        .border(1.dp, MaterialTheme.colorScheme.outline, RoundedCornerShape(8.dp))
                        .padding(12.dp)
                        .semantics { contentDescription = "Document contents outline" },
                    verticalArrangement = Arrangement.spacedBy(4.dp),
                ) {
                    Text("Contents", style = MaterialTheme.typography.titleSmall)
                    headings.forEach { Text("• $it", style = MaterialTheme.typography.bodySmall) }
                }
            }
        }
        Children(node, path, onIntent)
    }
}

@Composable
private fun DeckFrame(node: PlanNode.Component, path: String, onIntent: (TexuliIntent) -> Unit) {
    if (!nativeDeckFrameSupported(node.props)) {
        Placeholder("layout-deck", "unsupported-deck-options")
        return
    }
    Column(
        Modifier.fillMaxWidth().semantics {
            isTraversalGroup = true
            node.props.str("title")?.let { paneTitle = it }
        }.padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        node.props.str("title")?.let { Heading(it, level = 1) }
        node.props.str("description")?.let { Text(it, style = MaterialTheme.typography.bodyLarge) }
        Children(node, path, onIntent)
    }
}

@Composable
private fun CardLayout(node: PlanNode.Component, path: String, onIntent: (TexuliIntent) -> Unit) {
    Card(Modifier.fillMaxWidth().semantics { isTraversalGroup = true }) {
        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            node.props.str("title")?.let { Heading(it, level = 2) }
            Children(node, path, onIntent)
        }
    }
}

@Composable
private fun DeckSlide(node: PlanNode.Component, path: String, onIntent: (TexuliIntent) -> Unit) {
    val slideLabel = nativeDeckSlideLabel(node.props)
    Card(
        Modifier.fillMaxWidth().semantics {
            isTraversalGroup = true
            slideLabel?.let { paneTitle = "Slide $it" }
        },
    ) {
        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            node.props.str("title")?.let { Heading(it, level = 2) }
            Children(node, path, onIntent)
        }
    }
}

@Composable
private fun GridLayout(node: PlanNode.Component, path: String, onIntent: (TexuliIntent) -> Unit) {
    val grid = nativeGridSpec(node.props)
    if (grid == null) {
        Placeholder("layout-grid", "unsupported-gap")
        return
    }
    BoxWithConstraints(Modifier.fillMaxWidth()) {
        val columns = nativeResponsiveGridColumns(grid.requestedColumns, maxWidth.value.toInt(), grid.gapDp)
        val delays = childMotionDelays(node.children, node.motion?.stagger)
        Column(verticalArrangement = Arrangement.spacedBy(grid.gapDp.dp)) {
            nativeGridRows(node.children.withIndex().toList(), columns).forEach { row ->
                Row(horizontalArrangement = Arrangement.spacedBy(grid.gapDp.dp)) {
                    row.forEach { (index, child) ->
                        Column(Modifier.weight(1f).semantics { isTraversalGroup = true }) {
                            PlanNodeView(child, "$path.children.$index", onIntent, delays.getOrElse(index) { 0 })
                        }
                    }
                    repeat(columns - row.size) { Spacer(Modifier.weight(1f)) }
                }
            }
        }
    }
}

@Composable
private fun Heading(text: String, level: Int) {
    val normalizedLevel = level.coerceIn(1, 6)
    val style = when (normalizedLevel) {
        1 -> MaterialTheme.typography.headlineMedium
        2 -> MaterialTheme.typography.titleLarge
        3 -> MaterialTheme.typography.titleMedium
        else -> MaterialTheme.typography.titleSmall
    }
    Text(text, style = style, modifier = Modifier.semantics { heading() })
}

@Composable
private fun TextBlock(block: Map<String, JsonValue>?) {
    if (block == null) {
        Placeholder("blocks-text", "unknown-block")
        return
    }
    when (block.str("type")) {
        "heading" -> Heading(block.str("text").orEmpty(), nativeHeadingLevel(block))
        "text" -> Text(block.str("markdown").orEmpty(), style = MaterialTheme.typography.bodyMedium)
        "list" -> {
            val list = nativeList(block)
            if (list == null) Placeholder("blocks-text", "invalid-list") else ListWidget(list)
        }
        "quote" -> Text("“${block.str("quote").orEmpty()}” ${block.str("cite").orEmpty()}".trim())
        "callout" -> Column(
            Modifier.fillMaxWidth().semantics {
                isTraversalGroup = true
                block.str("title")?.let { paneTitle = it }
            }.border(1.dp, MaterialTheme.colorScheme.outline, RoundedCornerShape(8.dp)).padding(12.dp),
        ) {
            block.str("title")?.let { Text(it, style = MaterialTheme.typography.titleSmall) }
            block.str("body")?.let { Text(it) }
        }
        else -> Placeholder("blocks-text", "unknown-block")
    }
}

@Composable
private fun DiagramBlock(block: Map<String, JsonValue>?) {
    val board = nativeBoard(block)
    if (board == null) Placeholder("blocks-diagram", "not-on-this-target") else BoardWidget(board)
}

@Composable
private fun DataBlock(block: Map<String, JsonValue>?) {
    if (block == null) {
        Placeholder("blocks-data", "unknown-block")
        return
    }
    when (block.str("type")) {
        "stat", "kpi" -> Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            (block["items"] as? JsonValue.Arr)?.items?.forEach { item ->
                val fields = (item as? JsonValue.Obj)?.fields ?: return@forEach
                Column(Modifier.weight(1f)) {
                    Text(fields.str("label").orEmpty(), style = MaterialTheme.typography.labelMedium)
                    Text(fields.scalar("value"), style = MaterialTheme.typography.titleLarge)
                    fields.str("delta")?.let { Text(it, style = MaterialTheme.typography.labelSmall) }
                }
            }
        }
        "table" -> {
            val table = nativeTable(block)
            if (table == null) Placeholder("blocks-data", "invalid-table") else TableBlock(table)
        }
        else -> Placeholder("blocks-data", "not-on-this-target")
    }
}

@Composable
private fun TableBlock(table: NativeTable) {
    BoxWithConstraints(Modifier.fillMaxWidth()) {
        val tableWidth = maxOf(maxWidth, 144.dp * table.columns.size.toFloat())
        Column(
            Modifier.fillMaxWidth(),
            verticalArrangement = Arrangement.spacedBy(1.dp),
        ) {
            table.caption?.let { Text(it, style = MaterialTheme.typography.titleSmall) }
            Column(
                Modifier.fillMaxWidth()
                    .horizontalScroll(rememberScrollState())
                    .focusable()
                    .semantics {
                        contentDescription = table.caption ?: "Data table"
                        collectionInfo = CollectionInfo(table.rows.size + 1, table.columns.size)
                        isTraversalGroup = true
                    },
            ) {
                Column(Modifier.width(tableWidth)) {
                    Row(
                        Modifier.fillMaxWidth()
                            .border(1.dp, MaterialTheme.colorScheme.outline, RoundedCornerShape(topStart = 4.dp, topEnd = 4.dp))
                            .padding(horizontal = 12.dp, vertical = 10.dp),
                        horizontalArrangement = Arrangement.spacedBy(12.dp),
                    ) {
                        table.columns.forEachIndexed { index, column ->
                            Text(
                                column.label,
                                Modifier.weight(1f).semantics {
                                    collectionItemInfo = CollectionItemInfo(0, 1, index, 1)
                                },
                                style = MaterialTheme.typography.labelLarge,
                                color = MaterialTheme.colorScheme.onSurface,
                            )
                        }
                    }
                    table.rows.forEachIndexed { rowIndex, cells ->
                        Row(
                            Modifier.fillMaxWidth()
                                .border(1.dp, MaterialTheme.colorScheme.outline)
                                .padding(horizontal = 12.dp, vertical = 10.dp),
                            horizontalArrangement = Arrangement.spacedBy(12.dp),
                        ) {
                            cells.forEachIndexed { index, cell ->
                                Text(
                                    cell,
                                    Modifier.weight(1f).semantics {
                                        collectionItemInfo = CollectionItemInfo(
                                            rowIndex = rowIndex + 1,
                                            rowSpan = 1,
                                            columnIndex = index,
                                            columnSpan = 1,
                                        )
                                    },
                                    style = MaterialTheme.typography.bodyMedium,
                                    color = MaterialTheme.colorScheme.onSurface,
                                )
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun Placeholder(id: String, reason: String) {
    Text(
        text = "“$id” is not shown here ($reason)",
        style = MaterialTheme.typography.labelMedium,
        modifier = Modifier
            .fillMaxWidth()
            .border(1.dp, MaterialTheme.colorScheme.outline, RoundedCornerShape(8.dp))
            .padding(12.dp),
    )
}

private fun Map<String, JsonValue>.str(key: String): String? = (this[key] as? JsonValue.Str)?.value

private fun Map<String, JsonValue>.obj(key: String): Map<String, JsonValue>? = (this[key] as? JsonValue.Obj)?.fields

/** A cell or stat value shown as text, whatever its JSON scalar type. */
private fun Map<String, JsonValue>.scalar(key: String): String = when (val value = this[key]) {
    is JsonValue.Str -> value.value
    is JsonValue.Num -> if (value.value % 1.0 == 0.0) value.value.toLong().toString() else value.value.toString()
    is JsonValue.Bool -> value.value.toString()
    else -> ""
}
