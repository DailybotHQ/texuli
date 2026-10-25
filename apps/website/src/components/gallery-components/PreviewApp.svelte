<script lang="ts">
/**
 * The isolated preview document's island: reads `?id=` and mounts that
 * component's live stage full-page. The embedding page sends props, mode and
 * direction by same-origin `postMessage`; anything else is ignored.
 */
import type { Component } from 'svelte';
import {
  PREVIEW_READY,
  PREVIEW_SIZE,
  PREVIEW_STATE,
  sanitizePreviewState,
} from '../live/preview.ts';
import { type StageFamily, type StageModule, stageFor } from '../live/stage-map.ts';

/** Framed families (`FRAMED_FAMILIES`): only this document loads them. */
const OWN_LOADERS: Partial<Record<StageFamily, () => Promise<StageModule>>> = {
  combobox: () => import('../live/stages/ComboboxStage.svelte') as Promise<StageModule>,
};

let id = $state('');
let values = $state<Record<string, unknown>>({});
let started = $state(false);
/**
 * The stage router loads lazily (the same lazy-only entry component pages
 * use), so this document fetches only its own family's code and CSS.
 */
let Stage = $state<Component<{
  componentId: string;
  values: Record<string, unknown>;
  family: StageFamily | undefined;
  load?: () => Promise<StageModule>;
}> | null>(null);
$effect(() => {
  if (!entry || Stage) return;
  void import('../live/LazyLiveStage.svelte').then((mod) => {
    Stage = mod.default;
  });
});

const entry = $derived(id ? stageFor(id) : undefined);

$effect(() => {
  const requested = new URLSearchParams(location.search).get('id') ?? '';
  id = stageFor(requested) ? requested : '';
  started = true;

  const root = document.documentElement;
  function onMessage(event: MessageEvent): void {
    if (event.origin !== location.origin || event.source !== window.parent) return;
    const data = event.data as { type?: unknown; id?: unknown; state?: unknown } | null;
    if (data?.type !== PREVIEW_STATE || data.id !== id) return;
    const state = sanitizePreviewState(data.state);
    if (!state) return;
    values = state.values;
    root.dataset.txMode = state.mode;
    root.style.colorScheme = state.mode;
    root.dir = state.dir;
  }
  window.addEventListener('message', onMessage);
  if (id && window.parent !== window) {
    window.parent.postMessage({ type: PREVIEW_READY, id }, location.origin);
  }
  // Report the content height so the embedding frame can grow to fit it.
  let observer: ResizeObserver | undefined;
  if (id && window.parent !== window && typeof ResizeObserver === 'function') {
    observer = new ResizeObserver(() => {
      window.parent.postMessage(
        { type: PREVIEW_SIZE, id, height: document.body.scrollHeight },
        location.origin
      );
    });
    observer.observe(document.body);
  }
  return () => {
    window.removeEventListener('message', onMessage);
    observer?.disconnect();
  };
});
</script>

{#if !started}
  <main class="preview" aria-label="Component preview"><p role="status">Loading preview…</p></main>
{:else if !entry}
  <main class="preview" aria-labelledby="preview-title">
    <h1 class="title" id="preview-title">Component preview</h1>
    <p>
      Choose a component in the <a href="../">component gallery</a> to see its live preview here.
    </p>
  </main>
{:else if !Stage}
  <main class="preview" aria-label="Component preview"><p role="status">Loading preview…</p></main>
{:else if entry.isolate}
  <Stage componentId={id} family={entry.family} {values} load={OWN_LOADERS[entry.family]} />
{:else}
  <main class="preview" data-tx-preview={id} aria-labelledby="preview-title">
    <!-- An h2: stage content starts at h2 or h3 (chart titles are h3). -->
    <h2 class="sr-only" id="preview-title">{id} live preview</h2>
    <Stage componentId={id} family={entry.family} {values} load={OWN_LOADERS[entry.family]} />
  </main>
{/if}

<style>
  .preview {
    display: grid;
    align-content: start;
    gap: 0.75rem;
    padding: 1rem;
  }
  .title {
    margin: 0;
    font-size: 1.25rem;
  }
  .sr-only {
    position: absolute;
    inline-size: 1px;
    block-size: 1px;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
  }
</style>
