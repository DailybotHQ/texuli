# Sheet, Drawer, Panel and ResponsiveModal

**Package:** `@texuli/primitives` · **Import:** `@texuli/primitives/sheet`

Headless overlays built on the owned [Dialog](prim-dialog.md) parts and the
per-feature overlay engine (`@texuli/core/overlay-core`), held to the WAI-ARIA APG **dialog**
pattern.

| Namespace | What it is |
| --- | --- |
| `Sheet` | A modal dialog attached to an edge (`side`: `start`, `end`, `top`, `right`, `bottom`, `left`) |
| `Drawer` | A modal sheet you drag toward its edge to dismiss, with optional snap points |
| `Panel` | A non-modal detail panel: the page stays usable while it is open |
| `ResponsiveModal` | A centered dialog on wide screens and a bottom drawer on phones |

Each namespace has `Root`, `Trigger`, `Portal`, `Content`, `Title`,
`Description` and `Close`, which are Dialog's parts and take Dialog's props.
`Sheet`, `Drawer` and `ResponsiveModal` also have `Overlay`, the backdrop.
`Drawer` and `ResponsiveModal` also have `Handle`. Only `Content` differs.

Nothing here imports `@texuli/core/position-dom`: none of these overlays is
anchored.

## Usage

```svelte
<script lang="ts">
  import { Drawer, Panel, Sheet } from '@texuli/primitives/sheet';
</script>

<Sheet.Root>
  <Sheet.Trigger>Filters</Sheet.Trigger>
  <Sheet.Portal>
    <Sheet.Overlay />
    <Sheet.Content side="left">
      <Sheet.Title>Filters</Sheet.Title>
      <Sheet.Description>Narrow the orders.</Sheet.Description>
      <Sheet.Close>Apply</Sheet.Close>
    </Sheet.Content>
  </Sheet.Portal>
</Sheet.Root>

<Drawer.Root>
  <Drawer.Trigger>Cart</Drawer.Trigger>
  <Drawer.Portal>
    <Drawer.Overlay />
    <Drawer.Content snapPoints={[0.5, 1]}>
      <Drawer.Handle label="Resize cart" />
      <Drawer.Title>Cart</Drawer.Title>
    </Drawer.Content>
  </Drawer.Portal>
</Drawer.Root>

<Panel.Root>
  <Panel.Trigger>Details</Panel.Trigger>
  <Panel.Portal>
    <Panel.Content>
      <Panel.Title>Order details</Panel.Title>
      <Panel.Close>Close</Panel.Close>
    </Panel.Content>
  </Panel.Portal>
</Panel.Root>
```

**Styling is yours.** Position the content against its side, for example
`position: fixed; inset: 0 auto 0 0` for a left sheet. In top-layer mode,
also reset the browser's popover margin (`margin: 0`). Use `data-side`,
`data-state`, `data-snap-point` and `data-dragging` as hooks: turn
transitions off while `[data-dragging]` is present, and under
`prefers-reduced-motion`.

## Content props

**`Sheet.Content`** (any `<div>` attribute):
- `side`: `right` by default;
- `onCloseAutoFocus`.

It renders `role="dialog"` with `aria-modal="true"`, named and described by
`Title` and `Description`, with `data-state="open"` and `data-side`.
- Modal: everything outside is inert, focus is trapped, and the page does not
  scroll.
- Escape and a press outside (the `Overlay`) close it, through the Root's
  preventable `onDismissRequest`.
- Focus returns to the trigger.

**`Drawer.Content`** is `Sheet.Content` plus dragging; `side` is `bottom` by
default.

| Prop | Default | |
| --- | --- | --- |
| `snapPoints` | `[1]` | Visible fractions (0 to 1) it settles at, smallest first |
| `activeSnapPoint` | the first | Bindable |
| `onSnapPointChange` | — | Called with each new snap point |
| `dismissible` | `true` | Whether dragging past the last snap point closes it |

- **Dragging:** mouse, pen or touch, from anywhere on the content except
  fields, `[contenteditable]` and `[data-drawer-no-drag]`.
  - The content follows the pointer through `transform`, and never goes past
    fully open.
  - On release it settles on the snap point nearest to where it is heading:
    its position plus 200 ms at the release speed. A quick flick dismisses
    it; a pointer that held still before lifting has no speed.
  - A short pull springs back. A cancelled gesture springs back.
  - The click that ends a drag is swallowed, so a drag that starts on a button
    does not press it.
- **Resting position:** `transform: translate…(…%)` for the current snap
  point, or no transform when fully open.
- **Touch:** the content sets `touch-action: pan-x` (top and bottom drawers)
  or `pan-y` (side drawers). A finger drags the drawer along its axis, and
  scroll regions inside it (`overflow: auto`) still scroll. A touch that starts
  inside such a region scrolls it rather than dragging the drawer: drag from
  the handle.

**`Drawer.Handle`** (any attribute; `label` defaults to "Resize"):
- With two or more snap points it is a `<button>` that steps to the next snap
  point, wrapping: the keyboard path between sizes.
- Otherwise it is a decorative `aria-hidden` grip.
- Either way it sets `touch-action: none`.

