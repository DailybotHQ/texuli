<script lang="ts">
/**
 * Print view for deck model v2: one page per visible slide at the deck's
 * canvas size (a named `@page`), every reveal step shown, optional notes
 * pages, hidden slides skipped, and `data-print-ready="true"` once fonts,
 * images and the slide renderers have settled. See `DeckPrintViewProps`.
 *
 * This wrapper loads the view's body on first use, so importing
 * `@texuli/slides/export` for PPTX or the print plan costs no print code.
 */
import type { Component } from 'svelte';
import type { DeckPrintViewProps } from './print-types.ts';

let props: DeckPrintViewProps = $props();
let Body = $state.raw<Component<DeckPrintViewProps> | null>(null);

$effect(() => {
  let live = true;
  import('./DeckPrintPages.svelte').then(
    (module) => {
      if (live) Body = module.default;
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
