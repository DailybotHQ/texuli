# HoverCard

`@texuli/primitives/hover-card` provides a non-modal preview surface that opens after a pointer or keyboard-focus delay. It is implemented with Texuli's positioning and dismiss texels.

```svelte
<script lang="ts">
  import {
    HoverCardContent,
    HoverCardRoot,
    HoverCardTrigger,
  } from '@texuli/primitives/hover-card';
</script>

<HoverCardRoot openDelay={500} closeDelay={300}>
  <HoverCardTrigger>View profile</HoverCardTrigger>
  <HoverCardContent aria-label="Profile preview">
    <p>Sam Chen, product designer</p>
  </HoverCardContent>
</HoverCardRoot>
```

`HoverCardRoot` accepts bindable `open`, `openDelay` (default `500` ms), `closeDelay` (default `300` ms), an optional stable `id`, and `onOpenChange`. A pointer or focus entering the trigger schedules opening. Leaving the trigger schedules closing; moving into the preview cancels that close. Focus can move between trigger and preview without closing it. Touch pointer-down toggles the preview. Escape and outside pointer interaction dismiss it. The card is non-modal: it does not trap focus, lock scrolling, or inert the page. Escape returns focus to the trigger only when focus was inside the preview.

The trigger exposes `aria-haspopup="dialog"`, `aria-expanded`, `aria-controls`, and `data-state`. Content requires an accessible `aria-label`, uses `role="dialog"`, and exposes `data-state`. A custom `child` snippet receives a `props` object containing those attributes, event handlers, and an `attach` callback. Apply that callback to the snippet's actual element with Svelte's `{@attach}` directive and remove `attach` before spreading the remaining props onto the DOM node; this registers the trigger or card for positioning and pointer/focus handoff. Consumer event handlers run before primitive handlers and can prevent them with `event.preventDefault()`.

The package is headless and supplies no visual theme. Style `[data-state="open"]` and `[data-state="closed"]` in the consuming application, including forced-colors and reduced-motion behavior as appropriate. The preview is placed with the shared `@texuli/core/position-dom` texel and dismisses through the shared `@texuli/core/dismiss` texel.

Validation:

```sh
TEXULI_E2E_PORT=4870 pnpm exec playwright test tests/behavior/scenarios/hover-card.spec.ts
pnpm --filter @texuli/primitives typecheck
```
