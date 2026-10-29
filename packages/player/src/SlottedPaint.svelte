<script lang="ts">
import type { Component, Snippet } from 'svelte';
import type { PlayerNodeError } from './errors.ts';
import PlayerNode from './PlayerNode.svelte';
import Self from './SlottedPaint.svelte';
import type { SlotGroups } from './slots.ts';

/**
 * Mounts a painted component with one snippet prop per named slot (audit
 * G04). Svelte snippets are declared in templates, so each level of this
 * component declares the snippet for one slot name and hands the rest on;
 * the last level mounts the component. Depth is the number of named slots
 * the parent's manifest declares.
 */
let {
  component,
  props,
  slots,
  remaining,
  snippets = {},
  onNodeError,
}: {
  component: Component<Record<string, unknown>>;
  props: Readonly<Record<string, unknown>>;
  slots: SlotGroups;
  remaining: readonly string[];
  snippets?: Readonly<Record<string, Snippet>>;
  onNodeError?: (error: PlayerNodeError) => void;
} = $props();

const name = $derived(remaining[0]);
</script>

{#snippet slotted()}
  {#each slots.groups[name ?? ''] ?? [] as child (child.path)}
    <PlayerNode node={child} {onNodeError} />
  {/each}
{/snippet}

{#if name !== undefined}
  <Self
    {component}
    {props}
    {slots}
    remaining={remaining.slice(1)}
    snippets={{ ...snippets, [name]: slotted }}
    {onNodeError}
  />
{:else}
  {@const Painted = component}
  <Painted {...props} {...snippets}>
    {#snippet children()}
      {#each slots.defaults as child (child.path)}
        <PlayerNode node={child} {onNodeError} />
      {/each}
    {/snippet}
  </Painted>
{/if}
