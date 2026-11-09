<script lang="ts" generics="T">
/**
 * A windowed list (catalog id `data-virtual-list`) on `createVirtualList`.
 * It follows the WAI-ARIA APG **listbox** pattern: one tab stop, focus stays
 * on the listbox and `aria-activedescendant` names the active option, so the
 * active row can be windowed in and out without moving DOM focus. Every
 * option carries `aria-setsize` (the full count) and `aria-posinset` (its
 * 1-based position), so a screen reader announces "12 of 10,000" although
 * only a window is in the DOM.
 *
 * The component owns its spacers and its scroll measurement: the space
 * before and after the window is two `aria-hidden` elements whose size comes
 * from a custom property this component sets (`--tx-virtual-list-spacer`),
 * never from consumer inline style. Rows render through the `row` snippet
 * (or a plain label), are measured as they mount and resize, and keep the
 * scroll position steady when a row above the viewport changes height.
 */

import type { Snippet } from 'svelte';
import type { Attachment } from 'svelte/attachments';
import { type ClassValue, cx } from 'texuli/cx';
import './virtual-list-view.css';
import {
  normalizeVirtualListDensity,
  normalizeVirtualListSize,
  type VirtualListKeyValue,
  type VirtualListRowContext,
  type VirtualListViewDensity,
  type VirtualListViewSize,
  viewportFallback,
  virtualListDescriptionOf,
  virtualListKeyOf,
  virtualListLabelOf,
} from './view-model.ts';
import { createVirtualList, nextVirtualListIndex } from './virtual-list.ts';

interface Props {
  /** The rows. Any length: only a window is rendered. */
  items: readonly T[];
  /** Accessible name of the listbox. */
  label: string;
  /** A stable key per row (default: `item.id`, else the index). */
  getKey?: (item: T, index: number) => VirtualListKeyValue;
  /** The row's text when no `row` snippet is given (default: `item.label`). */
  getLabel?: (item: T, index: number) => string;
  /** Renders one row; it receives the item, its index and its state. */
  row?: Snippet<[VirtualListRowContext<T>]>;
  /** Height in px used for a row until it has been measured. Defaults to 40. */
  estimateSize?: number;
  /** Rows rendered before and after the viewport. Defaults to 3. */
  overscan?: number;
  /** Viewport height: `sm`, `md`, `lg`, or `fill` (the parent's height). */
  size?: VirtualListViewSize;
  /** Row padding. */
  density?: VirtualListViewDensity;
  /** The selected row's key (bindable). */
  selected?: VirtualListKeyValue;
  /** Text shown when there are no rows. */
  emptyLabel?: string;
  /** Called when a row is chosen by click, Enter or Space. */
  onSelect?: (item: T, index: number) => void;
  /** Called when the rendered range changes (for an infinite loader). */
  onRangeChange?: (range: { start: number; end: number }) => void;
  class?: ClassValue;
}

let {
  items,
  label,
  getKey,
  getLabel,
  row,
  estimateSize = 40,
  overscan = 3,
  size = 'md',
  density = 'default',
  selected = $bindable(),
  emptyLabel = 'No items',
  onSelect,
  onRangeChange,
  class: className,
}: Props = $props();

const uid = $props.id();
const listId = `tx-virtual-list-${uid}`;
const emptyId = `${listId}-empty`;
const optionId = (index: number) => `${listId}-option-${index}`;

const safeSize = $derived(normalizeVirtualListSize(size));
const safeDensity = $derived(normalizeVirtualListDensity(density));
const estimate = $derived(Number.isFinite(estimateSize) && estimateSize > 0 ? estimateSize : 40);
const extra = $derived(
  Number.isFinite(overscan) ? Math.min(50, Math.max(0, Math.floor(overscan))) : 3
);

// One engine per estimate; the count follows `items`. Measurements are plain
// engine state, so `version` tells Svelte when the window must be recomputed.
const engine = $derived(createVirtualList({ count: 0, estimateSize: estimate, overscan: extra }));
let version = $state(0);
let scrollTop = $state(0);
let viewportSize = $state(0);
let active = $state(-1);
let viewport: HTMLElement | undefined = $state();

const view = $derived.by(() => {
  void version;
  if (engine.count !== items.length) engine.resize(items.length);
  return engine.window(scrollTop, viewportSize || viewportFallback(safeSize), extra);
});
const last = $derived(view.items.at(-1));
const before = $derived(view.items[0]?.start ?? 0);
const after = $derived(last ? Math.max(0, view.totalSize - (last.start + last.size)) : 0);
const activeInWindow = $derived(active >= view.start && active < view.end);

const keyOf = (item: T, index: number) =>
  getKey ? getKey(item, index) : virtualListKeyOf(item, index);
const labelOf = (item: T, index: number) =>
  getLabel ? getLabel(item, index) : virtualListLabelOf(item, index);

$effect(() => {
  if (active >= items.length) active = items.length - 1;
});

// The window recomputes on every row measurement; report the range only when
// it moves, so an infinite loader is not called again for the same rows.
let reported: { start: number; end: number } | undefined;
$effect(() => {
  const { start, end } = view;
  if (reported?.start === start && reported.end === end) return;
  reported = { start, end };
  onRangeChange?.({ start, end });
});

