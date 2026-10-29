# Board (kanban)

**Package:** `@texuli/data`
**Lazy subpath:** `@texuli/data/board`
**Engine:** `packages/data/src/engines/board/` (framework-free, also `./board/engine`)
**View:** `packages/data/src/board/`
**Tests:** `packages/data/tests/board.test.ts`, `packages/data/tests/engines.test.ts`
**Example:** `data-board`

## Goal

A kanban board over flat `{ id, columnId, rank }` cards with:

- Columns from definitions (optional WIP soft/hard limits), optional swimlanes
- Pointer drag (4px threshold, pointer capture) on the `@texuli/drag/gesture`
  tracker, and a full keyboard move map
- A per-card "Move …" menu as the pointing-device alternative (WCAG 2.5.7),
  built from the same `validateMove` rules as drag and keyboard
- Live-region announcements for pickups, positions, WIP rejections and drops;
  drag announcements come from `DragMessages` templates (`@texuli/drag/messages`),
  overridable per locale with the `messages` prop (new in `0.4.0`)
- Locked cards (`isLocked`) that cannot be dragged or moved
- RTL via `dir="rtl"` (arrow keys flip with the reading direction) and logical CSS

## Usage

```svelte
<script lang="ts">
  import { Board, type BoardMove } from '@texuli/data/board';

  let tasks = $state([
    { id: 'alpha', column: 'todo', rank: 'a0', title: 'Alpha' },
    { id: 'beta', column: 'doing', rank: 'a0', title: 'Beta' },
  ]);

  function onMove(move: BoardMove): void {
    tasks = tasks.map((task) => {
      const rank = move.rerank?.find((entry) => entry.itemId === task.id)?.rank;
      if (task.id === move.itemId) return { ...task, column: move.columnId, rank: move.rank };
      return rank === undefined ? task : { ...task, column: move.columnId, rank };
    });
  }
</script>

<Board
  columns={[
    { id: 'todo', title: 'To do' },
    { id: 'doing', title: 'In progress', wip: { soft: 3, hard: 5 } },
    { id: 'done', title: 'Done' },
  ]}
  items={tasks}
  getId={(task) => task.id}
  getColumn={(task) => task.column}
  getRank={(task) => task.rank}
  getLabel={(task) => task.title}
  {onMove}
>
  {#snippet card(task)}
    <span>{task.title}</span>
  {/snippet}
</Board>
```

### Swimlanes

Pass lane definitions and a lane accessor; the keyboard map gains
Shift+ArrowUp/ArrowDown to change lanes, and the move menu and drop targets
follow the card's lane.

```svelte
<Board
  columns={columns}
  lanes={[
    { id: 'web', title: 'Web' },
    { id: 'mobile', title: 'Mobile' },
  ]}
  getLane={(task) => task.lane}
  {/* remaining accessors as above */}
/>
```

### Column footers and heading levels

`columnFooter` renders at the end of each column (an "add card" button,
totals) and receives the column and its card count. `headingLevel` (2–6,
default 3) sets the level of the column headings so the board fits the page
outline: the board's visually hidden title sits one level above (a plain
paragraph at level 2, still naming the board), swimlane titles one below
(capped at 6), and the unplaced-cards heading matches the columns.

```svelte
<Board {columns} items={tasks} headingLevel={4} {/* accessors */} {onMove}>
  {#snippet card(task)}<span>{task.title}</span>{/snippet}
  {#snippet columnFooter(column, { count })}
    <button type="button" onclick={() => add(column.id)}>Add to {column.title}</button>
    <span>{count} cards</span>
  {/snippet}
</Board>
```

Example: `data-board-footer`. Test: the "Board column footers and heading
levels (G14)" block in `packages/data/tests/board.test.ts` (levels 2, 3, 4
and 6, lanes on and off, one footer per column with its count).

## Keyboard map

Focus a card's handle (announced as `Drag <card>`), then:

| Key | Effect |
| --- | --- |
| Space / Enter | pick up / drop (a rejected drop keeps the card in hand) |
| ArrowLeft / ArrowRight | previous / next column (flipped under RTL) |
| ArrowUp / ArrowDown | up / down inside the cell |
| Shift + ArrowUp / ArrowDown | previous / next lane |
| Home / End | top / bottom of the cell |
| Escape | cancel — the card returns to its origin |

Every step announces column, lane and position through the live region; a full
column warns before the drop is rejected. The per-card **Move …** menu exposes
the same destinations (column top/bottom) for pointer and touch users.

## Engine vs view

| Layer | Import | Role |
| --- | --- | --- |
| Engine | `@texuli/data/board/engine` (plain Node) | `groupBoard`, `validateMove`, `pickUp`, `moveIntent`, rank helpers |
| View | `Board` from `@texuli/data/board` | rendering, drag, menu, focus, announcements |

The engine loads without DOM or Svelte, so hosts can share move rules with
non-web views.

## Tokens

Uses `--tx-border`, `--tx-foreground`, `--tx-surface`, `--tx-muted`,
`--tx-warning`, `--tx-danger`, `--tx-ring`, `--tx-shadow-soft` and the
`--tx-radius-*` scale, with system-color fallbacks and a `forced-colors: active`
block.
