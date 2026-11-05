# Charts: title heading rank

**Package:** `@texuli/charts`

**Import:** `import { setChartTitleLevel } from '@texuli/charts/heading'`

Flow, geo and part-whole charts (`FunnelChart`, `NetworkGraph`,
`SankeyChart`, `GeoMap`, `GeoPointMap`, `PieChart`, `DonutChart`,
`SunburstChart`, `TreemapChart`) render their `title` as a heading whose rank
their host sets through Svelte context, so a chart fits the outline it sits
in. With no host the title is an `h3`, as before. Cartesian and matrix charts
keep their fixed `h2`.

The rank is never a prop, so the blueprint vocabulary does not change. The
player sets it from the outline it paints (D-G-020): one rank below the
nearest titled frame or card, so `h2` directly under a page's `h1` and `h3`
in a card titled `h2`, and `h3` when nothing titled is around the chart (a
slide's component, a block). The catalog grammar checks the same rank
(`titleHeading: 'figure'`).

```svelte
<script lang="ts">
import { setChartTitleLevel } from '@texuli/charts/heading';
import { PieChart } from '@texuli/charts/part-whole';

// Every chart inside this component titles itself h2.
setChartTitleLevel(() => 2);
</script>

<h1>Survey</h1>
<PieChart title="Work setup" description="Share of each setup" data={data} labels={{}} />
```

| Export | What it does |
| --- | --- |
| `setChartTitleLevel(level)` | Sets the rank for the charts inside the calling component (call during initialization). `level` is a getter read on every render; `undefined` means the default |
| `chartTitleLevel()` | The getter a chart reads (call during initialization): the host's rank, or the default |
| `chartTitleLevelOf(value)` | Clamps a value to 2–6 (a chart title is never an `h1`); a non-number is the default |
| `CHART_TITLE_LEVEL_DEFAULT` | `3` |
| `ChartTitleLevel` | `2 \| 3 \| 4 \| 5 \| 6` |

The title style covers every rank (`figcaption :is(h2, h3, h4, h5, h6)`), so
a ranked title looks the same as the default one.

## Tests

- `packages/charts/tests/heading.test.ts`: every flow, geo and part-whole
  chart titles `h3` with no host and at the host's rank (clamped) under one,
  and no source hard-codes a rank.
- `packages/player/tests/painting.test.ts`: the player paints `h2` under a
  page, `h3` in a card and in a fragment, and the grammar agrees.
