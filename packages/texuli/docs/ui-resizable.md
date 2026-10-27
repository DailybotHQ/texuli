# Resizable panels

**Package:** `texuli` · **Import:** `texuli/resizable` ·
**Path:** `src/components/resizable/` · **Task:** T-ui-resizable

Styled resizable panel groups on the token contract, built on the owned
APG window splitter (`@texuli/primitives/splitter`). Protoyard had no
resizable component to port; its master-detail layout is covered by the
layouts tasks.

```svelte
<script lang="ts">
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from 'texuli/resizable';
</script>

<ResizablePanelGroup variant="bordered" autoSaveId="mail" storage={localStorage}>
  <ResizablePanel defaultSize={30} minSize={20} collapsible>
    <div class="pane">Folders</div>
  </ResizablePanel>
  <ResizableHandle label="Resize folders" />
  <ResizablePanel minSize={30}>
    <div class="pane">Messages</div>
  </ResizablePanel>
</ResizablePanelGroup>
```

Give the group a block size (for example with a class). Put padding inside a
panel's content, not on the panel: a collapsed panel keeps its own padding.

## Parts and props

| Part | Props |
| --- | --- |
| `ResizablePanelGroup` | `direction` (`horizontal` default, or `vertical`), `layout` (bindable percents), `onLayoutChange`, `autoSaveId` + `storage` (restore and save), `keyboardStep` (10), `disabled`, `variant` (`plain` default, or `bordered`), `class`, `ref` |
| `ResizablePanel` | `defaultSize`, `minSize`, `maxSize`, `collapsible`, `collapsedSize`, `onCollapse`, `onExpand`, `id`, `class`, `ref` |
| `ResizableHandle` | `label` (accessible name; default "Resize". Translate it and name the panel, for example "Resize folders"), `disabled`, `withGrip` (true), `size` (`sm` or `md`, default `md`), `class`, `ref` |

- Class composers for custom markup: `resizableGroupClass({ variant })`,
  `resizableHandleClass({ size })` and `resizablePanelClass()`.
- The value lists are `RESIZABLE_VARIANTS` and `RESIZABLE_HANDLE_SIZES`.
- Consumer classes are merged last, and the styles sit in
  `@layer tx.components`, so consumer CSS wins.

## Look and states

- **Divider:** a 1 px line in `--tx-border`. It has a transparent `::before`
  hit area 12 px to each side, so pointers and fingers get a target of at
  least 24 px (WCAG 2.5.8). The cursor is `col-resize` or `row-resize`.
- **Grip:** an optional dotted pill across the divider, outlined in
  `--tx-muted-foreground` so the control clears 3:1 against the surface (WCAG
  1.4.11). `sm` and `md` sizes; hide it with `withGrip={false}`.
- **Hover:** the line darkens to `--tx-muted-foreground`.
- **Focus-visible:** a `--tx-ring` focus ring, and the line and grip turn
  `--tx-primary`.
- **Dragging** (`data-state="active"`): the line and grip turn `--tx-primary`.
- **Disabled** (`data-disabled`): 50% opacity, the default cursor, and the
  handle leaves the Tab order.
- **Collapsed panel** (`data-state="collapsed"`): hidden, and `inert` from
  the primitive.
- **Variants:** `plain` has no frame. `bordered` is a framed, rounded
  surface (`--tx-surface`, `--tx-radius-lg`).
- **Forced colors:** the line uses `CanvasText`, focus and hover use
  `Highlight`, and a disabled line uses `GrayText`.
- **Reduced motion:** no color transition.
- **RTL:** handled by the primitive (ArrowLeft grows the first panel) and by
  logical properties in the CSS.

Keyboard, pointer, touch and persistence behavior is the primitive's; see
`packages/primitives/docs/prim-splitter.md`.

## Example

`texuli-resizable` (fixture `?fixture=texuli-resizable`) shows:
- default
- bordered with three panels
- stacked with a small handle and no grip
- a collapsible sidebar
- disabled
- RTL (Arabic)
- a remembered layout

The visual baselines cover light and dark on desktop Chromium and the
Pixel 7.

## Verified

- `pnpm vitest run packages/texuli/tests/display.test.ts -t resizable`: 3 tests.
  - The default and translated label; disabled; storage restore and save.
  - Keyboard resizing, RTL and Enter collapse are covered by the splitter
    primitive (`tests/behavior/scenarios/splitter.spec.ts`).
- In the fixture app (2026-10-23), on Chromium, WebKit and the Pixel 7, in
  light and dark:
  - axe reports 0 violations
  - the keyboard and a mouse drag resize
  - RTL ArrowLeft grows the first panel
  - Enter collapses the sidebar
  - disabled reports `aria-disabled`
  - no console errors
- Under Chromium forced-colors emulation, axe also reports 0 violations and
  the divider renders in the system text color.

## Size

`pnpm size` (2026-10-24): `texuli/resizable` is **4.85 KiB gzip JS** (most of
it the splitter primitive) plus **993 B CSS**, within the 12 KiB `texuli/*`
budget.
