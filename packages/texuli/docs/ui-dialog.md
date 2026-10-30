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
| `open` / `onOpenChange` | Open state (bindable). `onOpenChange(next)` runs exactly once per change, whether `open` is bound or passed once, on the close control, Escape, an outside press, Cancel or a resolved confirm (`AlertDialog` too) |
| `ref` | Bindable: the dialog content element while open, `null` while closed |
| `stack` | A `LayerStack` (`@texuli/core/layer-stack`) to register on instead of the page-wide one, for apps that keep their own Escape and outside-press order (`AlertDialog` too) |
| `mode` / `container` | `mode="contained"` with a `container` element renders the overlay inside it, and scopes inertness, focus containment and the backdrop to it (document scrolling is left alone): for framed previews. Default `top-layer` (`AlertDialog` and `CommandPalette` too) |
| `onDismissRequest` | Called before Escape, an outside press or outside focus closes it; `event.preventDefault()` keeps it open (`AlertDialog` also stays open while a confirm is pending; `CommandPalette` too) |
| `onCloseAutoFocus` | Called before focus returns on close; `event.preventDefault()` keeps focus where it is, so you can move it yourself (`AlertDialog` and `CommandPalette` too) |
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

## Themed subtrees (ADR-023)

Several themes can share a page: `applyTheme(el)` (`@texuli/tokens`) themes
one subtree and marks it `[data-tx-scope]`. A Dialog or AlertDialog rendered
inside that subtree keeps its theme: without `portal`, its portal mounts in a
scoped portal root at the end of `body` that mirrors the subtree's `data-tx-*`
attributes and inline `--tx-*` variables, and follows changes (a mode toggle
while it is open). Pass `portal={element}` to mount it in a frame instead.
Focus, `inert`, scroll lock, Escape and outside clicks behave as with a body
portal. Menus, selects, comboboxes, popovers, hover cards, tooltips, date
pickers and the Toaster render in place (in the top layer), so they inherit
the subtree's theme without a portal. Checked by
`tests/e2e/theme-scopes.spec.ts`.

## Rules

- Logical CSS for padding, gaps and inline size; physical `top`/`left` only to keep the modal centered in LTR and RTL
- No static `style=` attributes
- Layers: `@layer tx.components`
- AA contrast in light, dark and forced-colors (token fallbacks + `forced-colors` rules)
- Labels are props so hosts can translate them

## Motion

`motion` (`Dialog` and `AlertDialog`): the panel scales in and out and the
backdrop fades, through `@texuli/core/motion`
([ui-motion](ui-motion.md)). `motion={false}` turns it off; reduced motion and
a `MotionProvider` level of `none` make it instant. A closing dialog gives
focus back and lifts `inert` at once; only the panel's exit (inert,
`data-state="closed"`) waits. A dialog open on the first render does not
animate in.

<!-- tokens:start (generated by `pnpm exec tsx packages/tokens/scripts/generate.ts`; do not edit by hand) -->
## Tokens

Set these on any element above the component (a theme scope, a design
system scope or `data-tx-scope`); each defaults to the system or theme token
shown, so nothing changes until one is set. The full list, with the exact
read expressions, is in
[tokens-components](../../tokens/docs/tokens-components.md#component-tokens).

| Token | Default | Meaning |
| --- | --- | --- |
| `--tx-dialog-z-index` | `var(--tx-z-modal)` | Stacking. |
| `--tx-dialog-radius` | `var(--tx-shape-radius-xl)` | Corner radius. |
| `--tx-dialog-border-width` | `var(--tx-border-width-thin)` | Border width. |
| `--tx-dialog-elevation` | `var(--tx-elevation-4)` | Shadow. |
| `--tx-dialog-font-size` | `var(--tx-font-size-sm)` | Body font size. |
| `--tx-dialog-line-height` | `var(--tx-type-body-line)` | Body line height. |
| `--tx-dialog-title-font-size` | `var(--tx-type-heading-size)` | Title font size. |
| `--tx-dialog-title-font-weight` | `var(--tx-type-heading-weight)` | Title font weight. |
| `--tx-dialog-title-line-height` | `var(--tx-type-heading-line)` | Title line height. |
| `--tx-dialog-alert-padding` | `var(--tx-space-5)` | Alert dialog padding. |
| `--tx-dialog-scrim-opacity` | `var(--tx-opacity-scrim)` | Foreground mix of the overlay scrim. |

<!-- tokens:end -->
