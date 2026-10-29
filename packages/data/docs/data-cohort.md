# Cohort retention table

**Package:** `@texuli/data`  
**Lazy subpath:** `@texuli/data/cohort` (also `CohortTable` from `@texuli/data`)  
**Model:** `packages/data/src/cohort/model.ts` (framework-free)  
**View:** `packages/data/src/cohort/`  
**Tests:** `packages/data/tests/cohort.test.ts`  
**Example:** `data-cohort`

## Goal

A retention matrix that is a real data table: a caption that says what is
measured, a column header per period, a row header per cohort (`scope`),
numbers as text, missing and incomplete cells that are read aloud, optional
size-weighted averages and optional heat cells whose text keeps its contrast.

## Usage

```svelte
<script lang="ts">
  import { type CohortRow, CohortTable } from '@texuli/data/cohort';

  const rows: CohortRow[] = [
    { label: 'Jun 2026', size: 412, cells: [1, 0.62, 0.48] },
    { label: 'Jul 2026', size: 388, cells: [1, { value: 0.58, incomplete: true }] },
  ];
</script>

<CohortTable
  {rows}
  periods={['Month 0', 'Month 1', 'Month 2']}
  caption="Share of each signup cohort still active, by month since signup"
  heat
  average
/>
```

## Props

| Prop | Default | Meaning |
| --- | --- | --- |
| `rows` | required | `CohortRow[]`: `label` (the row header), `size?`, `cells` (a number, `null` for a period not reached, or `{ value, incomplete }`), `id?` |
| `periods` | `[]` | Period column headers; missing ones come from `labels.period(index)` ("Period 2") |
| `caption` | required | The table's name; `captionHidden` keeps it for assistive technology only |
| `valueKind` | `rate` | `rate` (0 to 1, shown as a percent) or `count` |
| `format` | percent or grouped integer | `(value, kind) => text` |
| `heat` | `false` | Tints value cells in five fixed steps |
| `heatScale` | none | Own heat steps, lightest first (2 to 10): hex colors or `COHORT_HEAT_TOKENS` names (below) |
| `heatText` | `{ light: '#ffffff', dark: '#000000' }` | The two hex text colors a hex step picks from |
| `max` | 1 for rates, the largest cell for counts | Top of the heat scale |
| `average` | `false` | A `tfoot` row of averages per period, weighted by size when every cohort that reached the period has one, and the mean cohort size |
| `density`, `locale`, `labels`, `class` | `compact`, `en-US`, English | Table density, number formatting and every header and announced string |

## Semantics

- `<caption>`, then `<th scope="col">` for the cohort column, the size column (when any row has a size) and each period; `<th scope="row">` for each cohort and for the Average row.
- Values are text in the cell. A period a cohort has not reached shows a dash hidden from assistive technology and reads "No data yet"; an incomplete value shows an asterisk and reads "(incomplete)".
- Built on the texuli `Table`: a wide table scrolls in its own named region, and the row headers stay visible while it scrolls sideways.
- **Heat:** steps 0–3 mix 6, 14, 24 and 34% of `--tx-primary` into the surface under the normal text color; step 4 is the solid `--tx-primary` with `--tx-primary-foreground`, the pair the token engine keeps at AA. Color is never the only cue (the number is the content), and forced colors drop the tints.
- **Heat palette (G51):** `heatScale` replaces the five steps with 2 to 10 of the host's, with the same guarantee. A hex step (`#rgb` or `#rrggbb`) gets the `heatText` color with the higher contrast, and the palette is refused if any step stays under 4.5:1 (with the default black and white text every hex color passes). A token step names a pair the tokens' AA gate checks in every theme: `primary`, `secondary`, `accent`, `destructive`, `success`, `warning`, `info`, or the `-soft` fills of `primary`, `destructive`, `success`, `warning` and `info`, painted `var(--tx-<name>)` under `var(--tx-<name>-foreground)`. Any other entry refuses the palette. A refused palette logs a console warning and the built-in steps are used. The colors are custom properties set through CSSOM on the root (`--tx-cohort-heat-<n>` and `--tx-cohort-heat-<n>-text`, so a strict CSP without `'unsafe-inline'` allows them); until they are set (server rendering), a step shows the plain surface and text.

## Model

`cellValue(cell)`, `periodCount(rows)`, `cohortAverages(rows)`,
`formatCohortValue(value, kind, locale)`, `heatLevel(value, max, levels?)`,
`heatMax(rows, kind, skipFirst?)` and `resolveHeatScale(scale, text?)`
(`{ ok: true, steps }` with each step's `background`, `color` and measured
`ratio`, or `{ ok: false, error }`): pure helpers for adapters and custom
views. `COHORT_HEAT_TOKENS`, `HEAT_SCALE_LIMITS`, `HEAT_TEXT_MINIMUM` and
`DEFAULT_HEAT_TEXT` are the palette contract.

## Verified

- `pnpm vitest run packages/data/tests/cohort.test.ts`: **4 tests**: the model (cell normalization, weighted and plain averages, formats, heat steps and scale tops); the table's caption, `scope` on every column and row header, fallback period names, readable missing and incomplete cells, heat attributes, the averages footer; counts with a custom format and label, no heat when off, and the CSS heat steps; a host `heatScale` (text picked per step, token pairs, refused low-contrast and unknown entries with the warning and fallback, step counts, the CSSOM custom properties and the forced-colors rule).
- In the browser (a scratch spec on port 4937): the `data-cohort` example passes axe (including color contrast on every heat step) in light, dark and forced colors on Chromium, WebKit and the Pixel 7.

## Limits

- No interactive sorting or display toggle (rate and count) in the view; render two tables or switch `rows` and `valueKind` on the host.
- A `heatScale` is checked in WCAG 2 contrast on hex colors; other color syntaxes (`oklch()`, named colors) are refused rather than guessed. The browser axe sweep above covers the built-in steps, not host palettes.
