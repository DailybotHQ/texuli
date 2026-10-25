# Chart interaction

**Package:** `@texuli/charts` · **Import:** `@texuli/charts/interaction`

Shared exploration chrome for chart families: pointer and keyboard navigation,
tooltips, symbol-aware legends, crosshair, zoom and brush helpers. Cartesian
and scatter/bubble legends map each series label to its color and mark; toggles
are native keyboard-operable buttons and never hide the final visible series.
Part-whole charts use the same legend as a static category/color key. Legend
visibility changes do not animate, so they honor reduced-motion preferences;
wheel zoom skips when the user prefers reduced motion and the live region stays
polite.

## Exports

| Export | Role |
| --- | --- |
| `InteractivePlot` | Focusable SVG composite: arrows, Page Up/Down, Home/End, Enter, Escape, pointer hover/click, optional Shift-brush and Ctrl-wheel zoom |
| `Legend` | Symbol/color-mapped series or category list; optional pressable toggles (never hides the last series) |
| `Tooltip` | Pixel-placed, `aria-hidden` floating box (announcements live on the plot) |
| `ChartTable` / `TableToggle` | Data table fallback |
| `stepIndex` / `nearestIndex` / `toggleSeries` / `tooltipPosition` / `brushToDomain` / `zoomDomain` | Pure helpers |

`LegendItem` and `LegendSymbol` are exported for typed composition. Supported
marks are `circle`, `square`, `diamond`, `triangle`, `cross`, `line`, `area`
and `bar`.

## Keyboard

| Key | Action |
| --- | --- |
| ← → | Previous / next defined point (skips gaps) |
| Home / End | First / last defined point |
| Page Up / Down (or ↑ ↓) | Previous / next visible series |
| Enter / Space | `onselect` drill-down |
| Escape | Dismiss tooltip / clear brush |
| + / − | Zoom in/out when `onzoom` + `fullDomain` are set |

## Pointer

- Move: nearest point along the axis; tooltip + crosshair.
- Click / tap: select that point.
- Shift-drag: brush (needs `brushInvert` + `onbrush`).
- Ctrl/Meta + wheel: zoom (needs `onzoom` + `fullDomain`; skipped under reduced motion).

## Example

```svelte
<script lang="ts">
  import { InteractivePlot, Legend } from '@texuli/charts/interaction';
  // series: PlotSeries[] in pixel space
</script>

<Legend items={…} {hidden} onchange={(h) => (hidden = h)} />
<InteractivePlot label="Revenue" {series} {hidden} {width} {height} {plot} {formatters} />
```
