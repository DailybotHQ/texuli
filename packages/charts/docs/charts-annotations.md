# Charts: annotations

**Package:** `@texuli/charts`  
**Import:** `import { AnnotationLayer, projectAnnotations } from '@texuli/charts/annotations'`

Reference lines, range bands and point callouts in data coordinates, shared by
the cartesian and matrix families through their `annotations` prop (at most
100 per chart, unique `id`).

## Shapes

| `type` | Fields |
| --- | --- |
| `line` | `axis` (`x` or `y`), `value`, `label`, `color?` |
| `band` | `axis`, `start`, `end`, `label`, `color?` |
| `point` | `x`, `y`, `label`, `color?` |

On cartesian charts, y values must be numbers (`assertCartesianAnnotations`).
Matrix charts accept strings or numbers on both axes (`assertChartAnnotations`).
`color` is an optional CSS color; theme tokens are used when it is omitted.

## Exports

| Export | Role |
| --- | --- |
| `AnnotationLayer` | Draws projected annotations inside a chart SVG |
| `assertChartAnnotations`, `assertCartesianAnnotations` | Validate JSON-authored annotations before any geometry |
| `projectAnnotations` | Map annotation data into the chart's view-box coordinates |
| `annotationInteractionSeries` | Add annotations to the keyboard explorer, in declaration order |

## Accessibility

Each annotation's `label` is its SVG `title` (shown on hover) and is announced
by the keyboard explorer. Labels are not drawn as visible text.

## Tiers

`annotations` is a `blueprint` prop: it can come from JSON blueprints, catalog
nodes and chart blocks. Chart blocks cap annotations at 16; see
[prop schemas and tiers](charts-schemas.md).

## Example

No `charts-*` example draws annotations yet. The blocks example
**`blocks-data-charts`** has a line chart with a reference line, a band and a
point callout.

## Testing

```bash
pnpm vitest run packages/charts/tests/math.test.ts
```
