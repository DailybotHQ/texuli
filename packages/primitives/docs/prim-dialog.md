# Dialog

`@texuli/primitives/dialog` provides an owned, headless modal dialog built on Texuli core overlay, focus-scope, inert, portal and scroll-lock texels.

## Parts

- `Root` owns the controlled `open` state and supports `bind:open`, `onOpenChange`, `mode`, `container`, `initialFocus`, `onDismissRequest` and preventable `onCloseAutoFocus`. `stack` (a `LayerStack` from `@texuli/core/layer-stack`) makes `Content` register on that stack instead of the page-wide one; it is read when the content opens. The sheet family shares this `Root`.
- `Trigger` is a button with `aria-haspopup="dialog"`, `aria-expanded` and `aria-controls`.
- `Portal` moves its stable wrapper to `document.body` by default. In contained mode it portals into `Root.container`; pass `to` to choose a top-layer target.
- `Overlay` is a full-viewport backdrop target. Style it with the consumer's class; pointer presses on the backdrop close the dialog unless prevented.
- `Content` is the modal `role="dialog"` surface. It wires title and description ids, traps focus, makes outside content inert and locks page scroll in top-layer mode.
- `Title` and `Description` provide the ids used by `Content`.
- `Close` closes the nearest root.

```svelte
<script lang="ts">
  import * as Dialog from '@texuli/primitives/dialog';

  let open = $state(false);
</script>

<Dialog.Root bind:open>
  <Dialog.Trigger>Open settings</Dialog.Trigger>
  <Dialog.Portal>
    <Dialog.Overlay class="dialog-backdrop" />
    <Dialog.Content>
      <Dialog.Title>Settings</Dialog.Title>
      <Dialog.Description>Manage your workspace preferences.</Dialog.Description>
      <Dialog.Close>Done</Dialog.Close>
    </Dialog.Content>
  </Dialog.Portal>
</Dialog.Root>
```

Nested dialogs close from the top layer first. In `mode="contained"`, provide a `container` such as a device frame; inertness is scoped to that element and document scrolling is left alone. `initialFocus` accepts an element or a function that returns one. `onCloseAutoFocus` receives the same preventable focus-restore event used by the core focus scope.

The primitive supplies no visual theme or backdrop color. Consumers should provide backdrop and content styles, including forced-colors treatment, and check contrast in light and dark modes.


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
- **Tests:** `packages/primitives/tests/overlays.test.ts`
  (`-t dialog-contained-focus`: dialog, alert dialog and sheet), plus the behavior rows
  `contained-backdrop-under-content` and `mounted-open-keeps-focus` in
  `tests/behavior/scenarios/dialog.spec.ts`.

## Motion hooks

Overlay parts animate nothing on their own. A styled layer passes
`motionHooks` (texuli builds them from its `motion` prop through
[`texuli/motion`](../../texuli/docs/ui-motion.md), on
`@texuli/core/motion`, ADR-013):

```ts
interface OverlayMotionHooks {
  enter?: (node: HTMLElement) => void; // after the part opens
  exit?: (node: HTMLElement) => { finished: Promise<unknown>; cancel(): void } | null;
}
```

- **Which parts take it:** dialog `Content` and `Overlay`, alert dialog
  `Content` and `Overlay`, every sheet content (`Sheet`, `Drawer`, `Panel`,
  `ResponsiveModal`), popover `Content`, hover card `Content`, menu,
  context-menu, menubar and submenu contents, tooltip `Content`, and accordion
  `Content` (its height).
- **Enter** runs once per opening, after the part is shown; never for a part
  that is open when it is created (first render, hydration).
- **Exit:** when `exit` returns a hold, the closed part stays mounted with
  `data-state="closed"` and `inert` until `finished` settles (at most
  1,200 ms, `MOTION_HOLD_MAX_MS`). Reopening during the exit cancels it and
  plays the enter again on the same element.
- **Unchanged without hooks:** focus returns, `inert` lifts, the layer stack
  and dismissal are released at close in either case; with a hold only the
  paint (the top layer, the scroll lock, the portal) waits for the unmount.
  A held backdrop takes no pointer presses.
