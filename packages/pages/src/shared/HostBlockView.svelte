<script lang="ts">
// A node painted by the host's block renderer: the `renderBlock` snippet,
// the `blockHost` component or its `present` mount, handed a frozen copy.
// A renderer that throws shows the refused notice instead.
import type { PagesBlockPainter, PagesHostNode } from './block-host.ts';

let {
  node,
  painter,
  refusedLabel,
}: { node: PagesHostNode; painter: PagesBlockPainter; refusedLabel: string } = $props();

let target = $state<HTMLElement | null>(null);
let threw = $state(false);
const Painted = $derived(painter.render ? null : (painter.host?.component ?? null));
const present = $derived(painter.render || Painted ? null : (painter.host?.present ?? null));

$effect(() => {
  const element = target;
  const mount = present;
  const value = node;
  if (!element || !mount) return;
  threw = false;
  let cleanup: undefined | (() => void);
  try {
    cleanup = mount({ node: value, target: element });
  } catch {
    threw = true;
  }
  return () => {
    try {
      cleanup?.();
    } catch {
      // A host cleanup that throws leaves nothing of ours behind.
    }
    element.replaceChildren();
  };
});
</script>

<div
  class="tx-pages-host-block"
  data-tx-pages-host=""
  data-block-type={node.type === 'block' ? node.block : node.kind}
>
  <svelte:boundary>
    {#if threw}
      <p class="tx-pages-notice" role="note" data-refused="">{refusedLabel}</p>
    {:else if painter.render}
      {@render painter.render(node)}
    {:else if Painted}
      <Painted {node} />
    {:else if present}
      <div class="tx-pages-host-block__mount" bind:this={target}></div>
    {/if}
    {#snippet failed()}
      <p class="tx-pages-notice" role="note" data-refused="">{refusedLabel}</p>
    {/snippet}
  </svelte:boundary>
</div>
