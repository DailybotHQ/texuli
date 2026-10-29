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

### Column descriptions, header snippet and column-only boards (G67, G69)

- A column's `description` (`BoardColumnDef.description`) renders under its
  title in the header and describes the column's card lists
  (`aria-describedby`).
- `columnHeader` renders in each column header after the title and count
  (actions, a sort menu, a hint) and receives the column and its card count.
- **Column-only mode:** omit `getRank` when the host keeps no order field.
  Cards keep the order of `items`, a move goes to another column (dropping
  in place is fine; reordering inside a column is refused and announced,
  through the engine rule `MoveRules.reorder: false`), and a move settles as
  soon as the item reports its new column. `onMove` still receives a `rank`
  (derived from the `items` order), which the host may ignore.

```svelte
<Board columns={[{ id: 'todo', title: 'To do', description: 'Not started yet.' }, …]}
  items={tickets} getId={(t) => t.id} getColumn={(t) => t.column} {onMove}>
  {#snippet card(ticket)}<span>{ticket.title}</span>{/snippet}
  {#snippet columnHeader(column, { count })}<button type="button">Sort {column.title}</button>{/snippet}
</Board>
```

Test: the "Board column descriptions, header snippet and column-only mode
(G67, G69)" block in `packages/data/tests/board.test.ts`.

### Saving moves

`onMove` may return a promise. The card moves at once and shows
`labels.savingMove` while the promise is pending (its controls are disabled);
when it rejects, the card goes back to where it was and `labels.moveFailed`
is announced. `@texuli/player` uses this for boards whose items read a host
data source (blueprint spec 0.8.0, unreleased): the move is saved through the
source, optimistically
([player data sources](../../player/docs/data-sources.md)).

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

## Motion

`motion` (`layout` on by default): when `items` changes (a committed move,
an insert or a removal) the cards glide from where they were to their new
place (FLIP through `texuli/motion` on `@texuli/core/motion`,
[ui-motion](../../texuli/docs/ui-motion.md)). Nothing plays on the first
render; reduced motion, a `MotionProvider` level of `none` and
`motion={false}` commit at once. Drag previews are not animated by it.
Tests: `packages/data/tests/motion.test.ts`, `tests/behavior/motion.spec.ts`.
