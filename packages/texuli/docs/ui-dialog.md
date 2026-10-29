# Dialog and AlertDialog

**Package:** `texuli`  
**Source:** `packages/texuli/src/components/dialog/`  
**Primitives:** `@texuli/primitives/dialog`, `@texuli/primitives/alert-dialog`  
**Tests:** `packages/texuli/tests/overlays.test.ts`  
**Examples:** `ui-dialog`, `ui-dialog-variants`, `ui-dialog-states`, `ui-dialog-rtl`, `ui-dialog-dark`

Styled modal surfaces on the `--tx-*` token contract: a general **Dialog** with header, body and footer, and an **AlertDialog** confirm pattern.

## Dialog

```svelte
<script lang="ts">
  import { Button } from 'texuli/button';
  import { Dialog } from 'texuli/dialog';
  let open = $state(false);
</script>

<Dialog
  bind:open
  title="Workspace settings"
  description="Update the Harbor Labs workspace name and timezone."
  size="md"
>
  {#snippet trigger({ props })}
    <Button {...props}>Open settings</Button>
  {/snippet}
  <p>Name, region and default locale.</p>
  {#snippet footer()}
    <Button variant="outline" onclick={() => (open = false)}>Cancel</Button>
    <Button onclick={() => (open = false)}>Save</Button>
  {/snippet}
</Dialog>
```

| Prop | Notes |
| --- | --- |
| `title` | Required; becomes the dialog name |
| `description` | Optional supporting copy |
| `size` | `sm` · `md` (default) · `lg` · `xl` |
| `trigger` | Snippet receiving `{ props }` to spread onto a control |
| `footer` | Snippet for action row |
| `hideClose` | Hides the header close control |
| `closeLabel` | Accessible name of the close control (default `Close`) |
| `open` / `onOpenChange` | Controlled open state |
| `ref` | Bindable: the dialog content element while open, `null` while closed |
| `stack` | A `LayerStack` (`@texuli/core/layer-stack`) to register on instead of the page-wide one, for apps that keep their own Escape and outside-press order (`AlertDialog` too) |
| other attributes | `id`, `aria-*`, `data-*` and handlers land on the dialog content element (`AlertDialog` too) |

Escape and backdrop pointer dismiss close a Dialog. Focus is trapped while open.

### Focus-exempt regions (an undo toaster)

`Toaster` (`texuli/toast`) is already exempt. A region you render yourself
outside the dialog (an undo bar) stays reachable once registered:

```ts
import { getInertRegistry } from '@texuli/core/inert';
const handle = getInertRegistry().exempt({ element: undoBar, label: 'undo-toaster' });
// later: handle.release();
```

The open dialog never makes it inert, never closes on a press, focus or
Escape inside it, and lets Tab move between its buttons; past its last
button focus wraps back into the dialog. Move focus into it with a click, a
hotkey or `focus()`; Tab inside the dialog still cycles within the dialog.

## AlertDialog

```svelte
<script lang="ts">
  import { AlertDialog } from 'texuli/dialog';
  import { Button } from 'texuli/button';
  let open = $state(false);
</script>

<AlertDialog
  bind:open
  title="Delete project?"
  description="This removes the Harbor Labs project from every member workspace."
  confirmLabel="Delete"
  cancelLabel="Keep project"
  destructive
  onConfirm={async () => {
    /* may throw — dialog stays open with an error */
  }}
>
  {#snippet trigger({ props })}
    <Button {...props} variant="destructive">Delete project</Button>
  {/snippet}
</AlertDialog>
```

| Prop | Notes |
| --- | --- |
| `destructive` | Warning icon + destructive confirm button |
| `onConfirm` | Sync or async; rejection keeps the dialog open with `role="alert"` |
| `onCancel` | Called when cancel closes the dialog |
| `confirmLabel` / `cancelLabel` | Action labels (translatable) |
| `errorFallback` | Copy when a rejection has no message |

AlertDialog does **not** close on outside pointer. Cancel is the default initial focus (safe choice). Confirm shows pending while `onConfirm` is in flight.

## Import

| Path | Exports |
| --- | --- |
| `texuli/dialog` | `Dialog`, `AlertDialog`, size helpers and class builders |
| `texuli` | the same (root barrel) |

## Rules

- Logical CSS for padding, gaps and inline size; physical `top`/`left` only to keep the modal centered in LTR and RTL
- No static `style=` attributes
- Layers: `@layer tx.components`
- AA contrast in light, dark and forced-colors (token fallbacks + `forced-colors` rules)
- Labels are props so hosts can translate them
