# Positioning math

**Package:** `@texuli/core` · **Path:** `src/position-math/`

Pure placement math for floating UI (popover, menu, tooltip, select). **Rects
in, coordinates out.** No DOM, no framework, no `@floating-ui`.

## Placements

Twelve **physical** placements:

`top` · `top-start` · `top-end` · `bottom` · `bottom-start` · `bottom-end` ·
`left` · `left-start` · `left-end` · `right` · `right-start` · `right-end`

Twelve **logical** placements (horizontal-tb writing mode):

`block-start*` · `block-end*` · `inline-start*` · `inline-end*` (each with
optional `-start` / `-end` alignment).

`resolvePlacementForDirection(placement, direction)` maps logical → physical
and, by default, mirrors physical `-start`/`-end` under RTL so **start** always
means inline-start.

## Pipeline

`computePosition(reference, floating, options)`:

1. Resolve placement for `direction` (`ltr` | `rtl`).
2. Optional **size** — clamp width/height to space on the main side inside
   `boundary` (minus main-axis offset).
3. **place** — top-left from placement + `offset` (`mainAxis` / `crossAxis`).
4. Optional **flip** — try opposite and adjacent placements when the box
   overflows `boundary`.
5. Optional **shift** — slide within the boundary without resizing.
6. Optional **arrow** — cross-axis center on the reference, clamped with padding.

## API (selected)

| Function | Role |
| --- | --- |
| `place` | Raw coordinates for one placement |
| `overflowOf` / `totalOverflow` | How far a box sticks out of a boundary |
| `flipFallbacks` | Candidate list after a preferred placement |
| `shiftIntoBoundary` | Clamp top-left inside a boundary |
| `sizeToAvailable` | Clamp size to free space on one side |
| `arrowPosition` | Arrow tip relative to the floating top-left |
| `computePosition` | Full pipeline |

```ts
import { computePosition, rect } from '@texuli/core';

const result = computePosition(
  rect(100, 100, 40, 20),
  { width: 80, height: 40 },
  {
    placement: 'top',
    offset: 8,
    boundary: rect(0, 0, 400, 300),
    flip: true,
    shift: true,
    arrow: { width: 10, height: 6, padding: 4 },
  }
);
// result.x, result.y, result.placement, result.arrow
```

## Rules

- Every function is **pure** (or takes rects explicitly). No `window` / `document`.
- Boundary coordinates use the same space as the reference (viewport or a
  positioning root). Callers convert DOM `getBoundingClientRect()` values.
- The overlay engine (later) owns middleware order and DOM measurement; this
  module only does math.

## Tests

```bash
pnpm vitest run packages/core/tests/position-math.test.ts
```