/** Measures the scroll viewport (the listbox) and follows its size. */
const trackViewport: Attachment<HTMLElement> = (element) => {
  viewport = element;
  const read = () => {
    viewportSize = element.clientHeight;
  };
  read();
  if (typeof ResizeObserver !== 'function') return;
  const observer = new ResizeObserver(read);
  observer.observe(element);
  return () => observer.disconnect();
};

/** Measures a rendered row; a row above the viewport keeps the content still. */
function measureRow(index: number): Attachment<HTMLElement> {
  return (element) => {
    const read = () => {
      const height = element.getBoundingClientRect().height;
      if (!(height > 0) || index >= engine.count) return;
      const previous = engine.sizeOf(index);
      if (previous === height || !engine.measure(index, height)) return;
      if (viewport && engine.offsetOf(index) + previous <= viewport.scrollTop) {
        viewport.scrollTop += height - previous;
        scrollTop = viewport.scrollTop;
      }
      version += 1;
    };
    read();
    if (typeof ResizeObserver !== 'function') return;
    const observer = new ResizeObserver(read);
    observer.observe(element);
    return () => observer.disconnect();
  };
}

function onscroll(event: Event): void {
  scrollTop = (event.currentTarget as HTMLElement).scrollTop;
}

/** Scrolls the list so the row at `index` is fully visible. */
export function scrollToIndex(index: number): void {
  if (!Number.isInteger(index) || index < 0 || index >= items.length) return;
  const top = engine.offsetOf(index);
  const height = engine.sizeOf(index);
  const span = viewportSize || viewportFallback(safeSize);
  let next = scrollTop;
  if (top < scrollTop) next = top;
  else if (top + height > scrollTop + span) next = top + height - span;
  if (next === scrollTop) return;
  if (viewport) viewport.scrollTop = next;
  scrollTop = next;
}

function choose(index: number): void {
  const item = items[index];
  if (item === undefined) return;
  active = index;
  selected = keyOf(item, index);
  onSelect?.(item, index);
}

function onfocus(): void {
  if (active >= 0 || items.length === 0) return;
  const chosen =
    selected === undefined ? -1 : items.findIndex((item, index) => keyOf(item, index) === selected);
  active = chosen >= 0 ? chosen : engine.indexAt(scrollTop);
  scrollToIndex(active);
}

function onkeydown(event: KeyboardEvent): void {
  if (items.length === 0 || event.altKey || event.ctrlKey || event.metaKey) return;
  if (event.key === 'Enter' || event.key === ' ') {
    if (active >= 0) {
      event.preventDefault();
      choose(active);
    }
    return;
  }
  const pageSize = Math.max(1, Math.floor((viewportSize || viewportFallback(safeSize)) / estimate));
  const next = nextVirtualListIndex(Math.max(0, active), event.key, {
    count: items.length,
    pageSize,
  });
  if (next === null) return;
  event.preventDefault();
  active =
    active < 0 && event.key !== 'End' && event.key !== 'PageDown' && event.key !== 'Home'
      ? 0
      : next;
  scrollToIndex(active);
}
</script>

<div
  class={cx('tx-virtual-list', `tx-virtual-list--${safeSize}`, `tx-virtual-list--${safeDensity}`, className)}
  data-tx-component="data-virtual-list"
  data-tx-size={safeSize}
  data-tx-density={safeDensity}
>
  <div
    {@attach trackViewport}
    id={listId}
    class="tx-virtual-list__viewport"
    role="listbox"
    tabindex={items.length === 0 ? -1 : 0}
    aria-label={label}
    aria-activedescendant={activeInWindow ? optionId(active) : undefined}
    aria-describedby={items.length === 0 ? emptyId : undefined}
    {onscroll}
    {onfocus}
    {onkeydown}
  >
    <div
      class="tx-virtual-list__spacer"
      aria-hidden="true"
      data-tx-virtual-list-spacer="before"
      style:--tx-virtual-list-spacer="{before}px"
    ></div>
    {#each view.items as entry (entry.index)}
      {@const item = items[entry.index] as T}
      {@const key = keyOf(item, entry.index)}
      {@const isSelected = selected !== undefined && key === selected}
      {@const isActive = entry.index === active}
      <!-- svelte-ignore a11y_click_events_have_key_events, a11y_interactive_supports_focus -- APG listbox with aria-activedescendant: the listbox holds focus and the keys. -->
      <div
        {@attach measureRow(entry.index)}
        id={optionId(entry.index)}
        class="tx-virtual-list__option"
        role="option"
        aria-selected={isSelected}
        aria-setsize={items.length}
        aria-posinset={entry.index + 1}
        data-index={entry.index}
        data-active={isActive ? '' : undefined}
        onclick={() => choose(entry.index)}
      >
        {#if row}
          {@render row({ item, index: entry.index, active: isActive, selected: isSelected })}
        {:else}
          <span class="tx-virtual-list__label">{labelOf(item, entry.index)}</span>
          {@const description = virtualListDescriptionOf(item)}
          {#if description}
            <span class="tx-virtual-list__description">{description}</span>
          {/if}
        {/if}
      </div>
    {/each}
    <div
      class="tx-virtual-list__spacer"
      aria-hidden="true"
      data-tx-virtual-list-spacer="after"
      style:--tx-virtual-list-spacer="{after}px"
    ></div>
  </div>
  {#if items.length === 0}
    <p id={emptyId} class="tx-virtual-list__empty">{emptyLabel}</p>
  {/if}
</div>
