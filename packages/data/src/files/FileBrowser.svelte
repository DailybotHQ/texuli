<script lang="ts" generics="T extends FileEntry">
import { safeImageSrc } from '@texuli/core/url-policy';
import type { Snippet } from 'svelte';
import { tick } from 'svelte';
import { type ClassValue, cx } from 'texuli/cx';
import {
  breadcrumbs,
  categoryOf,
  childrenOf,
  type FileEntry,
  formatSize,
} from '../engines/files/model.ts';
import { thumbnailUrl } from '../engines/files/thumbnail.ts';
import { type FileBrowserLayout, moveFocusIndex, previewOf, toggleSelectedId } from './model.ts';
import type { FileBrowserLabels } from './types.ts';

interface FileBrowserProps<T extends FileEntry> {
  entries: readonly T[];
  /** Current folder id (`null` = root). */
  folderId?: string | null;
  onFolderChange?: (folderId: string | null) => void;
  selected?: string[];
  onSelectedChange?: (selected: string[]) => void;
  layout?: FileBrowserLayout;
  onLayoutChange?: (layout: FileBrowserLayout) => void;
  /** Columns used for grid keyboard movement. */
  gridColumns?: number;
  /** Optional host preview URL for an entry (URL policy; developer trust). */
  getPreviewSrc?: (entry: T) => string | undefined;
  /** Activate a file (Enter). Folders always open. */
  onOpenFile?: (entry: T) => void;
  item?: Snippet<[T, { selected: boolean; focused: boolean }]>;
  labels?: Partial<FileBrowserLabels>;
  density?: 'comfortable' | 'compact';
  dir?: 'ltr' | 'rtl' | 'auto';
  class?: ClassValue;
}

const DEFAULT_LABELS: FileBrowserLabels = {
  browser: 'Files',
  root: 'All files',
  breadcrumbs: 'Location',
  layoutGroup: 'Layout',
  layoutGrid: 'Grid',
  layoutList: 'List',
  items: 'Folder contents',
  empty: 'This folder is empty',
  preview: 'Preview',
  previewEmpty: 'Select a file to preview',
  openFolder: (name) => `Open ${name}`,
  selectItem: (name) => `Select ${name}`,
  size: 'Size',
  modified: 'Modified',
  kind: 'Kind',
  selectedCount: (count) => (count === 0 ? 'None selected' : `${count} selected`),
  announcement: (message) => message,
};

let {
  entries,
  folderId = $bindable<string | null>(null),
  onFolderChange,
  selected = $bindable<string[]>([]),
  onSelectedChange,
  layout = $bindable<FileBrowserLayout>('grid'),
  onLayoutChange,
  gridColumns = 4,
  getPreviewSrc,
  onOpenFile,
  item: itemSnippet,
  labels: labelOverrides,
  density = 'comfortable',
  dir,
  class: className,
}: FileBrowserProps<T> = $props();

const uid = $props.id();
const titleId = `files-${uid}-title`;
const itemsId = `files-${uid}-items`;
const labels = $derived({ ...DEFAULT_LABELS, ...labelOverrides });

let focusId = $state<string | undefined>();
let announcement = $state('');

const path = $derived(breadcrumbs(entries, folderId));
const children = $derived(childrenOf(entries, folderId));
const selectedSet = $derived(new Set(selected));
const focusedEntry = $derived(
  (focusId ? children.find((entry) => entry.id === focusId) : undefined) ??
    children.find((entry) => selectedSet.has(entry.id)) ??
    children[0]
);
const preview = $derived(
  focusedEntry
    ? previewOf(focusedEntry, {
        previewSrc: safeImageSrc(getPreviewSrc?.(focusedEntry as T), 'developer'),
        thumbnailSize: 192,
      })
    : null
);

$effect(() => {
  if (children.length === 0) {
    focusId = undefined;
    return;
  }
  if (focusId && children.some((entry) => entry.id === focusId)) return;
  focusId = children.find((entry) => selectedSet.has(entry.id))?.id ?? children[0]?.id;
});

function announce(message: string): void {
  announcement = labels.announcement(message);
}

function emitSelected(next: string[]): void {
  selected = next;
  onSelectedChange?.(next);
}

function emitLayout(next: FileBrowserLayout): void {
  layout = next;
  onLayoutChange?.(next);
}

