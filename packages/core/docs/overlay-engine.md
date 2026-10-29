# Overlay engine

**Package:** `@texuli/core` · **Path:** `src/overlay/` · **Subpath:**
`@texuli/core/overlay` · **Task:** T-overlay-engine

One framework-free composition that every floating primitive builds on:
Dialog, AlertDialog, Sheet, Popover, menus, Select and Combobox lists. It
wires the texels together with one life cycle and two modes:

- layer registration ([layer stack](core-layer-stack.md));
- topmost-only dismissal ([dismiss](core-dismiss.md));
- the focus trap ([focus scope](core-focus-scope.md));
- inert outside, with exemptions ([inert](core-inert.md));
- [scroll lock](core-scroll-lock.md);
- the [portal](core-portal.md);
- exit motion ([presence](core-presence.md));
- anchored placement ([position-dom](core-position-dom.md)).

```ts
import { createOverlay } from '@texuli/core/overlay';

const overlay = createOverlay({
  element: dialogPanel,
  modal: true,
  onOpenChange: (open) => (isOpen = open),
});

trigger.addEventListener('click', (event) => overlay.open(event));
// Later: overlay.close(); on unmount: overlay.destroy();
```

## Modes

| | `top-layer` (default) | `contained` |
| --- | --- | --- |
| Paints above | Everything, through the browser top layer: `popover="manual"` and `showPopover()` | Siblings in the container, through `z-index` = `OVERLAY_Z_BASE` + stack order |
| Element location | Stays in place (the top layer escapes clipping and transforms), or `portal` moves it | Portaled into `container` (a device frame, an embedded preview) |
| Modal inert | Outside the element, page-wide | Only inside `container`; the page around the frame stays usable |
| Modal scroll lock | The page (`lockScroll`) | None (the frame owns its overflow) |
| Positioning boundary | The viewport | The container (`contain`) |

**Why not `showModal()`.** A modal `<dialog>` makes the whole page inert,
including the toast region and the live announcer. R16 requires those to
stay reachable, so the engine uses `popover="manual"`, which brings no light
dismiss and no Escape handling of its own. Inert, the focus trap and Escape
are owned by the engine, and inert exemptions apply.

**Without the popover API**, top-layer mode falls back to the contained
mode's `z-index` stacking.

## Life cycle

1. **`open(event?)`**, in this order:
   1. Portal; `popover="manual"` and `showPopover()`; scroll lock.
   2. Register in the layer stack and position against `anchor`.
   3. Make the outside inert, with `observe: true` so late portals are
      covered. A non-modal overlay opened while a modal is up (a menu inside
      a dialog) is exempted from inert while it is open instead.
   4. Activate the focus scope.
   5. Bind Escape and outside dismissal.
   6. Presence writes `data-state="open"`, then `onOpenChange(true)`.

   Pass the opening pointer or click event: it is guarded so it cannot
   dismiss at once, and its control becomes the fallback restore target. A
   keyboard or programmatic open guards nothing, so the first outside
   pointer still dismisses.
2. **`close()`** releases interaction **at once**: dismissal listeners, then
   inert (before focus moves, since inert content refuses focus), then the
   focus scope, which restores focus, then the layer. Lower layers get Escape
   immediately, `onOpenChange(false)` fires, and presence writes
   `data-state="closed"`.
3. **When exit motion ends** (presence: transition or animation end, or the
   next frame under reduced motion), the element leaves the top layer:
   - `hidePopover()` runs, and an author's own `popover` value comes back;
   - positioning stops, the scroll lock is released and the portal is
     restored;
   - `onExitComplete` fires.
4. **`open()` during exit** re-opens without hiding.
5. **`destroy()`** tears everything down synchronously; use it on unmount.
   It is idempotent, and the controller stays closed afterwards.

**Focus.**
- On close, focus returns to the element that was focused at open (focus
  scope).
- When that was nothing (WebKit does not focus a clicked button) or focus
  would be stranded inside the closed overlay, it goes to the control from
  the opening event, and is never left inside a hidden overlay.
