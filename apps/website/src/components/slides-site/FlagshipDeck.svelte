<script lang="ts">
/**
 * The flagship: `texuli-create-anything` (25 fictional slides) on the v2
 * stage at the untrusted tier. It owns the page's URL hash (`#/<slide>/<step>`
 * deep links), and the stage chrome brings fullscreen, the presenter view,
 * blackout, the laser pointer, the help dialog and the overview.
 *
 * The print route: the stage's print action opens `?print=1#/<slide>` in a
 * new tab, and on that route this island paints every slide as pages with
 * `DeckPrintView` and opens the browser's print dialog once they are ready.
 * The export bar downloads the deck as PPTX, built in the browser by the
 * dependency-free writer (imported on first use).
 */
import '@texuli/slides/styles.css';
import '@texuli/player/styles.css';
import { DeckStage, prepareDeck } from '@texuli/slides/stage';
import type { Component } from 'svelte';
import { onMount } from 'svelte';
import { FLAGSHIP_ID, flagshipDeck } from './flagship.ts';

const input = flagshipDeck();
const prepared = prepareDeck(input);

let printing = $state(false);
let PrintView = $state<Component<Record<string, unknown>> | null>(null);
let status = $state('');
let busy = $state(false);

onMount(() => {
  if (new URLSearchParams(window.location.search).get('print') !== '1') return;
  printing = true;
  void import('@texuli/slides/export').then((module) => {
    PrintView = module.DeckPrintView as unknown as Component<Record<string, unknown>>;
  });
});

async function downloadPptx() {
  if (!prepared.ok || busy) return;
  busy = true;
  status = 'Building the PPTX file…';
  try {
    const { exportDeckPptx } = await import('@texuli/slides/export');
    const result = await exportDeckPptx(prepared.deck, { notes: true });
    const url = URL.createObjectURL(result.blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = result.filename;
    link.hidden = true;
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30_000);
    const omitted = result.omitted.length;
    status = `Downloaded ${result.filename}${omitted > 0 ? ` (${omitted} item${omitted === 1 ? '' : 's'} could not be written to PPTX and are listed in its notes)` : ''}.`;
  } catch {
    status = 'The PPTX file could not be built in this browser.';
  } finally {
    busy = false;
  }
}
</script>

{#if printing}
  {#if PrintView && prepared.ok}
    {@const View = PrintView}
    <View deck={prepared.deck} notes="appendix" onReady={() => window.print()} />
  {:else}
    <p role="status">Preparing the print view…</p>
  {/if}
{:else}
  <div class="flagship" data-slides-flagship={FLAGSHIP_ID}>
    <DeckStage deck={input} tier="untrusted" />
    <div class="flagship__export" role="group" aria-label="Export the deck">
      <button type="button" class="flagship__button" disabled={busy} onclick={downloadPptx}>
        Download PPTX
      </button>
      <a class="flagship__button" href="?print=1" target="_blank" rel="noopener"
        >Print or save as PDF</a
      >
      <p class="flagship__status" role="status" data-slides-export-status>{status}</p>
    </div>
  </div>
{/if}

<style>
  .flagship {
    display: grid;
    gap: 0.75rem;
    min-inline-size: 0;
  }

  .flagship__export {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.5rem 0.75rem;
  }

  .flagship__button {
    display: inline-flex;
    align-items: center;
    min-block-size: 44px;
    padding-inline: 1rem;
    border: 1px solid var(--tx-border, CanvasText);
    border-radius: 999px;
    background: var(--tx-surface, Canvas);
    color: var(--tx-foreground, CanvasText);
    font: inherit;
    font-weight: 600;
    text-decoration: none;
    cursor: pointer;
  }

  .flagship__button:focus-visible {
    outline: 3px solid var(--tx-ring, Highlight);
    outline-offset: 2px;
  }

  .flagship__button:disabled {
    cursor: progress;
  }

  .flagship__status {
    flex-basis: 100%;
    margin: 0;
    min-block-size: 1.5em;
    font-size: 0.875rem;
  }
</style>
