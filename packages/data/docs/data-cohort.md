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
| `max` | 1 for rates, the largest cell for counts | Top of the heat scale |
| `average` | `false` | A `tfoot` row of averages per period, weighted by size when every cohort that reached the period has one |
| `density`, `locale`, `labels`, `class` | `compact`, `en-US`, English | Table density, number formatting and every header and announced string |

## Semantics

- `<caption>`, then `<th scope="col">` for the cohort column, the size column (when any row has a size) and each period; `<th scope="row">` for each cohort and for the Average row.
- Values are text in the cell. A period a cohort has not reached shows a dash hidden from assistive technology and reads "No data yet"; an incomplete value shows an asterisk and reads "(incomplete)".
- Built on the texuli `Table`: a wide table scrolls in its own named region, and the row headers stay visible while it scrolls sideways.
- **Heat:** steps 0–3 mix 6, 14, 24 and 34% of `--tx-primary` into the surface under the normal text color; step 4 is the solid `--tx-primary` with `--tx-primary-foreground`, the pair the token engine keeps at AA. Color is never the only cue (the number is the content), and forced colors drop the tints.

## Model

`cellValue(cell)`, `periodCount(rows)`, `cohortAverages(rows)`,
`formatCohortValue(value, kind, locale)`, `heatLevel(value, max)` and
`heatMax(rows, kind, skipFirst?)`: pure helpers for adapters and custom views.

## Verified

- `pnpm vitest run packages/data/tests/cohort.test.ts`: **3 tests**: the model (cell normalization, weighted and plain averages, formats, heat steps and scale tops); the table's caption, `scope` on every column and row header, fallback period names, readable missing and incomplete cells, heat attributes, the averages footer; counts with a custom format and label, no heat when off, and the CSS heat steps.
- In the browser (a scratch spec on port 4937): the `data-cohort` example passes axe (including color contrast on every heat step) in light, dark and forced colors on Chromium, WebKit and the Pixel 7.

## Limits

- No interactive sorting or display toggle (rate and count) in the view; render two tables or switch `rows` and `valueKind` on the host.
- The heat steps use the theme's primary color only; there is no custom palette.
