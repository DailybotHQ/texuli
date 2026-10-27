# @texuli/drag

A framework-free, general-purpose drag engine: sortable lists in every
axis, multi-list groups, trees, swap and multi-item drags, pointer
gestures, a spatial canvas (pan, zoom, snapping, marquee, resize) and graph
editing (ports, edges, connection rules). It plans moves as data and never
touches your state, so the same engine drives a keyboard move, a pointer
drag and an agent's move. It is part of [Texuli](https://texuli.com),
"Small pieces. Infinite possibilities.": an MIT Svelte 5 component library
by Dailybot, Inc.

> **Status: in development.** `@texuli/drag` is versioned `0.3.0` and listed
> in the publish waves, but is **not yet on npm** (it goes out with the next
> owner-run publish). Inside the Texuli repository it
> already powers `@texuli/primitives/sortable`, the `@texuli/data` board,
> tree view, calendar, timeline and column moves, and `@texuli/workflows`.
> It will be published in a future release wave, before the packages that
> depend on it (see
> [RELEASE](https://github.com/DailybotHQ/texuli/blob/main/docs/RELEASE.md)).

## Install

Not yet on npm. In the Texuli workspace, depend on it as
`"@texuli/drag": "workspace:*"`. It has **no runtime dependencies** and no
peer dependencies: no Svelte, no DOM framework.

## Quick start

Plan a move between two lists of one group, then apply it. Nothing changes
until you apply the plan, and a refused plan names its reason.

```ts
import { formatDragMessage, resolveDragMessages } from '@texuli/drag/messages';
import { applyMove, createSortableModel, planMove } from '@texuli/drag/sortable';

let lists = [
  { id: 'todo', items: ['write-copy', 'review-pr'], group: 'tasks' },
  { id: 'done', items: ['ship-beta'], group: 'tasks', maxItems: 10 },
];

const plan = planMove(createSortableModel(lists), ['review-pr'], { containerId: 'done', index: 0 });
if (plan.ok) {
  lists = applyMove(lists, plan.move);
  // todo: write-copy · done: review-pr, ship-beta
} else {
  console.log(`refused: ${plan.reason}`); // 'locked', 'full', 'put', …
}

const messages = resolveDragMessages(); // English defaults; pass overrides for any locale
formatDragMessage(messages.dropped, { item: 'Review PR', position: 1, total: 2, container: 'Done' });
// "Review PR dropped at position 1 of 2 in Done."
```

In Svelte, use the owned binding instead of wiring pointers yourself:
`Sortable.Root`, `Sortable.List`, `Sortable.Item` and `Sortable.Handle` from
`@texuli/primitives/sortable` (handles, keyboard, announcements, FLIP and
auto-scroll included).

## Subpaths

| Import | What it gives you | gzip |
| --- | --- | --- |
| `@texuli/drag` | The session state machine (idle → pressed → dragging → dropping), refusal reasons and shared geometry | 1.58 KiB |
| `@texuli/drag/sortable` | Sortable model and controller: groups with `pull` / `put` (including clone), nested lists and trees, swap, multi-item, locked items, filters, capacity, keyboard intents, overlay and in-place previews | 6.95 KiB |
| `@texuli/drag/collision` | Closest center, pointer within, rect intersection and a binary-search midpoint index | 696 B |
| `@texuli/drag/modifiers` | Axis lock, bounds and snap to grid | 517 B |
| `@texuli/drag/auto-scroll` | Edge zones and a speed curve, on a frame loop you supply | 671 B |
| `@texuli/drag/gesture` | A pointer tracker: capture with a document fallback, a 4 px threshold, `pointercancel` as cancel, optional long-press | 1.22 KiB |
| `@texuli/drag/spatial` | Canvas pan and zoom transforms, free placement, snapping and alignment guides, marquee, resize with bounds and aspect ratio | 1.64 KiB |
| `@texuli/drag/graph` | Port hit-testing, edge hit areas and connection rules (direction, self, type, duplicate, capacity, cycle) | 1.42 KiB |
| `@texuli/drag/messages` | `DragMessages` templates and `resolveDragMessages()` / `formatDragMessage()` | 963 B |
| `@texuli/drag/testing` | Test helpers: fake frames and timers, measured lists, pointer events | 1.01 KiB |

Sizes are gzip from `pnpm size --filter @texuli/drag` (Svelte external);
each subpath has its own budget in `texuli.budgets.json`.

## Key guarantees

- **One accessibility and i18n contract.** Every surface built on the
  engine follows the
  [interaction, accessibility and i18n contract](https://github.com/DailybotHQ/texuli/blob/main/packages/drag/docs/contract.md):
  Space or Enter picks up and drops, arrows move (inline arrows flip in
  right-to-left text), Escape cancels and restores the origin, every pointer
  drag has a non-drag alternative (WCAG 2.5.7), and no `aria-grabbed`.
- **Localized announcements.** Every string comes from `DragMessages`
  templates with position, total and container; English defaults ship and
  any locale overrides them. No surface hardcodes English.
- **Moves as data.** The engine emits planned moves and refusal reasons; your
  application applies them and owns history, persistence and authorization.
- **SSR-safe, dependency-free.** No `window` or `document` access at module
  load, no runtime dependencies (`tests/package.test.ts` checks both).
- **Measured performance.** `tests/perf/drag.test.ts` (`pnpm test:perf`)
  holds every pointer event under 2 ms (scaled for slow hosts). One run on a
  loaded development machine measured, per pointer event: 0.037 ms for a
  1,000-item vertical list, 0.053 ms for a 1,000-item grid, 0.017 ms across a
  4 × 250 board and 0.010 ms for edge hit-testing over 2,000 edges.
- **SortableJS-class parity.** The capability matrix in
  [parity](https://github.com/DailybotHQ/texuli/blob/main/packages/drag/docs/parity.md)
  names one test per row, and the test fails when the table and the tests
  drift.

## Documentation

- Contract:
  [interaction, accessibility and i18n](https://github.com/DailybotHQ/texuli/blob/main/packages/drag/docs/contract.md)
  · [capability parity](https://github.com/DailybotHQ/texuli/blob/main/packages/drag/docs/parity.md)
- Decision: ADR-007 in
  [DECISIONS](https://github.com/DailybotHQ/texuli/blob/main/docs/DECISIONS.md)
- Bindings:
  [`@texuli/primitives/sortable`](https://github.com/DailybotHQ/texuli/blob/main/packages/primitives/README.md)
  · [`@texuli/workflows`](https://github.com/DailybotHQ/texuli/blob/main/packages/workflows/README.md)
- Source: [github.com/DailybotHQ/texuli](https://github.com/DailybotHQ/texuli)
  · Issues: [github.com/DailybotHQ/texuli/issues](https://github.com/DailybotHQ/texuli/issues)

## Contributing

Contributions are welcome; start at the
[GitHub repository](https://github.com/DailybotHQ/texuli).

## License

MIT © Dailybot, Inc. Powered by [Dailybot](https://www.dailybot.com?utm_source=dailybotopensource&utm_medium=texuli-drag).
