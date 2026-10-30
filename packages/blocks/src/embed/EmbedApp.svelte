<script lang="ts">
import { onDestroy } from 'svelte';
import type { EmbedBlockLabels, EmbedMountResult } from './family.ts';
import type { EmbedAppBlock } from './schema.ts';

interface Props {
  block: EmbedAppBlock;
  /**
   * Host callback after Start. Texuli does not run `block.app`. Prefer
   * `createSandboxedEmbedMount` from `@texuli/blocks/embed` for URL frames
   * (sandbox without allow-same-origin, no-referrer, origin allowlist).
   * Host must enforce CSP frame-src and postMessage origin checks.
   */
  mountEmbed?: (
    target: HTMLElement,
    app: Record<string, unknown>
  ) => EmbedMountResult | Promise<EmbedMountResult>;
  labels: EmbedBlockLabels;
}

let { block, mountEmbed, labels }: Props = $props();
let started = $state(false);
let pending = $state(false);
let error = $state<string | null>(null);
let mountEl = $state<HTMLDivElement | undefined>(undefined);
let cleanup: (() => void) | undefined;
let cancelled = false;

$effect(() => {
  const frame = mountEl;
  if (!frame) return;
  frame.addEventListener('keydown', onFrameKeydown);
  return () => frame.removeEventListener('keydown', onFrameKeydown);
});

async function start() {
  if (pending || started) return;
  if (!mountEmbed || !mountEl) {
    error = labels.unavailable;
    return;
  }
  pending = true;
  error = null;
  cancelled = false;
  try {
    const dispose = await mountEmbed(mountEl, block.app);
    if (cancelled) {
      if (typeof dispose === 'function') dispose();
      return;
    }
    if (typeof dispose === 'function') cleanup = dispose;
    started = true;
    mountEl.focus();
  } catch {
    if (!cancelled) error = labels.startError;
  } finally {
    if (!cancelled) pending = false;
  }
}

function close() {
  cancelled = true;
  const dispose = cleanup;
  cleanup = undefined;
  try {
    dispose?.();
  } catch {
    // Runtime cleanup must not disrupt its host document.
  }
  mountEl?.replaceChildren();
  started = false;
  pending = false;
}

function onFrameKeydown(event: KeyboardEvent) {
  if (!started || event.key !== 'Tab' || !mountEl) return;
  const focusable = [
    ...mountEl.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    ),
  ].filter((element) => !element.hasAttribute('disabled') && element.tabIndex >= 0);
  const first = focusable[0];
  const last = focusable.at(-1);
  if (!first || !last) {
    event.preventDefault();
    mountEl.focus();
    return;
  }
  const active = document.activeElement;
  if (event.shiftKey && (active === first || active === mountEl)) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && active === last) {
    event.preventDefault();
    first.focus();
  }
}

onDestroy(close);
</script>

<section class="tx-embed-app" data-tx-block="embed-app" data-tx-embed-started={started} aria-label={block.title}>
  <header class="tx-embed-header">
    <h3>{block.title}</h3>
    {#if started}<button type="button" onclick={close}>{labels.close}</button>{/if}
  </header>
  <div class="tx-embed-content" data-size={block.height ?? 'md'}>
    {#if !started}
      <div class="tx-embed-start">
        <p>{labels.idle}</p>
        <button type="button" disabled={pending} aria-busy={pending || undefined} onclick={start}>
          {pending ? labels.starting : block.startLabel ?? labels.start}
        </button>
      </div>
    {/if}
    {#if error}<p role="alert">{error}</p>{/if}
    <!-- Host runtime is deferred until the user activates the start button. -->
    <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
    <div bind:this={mountEl} class="tx-embed-mount" hidden={!started} tabindex={started ? 0 : -1} role="region" aria-label={`${block.title} app`}></div>
  </div>
</section>

<style>
  .tx-embed-app { overflow: hidden; border: var(--tx-border-width-thin) solid var(--tx-color-border, #9ca3af); border-radius: calc(var(--tx-shape-radius-lg) * 1.25); background: var(--tx-color-surface, Canvas); color: var(--tx-color-text, CanvasText); }
  .tx-embed-header { display: flex; align-items: center; justify-content: space-between; gap: var(--tx-space-3); padding: var(--tx-space-3) var(--tx-space-4); border-block-end: var(--tx-border-width-thin) solid var(--tx-color-border, #9ca3af); }
  .tx-embed-header h3 { margin: 0; font-size: var(--tx-type-body-size); }
  .tx-embed-content { min-block-size: 16rem; padding: var(--tx-space-4); }
  .tx-embed-content[data-size='sm'] { min-block-size: 10rem; }
  .tx-embed-content[data-size='lg'] { min-block-size: 24rem; }
  .tx-embed-start { display: grid; min-block-size: inherit; align-content: center; justify-items: center; gap: var(--tx-space-3); text-align: center; }
  .tx-embed-start p { margin: 0; }
  button { min-block-size: 2.5rem; padding-inline: var(--tx-space-4); border: var(--tx-border-width-thin) solid currentColor; border-radius: var(--tx-shape-radius-md); background: var(--tx-color-accent, #4338ca); color: var(--tx-color-on-accent, white); font: inherit; cursor: pointer; }
  button:focus-visible { outline: 2px solid currentColor; outline-offset: 2px; }
  button:disabled { cursor: wait; opacity: 0.65; }
  .tx-embed-mount { min-block-size: 12rem; overflow: auto; }
  [role='alert'] { color: var(--tx-color-danger, #b91c1c); }
  @media (forced-colors: active) { .tx-embed-app, .tx-embed-header { border-color: CanvasText; } button { border: var(--tx-border-width-thin) solid ButtonText; } }
</style>
