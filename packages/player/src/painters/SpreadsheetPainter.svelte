<script lang="ts">
import { untrack } from 'svelte';
import { getPlayerLabels, getPlayerSheetHost } from '../context.ts';

/**
 * `spreadsheet` (spec 0.8.0, ADR-015): a sheet as data, painted by the
 * host's `sheetHost` (`createSheetPlayerHost` from `@texuli/sheets/host`),
 * so the formula engine stays out of the player. The draft already passed
 * `validateDraft` with the host's `checkSheet` at the player's tier (every
 * formula parsed); the host validates the sheet again before it paints.
 * Without a host validation refuses the node (`sheet-unchecked`), so only a
 * preview with placeholders reaches the fallback: the sheet title as text
 * and where the sheet opens. It never reads the cells.
 */

let { sheet, label }: { sheet?: unknown; label?: string } = $props();

const labels = getPlayerLabels();
const sheetHost = getPlayerSheetHost();

let target = $state<HTMLElement | null>(null);
const host = $derived(sheetHost().host);
const tier = $derived(sheetHost().tier);

const title = $derived.by(() => {
  if (typeof label === 'string' && label.trim()) return label;
  const meta =
    sheet && typeof sheet === 'object' ? (sheet as { meta?: { title?: unknown } }).meta : undefined;
  return typeof meta?.title === 'string' ? meta.title : '';
});

$effect(() => {
  const presenter = host;
  const presentTier = tier;
  const node = target;
  const nextSheet = sheet;
  const sheetLabel = label;
  if (!presenter || !node) return;
  const cleanup = untrack(() =>
    presenter.present({
      sheet: nextSheet,
      ...(typeof sheetLabel === 'string' ? { sheetLabel } : {}),
      tier: presentTier,
      get label() {
        return sheetHost().label;
      },
      get active() {
        return sheetHost().active;
      },
      get target() {
        return target;
      },
    })
  );
  if (typeof cleanup === 'function') return cleanup;
});
</script>

{#if host}
  <div bind:this={target} class="tx-player-spreadsheet" data-tx-player-spreadsheet=""></div>
{:else}
  <figure
    class="tx-player-spreadsheet tx-player-spreadsheet--fallback"
    aria-label={title || undefined}
    data-tx-player-spreadsheet-fallback=""
  >
    {#if title}<p class="tx-player-spreadsheet__title">{title}</p>{/if}
    <p class="tx-player-spreadsheet__note">{labels().sheetNeedsHost}</p>
  </figure>
{/if}
