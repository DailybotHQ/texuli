<script lang="ts">
/**
 * Print view for deck model v2: one page per visible slide at the deck's
 * canvas size (a named `@page`), every reveal step shown, optional notes
 * pages, hidden slides skipped, and `data-print-ready="true"` once fonts,
 * images and the slide renderers have settled. See `DeckPrintViewProps`.
 *
 * This wrapper loads the view's body on first use, so importing
 * `@texuli/slides/export` for PPTX or the print plan costs no print code;
 * `preloadDeckPrintView()` warms it (G81).
 */
import type { Component } from 'svelte';
import { loadDeckPrintBody, loadedDeckPrintBody } from './print-preload.ts';
import type { DeckPrintViewProps } from './print-types.ts';

let props: DeckPrintViewProps = $props();
// After `preloadDeckPrintView()` (or an earlier view) the body renders on the first render.
let Body = $state.raw<Component<DeckPrintViewProps> | null>(loadedDeckPrintBody() ?? null);

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
