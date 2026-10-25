# Component: Toaster

**Package:** `texuli`  
**Source:** `packages/texuli/src/components/toast/`  
**Tests:** `packages/texuli/tests/toast.test.ts`  
**Example:** `texuli-toast`  
**Task:** T-ui-toast

## Import

```ts
import { Toaster, toast, createToastStore } from 'texuli/toast';
```

## API

| Export | Role |
| --- | --- |
| `Toaster` | Styled region over `@texuli/primitives/toast` (R16 viewport + timers) |
| `toast` / `createToastStore()` | `success` / `error` / `info` / `warning` / `promise` / `dismiss` |
| `label` | Landmark name (default `"Notifications"`) |
| `offset` | Lift above bottom nav (`--tx-toast-offset`) |
| `dismissLabel` | Localizable close control prefix |

### Kinds

`success`, `error`, `info`, `warning` — token-colored icon chips. Errors use assertive announcements via `@texuli/core/announcer` (through the primitive Provider).

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
- **Motion:** toasts slide in from the stack's edge. A dismissed toast stays
  mounted (`data-leaving`, inert, `aria-hidden`) for a 160 ms exit. Under
  reduced motion there is no animation and the toast leaves at once.
- **Under a modal (R16):** the region stays exempt from inert. When another
  popover opens, the viewport re-enters the top layer so toasts stay above
  the overlay and clickable. F6 reaches them from the keyboard.
- **Durations:** `createToastStore({ duration })` sets a store-wide default
  (`0` keeps toasts until dismissed). A toast's own `duration` wins, and
  without either each kind uses `DEFAULT_TOAST_DURATION`.
- **Example:** `texuli-toaster-positions` (two stacks, two toasts per tone).
  Checks: `packages/texuli/tests/toast.test.ts` and
  `tests/e2e/toaster-viewport.spec.ts` (axe in light, dark and forced
  colors; placement in LTR and RTL; exit motion; reachable under a modal).
