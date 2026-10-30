<script lang="ts">
import type { Component } from 'svelte';
import { setDesignDefaults } from '../../src/defaults/index.ts';
import type { DesignDefaults } from '../../src/defaults/vocabulary.ts';
import Inner from './DesignDefaultsInner.svelte';

interface Props {
  /** The component under test. */
  // biome-ignore lint/suspicious/noExplicitAny: any styled component
  component: Component<any>;
  props?: Record<string, unknown>;
  /** Omit to render without a provider. */
  defaults?: DesignDefaults;
  /** A second, nested provider (inner wins). */
  inner?: DesignDefaults;
}

let { component, props = {}, defaults, inner }: Props = $props();
// Mount-time choice: with or without a provider (the defaults stay reactive).
// svelte-ignore state_referenced_locally
if (defaults) setDesignDefaults(() => defaults ?? {});
const Target = $derived(component);
</script>

{#if inner}
  <Inner {inner} {component} {props} />
{:else}
  <Target {...props} />
{/if}
