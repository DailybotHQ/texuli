# Charts: canvas renderer

**Package:** `@texuli/charts`  
**Import:** `import { CanvasRenderer, useCanvas, CANVAS_POINT_THRESHOLD } from '@texuli/charts/canvas'`

Dense cartesian series draw their marks on a `canvas` instead of one SVG
element per point.

## When it is used

A cartesian chart's `renderer` prop decides: `'svg'` always uses SVG marks,
`'canvas'` always uses the canvas, and `'auto'` (the default) switches to the
canvas at 5,000 source points (`CANVAS_POINT_THRESHOLD`). `useCanvas(mode,
pointCount)` applies the same rule.

## What stays accessible

- The canvas is `aria-hidden`; the chart keeps its named SVG `role="img"` with
  axes and title.
- Marks are downsampled per horizontal pixel bucket (`downsampleCanvasPoints`
  keeps the first, last, minimum, maximum and gaps), and keyboard exploration
  runs on that downsampled series, not on every sample.
- The data table is still available from **Show data table**.

## Exports

| Export | Role |
| --- | --- |
| `CanvasRenderer` | Svelte component that paints marks into a sized canvas |
| `drawCanvasChart` | Paints line, area, bar, stacked-bar and combo marks into a 2D context (no DOM access) |
| `downsampleCanvasPoints` | Pixel-bucket downsampling |
| `useCanvas`, `CANVAS_POINT_THRESHOLD` | The renderer decision |

## Example

Registry id **`charts-canvas`**: 100,000 points with the default `auto`
renderer.

## Testing

```bash
pnpm vitest run packages/charts/tests/canvas.test.ts
TEXULI_E2E_PORT=4870 pnpm exec playwright test tests/e2e/charts-families.spec.ts -g "canvas"
```
