<script lang="ts">
/**
 * Lazy-mounts one registered example when it scrolls into view (or when
 * `eager` is set). Loads the real demo module from `@texuli/examples`.
 *
 * Listing cards (`listing`): the host is `inert` so Tab skips demo chrome, and
 * Escape is sent after mount so overlays that open for visual capture close
 * before the first Tab (portals still get Escape). Detail pages also start
 * closed; the user opens overlays with a click.
 */
import type { Component } from 'svelte';
import { onDestroy, tick } from 'svelte';

type Props = {
  id: string;
  /** Mount immediately (detail pages). */
  eager?: boolean;
  /** Listing cards: inert + force-close overlays on load. */
  listing?: boolean;
  /** Root margin for IntersectionObserver. */
  rootMargin?: string;
};

let { id, eager = false, listing = true, rootMargin = '120px 0px' }: Props = $props();

let rootEl = $state<HTMLElement | null>(null);
let visible = $state(eager);
let Demo = $state<Component | null>(null);
let error = $state<string | null>(null);
let loading = $state(false);

async function settleOverlays(): Promise<void> {
  await tick();
  // Give portals a frame to open, then dismiss (visual demos often start open).
  await new Promise<void>((resolve) => {
    requestAnimationFrame(() => resolve());
  });
  try {
    document.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: 'Escape',
        code: 'Escape',
        bubbles: true,
        cancelable: true,
      })
    );
    document.dispatchEvent(
      new KeyboardEvent('keyup', { key: 'Escape', code: 'Escape', bubbles: true, cancelable: true })
    );
  } catch {
    // SSR / non-DOM
  }
}

$effect(() => {
  if (!visible) return;
  let cancelled = false;
  loading = true;
  error = null;
  // The registry loads on the client only (FIX-site-perf-routes): imported
  // statically, the build collected every demo's CSS into each page that
  // shows one example. Each demo still brings its own CSS when it loads.
  void import('@texuli/examples')
    .then(({ getExample }) => {
      const entry = getExample(id);
      if (!entry) throw new Error(`Unknown example: ${id}`);
      return entry.load();
    })
    .then(
      async (mod) => {
        if (cancelled) return;
        Demo = mod.default;
        loading = false;
        await settleOverlays();
        // Second pass after delayed open animations.
        await settleOverlays();
      },
      (err: unknown) => {
        if (!cancelled) {
          error = err instanceof Error ? err.message : 'Failed to load example.';
          loading = false;
        }
      }
    );
  return () => {
    cancelled = true;
  };
});

$effect(() => {
  if (eager || typeof IntersectionObserver === 'undefined') {
    if (eager) visible = true;
    return;
  }
  const node = rootEl;
  if (!node) return;
  const io = new IntersectionObserver(
    (entries) => {
      if (entries.some((e) => e.isIntersecting)) {
        visible = true;
        io.disconnect();
      }
    },
    { root: null, rootMargin, threshold: 0.01 }
  );
  io.observe(node);
  return () => io.disconnect();
});

onDestroy(() => {
  Demo = null;
});
</script>

<div
  class="host"
  class:host--listing={listing}
  bind:this={rootEl}
  data-tx-example-host={id}
  data-loaded={Demo ? 'true' : 'false'}
  data-listing={listing ? 'true' : 'false'}
  inert={listing || undefined}
>
  {#if error}
    <p class="host__error" role="alert">{error}</p>
  {:else if Demo}
    <Demo />
  {:else if loading || visible}
    <p class="host__status" role="status">Loading example…</p>
  {:else}
    <p class="host__status" role="status">Scroll to load this example.</p>
  {/if}
</div>

<style>
  .host {
    min-block-size: 4rem;
  }
  .host--listing {
    /* Listing cards are not keyboard destinations; detail pages are. */
    pointer-events: none;
  }
  .host__status,
  .host__error {
    margin: 0;
    font-size: 0.9rem;
    color: var(--tx-foreground);
  }
  .host__error {
    color: var(--tx-destructive, var(--tx-foreground));
  }
</style>
