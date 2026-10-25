<script lang="ts">
/**
 * Client mount of one example inside the bare preview document.
 * When URL has `embed=1`: inert + demote landmarks/headings so axe on a parent
 * page that includes this iframe does not see colliding structure. Standalone
 * preview (no embed / embed=0) keeps real landmarks for “Open the live example”.
 *
 * embed/mode/dir are read from the URL at runtime — static HTML cannot bake them.
 */
import { getExample } from '@texuli/examples';
import type { Component } from 'svelte';
import { tick } from 'svelte';

type Props = {
  id: string;
};

let { id }: Props = $props();

let Demo = $state<Component | null>(null);
let error = $state<string | null>(null);
let hostEl = $state<HTMLElement | null>(null);
let embed = $state(false);

function readEmbedFromUrl(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return new URLSearchParams(window.location.search).get('embed') === '1';
  } catch {
    return false;
  }
}

async function settleOverlays(): Promise<void> {
  await tick();
  await new Promise<void>((r) => requestAnimationFrame(() => r()));
  try {
    document.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: 'Escape',
        code: 'Escape',
        bubbles: true,
        cancelable: true,
      })
    );
  } catch {
    /* ignore */
  }
}

/**
 * Presentational demotion only for embedded iframes under the docs shell.
 * `inert` removes focusable descendants so parent iframes may keep tabindex=-1
 * (axe frame-focusable-content) while still painting the demo.
 */
function demoteLandmarks(root: HTMLElement): void {
  if (!embed) {
    root.inert = false;
    return;
  }

  root.inert = true;
  document.documentElement.setAttribute('data-tx-example-embed', '1');
  try {
    document.body.inert = true;
  } catch {
    /* older engines */
  }

  const landmarkSelectors = [
    'main',
    'nav',
    'aside',
    'header',
    'footer',
    'form',
    'section[aria-label]',
    'section[aria-labelledby]',
    '[role="main"]',
    '[role="navigation"]',
    '[role="banner"]',
    '[role="contentinfo"]',
    '[role="complementary"]',
    '[role="region"]',
    '[role="search"]',
    '[role="form"]',
  ].join(', ');

  for (const el of root.querySelectorAll(landmarkSelectors)) {
    if (!(el instanceof HTMLElement)) continue;
    el.setAttribute('role', 'presentation');
    el.removeAttribute('aria-label');
    el.removeAttribute('aria-labelledby');
  }

  for (const heading of root.querySelectorAll('h1, h2, h3, h4, h5, h6')) {
    if (!(heading instanceof HTMLElement)) continue;
    heading.setAttribute('role', 'presentation');
  }
}

function releaseFocusToParent(): void {
  if (!embed) return;
  try {
    const active = document.activeElement;
    if (active instanceof HTMLElement && active !== document.body) active.blur();
    if (window.parent && window.parent !== window) window.parent.focus();
  } catch {
    /* best-effort */
  }
}

$effect(() => {
  embed = readEmbedFromUrl();
  const entry = getExample(id);
  if (!entry) {
    error = `Unknown example: ${id}`;
    return;
  }
  let cancelled = false;
  let observer: MutationObserver | null = null;

  void entry.load().then(
    async (mod) => {
      if (cancelled) return;
      Demo = mod.default;
      await settleOverlays();
      await settleOverlays();
      await tick();
      if (cancelled) return;
      if (hostEl) demoteLandmarks(hostEl);
      releaseFocusToParent();
      await new Promise<void>((r) => requestAnimationFrame(() => r()));
      if (cancelled) return;
      if (hostEl) demoteLandmarks(hostEl);
      releaseFocusToParent();

      if (embed && hostEl && typeof MutationObserver !== 'undefined') {
        observer = new MutationObserver(() => {
          if (hostEl) demoteLandmarks(hostEl);
        });
        observer.observe(hostEl, {
          subtree: true,
          childList: true,
          attributes: true,
          attributeFilter: ['role', 'aria-label', 'aria-labelledby'],
        });
      }
    },
    (err: unknown) => {
      if (!cancelled) error = err instanceof Error ? err.message : 'Failed to load example.';
    }
  );
  return () => {
    cancelled = true;
    observer?.disconnect();
  };
});
</script>

{#if error}
  <p role="alert">{error}</p>
{:else if Demo}
  <div
    bind:this={hostEl}
    data-tx-example-preview-host={id}
    data-loaded="true"
    data-embed={embed ? 'true' : 'false'}
  >
    <Demo />
  </div>
{:else}
  <p role="status">Loading example…</p>
{/if}
