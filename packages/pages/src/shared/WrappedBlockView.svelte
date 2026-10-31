<script lang="ts">
// A wrapped `@texuli/blocks` block, painted by its family's renderer. The
// renderer validates the props itself (the second validation phase of
// ADR-011) and shows an inert notice when they do not pass; the family
// loads on first use.
import type { WrappedBlock } from '@texuli/document/model';
import type { Component } from 'svelte';
import { wrappedBlockInput } from './embeds.ts';
import { loadBlockFamily } from './families.ts';

let {
  node,
  refusedLabel,
  loadingLabel,
  onrefused,
}: {
  node: WrappedBlock;
  refusedLabel: string;
  loadingLabel: string;
  /** The renderer refused the block: a host takes it over (no notice shows). */
  onrefused?: (() => void) | undefined;
} = $props();

let view = $state.raw<Component<{
  block: unknown;
  oninvalid?: (issues: unknown[]) => void;
}> | null>(null);
let failed = $state(false);
let invalidFor = $state.raw<unknown>(null);
const input = $derived(wrappedBlockInput(node));
const invalid = $derived(invalidFor !== null && invalidFor === input);
const handOff = $derived((invalid || failed) && onrefused !== undefined);

$effect(() => {
  if (handOff) onrefused?.();
});

$effect(() => {
  const family = node.family;
  let live = true;
  view = null;
  failed = false;
  loadBlockFamily(family).then(
    (component) => {
      if (live) view = component;
    },
    () => {
      if (live) failed = true;
    }
  );
  return () => {
    live = false;
  };
});
</script>

<div class="tx-pages-wrapped" data-family={node.family} data-block-type={node.block} data-refused={invalid || failed ? '' : undefined}>
  {#if handOff}
    <p class="tx-pages-loading" aria-busy="true">{loadingLabel}</p>
  {:else if failed}
    <p class="tx-pages-notice" role="note">{refusedLabel}</p>
  {:else if view}
    {@const View = view}
    <View block={input} oninvalid={() => (invalidFor = input)} />
  {:else}
    <p class="tx-pages-loading" aria-busy="true">{loadingLabel}</p>
  {/if}
</div>
