<script lang="ts">
import type { Snippet } from 'svelte';
import { tooltipPosition } from './model.ts';
import './interaction.css';

let {
  anchor,
  bounds,
  children,
}: {
  /** The point the tooltip describes, in the plot's pixel space. */
  anchor: { x: number; y: number };
  bounds: { width: number; height: number };
  children: Snippet;
} = $props();

let width = $state(0);
let height = $state(0);
const box = $derived(tooltipPosition(anchor, { width, height }, bounds));
// Physical offsets on purpose: `box` is in the plot's pixel space, which stays
// left-to-right under dir="rtl" (the SVG declares direction="ltr").
const tipStyle = $derived(`left: ${box.left}px; top: ${box.top}px`);
</script>

<!-- Hidden from assistive tech: the plot's live region already announces the same text. -->
<div
  aria-hidden="true"
  data-chart-tooltip=""
  class="tx-chart-tooltip"
  style={tipStyle}
  bind:offsetWidth={width}
  bind:offsetHeight={height}
>
  {@render children()}
</div>
