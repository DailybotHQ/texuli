# Drag page (texuli.com)

**App:** `apps/website`
**Path:** `/drag-page/`
**Package:** `@texuli/drag` (in development, on npm in the 0.12 line), shown through
`@texuli/primitives/sortable`, `@texuli/data/grid-columns` and
`@texuli/primitives/file-drop`
**Tests:** `apps/website/tests/site-drag.test.ts`, `tests/e2e/site-drag-workflows.spec.ts`

## Goal

Prove that one general-purpose drag engine builds every drag surface, like
Lego pieces: lists, boards, trees, groups, a free-placement canvas and grid
columns share the same session, collision, modifiers, gesture tracker and
localized messages.

## Layout

| Section | Island | What it shows |
| --- | --- | --- |
| Hero | `DragWorkbench.svelte` | A sortable list, a board (3 columns, `crossContainers`, `maxItems`) and a tree (`nestZone`, `maxDepth`) on one engine. Toggles: keyboard instructions, reduced motion (switches to the overlay preview, which has no move animation; the system setting also turns animation off), right to left. A visible log of the live-region announcements (newest first, six entries); the same text goes to the polite region through `@texuli/core/announcer`. |
| `#lists` | `SortableKinds.svelte` | Vertical, horizontal (arrows mirror in RTL) and grid lists; the grid can swap instead of insert. |
| `#groups` | `GroupsDemo.svelte` | A palette that clones into a page (`pull: 'clone'`, `put: false`, `sort: false`), a locked item, and multi-select with checkboxes. |
| `#canvas` | `SpatialDemo.svelte` | `@texuli/drag/spatial` + `gesture`: drag cards (the selection moves together), pan the background, Shift+drag marquee, zoom buttons, Ctrl/Command+wheel zoom around the pointer, Fit, snap to the grid or to other cards with guides. Keyboard: Tab to a card, arrows nudge one grid step (Shift: four), Space selects. |
| `#grid-columns` | `GridColumnsDemo.svelte` | `ColumnGrid`: drag headers to reorder within a pin zone, drag the edge to resize; the column menu is the non-drag path. |
| `#file-drop` | `FileDropDemo.svelte` | OS file drop, labelled as a different interaction kind (not `@texuli/drag`); nothing is uploaded. |
| `#contract` | static | The accessibility, motion, performance and safety contract. |

Copy lives in `src/components/drag-site/page.ts` and `data.ts` (fictional
Harbor Notes content; labels are text, never HTML).

## Performance

Only the hero mounts on open (`client:visible`, above the fold); every other
demo mounts when it scrolls into view, so it is not part of the route's
open-time weight. Route budgets: `src/components/perf/budgets.ts`.

## Validation

```bash
pnpm vitest run apps/website/tests/site-drag.test.ts
pnpm build
pnpm --filter @texuli/website check:csp
TEXULI_E2E_PORT=4895 pnpm exec playwright test tests/e2e/site-drag-workflows.spec.ts --project chromium
```

## Limits

- The reduced-motion toggle switches the preview to overlay mode; it does
  not change the system setting the binding reads.
- The canvas uses physical coordinates (it is a coordinate space, not text
  flow), so it does not mirror in right to left.
