<script lang="ts">
import GeoDataTable from './GeoDataTable.svelte';
import {
  GEO_TABLE_LABELS,
  type GeoTableLabels,
  type GeoTile,
  geoCells,
  geoColor,
  geoColorIndex,
  geoValue,
  WORLD_TILES,
} from './model.ts';

type Props = {
  title: string;
  description: string;
  data: Readonly<Record<string, number | null>>;
  shape?: readonly GeoTile[];
  labels?: Partial<GeoTableLabels>;
  width?: number;
  height?: number;
};

let {
  title,
  description,
  data,
  shape = WORLD_TILES,
  labels,
  width = 560,
  height = 320,
}: Props = $props();
const uid = $props.id();
const tableLabels = $derived({ ...GEO_TABLE_LABELS, ...labels });
const cells = $derived(geoCells(shape, width, height));
const values = $derived(shape.map((tile) => geoValue(data[tile.id])));
const rows = $derived(
  shape.map((tile) => ({ id: tile.id, label: tile.label, value: geoValue(data[tile.id]) }))
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
      {@const value = geoValue(data[cell.id])}
      {@const color = geoColorIndex(value, values)}
      <g data-region={cell.id}>
        <rect
          x={cell.x}
          y={cell.y}
          width={cell.size}
          height={cell.size}
          rx="4"
          fill={color === null ? 'var(--tx-muted, GrayText)' : geoColor(color)}
          stroke="var(--tx-background, Canvas)"
          stroke-width="2"
          stroke-dasharray={color === null ? '3 2' : undefined}
          aria-hidden="true"
        />
        <title>{cell.label}: {value === null ? tableLabels.noData : value}</title>
      </g>
    {/each}
  </svg>
  <div class="legend" role="img" aria-label="{tableLabels.low} to {tableLabels.high}">
    <span>{tableLabels.low}</span>
    <ol aria-hidden="true">
      {#each Array.from({ length: 9 }, (_, index) => index) as index (index)}
        <li class="step-{index}"></li>
      {/each}
    </ol>
    <span>{tableLabels.high}</span>
  </div>
  <GeoDataTable {title} labels={tableLabels} {rows} />
</figure>

<style>
  .geo-chart { color: var(--tx-foreground, CanvasText); margin: 0; max-inline-size: 100%; }
  figcaption h3 { font-size: 1rem; margin-block: 0; }
  figcaption p { color: var(--tx-muted-foreground, CanvasText); margin-block: 0.25rem 0.75rem; }
  .map { display: block; inline-size: 100%; max-block-size: 24rem; }
  .legend { align-items: center; display: flex; font-size: 0.75rem; gap: 0.5rem; justify-content: center; }
  .legend ol { display: flex; gap: 0.15rem; list-style: none; margin: 0; padding: 0; }
  .legend li { background: var(--tx-chart-sequential-1, color-mix(in oklab, var(--tx-chart-1, var(--tx-primary, CanvasText)) 18%, var(--tx-background, Canvas))); block-size: 0.7rem; inline-size: 1.1rem; }
  .legend .step-1 { background: var(--tx-chart-sequential-2, color-mix(in oklab, var(--tx-chart-1, var(--tx-primary, CanvasText)) 28%, var(--tx-background, Canvas))); }
  .legend .step-2 { background: var(--tx-chart-sequential-3, color-mix(in oklab, var(--tx-chart-1, var(--tx-primary, CanvasText)) 38%, var(--tx-background, Canvas))); }
  .legend .step-3 { background: var(--tx-chart-sequential-4, color-mix(in oklab, var(--tx-chart-1, var(--tx-primary, CanvasText)) 48%, var(--tx-background, Canvas))); }
  .legend .step-4 { background: var(--tx-chart-sequential-5, color-mix(in oklab, var(--tx-chart-1, var(--tx-primary, CanvasText)) 58%, var(--tx-background, Canvas))); }
  .legend .step-5 { background: var(--tx-chart-sequential-6, color-mix(in oklab, var(--tx-chart-1, var(--tx-primary, CanvasText)) 68%, var(--tx-background, Canvas))); }
  .legend .step-6 { background: var(--tx-chart-sequential-7, color-mix(in oklab, var(--tx-chart-1, var(--tx-primary, CanvasText)) 78%, var(--tx-background, Canvas))); }
  .legend .step-7 { background: var(--tx-chart-sequential-8, color-mix(in oklab, var(--tx-chart-1, var(--tx-primary, CanvasText)) 88%, var(--tx-background, Canvas))); }
  .legend .step-8 { background: var(--tx-chart-sequential-9, color-mix(in oklab, var(--tx-chart-1, var(--tx-primary, CanvasText)) 98%, var(--tx-background, Canvas))); }
  @media (forced-colors: active) { rect { fill: Canvas; stroke: CanvasText; } .legend li { background: Canvas; border: 1px solid CanvasText; } }
  @media (forced-colors: active) {
    figcaption h3, figcaption p { color: CanvasText; }
  }
</style>