function goTo(next: string | null): void {
  folderId = next;
  onFolderChange?.(next);
  const name =
    next === null ? labels.root : (entries.find((entry) => entry.id === next)?.name ?? next);
  announce(`Opened ${name}.`);
}

function toggleSelect(id: string): void {
  emitSelected(toggleSelectedId(selected, id));
}

async function focusItem(id: string): Promise<void> {
  focusId = id;
  await tick();
  const root = document.getElementById(`files-${uid}`);
  root?.querySelector<HTMLElement>(`[data-file-id="${CSS.escape(id)}"]`)?.focus();
}

function openEntry(entry: T): void {
  if (entry.kind === 'folder') {
    goTo(entry.id);
    return;
  }
  onOpenFile?.(entry);
  announce(`Opened ${entry.name}.`);
}

function onItemKey(event: KeyboardEvent, entry: T, index: number): void {
  const isRtl =
    dir === 'rtl' ||
    (dir !== 'ltr' &&
      event.currentTarget instanceof HTMLElement &&
      event.currentTarget.ownerDocument.defaultView?.getComputedStyle(event.currentTarget)
        .direction === 'rtl');

  if (event.key === 'Enter') {
    event.preventDefault();
    openEntry(entry);
    return;
  }
  if (event.key === ' ' || event.key === 'Spacebar') {
    event.preventDefault();
    toggleSelect(entry.id);
    return;
  }
  if (event.key === 'Backspace' && folderId !== null) {
    event.preventDefault();
    const parent = path.length > 1 ? path[path.length - 2] : null;
    goTo(parent?.id ?? null);
    return;
  }

  const columns = layout === 'list' ? 1 : gridColumns;
  const nextIndex = moveFocusIndex(index, children.length, columns, event.key, isRtl);
  if (nextIndex === index) return;
  if (
    event.key === 'ArrowLeft' ||
    event.key === 'ArrowRight' ||
    event.key === 'ArrowUp' ||
    event.key === 'ArrowDown' ||
    event.key === 'Home' ||
    event.key === 'End'
  ) {
    event.preventDefault();
    const next = children[nextIndex];
    if (next) void focusItem(next.id);
  }
}

function thumbSrc(entry: FileEntry): string {
  // Host previews go through the URL policy; engine thumbnails are deterministic
  // SVG data URLs owned by @texuli/data/files (safeImageSrc allows only raster data:).
  const host = safeImageSrc(getPreviewSrc?.(entry as T), 'developer');
  return host ?? thumbnailUrl(entry, { size: 96 });
}
</script>

<section
  id="files-{uid}"
  class={cx(
    'tx-files',
    density === 'compact' && 'tx-files--compact',
    layout === 'list' && 'tx-files--list',
    className
  )}
  aria-labelledby={titleId}
  dir={dir}
  data-file-browser
  data-layout={layout}
