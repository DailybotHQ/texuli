<script lang="ts" generics="P extends Record<string, unknown>">
/**
 * Paints one renderer entry: a component at once, or a lazy one after its
 * import (a polite loading status meanwhile, an alert if the import fails).
 * Already-loaded lazy entries paint on the first render, so revisiting a
 * slide never announces "loading" again.
 */
import type { Component } from 'svelte';
import type { DeckTranslate } from './messages.ts';
import { type DeckRendererEntry, loadRenderer, readyRenderer } from './renderers.ts';

interface Props {
  entry: DeckRendererEntry<P>;
  props: P;
  t: DeckTranslate;
}

let { entry, props, t }: Props = $props();

// svelte-ignore state_referenced_locally
let Loaded = $state<Component<P> | null>(readyRenderer(entry) ?? null);
let failed = $state(false);

$effect(() => {
  const current = entry;
  const ready = readyRenderer(current);
  failed = false;
  Loaded = ready ?? null;
  if (ready) return;
  let live = true;
  loadRenderer(current).then(
    (component) => {
      if (live) Loaded = component;
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

{#if Loaded}
  {@const Renderer = Loaded}
  <Renderer {...props} />
{:else if failed}
  <p class="tx-deck-stage__error" role="alert">{t('layout.contentLoadError')}</p>
{:else}
  <p class="tx-deck-stage__loading" role="status">{t('layout.contentLoading')}</p>
{/if}
