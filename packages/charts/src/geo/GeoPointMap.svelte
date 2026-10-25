<script lang="ts">
import { extent } from '../math/scales/extent.ts';
import GeoDataTable from './GeoDataTable.svelte';
import {
  clampGeoOffset,
  GEO_TABLE_LABELS,
  type GeoPointDatum,
  type GeoTableLabels,
  type GeoTile,
  geoCells,
  geoValue,
  WORLD_TILES,
} from './model.ts';

type Props = {
  title: string;
  description: string;
  points: readonly GeoPointDatum[];
  shape?: readonly GeoTile[];
  labels?: Partial<GeoTableLabels>;
  width?: number;
  height?: number;
};

let {
  title,
  description,
  points,
  shape = WORLD_TILES,
  labels,
  width = 560,
  height = 320,
}: Props = $props();
const uid = $props.id();
const tableLabels = $derived({ ...GEO_TABLE_LABELS, ...labels });
const cells = $derived(geoCells(shape, width, height));
const byId = $derived(new Map(cells.map((cell) => [cell.id, cell])));
const finite = $derived(
  points.map((point) => geoValue(point.value)).filter((value): value is number => value !== null)
);
const range = $derived(extent(finite));
const min = $derived(range ? range[0] : 0);
const max = $derived(range ? range[1] : 0);
const positioned = $derived(
  points.flatMap((point) => {
    const cell = byId.get(point.regionId);
    if (!cell) return [];
    const xOffset = clampGeoOffset(point.offset?.x);
    const yOffset = clampGeoOffset(point.offset?.y);
    const value = geoValue(point.value);
    const ratio = value === null || max === min ? 0.5 : (value - min) / (max - min);
    return [
      {
        ...point,
        value,
        x: cell.x + cell.size * (0.5 + xOffset),
        y: cell.y + cell.size * (0.5 + yOffset),
        radius: 4 + Math.max(0, Math.min(1, ratio)) * 8,
        regionLabel: cell.label,
      },
    ];
  })
);
const rows = $derived(
  points.map((point) => ({
    id: point.id,
    label: point.label,
    location: byId.get(point.regionId)?.label ?? tableLabels.noData,
    value: geoValue(point.value),
  }))
);
</script>

<figure class="geo-chart">
  <figcaption>
    <h3>{title}</h3>
    <p>{description}</p>
  </figcaption>
  <svg direction="ltr" class="map" viewBox="0 0 {width} {height}" role="img" aria-labelledby="{uid}-title {uid}-description">
    <title id="{uid}-title">{title}</title>
    <desc id="{uid}-description">{description}</desc>
    {#each cells as cell (cell.id)}
      <rect data-region={cell.id} x={cell.x} y={cell.y} width={cell.size} height={cell.size} rx="4" fill="var(--tx-muted, Canvas)" stroke="var(--tx-border, CanvasText)" stroke-dasharray="3 2" aria-hidden="true">
        <title>{cell.label}</title>
      </rect>
    {/each}
    {#each positioned as point (point.id)}
      <circle data-point={point.id} cx={point.x} cy={point.y} r={point.radius} fill="var(--tx-chart-1, var(--tx-primary, Highlight))" stroke="var(--tx-background, Canvas)" stroke-width="2" aria-hidden="true">
        <title>{point.label}: {point.value === null ? tableLabels.noData : point.value} ({point.regionLabel})</title>
      </circle>
    {/each}
  </svg>
  <GeoDataTable {title} labels={tableLabels} {rows} pointRows />
</figure>

<style>
  .geo-chart { color: var(--tx-foreground, CanvasText); margin: 0; max-inline-size: 100%; }
  figcaption h3 { font-size: 1rem; margin-block: 0; }
  figcaption p { color: var(--tx-muted-foreground, CanvasText); margin-block: 0.25rem 0.75rem; }
  .map { display: block; inline-size: 100%; max-block-size: 24rem; }
  @media (forced-colors: active) { [data-region] { fill: Canvas; stroke: CanvasText; } [data-point] { fill: Highlight; stroke: Canvas; } }
  @media (forced-colors: active) {
    figcaption h3, figcaption p { color: CanvasText; }
  }
</style>
