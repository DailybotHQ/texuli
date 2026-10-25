import { clearLazyChunk, lazyChunk } from '@texuli/core/lazy';
import type { Component, Snippet } from 'svelte';
import type { LayoutId, LayoutOptions } from './contract.ts';
import type { NavModel } from './nav-model.ts';

/**
 * Props shared by lazy layouts. `mountScreen` receives the one stable
 * routed-screen node so local state survives layout switches.
 */
export type LayoutProps = {
  mountScreen: (target: HTMLElement) => void;
  /** Navigation the layout renders; absent: chrome without links. */
  nav?: NavModel;
  /** Current hash path; absent: the layout may follow `location.hash`. */
  path?: string;
  /** Flat data-only knobs from the app. */
  options?: LayoutOptions;
  /** Scope for persisted layout UI state. */
  storageKey?: string;
  /** Optional context panel (dual-sidebar renders it on the right). */
  aside?: Snippet;
};

export type LayoutComponent = Component<LayoutProps>;

export type LayoutModule = { default: LayoutComponent };

export type LayoutEntry = {
  /** Separate lazy import so unused layouts stay out of the boot path. */
  load: () => Promise<LayoutModule>;
  /**
   * Owning registration module (`app`, `mobile`, `dashboard`, …).
   * Re-registering the same id from a different owner logs a dev warning.
   */
  owner?: string;
};

/**
 * Layout implementations register here as their modules ship.
 * Starts empty; layout tasks and tests call `registerLayout`.
 */
export const LAYOUT_REGISTRY: Partial<Record<LayoutId, LayoutEntry>> = {};

/** Owner string last used for each id (for order-independent ownership checks). */
export const LAYOUT_OWNERS: Partial<Record<LayoutId, string>> = {};

function layoutChunkKey(id: LayoutId): string {
  return `texuli:layout:${id}`;
}

/**
 * Register or replace a lazy layout entry (tests and layout packages).
 * When `owner` differs from a previous registration for the same id, warn in
 * development so app and mobile never silently overwrite each other.
 */
export function registerLayout(id: LayoutId, entry: LayoutEntry): void {
  const previous = LAYOUT_REGISTRY[id];
  const prevOwner = LAYOUT_OWNERS[id];
  const nextOwner = entry.owner;

  if (
    previous &&
    prevOwner &&
    nextOwner &&
    prevOwner !== nextOwner &&
    previous.load !== entry.load
  ) {
    const message = `[texuli/layouts] layout id "${id}" re-registered by owner "${nextOwner}" (was "${prevOwner}"). Each id must have one owner.`;
    if (typeof console !== 'undefined' && typeof console.warn === 'function') {
      console.warn(message);
    }
  }

  LAYOUT_REGISTRY[id] = entry;
  if (nextOwner) LAYOUT_OWNERS[id] = nextOwner;
  // Drop cache when the loader identity changes so a new entry can load.
  if (previous && previous.load !== entry.load) {
    clearLazyChunk(layoutChunkKey(id));
  }
}

/** Remove a layout entry and its cached import (tests). */
export function unregisterLayout(id: LayoutId): void {
  delete LAYOUT_REGISTRY[id];
  delete LAYOUT_OWNERS[id];
  clearLazyChunk(layoutChunkKey(id));
}

/** Clear the whole registry (tests only). */
export function clearLayoutRegistry(): void {
  for (const id of Object.keys(LAYOUT_REGISTRY) as LayoutId[]) {
    unregisterLayout(id);
  }
}

/**
 * Load a registered layout module, reusing one promise per id via
 * `@texuli/core/lazy`. Concurrent LayoutHost effects share the same import.
 */
export function loadLayout(id: LayoutId): Promise<LayoutModule> | undefined {
  const entry = LAYOUT_REGISTRY[id];
  if (!entry) return undefined;
  return lazyChunk(layoutChunkKey(id), entry.load);
}
