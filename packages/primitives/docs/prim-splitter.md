# Splitter (resizable panels)

**Package:** `@texuli/primitives` · **Import:** `@texuli/primitives/splitter`

A headless group of resizable panes, owned end to end, following the WAI-ARIA
APG **window splitter** pattern. The names follow the common resizable-panes
vocabulary
(`direction`, `defaultSize`, `minSize`, `maxSize`, `collapsible`,
`collapsedSize`, `onLayoutChange`, `autoSaveId`).

## Usage

```svelte
<script lang="ts">
  import { Splitter } from '@texuli/primitives/splitter';
</script>

<Splitter.Root direction="horizontal" autoSaveId="mail" storage={localStorage}>
  <Splitter.Pane id="nav" defaultSize={30} minSize={20} maxSize={60} collapsible>
    <Navigation />
  </Splitter.Pane>
  <Splitter.Handle label="Resize navigation" />
  <Splitter.Pane minSize={30}>
    <MessageList />
  </Splitter.Pane>
</Splitter.Root>
```

Sizes are percent of the group. Panes size with `flex-grow` along the group
axis; the root is `display: flex`.

**Put padding inside a pane's content, not on the pane:** a collapsed pane
keeps its own padding and border.

## Parts and props

**`Splitter.Root`** (any `<div>` attribute):

| Prop | Default | |
| --- | --- | --- |
| `direction` | `horizontal` | `horizontal`: panes side by side; `vertical`: stacked |
| `layout` | — | Bindable sizes, one per pane. Set it to restore a layout |
| `onLayoutChange` | — | Called with each new layout |
| `autoSaveId` + `storage` | — | The persistence hook: loads the layout on mount and saves it after each keyboard change and at the end of each drag. `storage` is any `{ getItem, setItem }`, such as `localStorage`; failures are ignored |
| `keyboardStep` | `10` | Percent per arrow press |
| `disabled` | `false` | Every handle stops resizing |
| `ref` | — | Bindable: the group element |

**`Splitter.Pane`** (any `<div>` attribute):
- `defaultSize`, `minSize` (default 0) and `maxSize` (default 100);
- `collapsible`, `collapsedSize` (default 0);
- `onCollapse`, `onExpand`;
- `id`, which the handle's `aria-controls` points to;
- `ref`.

It renders `data-state="collapsed" | "expanded"`, and is `inert` while
collapsed to size 0, so nothing hidden stays focusable.

**`Splitter.Handle`** (any `<div>` attribute):
- `label` (its accessible name; default "Resize", so name the pane, for
  example "Resize navigation"), or `aria-labelledby`;
- `disabled`;
- `ref`;
- `child` (a snippet `({ props })` to render your own element).

It renders `data-state="active"` while dragging and `"inactive"` otherwise.

## The APG window splitter

- The handle is a focusable `role="separator"`, with `aria-orientation`
  `vertical` between side-by-side panes (`horizontal` between stacked ones).
- `aria-valuenow` is the size of the pane before it.
- `aria-valuemin` is that pane's minimum, or its collapsed size if collapsible.
- `aria-valuemax` is that pane's maximum, limited by the next pane's minimum.
- `aria-controls` is the pane before it.

| Key | Effect |
| --- | --- |
| ArrowLeft / ArrowRight (side by side) | Move the handle that way by `keyboardStep`. In right to left the first pane is on the right, so ArrowLeft grows it |
| ArrowUp / ArrowDown (stacked) | Move the handle up or down |
| Home / End | The first pane to its minimum or maximum |
| Enter | Collapse the first pane, or restore it to its previous size (collapsible panes) |

**Pointer and touch:** dragging the handle (mouse, pen or finger; the handle
sets `touch-action: none`) moves it by the pointer's distance as a share of
the group's size. The layout is saved when the drag ends.

**Layout rules:** only the two panes next to the handle change.
- A pane pushed below its minimum stops there. If it is collapsible and the
  push passes halfway to its collapsed size, it collapses instead.
- A collapsed pane pulled open opens to at least its minimum.
- If the other pane cannot follow (its own limits), nothing moves.

The pure functions are exported for use outside Svelte: `initialLayout`,
`normalizeLayout`, `resizeLayout`, `setPaneSize`, `layoutForKey`,
`toggleCollapse`, `isCollapsed`, `paneBounds`, `loadLayout` and `saveLayout`.

## Size

`@texuli/primitives/splitter` is **4,092 B gzip** (3,624 B brotli,
`pnpm exec tsx scripts/size.ts --filter @texuli/primitives/splitter`,
2026-10-24), within the task's ≤ 4 KB, the default `@texuli/primitives/*` cap
of 4,096 B and its own 4,608 B budget. It holds three components plus the
layout, keyboard, collapse and persistence rules. It was cut from 4,651 B
(symmetric resize, no root `child`, no rounding pass) to 4,413 B when it
landed, without dropping behavior.

## Tests

```bash
pnpm vitest run packages/primitives/tests/splitter.test.ts
TEXULI_E2E_PORT=<port> pnpm exec playwright test tests/behavior/scenarios/splitter.spec.ts
```

**Unit** (16 tests) cover:
- the model: initial and saved layouts, normalization, min and max,
  collapse snapping and reopening, keys including right to left, collapse and
  restore;
- persistence, including corrupt data and refusing storage;
- the components: APG attributes in both directions, keyboard, Enter collapse
  with inert and callbacks, right to left, pointer drag with save-on-end and
  foreign pointers ignored, restore on mount, and the `child` handle.

**Browser** (Chromium, WebKit, Pixel 7) covers:
- attributes and the Tab stop;
- keyboard;
- Enter collapse;
- right to left;
- mouse drag (desktop) and a real touch drag (Pixel 7, CDP touch events);
- persistence across a reload;
- axe in light and dark.
