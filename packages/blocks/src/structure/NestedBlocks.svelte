<script lang="ts">
import type { Component } from 'svelte';
import type { Block } from '../core/index.ts';
import type { StructureBlockLabels } from './labels.ts';

/**
 * Nested child blocks inside columns or tab panels. Dynamically imports the
 * matching family renderer so the structure chunk can finish loading without a
 * hard cycle through every other family.
 */
let {
  blocks,
  labels,
}: {
  blocks: readonly Block[];
  labels: StructureBlockLabels;
} = $props();

const TEXT_TYPES = new Set(['heading', 'text', 'list', 'quote', 'callout']);
const STRUCTURE_TYPES = new Set([
  'columns',
  'grid',
  'tabs',
  'accordion',
  'cards',
  'divider',
  'cta',
]);

type View = Component<{ block: unknown; labels?: unknown; oninvalid?: unknown }>;

async function loadView(type: string): Promise<View | null> {
  if (TEXT_TYPES.has(type)) {
    const mod = await import('../text/TextBlockView.svelte');
    return mod.default as View;
  }
  if (STRUCTURE_TYPES.has(type)) {
    const mod = await import('./StructureFamily.svelte');
    return mod.default as View;
  }
  return null;
}
</script>

{#if blocks.length === 0}
  <p class="tx-structure-empty" role="note">{labels.emptyPanel}</p>
{:else}
  <div class="tx-structure-nested">
    {#each blocks as child, i (i)}
      {#await loadView(child.type)}
        <p class="tx-structure-loading" role="status">…</p>
      {:then View}
        {#if View}
          <View block={child} />
        {:else}
          <p class="tx-structure-empty" role="note" data-tx-nested-unsupported={child.type}>
            {labels.invalid}
          </p>
        {/if}
      {:catch}
        <p class="tx-structure-empty" role="note">{labels.invalid}</p>
      {/await}
    {/each}
  </div>
{/if}
