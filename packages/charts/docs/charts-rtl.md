# Charts in right-to-left layouts

**Applies to:** every `@texuli/charts` family  
**Task:** T-p6-rtl

Charts render inside `dir="rtl"` pages (Arabic, Hebrew, Persian…) without
mirroring the plot.

## What mirrors and what does not

| Part | Under `dir="rtl"` |
| --- | --- |
| Captions, titles, descriptions | Follow the document direction |
| Legends, data-table toggles, data tables | Follow the document direction (logical CSS: `text-align: start`, `inline-size`, `margin-inline`…) |
| The plot (SVG axes, marks, labels, annotations) | Stays left to right: every chart SVG declares `direction="ltr"` |
| Tooltips | Placed with physical `left` / `top`, in the plot's pixel space |

**Why the plot stays left to right.** Plot geometry is physical: an x scale
maps the lowest value to the left edge. SVG `text-anchor="start" | "end"`,
however, follows the inherited text direction. Without `direction="ltr"` an
end-anchored y-axis label in an RTL page grows to the right of its tick, into
the plot (heatmap row labels were clipped, cartesian tick labels overlapped
the axis, sankey node labels covered their nodes). Text inside the plot still
uses the Unicode bidi algorithm, so Arabic or Hebrew labels read correctly.

The tooltip follows the same rule: it is positioned at a data point in plot
pixels, so it uses physical offsets. A logical `inset-inline-start` would
mirror it away from the point.

Mirroring the x axis itself for RTL (time running right to left) is not
supported.

## Checks

- `packages/charts/tests/rtl.test.ts`: every chart SVG (legend icons excepted,
  they hold no text) declares `direction="ltr"`; rendered heatmap, sankey and
  gauge plots carry it; the tooltip uses physical offsets; the matrix frame's
  styles stay inside the matrix figure.
- The `charts-rtl` example renders line, heatmap, scatter, sankey and gauge
  charts inside `dir="rtl"` with fictional Arabic labels. It has its own
  visual baselines (light/dark, desktop and Pixel 7, macOS):

```bash
pnpm vitest run packages/charts/tests/rtl.test.ts
TEXULI_E2E_PORT=4883 pnpm visual -g charts-rtl
```
