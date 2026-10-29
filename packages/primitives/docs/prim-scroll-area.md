# ScrollArea

**Package:** `@texuli/primitives`  
**Source:** `packages/primitives/src/scroll-area/`  
**Tests:** `packages/primitives/tests/composites.test.ts`  
**Behavior:** `tests/behavior/scenarios/scroll-area.spec.ts`

Headless scroll region with optional custom scrollbar chrome. **Native scrolling
stays on the viewport** so keyboard, wheel, touch and screen readers keep working.
Custom scrollbars are decorative (`aria-hidden`) and pointer-draggable.

## Parts

```svelte
<script lang="ts">
  import { ScrollArea } from '@texuli/primitives/scroll-area';
</script>

<ScrollArea.Root type="hover" aria-label="Messages" style="block-size:12rem">
  <ScrollArea.Viewport>
    <!-- long content -->
  </ScrollArea.Viewport>
  <ScrollArea.Scrollbar orientation="vertical">
    <ScrollArea.Thumb />
  </ScrollArea.Scrollbar>
  <ScrollArea.Scrollbar orientation="horizontal">
    <ScrollArea.Thumb />
  </ScrollArea.Scrollbar>
  <ScrollArea.Corner />
</ScrollArea.Root>
```

| Part | Role |
| --- | --- |
| `Root` | Context, hover/scroll visibility, `type`, `dir`, `scrollHideDelay` |
| `Viewport` | Focusable overflow container (`tabindex=0`), native scroll |
| `Scrollbar` | Track for one axis; hidden when no overflow |
| `Thumb` | Draggable size/offset from scroll metrics |
| `Corner` | Shown only when both axes overflow, or with `forceMount` |

## `type`

| Value | Behavior |
| --- | --- |
| `hover` | Chrome visible while pointer is over the root |
| `scroll` | Chrome visible while scrolling, then hides after `scrollHideDelay` |
| `auto` | Chrome when content overflows |
| `always` | Chrome whenever the part is mounted and axis overflows |

## Accessibility

- Viewport remains the scrollable, focusable surface (APG: prefer native scroll).
- Scrollbar and thumb are `aria-hidden` so AT does not hear a second control.
- Root accepts `aria-label` / `aria-labelledby` for the region name.
-

## Budget

Target ≤ 3 KB gzip for the scroll-area entry graph. `@texuli/primitives/scroll-area`
measures 3.37 KiB (`pnpm size`, 2026-10-24): above that target, within the
4 KiB default for a primitive.
