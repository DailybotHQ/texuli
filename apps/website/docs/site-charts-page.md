# Charts gallery (texuli.com)

**App:** `apps/website`  
**Paths:** `/charts-page/` (all families) · `/charts-page/<family>/`  
**Tests:** `scripts/tests/site-charts-page.test.ts`, `tests/e2e/site-charts-page.spec.ts`

## Goal

Every **@texuli/charts** family with:

1. A **data contract** table (fields, types, required flags, notes).
2. **Interactive live examples** (Svelte islands, `client:visible` on the index).
3. Static Astro output, **no runtime network**, axe clean in light and dark.

## Families

| Id | Import | Components (gallery) |
| --- | --- | --- |
| `cartesian` | `@texuli/charts/cartesian` | Line, Area, Bar, StackedBar, Combo |
| `part-whole` | `@texuli/charts/part-whole` | Pie, Donut, Treemap, Sunburst |
| `compact` | `@texuli/charts/compact` | Sparkline, Bullet, Gauge, ProgressRing |
| `matrix` | `@texuli/charts/matrix` | Heatmap, Scatter, Bubble |
| `flow` | `@texuli/charts/flow` | Funnel, Sankey, Network |
| `geo` | `@texuli/charts/geo` | GeoMap, GeoPointMap (bundled tiles) |
| `interaction` | `@texuli/charts/interaction` | Legend, InteractivePlot, ChartTable |
| `canvas` | `@texuli/charts/cartesian` | Line/Area with `renderer="canvas"` |

Catalog and contracts: `src/components/charts-page/families.ts`.  
Demos: `src/components/charts-page/demos/*Demo.svelte`.

Fictional Harbor Notes metrics only. Geo tiles are schematic, not live GIS.

## Validation

```bash
pnpm build
TEXULI_E2E_PORT=4880 pnpm exec playwright test tests/e2e/site-charts-page.spec.ts
pnpm vitest run scripts/tests/site-charts-page.test.ts
```

## Limits

- Canvas demo uses 512 deterministic samples (forces canvas; not the 100k fixture-app load).
- Interaction demo sets `data-tx-motion="reduce"` for stable e2e.
- Page chrome follows the site theme (no per-demo light/dark token forks).
