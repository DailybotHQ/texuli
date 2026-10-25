package com.texuli.compose

import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.focusable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Card
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.isTraversalGroup
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.collectionInfo
import androidx.compose.ui.semantics.collectionItemInfo
import androidx.compose.ui.semantics.CollectionInfo
import androidx.compose.ui.semantics.CollectionItemInfo
import androidx.compose.ui.unit.dp
import com.texuli.spec.JsonValue

internal data class NativeList(val ordered: Boolean, val items: List<String>)

internal data class NativeBoard(val columns: List<NativeBoardColumn>) {
    val cardCount: Int get() = columns.sumOf { it.cards.size }
}

internal data class NativeBoardColumn(
    val id: String,
    val title: String,
    val cards: List<NativeBoardCard>,
)

internal data class NativeBoardCard(val id: String, val title: String)

/** Project a validated list block to inert text rows; reject malformed shapes. */
internal fun nativeList(block: Map<String, JsonValue>?): NativeList? {
    if (block?.get("type") != JsonValue.Str("list")) return null
    val ordered = when (val value = block["ordered"]) {
        null -> false
        is JsonValue.Bool -> value.value
        else -> return null
    }
    val items = (block["items"] as? JsonValue.Arr)?.items ?: return null
    if (items.isEmpty()) return null
    val textItems = items.map { item ->
        val fields = (item as? JsonValue.Obj)?.fields ?: return null
        (fields["text"] as? JsonValue.Str)?.value ?: return null
    }
    return NativeList(ordered, textItems)
}

/** Project the bounded board diagram to plain native labels and cards. */
internal fun nativeBoard(block: Map<String, JsonValue>?): NativeBoard? {
    if (block?.get("type") != JsonValue.Str("board")) return null
    val columns = (block["columns"] as? JsonValue.Arr)?.items ?: return null
    if (columns.isEmpty() || columns.size > 6) return null
    val projected = columns.map { column ->
        val fields = (column as? JsonValue.Obj)?.fields ?: return null
        val id = (fields["id"] as? JsonValue.Str)?.value?.takeIf(String::isNotBlank) ?: return null
        val title = (fields["title"] as? JsonValue.Str)?.value ?: return null
        val rawCards = (fields["cards"] as? JsonValue.Arr)?.items ?: return null
        if (rawCards.size > 8) return null
        val cards = rawCards.map { card ->
            val cardFields = (card as? JsonValue.Obj)?.fields ?: return null
            val cardId = (cardFields["id"] as? JsonValue.Str)?.value?.takeIf(String::isNotBlank) ?: return null
            val cardTitle = (cardFields["title"] as? JsonValue.Str)?.value ?: return null
            NativeBoardCard(cardId, cardTitle)
        }
        NativeBoardColumn(id, title, cards)
    }
    val allIds = projected.flatMap { column -> listOf(column.id) + column.cards.map(NativeBoardCard::id) }
    if (allIds.toSet().size != allIds.size) return null
    return NativeBoard(projected)
}

@Composable
internal fun ListWidget(list: NativeList) {
    Column(
        Modifier.semantics {
            collectionInfo = CollectionInfo(rowCount = list.items.size, columnCount = 1)
            isTraversalGroup = true
        },
        verticalArrangement = Arrangement.spacedBy(4.dp),
    ) {
        list.items.forEachIndexed { index, item ->
            val marker = if (list.ordered) "${index + 1}." else "•"
            Text(
                "$marker $item",
                Modifier.semantics {
                    collectionItemInfo = CollectionItemInfo(index, 1, 0, 1)
                },
                style = MaterialTheme.typography.bodyMedium,
            )
        }
    }
}

@Composable
internal fun BoardWidget(board: NativeBoard) {
    val columnWord = if (board.columns.size == 1) "column" else "columns"
    val cardWord = if (board.cardCount == 1) "card" else "cards"
    val summary = "Board with ${board.columns.size} $columnWord and ${board.cardCount} $cardWord"
    Row(
        Modifier.fillMaxWidth()
            .horizontalScroll(rememberScrollState())
            .focusable()
            .semantics {
                contentDescription = summary
                collectionInfo = CollectionInfo(rowCount = 1, columnCount = board.columns.size)
                isTraversalGroup = true
            },
        horizontalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        board.columns.forEachIndexed { columnIndex, column ->
            val columnCardWord = if (column.cards.size == 1) "card" else "cards"
            Card(
                Modifier.semantics {
                    contentDescription = "${column.title}, ${column.cards.size} $columnCardWord"
                    collectionItemInfo = CollectionItemInfo(0, 1, columnIndex, 1)
                    collectionInfo = CollectionInfo(rowCount = column.cards.size, columnCount = 1)
                    isTraversalGroup = true
                },
            ) {
                Column(
                    Modifier.padding(12.dp),
                    verticalArrangement = Arrangement.spacedBy(8.dp),
                ) {
                    Text(
                        column.title,
                        style = MaterialTheme.typography.titleSmall,
                        modifier = Modifier.semantics { heading() },
                    )
                    if (column.cards.isEmpty()) {
                        Text(
                            "No cards",
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                    } else {
                        column.cards.forEachIndexed { cardIndex, card ->
                            Card(shape = RoundedCornerShape(6.dp)) {
                                Text(
                                    card.title,
                                    Modifier.padding(10.dp).semantics {
                                        collectionItemInfo = CollectionItemInfo(cardIndex, 1, 0, 1)
                                    },
                                    style = MaterialTheme.typography.bodyMedium,
                                )
                            }
                        }
                    }
                }
            }
        }
    }
}
