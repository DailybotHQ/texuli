<script lang="ts">
import { getOwnerWindow } from '@texuli/core/env';
import type { Snippet } from 'svelte';
import { type ClassValue, cx } from '../../internal/cx.ts';
import {
  isLayoutId,
  type LayoutId,
  type LayoutOptions,
  layoutForWidth,
  normalizeLayoutOptions,
} from './contract.ts';
import type { NavModel } from './nav-model.ts';
import { type LayoutComponent, loadLayout } from './registry.ts';
import ScreenOutlet from './ScreenOutlet.svelte';
import './host.css';

/**
 * Resolves and lazy-loads a layout by id, applies responsive fallbacks from
 * the catalog, and keeps one stable screen outlet across switches.
 * Width is seeded synchronously (container, else viewport) so the first paint
 * does not flash a mobile fallback on a wide host; ResizeObserver keeps it live.
 * Loads go through `loadLayout` (one promise per id) so effect re-runs under
 * parallel tests share the same import instead of cancelling forever.
 */

function readViewportWidth(win?: Window | null): number {
  try {
    const w = win?.innerWidth ?? (typeof globalThis !== 'undefined' ? globalThis.innerWidth : 0);
    return typeof w === 'number' && Number.isFinite(w) && w > 0 ? w : 0;
  } catch {
    return 0;
  }
}

function readElementWidth(node: HTMLElement): number {
  const box = node.getBoundingClientRect().width;
  if (box > 0) return box;
  return node.clientWidth > 0 ? node.clientWidth : 0;
}

type Props = {
  layout: LayoutId;
  children: Snippet;
  nav?: NavModel;
  path?: string;
  options?: LayoutOptions;
  storageKey?: string;
  aside?: Snippet;
  /** Document direction for RTL-aware chrome. */
  dir?: 'ltr' | 'rtl';
  /** Accessible name while a layout module loads. */
  loadingLabel?: string;
  class?: ClassValue;
};

let {
  layout,
  children,
  nav,
  path,
  options,
  storageKey,
  aside,
  dir,
  loadingLabel = 'Loading layout',
  class: className,
}: Props = $props();

let host = $state<HTMLDivElement | undefined>();
/**
 * Synchronous seed: viewport when available (avoids width-0 → mobile flash).
 * Host measurement and ResizeObserver refine after mount.
 */
let width = $state(
  readViewportWidth(
    typeof globalThis !== 'undefined' && 'innerWidth' in globalThis
      ? (globalThis as unknown as Window)
      : null
  )
);
let outlet = $state<HTMLDivElement | undefined>();
let target = $state<HTMLElement | undefined>();
let fallbackTarget = $state<HTMLElement | undefined>();
let loadedFor = $state<LayoutId | undefined>();
let Layout = $state.raw<LayoutComponent | null>(null);
let loading = $state(false);

const requestedId = $derived(isLayoutId(layout) ? layout : 'custom');
const effectiveLayout = $derived(layoutForWidth(requestedId, width));
const safeOptions = $derived(normalizeLayoutOptions(options) ?? options);

function mountScreen(nextTarget: HTMLElement): void {
  target = nextTarget;
  if (outlet && !nextTarget.contains(outlet)) nextTarget.append(outlet);
}

/**
 * Before paint: prefer the container width. If the box is still 0×0 (common in
 * tests before layout), keep an existing positive width or seed from the viewport
 * once — never overwrite a ResizeObserver measurement with a larger viewport.
 */
$effect.pre(() => {
  const node = host;
  if (!node) return;
  const measured = readElementWidth(node);
  if (measured > 0) {
    width = measured;
    return;
  }
  if (width > 0) return;
  const win = getOwnerWindow(node);
  const viewport = readViewportWidth(win);
  if (viewport > 0) width = viewport;
});

$effect(() => {
  const node = host;
  if (!node) return;
  const win = getOwnerWindow(node);
  const RO =
    (win as (Window & { ResizeObserver?: typeof ResizeObserver }) | undefined)?.ResizeObserver ??
    globalThis.ResizeObserver;
  if (typeof RO !== 'function') return;
  const observer = new RO((entries: ResizeObserverEntry[]) => {
    const entry = entries[0];
    if (entry) width = entry.contentRect.width;
  });
  const initial = readElementWidth(node);
  if (initial > 0) width = initial;
  observer.observe(node);
  return () => observer.disconnect();
});

$effect(() => {
  if (outlet && target && !target.contains(outlet)) target.append(outlet);
  else if (outlet && fallbackTarget && !Layout && !fallbackTarget.contains(outlet)) {
    fallbackTarget.append(outlet);
  }
});

$effect(() => {
  const id = effectiveLayout;
  const pending = loadLayout(id);
  if (!pending) {
    loadedFor = undefined;
    Layout = null;
    loading = false;
    target = undefined;
    return;
  }
  if (loadedFor === id && Layout) {
    loading = false;
    return;
  }
  let cancelled = false;
  loading = true;
  pending.then(
    (module) => {
      if (cancelled) return;
      Layout = module.default;
      loadedFor = id;
      loading = false;
    },
    () => {
      if (cancelled) return;
      Layout = null;
      loadedFor = undefined;
      target = undefined;
      loading = false;
    }
  );
  return () => {
    cancelled = true;
  };
});
</script>

<div
  bind:this={host}
  class={cx('tx-layout-host', className)}
  data-tx-layout-host=""
  data-layout={effectiveLayout}
  data-loading={loading ? 'true' : 'false'}
  data-ready={Layout && loadedFor === effectiveLayout && !loading ? 'true' : 'false'}
  style:container-type="inline-size"
  dir={dir}
>
  {#if Layout && loadedFor === effectiveLayout}
    <Layout
      {mountScreen}
      {nav}
      {path}
      options={safeOptions}
      {storageKey}
      {aside}
    />
  {:else}
    <div bind:this={fallbackTarget} class="tx-layout-host__fallback" data-tx-layout-fallback=""></div>
  {/if}
  <ScreenOutlet {children} onready={(node) => (outlet = node)} />
  {#if loading}
    <div class="tx-layout-host__loading" aria-label={loadingLabel} role="status" data-tx-layout-loading="">
      <span class="tx-layout-host__loading-label">{loadingLabel}</span>
      <div class="tx-layout-host__skeleton" aria-hidden="true">
        <div class="tx-layout-host__skeleton-rail"></div>
        <div class="tx-layout-host__skeleton-main">
          <div class="tx-layout-host__skeleton-bar"></div>
          <div class="tx-layout-host__skeleton-block"></div>
        </div>
      </div>
    </div>
  {/if}
</div>
