<script lang="ts">
// One block list (the page, a callout, a toggle, a quote or a column) as a
// sortable list of the drag engine. Inserts, removes and reorders glide on
// the shared motion runtime (FLIP), instant under reduced motion.
import type { DocumentBlock, DocumentBlockId } from '@texuli/document/model';
import { Sortable } from '@texuli/primitives/sortable';
import { untrack } from 'svelte';
import { createListMotion } from 'texuli/motion';
import BlockRow from './BlockRow.svelte';
import { getPagesContext } from './context.ts';
import { listOfParent } from './moves.ts';

let {
  parent,
  blocks,
  label,
}: { parent: DocumentBlockId | null; blocks: readonly DocumentBlock[]; label: string } = $props();

const context = getPagesContext();
let list = $state<HTMLElement | null>(null);

const motion = createListMotion({
  motion: () => context.motion(),
  defaults: { layout: true, duration: 'fast' },
  items: () =>
    Array.from(list?.children ?? [])
      .filter((element) => element.hasAttribute('data-sortable-item'))
      .map((element) => [element.getAttribute('data-sortable-item') ?? '', element] as const),
});
$effect.pre(() => {
  void blocks;
  untrack(() => motion.measure());
});
$effect(() => {
  void blocks;
  untrack(() => motion.play());
});
</script>

<Sortable.List id={listOfParent(parent)} as="div" role="group" {label} class="tx-pages-list" bind:ref={list} data-parent={parent ?? undefined}>
  {#snippet children()}
    {#each blocks as block (block.id)}
      <BlockRow {block} {parent} />
    {/each}
  {/snippet}
</Sortable.List>
