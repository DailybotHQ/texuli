<script lang="ts">
import { DashboardWidget } from '@texuli/data/dashboard';
import type { Snippet } from 'svelte';

/**
 * `data-dashboard-widget` (spec 0.8.0): one widget of the enclosing
 * `data-dashboard`, keyed by `widgetId`; `place` is where it starts on the
 * widest grid. Its children are ordinary catalog nodes.
 */
interface Place {
  x?: number;
  y?: number;
  w?: number;
  h?: number;
  minW?: number;
  minH?: number;
  maxW?: number;
  maxH?: number;
  locked?: boolean;
}

let {
  widgetId,
  title,
  place,
  children,
}: { widgetId: string; title: string; place?: Place; children?: Snippet } = $props();

const at = $derived<Place>(place && typeof place === 'object' ? place : {});
</script>

<DashboardWidget
  id={widgetId}
  {title}
  x={at.x}
  y={at.y}
  w={at.w}
  h={at.h}
  minW={at.minW}
  minH={at.minH}
  maxW={at.maxW}
  maxH={at.maxH}
  locked={at.locked === true}
>
  {@render children?.()}
</DashboardWidget>
