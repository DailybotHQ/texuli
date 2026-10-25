# Chart axes

**Package:** `@texuli/charts` · **Import:** `@texuli/charts/axis`

Shared SVG axis rendering for Cartesian, matrix and histogram families. Numeric
tick formatting uses the deterministic helpers from `@texuli/charts/math`;
callers can override labels without reimplementing tick geometry.

## Exports

| Export | Role |
| --- | --- |
| `Axis` | Horizontal or vertical SVG axis with domain line, ticks, labels and optional grid lines |
| `AxisTick`, `AxisFormatter`, `AxisValue` | Typed tick positions and formatter callbacks |
| `formatNumericAxisTick` | Number labels with locale, fixed-step precision or compact notation |
| `formatTimeAxisTick` | UTC time labels from a `TimeInterval` |
| `formatAxisValue` | Default formatter: deterministic number output, unchanged string categories |

Chart family components use the shared deterministic default formatter. A
standalone `Axis` accepts a typed `format` callback for custom compositions.
`Axis` labels are decorative within the named chart graphic (`aria-hidden`);
the chart title/description and data-table fallback remain the accessible
summary and exact-value alternative.

```svelte
<Axis
  orientation="y"
  ticks={[{ value: 0, position: 160 }, { value: 10, position: 0 }]}
  length={160}
  gridLength={400}
  format={(value) => `${value} requests`}
/>
```

## Testing

```bash
pnpm vitest run packages/charts/tests/axes.test.ts
pnpm --filter @texuli/charts typecheck
```
