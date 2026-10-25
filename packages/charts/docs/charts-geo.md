# Charts: geo map and point map

**Package:** `@texuli/charts`  
**Import:** `import { GeoMap, GeoPointMap } from '@texuli/charts/geo'`

Values on a **schematic tile map**. The bundled shapes (`WORLD_TILES`,
`REGION_TILES`) are a grid of labelled tiles, not geographic borders, and make
no claim of exact geography. They work offline and need no map data download.

## Charts

| Component | Data |
| --- | --- |
| `GeoMap` | `data`: region id → finite value or `null` (no data), shaded on a sequential scale |
| `GeoPointMap` | `points: { id, label, regionId, value, offset? }[]` placed inside their regions |

`shape` replaces the bundled tiles with your own `{ id, label, abbr, col, row }`
grid. Model helpers: `geoCells`, `geoValue`, `geoColorIndex`, `geoColor`,
`clampGeoOffset`, `formatGeoValue`, `GEO_TABLE_LABELS`.

## Props

### `GeoMap` (`charts-geo-map`)

| Prop | Type | Required | Default | Exposure | Description |
| --- | --- | --- | --- | --- | --- |
| `title` | string | yes | — | blueprint | Visible chart title and accessible name. |
| `description` | string | yes | — | blueprint | Accessible summary of the chart and its main conclusion. |
| `data` | Record<string, number \| null> | yes | — | blueprint | Region ID to finite value or null. |
| `shape` | { id, label, abbr, col, row }[] | no | — | blueprint | Schematic tile geometry. |
| `labels` | { table, region, point, location, value, noData, low, high } | no | labels object | blueprint | Localized labels for the accessible data table and chart text. |
| `width` | number (> 0) | no | `560` | blueprint | View-box width in pixels. |
| `height` | number (> 0) | no | `320` | blueprint | View-box height in pixels. |

### `GeoPointMap` (`charts-geo-point-map`)

| Prop | Type | Required | Default | Exposure | Description |
| --- | --- | --- | --- | --- | --- |
| `title` | string | yes | — | blueprint | Visible chart title and accessible name. |
| `description` | string | yes | — | blueprint | Accessible summary of the chart and its main conclusion. |
| `points` | { id, label, regionId, value, offset? }[] | yes | — | blueprint | Points assigned to schematic regions. |
| `shape` | { id, label, abbr, col, row }[] | no | — | blueprint | Schematic tile geometry. |
| `labels` | { table, region, point, location, value, noData, low, high } | no | labels object | blueprint | Localized labels for the accessible data table and chart text. |
| `width` | number (> 0) | no | `560` | blueprint | View-box width in pixels. |
| `height` | number (> 0) | no | `320` | blueprint | View-box height in pixels. |

## Scales and color

Values map onto nine sequential steps between the data's minimum and maximum
(all values equal → the middle step). Each step uses the theme's
`--tx-chart-sequential-*` token when present, otherwise a mix of the primary
chart color. The legend shows the low and high ends. A `null` value draws a
dashed, muted tile.

## Tiers

Every prop in the tables above is marked `blueprint` (editable from JSON
blueprints, catalog nodes and chart blocks) or `developer` (callbacks and
`class`, set in code only). See [prop schemas and tiers](charts-schemas.md).

## Keyboard

Each chart's data table sits in a native `details` disclosure: Tab reaches
its summary and Enter or Space opens and closes it. There is no point-by-point
keyboard explorer in this family.

## Example

Registry id **`charts-geo`**.

## Testing

```bash
pnpm vitest run packages/charts/tests/geo.test.ts
TEXULI_E2E_PORT=4870 pnpm visual -g charts-geo
```
