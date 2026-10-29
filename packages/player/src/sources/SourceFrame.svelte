<script lang="ts">
import { type Snippet, tick } from 'svelte';
import { formatAnnouncement } from '../announcements.ts';
import { getPlayerLabels, getPlayerSources } from '../context.ts';

/**
 * Spec 0.8.0 data sources: what a node that reads a host source shows
 * around its component. The first load is a busy status with the node's
 * name; a failed load says why with a retry button when asking again can
 * help; an empty source says so; loaded rows paint the component, with a
 * load-more button while the source has more. Focus never falls to the
 * document: a button that goes away hands focus to the frame.
 */
let { path, label, children }: { path: string; label: string; children: Snippet } = $props();

const sources = getPlayerSources();
const labels = getPlayerLabels();
const current = $derived(sources?.status(path) ?? null);
let frame = $state<HTMLElement | null>(null);
let more = $state<HTMLButtonElement | null>(null);
/** A button the reader pressed: keep focus on it, or on the frame once it goes. */
let pressed = false;

function retry(): void {
  pressed = true;
  sources?.retry(path);
}

function loadMore(): void {
  if (current?.loadingMore) return;
  pressed = true;
  sources?.loadMore(path);
}

$effect(() => {
  const busy = current?.loadingMore === true || current?.status === 'loading';
  const hasMore = current?.hasMore === true;
  if (!pressed || busy) return;
  pressed = false;
  void tick().then(() => {
    const active = frame?.ownerDocument.activeElement;
    if (active && active !== frame?.ownerDocument.body && frame?.contains(active)) return;
    (hasMore ? more : null)?.focus() ?? frame?.focus();
  });
});
</script>

{#if current === null}
  {@render children()}
{:else}
  <div
    bind:this={frame}
    class="tx-player__source"
    data-tx-player-source={current.status}
    aria-busy={current.status === 'loading' || current.refreshing || current.loadingMore
      ? 'true'
      : undefined}
    tabindex="-1"
  >
    {#if current.count === 0 && current.status === 'loading'}
      <div class="tx-player__skeleton" role="status">
        <span class="tx-player__stream-node-label">
          {formatAnnouncement(labels().sourceLoading, { label })}
        </span>
        <span class="tx-player__skeleton-shape" aria-hidden="true"></span>
        <span class="tx-player__skeleton-shape" aria-hidden="true"></span>
      </div>
    {:else if current.count === 0 && current.status === 'error'}
      <div class="tx-player__stream-error" data-tx-player-source-error>
        <p>
          {formatAnnouncement(labels().sourceFailed, {
            label,
            reason: current.error?.message ?? '',
          })}
        </p>
        {#if current.error?.canRetry}
          <button type="button" class="tx-player__stream-retry" onclick={retry}>
            {labels().sourceRetry}
          </button>
        {/if}
      </div>
    {:else if current.count === 0}
      <p class="tx-player__skeleton" role="note" data-tx-player-source-empty>
        {labels().sourceEmpty}
      </p>
    {:else}
      {@render children()}
      {#if current.status === 'error' && current.error}
        <div class="tx-player__stream-error" data-tx-player-source-error>
          <p>
            {formatAnnouncement(labels().sourceFailed, { label, reason: current.error.message })}
          </p>
          {#if current.error.canRetry}
            <button type="button" class="tx-player__stream-retry" onclick={retry}>
              {labels().sourceRetry}
            </button>
          {/if}
        </div>
      {/if}
      {#if current.writeError}
        <p class="tx-player__stream-node-label" data-tx-player-source-write-error>
          {formatAnnouncement(labels().sourceSaveFailed, { reason: current.writeError.message })}
        </p>
      {/if}
      {#if current.moreError}
        <div class="tx-player__stream-error" data-tx-player-source-error>
          <p>{formatAnnouncement(labels().sourceFailed, { label, reason: current.moreError.message })}</p>
          {#if current.moreError.canRetry}
            <button type="button" class="tx-player__stream-retry" onclick={retry}>
              {labels().sourceRetry}
            </button>
          {/if}
        </div>
      {:else if current.hasMore}
        <button
          bind:this={more}
          type="button"
          class="tx-player__stream-retry"
          data-tx-player-source-more
          aria-disabled={current.loadingMore ? 'true' : undefined}
          onclick={loadMore}
        >
          {current.loadingMore ? labels().sourceLoadingMore : labels().sourceLoadMore}
        </button>
      {/if}
    {/if}
  </div>
{/if}