- `restoreFocus: false` leaves focus to the consumer.

## Dismissal

Every close request goes through `onDismissRequest(event)` with a `reason`
of `escape`, `pointer-outside` or `focus-outside`. Call
`event.preventDefault()` to stay open.

- **Escape:** topmost layer only.
  - Ignored when another handler already called `preventDefault()` (a
    combobox inside a dialog), during IME composition, or when focus is
    inside an inert exemption (the toast region handles its own Escape,
    R16).
  - When handled, the key event's default is prevented.
- **Pointer outside:** topmost layer only, through the dismiss texel.
  - `branches()` (the trigger) and inert exemptions count as inside.
  - `pointerPhase: 'click'` waits for a full click.
- **Focus outside:** on by default for non-modal overlays, off for modal
  ones (focus is trapped).
- **Switches:** `dismiss: { escape, pointerOutside, focusOutside }`.

## R16: the toast region under a modal

The toast region registers as an inert **exemption**
(`getInertRegistry().exempt(...)`) and renders as a `popover="manual"`
region. Then:

- it is never made inert, so it stays focusable;
- Escape and pointer interaction inside it never dismiss the modal;
- each time a top-layer overlay opens, the engine re-shows any exempt region
  that is an open popover, so it keeps painting **above** the new modal (the
  top layer orders by show time).

Only exemptions registered with `raise` left at its default (`true`) are
re-shown. A dialog backdrop and an overlay opened inside a modal (which the
engine exempts so it stays live) register with `raise: false`: re-showing them
when a Select, menu, popover or date picker opens from the dialog would put
them above it, and every click would land on the backdrop (G75). A newly
opened overlay therefore always ends above the dialog, its backdrop and the
overlay it was opened from; only the toast region stays above it.

A keyboard shortcut (F6) to reach the toasts belongs to the toast primitive
(T-prim-toast-region) and the R16 spike (T-overlay-r16).

### Focus-exempt regions (your own toaster)

Any region can be made focus-exempt the same way, for example an undo
toaster an app renders itself outside a modal dialog:

```ts
import { getInertRegistry } from '@texuli/core/inert';

const handle = getInertRegistry().exempt({ element: toaster, label: 'undo-toaster' });
// on unmount:
handle.release();
```

While a modal overlay is open, an exempt region:

- is never made inert, and pointer presses, focus and Escape inside it never
  dismiss the modal;
