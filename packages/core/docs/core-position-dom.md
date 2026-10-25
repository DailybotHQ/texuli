# Positioning on the page

**Package:** `@texuli/core` · **Path:** `src/position-dom/`

The DOM adapter over [positioning math](core-position-math.md). It measures the
page, runs `computePosition`, writes the result to the floating element and
keeps it there while the page scrolls, resizes or moves. Where the browser
supports **CSS anchor positioning** and it gives the same result, it hands the
job to CSS instead. It is framework-free TypeScript: every function takes its
element, document or window explicitly, and nothing touches `window` or
`document` at import time.

## One call

```ts
import { positionFloating } from '@texuli/core';

const position = positionFloating(trigger, panel, {
  placement: 'bottom-start', // or a logical placement: 'block-end-start'
  offset: 8,
  flip: true,
  shift: true,
  boundaryPadding: 8,
});
// position.mode: 'css-anchor' | 'script'
position.update(); // force a pass (the script path)
position.destroy(); // stop tracking, remove every style it wrote
```

| Option | Default | What it does |
| --- | --- | --- |
| `placement`, `offset`, `flip`, `shift`, `size`, `minSize`, `arrow`, `boundaryPadding` | — | As in `computePosition` |
| `direction` | the reference's computed `direction` | `ltr` / `rtl` for logical and `-start`/`-end` placements |
| `contain` | — | Contained mode: keep inside this container's visible part instead of the viewport |
| `strategy` | `fixed` | `fixed` or `absolute`; both land on the same pixels |
| `arrowElement` | — | An arrow inside the floating element, placed from `result.arrow` |
| `exposeSize` | `false` | Set `--texuli-available-width` / `-height` (use with `size`) |
| `cssAnchor` | `auto` | `never` forces the script path |
| `ancestorScroll`, `ancestorResize`, `elementResize`, `layoutShift` | `true` | Which changes trigger an update |
| `animationFrame` | `false` | Compare the anchor's rect every frame (an animating anchor) |
| `onPosition(result)` | — | Called after each script-path pass |

The floating element gets `data-placement` (`bottom-start`) and `data-side`
(`bottom`) for styling, the arrow `data-side`.

## The pieces

| Function | Role |
| --- | --- |
| `computeDomPosition(reference, floating, options)` | Measure and compute (viewport coordinates) |
| `applyPosition(floating, result, options)` | Write `position`, `top`/`left: 0` and a `translate` |
| `clearPosition(floating)` | Remove what `applyPosition` wrote |
| `autoUpdate(reference, floating, update, options)` | Call `update` now and at most once per frame on change; returns the cleanup |
| `observeResize(element, callback)` | Size changes through the window's one shared `ResizeObserver` |
| `observeMove(element, onMove)` | Moves without scroll or resize, through an `IntersectionObserver` |
| `measureRect`, `getViewportRect`, `getContainerRect`, `intersectRects`, `getScrollAncestors`, `readDirection` | Measuring |
| `supportsCssAnchorPositioning(window)`, `canUseCssAnchor(options)`, `cssAnchorDeclarations(name, placement, offset)` | The CSS path |

A reference can be an element or a **virtual element**
(`{ getBoundingClientRect(), contextElement? }`) for a context menu at the
pointer, a text selection or a canvas point.

## How it stays correct

- **Coordinates.** Results are viewport coordinates. `applyPosition` sets
  `top`/`left` to `0`, then measures where the element actually sits to find
  its containing block's origin, and translates by the difference. A
  transformed or zoomed ancestor, the top layer, margins and both strategies
  therefore land on the computed pixels. Physical `top`/`left` are geometry
  here: right-to-left is resolved by the placement math.
- **Boundary.** The visual viewport (pinch zoom and on-screen keyboards
  included), or in contained mode the container's padding box without
  scrollbars, intersected with the viewport.
- **Auto-update.** It uses passive `scroll` listeners on every scroll ancestor
  of both elements (crossing shadow roots) and on the window, plus passive
  `resize` on the window and the visual viewport. One `ResizeObserver` per
  window is shared by every positioned pair, and it disconnects when nothing is
  observed. An `IntersectionObserver` notices the anchor moving when content
  above it changes. Updates coalesce to one per animation frame.
- **CSS anchor positioning** is used only when it is exact: no flip, shift,
  size or arrow, and a real element as reference. The anchor gets an extra
  `anchor-name` (any author name is kept). The floating element gets
  `position-anchor` and insets written with `anchor()`; centered placements use
  `translate: -50%`. Unit tests check all 12 placements under four offsets
  against `place()`. When CSS cannot give the same result, the script path
  runs, so a placement never depends on which browser drew it.

## Measured

- Real Chromium (Playwright, a one-off check, 2026-10-23):
  - The CSS declarations landed on exactly `place()`'s pixels for 48 of 48
    combinations of placement and offset.
  - `applyPosition` inside a transformed, margined ancestor and a scrolled
    container hit the computed pixels with both strategies.
  - `positionFloating` stayed attached after the container scrolled.
- Size (`pnpm size`, gzip -9, 2026-10-24):
  - `@texuli/core/position-dom`: 5,557 B of its 6,144 B budget, including the
    position math (`@texuli/core/position-math`, 2,108 B) and env helpers.
    It was 4,783 B when it landed.
  - The `@texuli/core` barrel: 22,972 B (it went from 9,877 B to 12,350 B
    when this texel landed).

## Tests

```bash
pnpm vitest run packages/core/tests/position-dom.test.ts
```

Twenty-four tests (happy-dom, with controlled geometry and fake observers)
cover:

- measuring and contained mode;
- RTL;
- the containing-block math;
- the arrow;
- coalesced, passive updates and cleanup;
- the shared observer's life cycle;
- anchor-move detection;
- frame polling;
- CSS-anchor exactness and path selection.

## Limits

- Layout is not real in unit tests. The real-browser checks above were one-off
  scripts, not a committed Playwright spec.
- CSS anchor positioning covers the no-flip, no-shift subset only.
  `position-try-fallbacks` picks differently from the math when no placement
  fits, so flip stays on the script path.
- Writing modes other than horizontal-tb follow the math's limits.
