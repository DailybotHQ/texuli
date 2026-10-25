<script lang="ts">
import type { Component } from 'svelte';
import { getPlayerLabels } from './context.ts';
import type { PlayerNodeError } from './errors.ts';
import { isContentLayoutId } from './layouts/outline.ts';
import NodePlaceholder from './NodePlaceholder.svelte';
import PlayerNode from './PlayerNode.svelte';
import SlottedPaint from './SlottedPaint.svelte';
import { groupSlots } from './slots.ts';
import type { PlayerPaintNode } from './types.ts';

let {
  node,
  onNodeError,
}: { node: PlayerPaintNode; onNodeError?: (error: PlayerNodeError) => void } = $props();

const labels = getPlayerLabels();
// Named slots (audit G04): most nodes have none and paint on the direct path.
const slots = $derived(node.kind === 'component' ? groupSlots(node.children) : null);

function onBoundaryError(error: unknown): void {
  onNodeError?.({ code: 'node-error', id: node.id, path: node.path, phase: 'render', error });
}
</script>

{#if node.kind === 'placeholder'}
  <NodePlaceholder id={node.id} path={node.path} label={node.label} reason={node.reason} />
{:else if node.kind === 'skeleton'}
  <div
    class="tx-player__skeleton"
    data-family={node.family}
    data-tx-player-skeleton={node.id}
    aria-busy="true"
    inert
  >
    <span class="tx-player__visually-hidden">{labels().loading} {node.label}…</span>
    <span class="tx-player__skeleton-shape" aria-hidden="true"></span>
    <span class="tx-player__skeleton-shape" aria-hidden="true"></span>
  </div>
{:else}
  {#snippet painted()}
    <svelte:boundary onerror={onBoundaryError}>
      {@const Component = node.component as Component<Record<string, unknown>>}
      {@const layoutProps = isContentLayoutId(node.id) ? { variant: node.id, txFrame: node.frame } : {}}
      {#if slots && slots.names.length > 0}
        <SlottedPaint
          component={Component}
          props={{ ...node.props, ...layoutProps }}
          {slots}
          remaining={slots.names}
          {onNodeError}
        />
      {:else}
        <Component {...node.props} {...layoutProps}>
          {#snippet children()}
            {#each node.children as child (child.path)}
              <PlayerNode node={child} {onNodeError} />
            {/each}
          {/snippet}
        </Component>
      {/if}
      {#snippet failed()}
        <NodePlaceholder
          id={node.id}
          path={node.path}
          label={`“${node.id}” could not be shown`}
          reason="node-error"
        />
      {/snippet}
    </svelte:boundary>
  {/snippet}
  {#if node.frame?.anchor}
    <!-- A contents link focuses this generated anchor; the heading inside is the section start. -->
    <div class="tx-player__anchor" id={node.frame.frameId} tabindex="-1" data-tx-player-anchor>
      {@render painted()}
    </div>
  {:else}
    {@render painted()}
  {/if}
{/if}
