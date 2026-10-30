# Component: Toaster

**Package:** `texuli`  
**Source:** `packages/texuli/src/components/toast/`  
**Tests:** `packages/texuli/tests/overlays.test.ts`, `packages/texuli/tests/contracts.test.ts`  
**Example:** `texuli-toast`  
**Task:** T-ui-toast

## Import

```ts
import { Toaster, toast, createToastStore } from 'texuli/toast';
```

## API

| Export | Role |
| --- | --- |
| `Toaster` | Styled region over `@texuli/primitives/toast` (R16 viewport and announcer) |
| `toast` / `createToastStore()` | `success` / `error` / `info` / `warning` / `promise` / `dismiss` / `action` / `pause` / `resume` / `isPaused` (store) / `announcement` |
| `label` | Landmark name (default `"Notifications"`) |
| `offset` | Lift above bottom nav (`--tx-toast-offset`) |
| `dismissLabel` | Localizable close control prefix |
| `mode` | `'top-layer'` (default) or `'contained'`: out of the top layer, pinned to the edges of `container` (or of the Toaster's nearest positioned ancestor), for framed previews |
| `container` | The element a `'contained'` stack renders in; it becomes the containing block |
| `positioned` | Contained mode: `true` declares `container` already positioned, so its computed style is never read. Default `false`: the read runs one frame after mount (never during the first render, so no forced layout) and a static container gets `position: relative` |
| other attributes | Land on the Toaster's wrapper `div`. Caller `onpointerenter`, `onpointerleave`, `onfocusin` and `onfocusout` run first, then the Toaster's own pause handling (never replaced) |

### Settle reasons (undo)

`onSettle(reason)` on a toast's options is called exactly once when it
leaves: `'timeout'` when its timer ran out, `'action'` after its action ran
(also when the action rejected, unless it sets `retryOnError`), and
`'dismiss'` for every other way out (the
close button, a swipe, `dismiss()`, or being pushed out by the `max` cap).
Replacing a toast by `id` keeps one toast, and only the newest `onSettle` is
called. An error thrown by `onSettle` is rethrown on a microtask.

```ts
const id = toast.info('Message archived', {
  duration: 6000,
  action: { label: 'Undo', onClick: () => {} },
  onSettle: (reason) => (reason === 'action' ? restore() : commitArchive()),
});
```

### Timers, pause and announcements

The store owns the auto-dismiss timers (`ToastStore.pause(key?)`,
`resume(key?)`, `isPaused()`). A paused timer keeps its remaining time.
Holds stack by key (default `'host'`): timers run again only when every hold
is released. Each Toaster holds its own key while the pointer or focus is in
its region. Timers count from the moment a toast is published, whether or
not a Toaster is mounted.

`store.announcement(id?)` returns `{ message, politeness }` for a toast, or
for the newest one without an id: the text the region announces (`title.
description`) and `assertive` for errors, `polite` otherwise. Each `ToastItem`
carries the same `announcement`. `ToastSettleReason` and `ToastAnnouncement`
are exported types.

### Kinds

`success`, `error`, `info`, `warning` — token-colored icon chips. Errors use assertive announcements via `@texuli/core/announcer` (through the primitive Provider).

### Actions

`action: { label, onClick }` renders a real button. The toast stays mounted
and interactive while `onClick` runs (its timer stops), then dismisses when
its promise settles (failures surface through the action's own UI); sync
actions dismiss on the next tick. A second click while it runs does nothing.
`store.action(id)` runs the same path from host code.

A rejected action is rethrown on a microtask (host error reporting). By
default the toast still dismisses and settles with `'action'`. With
`retryOnError: true` it stays instead, unsettled, with an error line
(`role="alert"`, `data-error="true"` on the toast, `ToastItem.error`) and a
fresh timer, so the person can run the action again; `errorText` (a string or
`(error) => string`, default `DEFAULT_TOAST_ACTION_ERROR`) sets the message.
The toast still settles exactly once: `'action'` after a run that succeeds,
`'timeout'` or `'dismiss'` if the person gives up.

```ts
toast.info('Message archived', {
  action: { label: 'Undo', onClick: restoreOnServer, retryOnError: true },
  onSettle: (reason) => (reason === 'action' ? restoreLocally() : commitArchive()),
});
```

### Promise toasts

```ts
toast.promise(save(), {
  loading: 'Saving…',
  success: 'Saved',
  error: 'Could not save',
});
```

## Accessibility

- Region is focusable via F6 (primitive).
- Dismiss and action are real buttons with names.
- Announcements use the shared announcer (works under modals — R16).
- No private `aria-live` region in this component.

## Placement and motion (FIX-toaster-viewport)

- **`position`:** `top-start`, `top-center`, `top-end`, `bottom-start`,
  `bottom-center` or `bottom-end` (default). Start and end follow the
  reading direction. Below 40rem every position centers the stack.
  `TOASTER_POSITIONS` lists them.
- **The viewport places itself.** It is a manual popover in the top layer,
  so `.tx-toaster__viewport` resets the popover UA box (`inset: auto`,
  `margin: 0`, no border, padding, background or overflow) and uses logical
  insets from `data-position`. Centered positions use auto inline margins,
  which are RTL-safe. `offset` adds space from the stack's edge.
- **Nothing while empty (G77):** the viewport enters the top layer only
  while it has toasts (including one on its way out), so an empty Toaster
  never sits at the page corner, outside a framed preview.
- **Contained (G77):** `mode="contained"` with a `container` keeps the stack
  inside that element (`position: absolute`, above contained dialogs), never
  in the top layer. The container's position is checked one frame after
  mount, or never with `positioned` (G99), so mounting a contained Toaster
  never forces a layout during the app's first render.
- **Motion (`motion` prop, [ui-motion](ui-motion.md)):** new toasts rise in
  from the stack's edge and the stack reflows (FLIP) through
  `@texuli/core/motion`; nothing plays for the toasts of the first render. A
  dismissed toast stays mounted (`data-leaving`, inert, `aria-hidden`) until
  its fade-out ends (at most 1.2 s). Under reduced motion, a `MotionProvider`
  level of `none` or `motion={false}` there is no animation and the toast
  leaves at once.
- **Under a modal (R16):** the region stays exempt from inert. When another
  popover opens, the viewport re-enters the top layer so toasts stay above
  the overlay and clickable. F6 reaches them from the keyboard.
- **Durations:** `createToastStore({ duration })` sets a store-wide default
  (`0` keeps toasts until dismissed). A toast's own `duration` wins, and
  without either each kind uses `DEFAULT_TOAST_DURATION`.
- **Example:** `texuli-toaster-positions` (two stacks, two toasts per tone).
  Checks: `packages/texuli/tests/overlays.test.ts`, `packages/texuli/tests/contracts.test.ts` and
  `tests/e2e/toaster-viewport.spec.ts` (axe in light, dark and forced
  colors; placement in LTR and RTL; exit motion; reachable under a modal).

<!-- tokens:start (generated by `pnpm exec tsx packages/tokens/scripts/generate.ts`; do not edit by hand) -->
## Tokens

Set these on any element above the component (a theme scope, a design
system scope or `data-tx-scope`); each defaults to the system or theme token
shown, so nothing changes until one is set. The full list, with the exact
read expressions, is in
[tokens-components](../../tokens/docs/tokens-components.md#component-tokens).

| Token | Default | Meaning |
| --- | --- | --- |
| `--tx-toast-z-index` | `var(--tx-z-toast)` | Viewport stacking. |
| `--tx-toast-gap` | `var(--tx-space-3)` | Gap between icon, body and actions. |
| `--tx-toast-padding-block` | `var(--tx-space-3)` | Block padding. |
| `--tx-toast-radius` | `var(--tx-shape-radius-lg)` | Corner radius. |
| `--tx-toast-border-width` | `var(--tx-border-width-thin)` | Border width. |
| `--tx-toast-elevation` | `var(--tx-elevation-5)` | Shadow. |
| `--tx-toast-icon-size` | `var(--tx-size-icon-md)` | Status icon size. |
| `--tx-toast-title-font-size` | `var(--tx-type-label-size)` | Title font size. |
| `--tx-toast-title-font-weight` | `var(--tx-type-label-weight)` | Title font weight. |

<!-- tokens:end -->