- keeps its own Tab order: the modal's focus trap
  (`createFocusScope`'s `exemptRegions`, which the engine fills with the
  registry's exemptions) lets Tab and Shift+Tab move natively between the
  region's stops, and past its last (or before its first) stop focus wraps
  back into the modal;
- is entered by the app: a click, a hotkey (the toast primitive uses F6) or
  `focus()` on its action. Tab from inside the modal still cycles within the
  modal, as the APG dialog pattern requires.

Register the region on the same registry the overlay uses (the page-wide one
by default). The styled `Dialog`, `AlertDialog` and sheets use it.

## Options

| Option | Default | Notes |
| --- | --- | --- |
| `element` | — | The floating element. |
| `mode` | `top-layer` | Or `contained`. |
| `container` | — | Contained mode's frame. Reactive through `setContainer`. |
| `portal` | — | Top-layer mode: move the element here while open (`null` = body). |
| `modal` | `false` | Sets the defaults of `trapFocus`, `inertOutside` and `lockScroll` (top layer only). |
| `trapFocus`, `inertOutside`, `lockScroll`, `ariaHidden` | from `modal` | Fine-grained overrides. |
| `dismiss` | all on (`focusOutside` only when non-modal) | `{ escape, pointerOutside, focusOutside, pointerPhase }` |
| `branches` | — | Getter for elements that count as inside. |
| `anchor`, `position` | — | `positionFloating` placement (default `bottom`). `setAnchor` changes it while open. |
| `initialFocus`, `restoreFocus`, `onBeforeRestoreFocus` | — | As in the focus scope. |
| `onDismissRequest`, `onOpenChange`, `onExitComplete` | — | Callbacks. |
| `presence` | — | `skipExitAnimation`, `reducedMotion`, `isMotionPending`. |
| `stack`, `inertRegistry` | page-wide | Injection seams for tests and isolated roots. A `stack` is also how an app keeps its own layer order: the styled `Dialog`, `AlertDialog` and sheet roots forward a `stack` prop here. |

The controller also exposes `phase()` (`closed`, `open` or `closing`),
`isOpen()`, `isTop()`, `toggle(event?)`, `update()`, `setContainer()`,
`setAnchor()` and `destroy()`.

**Element attributes while open:**
- `data-tx-overlay`: the mode;
- `data-state`: `open` or `closed` (presence);
- `data-placement` and `data-side`, when anchored;
- `popover="manual"`, in top-layer mode.

The engine sets no visual styles other than the stacking `z-index` and
positioning; primitives style the element.

## Verified

- **Unit tests:** `pnpm vitest run packages/core/tests/overlay.test.ts`, 25
  tests in happy-dom, with a stubbed popover API since happy-dom has none.
  They cover:
  - both modes and the open composition;
  - the Tab trap;
  - release-now and hide-after-exit;
  - author `popover` restore and re-open during exit;
  - nested Escape order with focus restore;
  - pre-handled, composing and exempt Escape;
  - pointer and focus outside with branches, exemptions and the opening
    gesture;
  - the veto and the switches;
  - the contained frame, z-order, a reactive frame and anchoring;
  - the no-popover fallback and the top-layer portal;
  - destroy, the WebKit focus fallback, no stranded focus and
    `restoreFocus: false`;
  - nothing touched before open;
  - re-raising an exempt toast popover;
  - a menu opened from inside a modal staying live, with its own Escape.
- **Real browsers** (Chromium and WebKit through Playwright, 2026-10-23): a
  one-off probe script that bundles the engine, not a committed spec. **32
  of 32 checks passed.** A modal opened from a click:
  - joins the top layer above a `z-index: 2147483647` cover;
  - focuses inside, makes the page inert (except the toast region) and locks
    scroll;
  - keeps the toast region painting above it, focusable and clickable,
    without dismissing;
  - wraps Shift+Tab, and outside content refuses focus;
  - a nested modal paints above and takes focus; Escape closes only the top
    and focus returns to its opener; a second Escape closes the outer,
    returns focus to the trigger and restores the page;
  - a menu opened from inside the modal, living on the body, stays live
    and focusable; Escape closes the menu, then the modal;
  - contained mode stays inside the frame's bounds, only the frame's content
    goes inert, and destroy restores the DOM.

  The probe found the WebKit focus case: a clicked button is not focused, so
  there was no restore target. The engine handles it now.

## Size (gzip)

- **The engine's own cost: 1,460 B** (esbuild, minified, gzip -9: the
  composed texels alone 10,410 B, with the engine 11,870 B). That is within
  the task's 4 KB budget.
- **`pnpm size`** (2026-10-24) measures the `@texuli/core/overlay` subpath
  **with every texel it composes** at 13.64 KiB (13,972 B), within its own
  14,336 B budget in `texuli.budgets.json`. `position-dom` alone is 5.43 KiB
  of it. Floating primitives use `@texuli/core/overlay-core` instead
  (5,199 B), with only the features they need.

## Limits

- **No contained scroll lock:** the frame's own overflow is not locked.
- **Light DOM only:** inert exemptions in shadow roots follow the inert
  texel's limits.
- **Tab from a menu outside a modal.** A non-modal overlay opened from
  inside a modal (a menu portaled to the body) stays live: the engine
  exempts it from inert while it is open. It does not trap, though, so Tab
  from inside it is still handled by the modal's focus trap. Menus manage
  their own arrow-key focus.
- **The F6 toast shortcut and announcements** are the toast and R16 tasks'
  work. The engine only guarantees reachability and paint order.
