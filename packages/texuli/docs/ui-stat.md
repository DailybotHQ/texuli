# Stat and KPI

**Package:** `texuli` · **Import:** `texuli/stat`

Metric tiles with delta tone, comparison and a sparkline slot.

| Export | Role |
| --- | --- |
| `Stat` | Label, value, delta, trend tone, hint, icon and sparkline slots |
| `Kpi` | Numeric tile with unit formatting, previous-period delta, loading/empty, optional link |
| `KpiRow` | Auto-fit grid of KPI tiles |
| `resolveTrend` / `formatDelta` / `trendToneClass` / `trendWord` | Shared trend helpers |
| `formatKpi` / `kpiDelta` | Number formatting and period change |

## Stat

```svelte
<script lang="ts">
  import { Stat } from 'texuli/stat';
</script>

<Stat label="Churn" value="2.1%" delta={-0.4} positive="down" hint="vs last week" />
```

- `trend`: `up` | `down` | `neutral` (defaults from a numeric `delta`)
- `positive`: which direction is good (`up` default; use `down` for churn/latency)
- `icon` / `sparkline` snippets are decorative slots (sparkline is consumer-owned)
- `variant`: `elevated` (default) | `flat`

## KPI

```svelte
<script lang="ts">
  import { Kpi, KpiRow } from 'texuli/stat';
</script>

<KpiRow label="Key metrics">
  <Kpi label="Signups" value={420} previous={380} href="https://example.com/signups" />
  <Kpi label="Churn" value={0.031} previous={0.04} unit="percent" positive="down" />
  <Kpi label="MRR" value={1_245_000} previous={1_180_000} unit="cents" />
</KpiRow>
```

- `unit`: `number` | `compact` | `cents` (integer cents) | `percent` (ratio)
- `previous` drives the signed delta and comparison label
- `href` uses `@texuli/core/url-policy` `safeHref` (default trust `developer`)
- `loading` shows skeletons; `empty` (boolean or message) shows an empty tile

## Styles

`@layer tx.components` in `stat.css`. Token colors for success/destructive delta tones. Logical properties. Forced-colors borders on the surface and icon well; in forced colors the delta text is `CanvasText` (the arrow icon and the signed value carry the trend, not color).