>
  <h2 id={titleId} class="tx-files__sr-only">{labels.browser}</h2>

  <header class="tx-files__toolbar">
    <nav class="tx-files__crumbs" aria-label={labels.breadcrumbs}>
      <ol class="tx-files__crumb-list">
        <li class="tx-files__crumb">
          <button
            type="button"
            class={cx('tx-files__crumb-btn', folderId === null && 'tx-files__crumb-btn--current')}
            aria-current={folderId === null ? 'page' : undefined}
            onclick={() => goTo(null)}
          >
            {labels.root}
          </button>
        </li>
        {#each path as crumb, index (crumb.id)}
          <li class="tx-files__crumb" aria-hidden="true">
            <span class="tx-files__crumb-sep">/</span>
          </li>
          <li class="tx-files__crumb">
            <button
              type="button"
              class={cx(
                'tx-files__crumb-btn',
                index === path.length - 1 && 'tx-files__crumb-btn--current'
              )}
              aria-current={index === path.length - 1 ? 'page' : undefined}
              onclick={() => goTo(crumb.id)}
            >
              {crumb.name}
            </button>
          </li>
        {/each}
      </ol>
    </nav>

    <div class="tx-files__layout" role="group" aria-label={labels.layoutGroup}>
      <button
        type="button"
        class={cx('tx-files__layout-btn', layout === 'grid' && 'tx-files__layout-btn--active')}
        aria-pressed={layout === 'grid'}
        onclick={() => emitLayout('grid')}
      >
        {labels.layoutGrid}
      </button>
      <button
        type="button"
        class={cx('tx-files__layout-btn', layout === 'list' && 'tx-files__layout-btn--active')}
        aria-pressed={layout === 'list'}
        onclick={() => emitLayout('list')}
      >
        {labels.layoutList}
      </button>
    </div>
  </header>

  <div class="tx-files__body">
    <div
      id={itemsId}
      class="tx-files__items"
      role="listbox"
      aria-label={labels.items}
      aria-multiselectable="true"
      aria-orientation={layout === 'list' ? 'vertical' : 'horizontal'}
    >
      {#if children.length === 0}
        <p class="tx-files__empty">{labels.empty}</p>
      {:else}
        {#each children as entry, index (entry.id)}
          {@const isSelected = selectedSet.has(entry.id)}
          {@const isFocused = focusId === entry.id}
          {@const cat = categoryOf(entry)}
          {@const src = thumbSrc(entry)}
          {@const detailText =
            entry.kind === 'folder' ? 'Folder' : formatSize(entry.size) || cat}
          <div
            class={cx(
              'tx-files__item',
              isSelected && 'tx-files__item--selected',
              isFocused && 'tx-files__item--focused'
            )}
            role="option"
            tabindex={isFocused ? 0 : -1}
            id="files-{uid}-item-{entry.id}"
            data-file-id={entry.id}
            data-kind={entry.kind}
            data-category={cat}
            aria-selected={isSelected}
            aria-label={`${entry.name}, ${detailText}`}
            onfocus={() => (focusId = entry.id)}
            onkeydown={(event) => onItemKey(event, entry as T, index)}
            onclick={() => openEntry(entry as T)}
            ondblclick={() => openEntry(entry as T)}
          >
            <!-- Decorative selection mark: Space on the option toggles selection. -->
            <span
              class="tx-files__check"
              aria-hidden="true"
              onclick={(event) => {
                event.stopPropagation();
                toggleSelect(entry.id);
              }}
            >
              {#if isSelected}
                <svg viewBox="0 0 16 16" focusable="false" aria-hidden="true"
                  ><path d="m3 8 3.1 3.1L13 4.5" /></svg
                >
              {/if}
            </span>

            <span class="tx-files__open">
              <span class="tx-files__thumb" data-category={cat}>
                {#if src}
                  <img src={src} alt="" width="96" height="96" decoding="async" />
                {/if}
              </span>
              <span class="tx-files__meta">
                {#if itemSnippet}
                  {@render itemSnippet(entry as T, { selected: isSelected, focused: isFocused })}
                {:else}
                  <span class="tx-files__name">{entry.name}</span>
                  <span class="tx-files__detail">{detailText}</span>
                {/if}
              </span>
            </span>
          </div>
        {/each}
      {/if}
    </div>

    <aside class="tx-files__preview" aria-label={labels.preview}>
      {#if preview}
        <div class="tx-files__preview-card">
          <div class="tx-files__preview-thumb" data-category={preview.category}>
            {#if preview.imageSrc}
              <img src={preview.imageSrc} alt="" width="192" height="192" decoding="async" />
            {/if}
          </div>
          <h3 class="tx-files__preview-name">{preview.name}</h3>
          <dl class="tx-files__preview-dl">
            <div>
              <dt>{labels.kind}</dt>
              <dd>{preview.kind === 'folder' ? 'Folder' : preview.category}</dd>
            </div>
            {#if preview.sizeLabel}
              <div>
                <dt>{labels.size}</dt>
                <dd dir="ltr"><bdi>{preview.sizeLabel}</bdi></dd>
              </div>
            {/if}
            {#if preview.updatedAt}
              <div>
                <dt>{labels.modified}</dt>
                <dd dir="ltr"><bdi>{preview.updatedAt}</bdi></dd>
              </div>
            {/if}
          </dl>
        </div>
      {:else}
        <p class="tx-files__preview-empty">{labels.previewEmpty}</p>
      {/if}
    </aside>
  </div>

  <footer class="tx-files__status">
    <span>{labels.selectedCount(selected.length)}</span>
    <p class="tx-files__live" role="status" aria-live="polite" aria-atomic="true">{announcement}</p>
  </footer>
</section>

<style>
  @layer tx.components {
    .tx-files {
      color: var(--tx-foreground, var(--tx-text, CanvasText));
      color-scheme: light dark;
      min-inline-size: 0;
      display: grid;
      gap: 0.75rem;
    }

    .tx-files__sr-only {
      position: absolute;
      inline-size: 1px;
      block-size: 1px;
      padding: 0;
      margin: -1px;
      overflow: hidden;
      clip-path: inset(50%);
      white-space: nowrap;
      border: 0;
    }

    .tx-files__toolbar {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: 0.75rem;
    }

    .tx-files__crumb-list {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 0.25rem;
      margin: 0;
      padding: 0;
      list-style: none;
    }

    .tx-files__crumb-btn {
      margin: 0;
      padding: 0.35rem 0.5rem;
      border: 0;
      border-radius: var(--tx-radius-sm, 0.375rem);
      background: transparent;
      color: inherit;
      font: inherit;
      cursor: pointer;
    }

    .tx-files__crumb-btn--current {
      font-weight: 600;
    }

    .tx-files__crumb-sep {
      color: var(--tx-foreground, CanvasText);
      padding-inline: 0.15rem;
    }

    .tx-files__layout {
      display: inline-flex;
      gap: 0.25rem;
      border: 1px solid var(--tx-border, CanvasText);
      border-radius: var(--tx-radius-md, 0.5rem);
      padding: 0.15rem;
    }

    .tx-files__layout-btn {
      margin: 0;
      padding: 0.35rem 0.65rem;
      border: 0;
      border-radius: var(--tx-radius-sm, 0.375rem);
      background: transparent;
      color: inherit;
      font: inherit;
      cursor: pointer;
      min-block-size: 2.25rem;
    }

    .tx-files__layout-btn--active {
      background: var(--tx-primary, Highlight);
      color: var(--tx-primary-foreground, HighlightText);
      font-weight: 600;
    }

    .tx-files__crumb-btn:focus-visible,
    .tx-files__layout-btn:focus-visible,
    .tx-files__item:focus-visible,
    .tx-files__check:focus-visible,
    .tx-files__open:focus-visible {
      outline: 2px solid var(--tx-ring, Highlight);
      outline-offset: 2px;
    }

    .tx-files__body {
      display: grid;
      grid-template-columns: minmax(0, 1fr) minmax(12rem, 16rem);
      gap: 1rem;
      align-items: start;
    }

    @media (max-width: 40rem) {
      .tx-files__body {
        grid-template-columns: minmax(0, 1fr);
      }
    }

    .tx-files__items {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(8.5rem, 1fr));
      gap: 0.5rem;
      margin: 0;
      padding: 0.5rem;
      border: 1px solid var(--tx-border, CanvasText);
      border-radius: var(--tx-radius-lg, 0.75rem);
      background: var(--tx-surface, Canvas);
      min-block-size: 12rem;
    }

    .tx-files--list .tx-files__items {
      grid-template-columns: minmax(0, 1fr);
    }

    .tx-files--compact .tx-files__items {
      gap: 0.25rem;
      padding: 0.35rem;
    }

    .tx-files__item {
      display: grid;
      grid-template-columns: auto minmax(0, 1fr);
      gap: 0.35rem;
      align-items: start;
      margin: 0;
      padding: 0.35rem;
      border: 1px solid transparent;
      border-radius: var(--tx-radius-md, 0.5rem);
      background: transparent;
      color: inherit;
      text-align: start;
      cursor: default;
    }

    .tx-files--list .tx-files__item {
      align-items: center;
    }

    .tx-files__item--selected {
      background: color-mix(in srgb, var(--tx-primary, Highlight) 12%, transparent);
      border-color: color-mix(in srgb, var(--tx-primary, Highlight) 40%, transparent);
    }

    .tx-files__item--focused {
      border-color: var(--tx-ring, Highlight);
    }

    .tx-files__check {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      inline-size: 1.25rem;
      block-size: 1.25rem;
      margin-block-start: 0.35rem;
      padding: 0;
      border: 1px solid var(--tx-border, CanvasText);
      border-radius: 0.25rem;
      background: var(--tx-surface, Canvas);
      color: inherit;
      cursor: pointer;
    }

    .tx-files__check[aria-pressed='true'] {
      background: var(--tx-primary, Highlight);
      border-color: var(--tx-primary, Highlight);
      color: var(--tx-primary-foreground, Canvas);
    }

    .tx-files__check svg {
      inline-size: 0.85rem;
      block-size: 0.85rem;
      fill: none;
      stroke: currentColor;
      stroke-width: 2;
      stroke-linecap: round;
      stroke-linejoin: round;
    }

    .tx-files__open {
      display: grid;
      gap: 0.35rem;
      margin: 0;
      padding: 0.25rem;
      border: 0;
      border-radius: var(--tx-radius-sm, 0.375rem);
      background: transparent;
      color: inherit;
      font: inherit;
      text-align: start;
      cursor: pointer;
      min-inline-size: 0;
    }

    .tx-files--list .tx-files__open {
      grid-template-columns: 3rem minmax(0, 1fr);
      align-items: center;
      gap: 0.75rem;
    }

    .tx-files__thumb {
      display: grid;
      place-items: center;
      inline-size: 100%;
      aspect-ratio: 1;
      border-radius: var(--tx-radius-md, 0.5rem);
      background: var(--tx-muted, Canvas);
      overflow: hidden;
    }

    .tx-files--list .tx-files__thumb {
      inline-size: 3rem;
      block-size: 3rem;
      aspect-ratio: auto;
    }

    .tx-files__thumb img {
      inline-size: 100%;
      block-size: 100%;
      object-fit: cover;
    }

    .tx-files__meta {
      display: grid;
      gap: 0.15rem;
      min-inline-size: 0;
    }

    .tx-files__name {
      font-weight: 600;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .tx-files__detail {
      font-size: 0.8125rem;
      color: var(--tx-foreground, CanvasText);
    }

    .tx-files__empty {
      margin: 0;
      padding: 1.25rem;
      color: var(--tx-foreground, CanvasText);
      grid-column: 1 / -1;
    }

    .tx-files__preview {
      border: 1px solid var(--tx-border, CanvasText);
      border-radius: var(--tx-radius-lg, 0.75rem);
      background: var(--tx-muted, Canvas);
      padding: 0.75rem;
      min-block-size: 12rem;
    }

    .tx-files__preview-card {
      display: grid;
      gap: 0.75rem;
    }

    .tx-files__preview-thumb {
      display: grid;
      place-items: center;
      border-radius: var(--tx-radius-md, 0.5rem);
      background: var(--tx-surface, Canvas);
      overflow: hidden;
      aspect-ratio: 1;
    }

    .tx-files__preview-thumb img {
      inline-size: 100%;
      block-size: 100%;
      object-fit: contain;
    }

    .tx-files__preview-name {
      margin: 0;
      font-size: 1rem;
      overflow-wrap: anywhere;
    }

    .tx-files__preview-dl {
      margin: 0;
      display: grid;
      gap: 0.5rem;
    }

    .tx-files__preview-dl div {
      display: grid;
      grid-template-columns: 5.5rem minmax(0, 1fr);
      gap: 0.5rem;
      font-size: 0.875rem;
    }

    .tx-files__preview-dl dt {
      margin: 0;
      color: var(--tx-foreground, CanvasText);
    }

    .tx-files__preview-dl dd {
      margin: 0;
    }

    .tx-files__preview-empty {
      margin: 0;
      color: var(--tx-foreground, CanvasText);
    }

    .tx-files__status {
      display: flex;
      flex-wrap: wrap;
      align-items: baseline;
      justify-content: space-between;
      gap: 0.5rem;
      font-size: 0.875rem;
      color: var(--tx-foreground, CanvasText);
    }

    .tx-files__live {
      margin: 0;
      min-block-size: 1.25em;
    }

    @media (forced-colors: active) {
      .tx-files__items,
      .tx-files__preview,
      .tx-files__layout,
      .tx-files__check {
        border-color: CanvasText;
      }
      .tx-files__detail,
      .tx-files__preview-dl dt,
      .tx-files__preview-empty,
      .tx-files__empty {
        color: CanvasText;
      }
      .tx-files__item--selected {
        background: Highlight;
        color: HighlightText;
        forced-color-adjust: none;
      }
      .tx-files__item--selected .tx-files__detail,
      .tx-files__item--selected .tx-files__name {
        color: HighlightText;
      }
      .tx-files__layout-btn--active {
        background: Highlight;
        color: HighlightText;
        forced-color-adjust: none;
      }
    }
  }
</style>
