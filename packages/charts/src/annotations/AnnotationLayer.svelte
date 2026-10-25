<script lang="ts">
import type { Rect } from '../math/types.ts';
import type { RenderedAnnotation } from './model.ts';

let {
  annotations,
  plot,
}: {
  annotations: readonly RenderedAnnotation[];
  plot: Rect;
} = $props();
</script>

<g aria-hidden="true" data-chart-annotations="">
  {#each annotations as annotation (annotation.id)}
    {#if annotation.type === 'line'}
      <line
        data-annotation={annotation.id}
        data-annotation-type="line"
        x1={annotation.axis === 'x' ? annotation.position : plot.x}
        x2={annotation.axis === 'x' ? annotation.position : plot.x + plot.width}
        y1={annotation.axis === 'y' ? annotation.position : plot.y}
        y2={annotation.axis === 'y' ? annotation.position : plot.y + plot.height}
        stroke={annotation.color ?? 'var(--tx-chart-annotation, var(--tx-primary, currentColor))'}
        class="tx-chart-annotation-line"
      >
        <title>{annotation.label}</title>
      </line>
    {:else if annotation.type === 'band'}
      <rect
        data-annotation={annotation.id}
        data-annotation-type="band"
        x={annotation.axis === 'x' ? annotation.start : plot.x}
        y={annotation.axis === 'y' ? annotation.start : plot.y}
        width={annotation.axis === 'x' ? annotation.end - annotation.start : plot.width}
        height={annotation.axis === 'y' ? annotation.end - annotation.start : plot.height}
        fill={annotation.color ?? 'var(--tx-chart-annotation-fill, color-mix(in srgb, var(--tx-primary, Highlight) 14%, transparent))'}
        class="tx-chart-annotation-band"
      >
        <title>{annotation.label}</title>
      </rect>
    {:else}
      <circle
        data-annotation={annotation.id}
        data-annotation-type="point"
        cx={annotation.x}
        cy={annotation.y}
        r="5"
        fill={annotation.color ?? 'var(--tx-chart-annotation, var(--tx-primary, currentColor))'}
        class="tx-chart-annotation-point"
      >
        <title>{annotation.label}</title>
      </circle>
    {/if}
  {/each}
</g>

<style>
  .tx-chart-annotation-line {
    stroke-width: 1.5;
    stroke-dasharray: 5 4;
    vector-effect: non-scaling-stroke;
  }

  .tx-chart-annotation-band {
    stroke: none;
  }

  .tx-chart-annotation-point {
    stroke: var(--tx-surface, Canvas);
    stroke-width: 2;
    vector-effect: non-scaling-stroke;
  }

  @media (forced-colors: active) {
    .tx-chart-annotation-line,
    .tx-chart-annotation-point {
      stroke: Highlight;
    }

    .tx-chart-annotation-band {
      fill: Highlight;
      fill-opacity: 0.2;
    }
  }
</style>
