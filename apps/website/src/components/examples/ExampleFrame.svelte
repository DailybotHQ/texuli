<script lang="ts">
/**
 * Framed preview chrome: light/dark and LTR/RTL toggles.
 * Children receive mode/dir via the snippet arguments so an iframe can rebuild
 * its src without nesting the demo in the docs shell.
 */

import type { Snippet } from 'svelte';
import { ToggleGroup, ToggleGroupItem } from 'texuli/toggle';

type Props = {
  title: string;
  label?: string;
  children?: Snippet<[{ mode: 'light' | 'dark'; dir: 'ltr' | 'rtl' }]>;
};

let { title, label = 'Example', children }: Props = $props();

let mode = $state<'light' | 'dark'>('light');
let rtl = $state(false);
const dir = $derived(rtl ? 'rtl' : 'ltr');

function onMode(next: string | string[]): void {
  if (next === 'light' || next === 'dark') mode = next;
}

function onDir(next: string | string[]): void {
  if (next === 'ltr') rtl = false;
  if (next === 'rtl') rtl = true;
}
</script>

<section class="frame" data-tx-example-frame data-tx-mode={mode} dir={dir} aria-label={`${label}: ${title}`}>
  <header class="frame__bar">
    <span class="frame__title">{title}</span>
    <div class="frame__controls">
      <ToggleGroup
        type="single"
        value={mode}
        onValueChange={onMode}
        variant="outline"
        size="md"
        aria-label={`${title} color mode`}
      >
        <ToggleGroupItem value="light">Light</ToggleGroupItem>
        <ToggleGroupItem value="dark">Dark</ToggleGroupItem>
      </ToggleGroup>
      <ToggleGroup
        type="single"
        value={dir}
        onValueChange={onDir}
        variant="outline"
        size="md"
        aria-label={`${title} text direction`}
      >
        <ToggleGroupItem value="ltr">LTR</ToggleGroupItem>
        <ToggleGroupItem value="rtl">RTL</ToggleGroupItem>
      </ToggleGroup>
    </div>
  </header>
  <div class="frame__stage" data-tx-example-stage data-mode={mode} data-rtl={rtl ? 'true' : 'false'}>
    {#if children}
      {@render children({ mode, dir })}
    {/if}
  </div>
</section>

<style>
  .frame {
    display: grid;
    border: 1px solid var(--tx-border);
    border-radius: var(--tx-radius, 0.5rem);
    background: var(--tx-background);
    color: var(--tx-foreground);
    overflow: hidden;
  }
  .frame__bar {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem 1rem;
    padding: 0.5rem 0.75rem;
    border-block-end: 1px solid var(--tx-border);
    background: var(--tx-surface, var(--tx-muted));
    scroll-margin-block-start: 5.5rem;
  }
  .frame__title {
    font-weight: 600;
    font-size: 0.875rem;
  }
  .frame__controls {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
  }
  .frame__controls :global(.tx-toggle) {
    min-block-size: 1.5rem;
    min-inline-size: 1.5rem;
  }
  .frame__stage {
    padding: 0;
    min-block-size: 8rem;
    background: var(--tx-background);
    color: var(--tx-foreground);
  }
</style>
