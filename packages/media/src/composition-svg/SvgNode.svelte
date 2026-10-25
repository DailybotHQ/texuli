<svelte:options namespace="svg" />


<script lang="ts">
import Self from './SvgNode.svelte';
import type { SvgChild } from './types.ts';

let { node }: { node: SvgChild } = $props();
</script>

{#if typeof node === 'string'}
  {node}
{:else if node.children && node.children.length > 0}
  <svelte:element this={node.tag} {...node.attrs}>
    {#each node.children as child, i (i)}
      <Self node={child} />
    {/each}
  </svelte:element>
{:else}
  <svelte:element this={node.tag} {...node.attrs} />
{/if}
