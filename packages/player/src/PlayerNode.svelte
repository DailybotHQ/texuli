<script lang="ts">
import type { Component } from 'svelte';
import { getPlayerLabels, getPlayerSources } from './context.ts';
import type { PlayerNodeError } from './errors.ts';
import { isContentLayoutId } from './layouts/outline.ts';
import MotionFrame from './motion/MotionFrame.svelte';
import NodePlaceholder from './NodePlaceholder.svelte';
import Self from './PlayerNode.svelte';
import SlottedPaint from './SlottedPaint.svelte';
import { groupSlots } from './slots.ts';
import SourceFrame from './sources/SourceFrame.svelte';
import type { PlayerPaintNode } from './types.ts';

let {
  node,
  onNodeError,
}: { node: PlayerPaintNode; onNodeError?: (error: PlayerNodeError) => void } = $props();

const labels = getPlayerLabels();
// Spec 0.8.0: a node reading a host data source paints inside its source frame.
const sources = getPlayerSources();
const sourceBound = $derived(node.kind === 'component' && sources?.status(node.path) != null);

/** The bound node's name for its loading and error messages. */
function sourceLabel(props: Readonly<Record<string, unknown>>, id: string): string {
  for (const key of ['caption', 'label', 'title']) {
    const value = props[key];
    if (typeof value === 'string' && value.trim() !== '') return value;
  }
  return id;
}
// Named slots (audit G04): most nodes have none and paint on the direct path.
const slots = $derived(node.kind === 'component' ? groupSlots(node.children) : null);

function onBoundaryError(error: unknown): void {
  onNodeError?.({ code: 'node-error', id: node.id, path: node.path, phase: 'render', error });
}
</script>

{#if node.kind === 'placeholder'}
  <NodePlaceholder id={node.id} path={node.path} label={node.label} reason={node.reason} />
{:else if node.kind === 'skeleton' && node.stream !== undefined && node.stream !== 'pending'}
  <!-- A streamed node held until the final verdict, or never finished: static, not busy. -->
  <div
    class="tx-player__skeleton tx-player__stream-node"
    data-family={node.family}
    data-tx-player-stream-node={node.stream}
    data-tx-player-path={node.path}
    role="note"
  >
    <span class="tx-player__stream-node-label">
      {node.stream === 'held' ? labels().streamHeld : labels().streamIncomplete}
    </span>
  </div>
{:else if node.kind === 'skeleton'}
  <div
    class="tx-player__skeleton"
    data-family={node.family}
    data-tx-player-skeleton={node.id}
    data-tx-player-stream-node={node.stream}
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
              <Self node={child} {onNodeError} />
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
  {#snippet framed()}
    {#if node.frame?.anchor}
      <!-- A contents link focuses this generated anchor; the heading inside is the section start. -->
      <div class="tx-player__anchor" id={node.frame.frameId} tabindex="-1" data-tx-player-anchor>
        {@render painted()}
      </div>
    {:else}
      {@render painted()}
    {/if}
  {/snippet}
  {#snippet sourced()}
    {#if sourceBound}
      <SourceFrame path={node.path} label={sourceLabel(node.props, node.id)}>
        {@render framed()}
      </SourceFrame>
    {:else}
      {@render framed()}
    {/if}
  {/snippet}
  {#if node.motion}
    <!-- Spec 0.6.0 motion: a box-less wrapper the motion runtime animates. -->
    <MotionFrame
      motion={node.motion}
      path={node.path}
      delay={node.motionDelay}
      leaving={node.leaving === true}
    >
      {@render sourced()}
    </MotionFrame>
  {:else}
    {@render sourced()}
  {/if}
{/if}
