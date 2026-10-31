<script lang="ts">
/**
 * Print view for deck model v2 without the default renderer tables (G105):
 * `DeckPrintView` with nothing behind `defaultRenderers` unless the host
 * hands it a `defaults` source, so a host that brings every renderer itself
 * (a `DeckStageCore` host) never references the catalog layouts or the
 * component registry, and its build emits none of their chunks or CSS.
 * Pages, notes, `data-print-ready` and every other prop behave as in
 * `DeckPrintView`. The body loads on first use;
 * `preloadDeckPrintViewCore()` warms it.
 */
import type { Component } from 'svelte';
import { loadDeckPrintBody, loadedDeckPrintBody } from './print-preload-core.ts';
import type { DeckPrintViewCoreProps } from './print-types.ts';

let props: DeckPrintViewCoreProps = $props();
// After a preload (or an earlier view) the body renders on the first render.
let Body = $state.raw<Component<DeckPrintViewCoreProps> | null>(loadedDeckPrintBody() ?? null);

$effect(() => {
  if (Body) return;
  let live = true;
  loadDeckPrintBody().then(
    (loaded) => {
      if (live) Body = loaded;
    },
    (error: unknown) => {
      if (live) props.onError?.(error);
    }
  );
  return () => {
    live = false;
  };
});
</script>

{#if Body}
  <Body {...props} />
{/if}
