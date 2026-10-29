<script lang="ts">
/**
 * /output-page/ print and PDF: the weekly digest painted by the real
 * `<Player>` at the untrusted tier, with its print mode switchable on
 * screen (the static form the browser prints: inert surface, motion off,
 * no skip link or retry button; the player also enters it on its own
 * between `beforeprint` and `afterprint`). "Download the PDF" runs
 * `renderBlueprintPdf` from `@texuli/tools/print`: the blueprint maps to a
 * validated document and the owned PDF writer draws it, in this tab; the
 * file is a Blob this island creates. Both modules load after hydration.
 */
import { onMount } from 'svelte';
import { byteSize, saveBlob } from '../canvas-site/download.ts';
import { PRINT_BLUEPRINT, WEEKLY_DIGEST } from './drafts.ts';

type PlayerModule = typeof import('@texuli/player');

let player = $state.raw<PlayerModule | null>(null);
let failed = $state(false);
let print = $state(true);
let size = $state<'a4' | 'letter'>('a4');
let orientation = $state<'portrait' | 'landscape'>('portrait');
let busy = $state(false);
let status = $state('');

onMount(() => {
  let live = true;
  import('@texuli/player').then(
    (module) => {
      if (live) player = module;
    },
    () => {
      failed = true;
    }
  );
  return () => {
    live = false;
  };
});

async function downloadPdf(): Promise<void> {
  busy = true;
  status = 'Writing the PDF…';
  try {
    const { renderBlueprintPdf } = await import('@texuli/tools/print');
    const result = await renderBlueprintPdf(WEEKLY_DIGEST, {
      title: 'Harbor weekly digest',
      page: { size, orientation, footer: { center: 'Harbor weekly digest' } },
    });
    if (!result.ok) {
      status = `Refused: ${result.diagnostics.map((entry) => entry.code).join(', ')}.`;
      return;
    }
    saveBlob(new Blob([result.bytes as BlobPart], { type: result.mime }), 'weekly-digest.pdf');
    const warnings = result.diagnostics.filter((entry) => entry.severity === 'warning');
    status = `Saved weekly-digest.pdf: ${result.pageCount} page${result.pageCount === 1 ? '' : 's'}, ${byteSize(result.bytes.length)}${warnings.length > 0 ? `; ${warnings.map((entry) => entry.message).join(' ')}` : '.'}`;
  } catch {
    status = 'The PDF writer could not load. Reload the page to try again.';
  } finally {
    busy = false;
  }
}
</script>

<div class="print" data-output-print="">
  <div class="print__controls">
    <label class="print__choice">
      <input type="checkbox" bind:checked={print} data-output-print-mode="" />
      Print mode on screen
    </label>
    <button type="button" class="print__button" onclick={() => window.print()}>Print this page (the digest is on it)</button>
  </div>
  <div class="print__controls">
    <label class="print__field">
      <span>Page size</span>
      <select bind:value={size}>
        <option value="a4">A4</option>
        <option value="letter">US Letter</option>
      </select>
    </label>
    <label class="print__field">
      <span>Orientation</span>
      <select bind:value={orientation}>
        <option value="portrait">Portrait</option>
        <option value="landscape">Landscape</option>
      </select>
    </label>
    <button type="button" class="print__button" disabled={busy} onclick={downloadPdf}>Download the PDF</button>
  </div>
  <p class="print__status" role="status" data-output-print-status="">{status}</p>
  <div class="print__stage" data-output-print-stage="">
    {#if failed}
      <p role="alert">The player could not load. Reload the page to try again.</p>
    {:else if player}
      <player.Player
        blueprint={PRINT_BLUEPRINT}
        tier="untrusted"
        status="draft"
        label="Weekly digest (untrusted)"
        landmarks={false}
        loadTimeoutMs={8000}
        {print}
      />
    {:else}
      <p data-output-print-loading="">Loading the player…</p>
    {/if}
  </div>
</div>

<style>
  .print {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: 0.6rem;
    min-inline-size: 0;
    padding: clamp(0.75rem, 2vw, 1.25rem);
    border: 1px solid var(--tx-border, CanvasText);
    border-radius: 1rem;
    background: var(--tx-surface, Canvas);
    color: var(--tx-foreground, CanvasText);
  }
  .print__controls {
    display: flex;
    flex-wrap: wrap;
    gap: 0.6rem;
    align-items: end;
  }
  .print__choice {
    display: inline-flex;
    gap: 0.4rem;
    align-items: center;
    min-block-size: 2.25rem;
    font-size: 0.875rem;
  }
  .print__field {
    display: grid;
    gap: 0.25rem;
    font-size: 0.875rem;
    font-weight: 600;
  }
  .print__field select {
    min-block-size: 2.25rem;
    padding-inline: 0.5rem;
    border: 1px solid var(--tx-border, ButtonBorder);
    border-radius: 0.5rem;
    background: var(--tx-background, Field);
    color: var(--tx-foreground, FieldText);
    font: inherit;
    font-weight: 400;
  }
  .print__button {
    min-block-size: 2.25rem;
    padding-inline: 0.8rem;
    border: 1px solid var(--tx-border, ButtonBorder);
    border-radius: 0.5rem;
    background: var(--tx-background, ButtonFace);
    color: var(--tx-foreground, ButtonText);
    font: inherit;
    cursor: pointer;
  }
  .print__button:disabled {
    cursor: progress;
    opacity: 0.7;
  }
  .print__button:focus-visible,
  .print__field select:focus-visible {
    outline: 2px solid var(--tx-ring, Highlight);
    outline-offset: 2px;
  }
  .print__status {
    margin: 0;
    min-block-size: 1.25rem;
    font-size: 0.875rem;
    overflow-wrap: anywhere;
  }
  .print__stage {
    min-inline-size: 0;
    padding: 0.75rem;
    border: 1px dashed var(--tx-border, CanvasText);
    border-radius: 0.75rem;
    background: var(--tx-background, Canvas);
  }
</style>
