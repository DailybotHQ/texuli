<script lang="ts">
/**
 * Picks the live demo island for one chart family id.
 */

import CanvasDemo from './demos/CanvasDemo.svelte';
import CartesianDemo from './demos/CartesianDemo.svelte';
import CompactDemo from './demos/CompactDemo.svelte';
import FlowDemo from './demos/FlowDemo.svelte';
import GeoDemo from './demos/GeoDemo.svelte';
import InteractionDemo from './demos/InteractionDemo.svelte';
import MatrixDemo from './demos/MatrixDemo.svelte';
import PartWholeDemo from './demos/PartWholeDemo.svelte';
import type { ChartFamilyId } from './families.ts';

type Props = {
  id: ChartFamilyId;
};

let { id }: Props = $props();
</script>

{#if id === 'cartesian'}
  <CartesianDemo />
{:else if id === 'part-whole'}
  <PartWholeDemo />
{:else if id === 'compact'}
  <CompactDemo />
{:else if id === 'matrix'}
  <MatrixDemo />
{:else if id === 'flow'}
  <FlowDemo />
{:else if id === 'geo'}
  <GeoDemo />
{:else if id === 'interaction'}
  <InteractionDemo />
{:else if id === 'canvas'}
  <CanvasDemo />
{/if}