**`Panel.Content`** is non-modal: `role="dialog"` without `aria-modal`.
- Nothing is made inert, focus is not trapped, the page still scrolls, and
  pressing or focusing outside does not close it.
- It takes focus when it opens: the Root's `initialFocus`, else its first
  tabbable element, else itself. When it closes with focus inside, focus
  returns to the trigger.
- Escape closes it only while focus is inside it, through the Root's
  preventable `onDismissRequest`.
- `modal` is read once, when the content mounts.

**`ResponsiveModal.Content`**: `query` (default `(max-width: 40rem)`) chooses
a bottom drawer (`data-side="bottom"`, draggable, with snap points) on
matching screens and a centered dialog (`data-side="center"`) elsewhere. It is
modal either way. It reads `matchMedia` only after mount, never at import.

`dismissDirection(side)` and `releaseTarget(offset, velocity, size, snapPoints,
dismissible)` are exported: the pure drag rules.

## Keyboard, pointer and touch

| Input | Sheet / Drawer / ResponsiveModal | Panel |
| --- | --- | --- |
| Enter or Space on the trigger | Open; focus moves inside | Open; focus moves inside |
| Tab, Shift+Tab | Cycle inside (trapped) | Leave to the page |
| Escape | Close; focus returns to the trigger | Close while focus is inside |
| Press on the backdrop | Close | — |
| Drag toward the edge (Drawer) | Change snap point or dismiss | — |
| Enter on the handle (Drawer) | Next snap point | — |

**Sides can be logical or physical.** `start` and `end` follow the direction
of the trigger, including when the dialog is portaled. `left` and `right`
remain explicit physical choices in every direction. An explicit `dir` on the
content controls its direction; otherwise it follows the trigger.

## Size

`@texuli/primitives/sheet` is **14,819 B gzip** (13,153 B brotli,
`pnpm exec tsx scripts/size.ts --filter @texuli/primitives/sheet`,
2026-10-24). That is **2,830 B on top of** `@texuli/primitives/dialog`
(11,989 B), within the task's ≤ 4 KB and the `@texuli/primitives/sheet` budget
of 16,384 B. It is
built on the per-feature `@texuli/core/overlay-core`: a modal content passes
the focus scope, inert and scroll lock features, a panel passes none, and no
positioning code is bundled.

## Tests

```bash
pnpm vitest run packages/primitives/tests/sheet.test.ts
TEXULI_E2E_PORT=<port> pnpm exec playwright test tests/behavior/scenarios/sheet.spec.ts
```

**Unit** (15 tests) cover:
- the drag rules;
- the modal sheet on a side: name, `aria-modal`, focus, inert, Escape and
  restore;
- the non-modal panel: focus in, page usable, Escape only from inside, restore;
- drawer drag: spring back, dismiss, follow and clamp, cancel, snap points by
  drag and by handle, flick versus hold, top-drawer mirroring, fields, the
  swallowed click, the decorative grip;
- the responsive modal on wide and phone screens.

**Browser** (Chromium, WebKit, Pixel 7) covers:
- the sheet's focus trap, Escape and restore, and its backdrop press;
- the panel with the page usable;
- drawer snap points by keyboard;
- drawer drag between snap points, spring back and swipe away (mouse on
  desktop, real CDP touch on the Pixel 7);
- the responsive modal as a dialog on desktop and a drawer on the phone;
- axe WCAG 2.1 A/AA in light and dark, closed and with each overlay open.

## Non-modal dismissal (FIX-sheet-dismiss-outside)

A non-modal panel (`modal={false}`, and every `Panel`) stays open by default
while the page is used. It closes only on Escape with focus inside it, or
from its controls. Two opt-ins go through the core dismissable layer:

| Prop | Default | When `true` |
| --- | --- | --- |
| `dismissOutside` | `false` | A pointer press or focus moving outside the panel closes it. The trigger never counts as outside |
| `closeOnEscape` | `false` | Escape anywhere on the page closes it (topmost layer only), not just from inside |

Modal sheets and drawers are unchanged: they always dismiss on an outside
press and on Escape, and these flags have no effect there. Both flags are
read when the panel opens.


## Contained mode and dialogs mounted open (FIX-dialog-contained-focus)

- **Contained mode** (`mode="contained"`). The Overlay never enters the top
  layer, because it would cover the content kept in the container. It stays
  in the container and fills it: `data-contained`, `position: absolute`,
  `inset: 0`. The container gets `position: relative` while the backdrop is
  mounted, if it was statically positioned. The backdrop stacks just below
  the content (z-index base − 1), and the content becomes positioned so its
  z-index applies. Both inline styles are restored on teardown.
- **Mounted already open.** The Portal moves its wrapper first and then
  marks itself `placed`. Content opens (and takes initial focus) only once
  it is placed, because moving a focused node blurs it in browsers. Before
  this fix, a dialog mounted with `open` (for example a lazily imported
  command palette) ended with focus on `body`.
- **Tests:** `packages/primitives/tests/dialog-contained-focus.test.ts`
  (dialog, alert dialog and sheet), plus the behavior rows
  `contained-backdrop-under-content` and `mounted-open-keeps-focus` in
  `tests/behavior/scenarios/dialog.spec.ts`.
