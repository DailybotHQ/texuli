# AlertDialog

`@texuli/primitives/alert-dialog` is an owned, headless modal confirmation dialog built on Texuli core overlay, focus-scope, inert, portal and scroll-lock texels.

## Behaviour

- `role="alertdialog"` with `aria-modal="true"`, labelled by `Title` and described by `Description`.
- **Never dismisses on outside pointer** (backdrop or page). Escape, Cancel and Action close it.
- **Cancel receives initial focus** by default (the safe choice). Override with `Root.initialFocus`.
- Focus is trapped; Tab cycles Cancel ↔ Action. Closing restores focus to the trigger.
- Page content outside the layer is inert while open; top-layer mode locks scroll.

## Parts

- `Root` — controlled `open` (`bind:open`), `onOpenChange`, `mode`, `container`, `initialFocus`, `onDismissRequest`, preventable `onCloseAutoFocus`, and `stack` (a `LayerStack` to register on instead of the page-wide one).
- `Trigger` — button with `aria-haspopup="dialog"`, `aria-expanded`, `aria-controls`, `data-state`.
- `Portal` — moves children to `document.body` (or `Root.container` in contained mode).
- `Overlay` — full-viewport backdrop; pointer presses do **not** close the alert.
- `Content` — `role="alertdialog"` surface with focus trap and no outside dismiss.
- `Title` / `Description` — accessible name and description ids.
- `Cancel` — safe control; registers as the default initial focus target and closes.
- `Action` — confirming control; closes after the consumer handler runs (unless `preventDefault`).

```svelte
<script lang="ts">
  import * as AlertDialog from '@texuli/primitives/alert-dialog';

  let open = $state(false);
</script>

<AlertDialog.Root bind:open>
  <AlertDialog.Trigger>Delete project</AlertDialog.Trigger>
  <AlertDialog.Portal>
    <AlertDialog.Overlay class="backdrop" />
    <AlertDialog.Content>
      <AlertDialog.Title>Delete project?</AlertDialog.Title>
      <AlertDialog.Description>
        The fictional Orbit project and its tasks will be removed.
      </AlertDialog.Description>
      <AlertDialog.Cancel>Cancel</AlertDialog.Cancel>
      <AlertDialog.Action onclick={() => {/* confirm */}}>Delete</AlertDialog.Action>
    </AlertDialog.Content>
  </AlertDialog.Portal>
</AlertDialog.Root>
```

The primitive supplies no visual theme. Consumers style the backdrop and content, including forced-colors treatment, and check contrast in light and dark modes.


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

The content takes `motionHooks` (enter and exit, the closed part held `inert` while its exit plays); see [prim-dialog](prim-dialog.md#motion-hooks).
