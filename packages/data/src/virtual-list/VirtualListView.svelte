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
 *
 * Keys act only on the element that owns them (`event.target` is the
 * listbox, or the article): a key typed in a row's own input or pressed on a
 * row's button is never taken.
 *
 * `mode="feed"` follows the APG **feed** pattern instead, for rows that hold
 * their own buttons, links or inputs: the scroller is `role="feed"`, each row
 * an `<article>` with `aria-setsize` and `aria-posinset`, focusable without
 * selection (one article is the tab stop, the others `tabindex="-1"`), and
 * Page Down / Page Up move focus to the next or previous article. A feed has
 * no selection. `selectable={false}` keeps a listbox from selecting rows.
 * Feeds and non-selectable lists use a plain row (no option padding, border,
 * hover or cursor), so a row snippet brings its own chrome.
 *
 * A feed article is named by `aria-labelledby`: the row's label when there is
 * no row snippet; otherwise the element whose id the snippet receives as
 * `labelId` (or `getRowLabelId` returns), else the row's first heading with an
 * id, else `aria-label` with the row's label text. `surface="plain"` drops the
 * viewport's border, radius and surface.
 *
 * Uniform component contract (docs/STANDARDS.md): `ref` binds the root, which
 * takes `class`, `style` and `hidden`; `id`, `aria-*`, `data-*` and handlers
 * go to the scroller (the listbox or the feed), as a split form control sends
 * them to its control. A caller `onkeydown` runs first and skips the
 * listbox's own keys when it calls `preventDefault()`; a caller `onscroll` and
 * `onfocus` run alongside the scroll and focus bookkeeping, which always runs.
 */

import { type Snippet, tick } from 'svelte';
import type { Attachment } from 'svelte/attachments';
import type { HTMLAttributes } from 'svelte/elements';
import { type ClassValue, cx } from 'texuli/cx';
import './virtual-list-view.css';
import {
  normalizeVirtualListDensity,
  normalizeVirtualListMode,
  normalizeVirtualListSize,
  normalizeVirtualListSurface,
  type VirtualListKeyValue,
  type VirtualListRowContext,
  type VirtualListViewDensity,
  type VirtualListViewMode,
  type VirtualListViewSize,
  type VirtualListViewSurface,
  viewportFallback,
  virtualListDescriptionOf,
  virtualListKeyOf,
  virtualListLabelOf,
} from './view-model.ts';
import { createVirtualList, nextVirtualListIndex } from './virtual-list.ts';

interface OwnProps {
  /** The rows. Any length: only a window is rendered. */
  items: readonly T[];
  /** Accessible name of the listbox or feed. */
  label: string;
  /**
   * `listbox` (default): one tab stop, rows are options to pick. `feed`: the
   * APG feed pattern; rows are articles that may hold their own controls.
   */
  mode?: VirtualListViewMode;
  /**
   * Listbox only. `false`: rows are never selected or painted as selected
   * (`selected` is not written); Enter, Space and a click still call
   * `onSelect`, so a row can open something. Defaults to true.
   */
  selectable?: boolean;
  /** A stable key per row (default: `item.id`, else the index). */
  getKey?: (item: T, index: number) => VirtualListKeyValue;
  /** The row's text when no `row` snippet is given (default: `item.label`). */
  getLabel?: (item: T, index: number) => string;
  /** Renders one row; it receives the item, its index, its state and the feed's `labelId`. */
  row?: Snippet<[VirtualListRowContext<T>]>;
  /**
   * Feed mode: the id of the element inside the row snippet that names the
   * article (its heading). Default: the `labelId` the snippet receives.
   */
  getRowLabelId?: (item: T, index: number) => string | undefined;
  /** Height in px used for a row until it has been measured. Defaults to 40. */
  estimateSize?: number;
  /** Rows rendered before and after the viewport. Defaults to 3. */
  overscan?: number;
  /** Viewport height: `sm`, `md`, `lg`, or `fill` (the parent's height). */
  size?: VirtualListViewSize;
  /** Row padding. */
  density?: VirtualListViewDensity;
  /** `box` (default): border, radius and surface. `plain`: none, for a feed of cards. */
  surface?: VirtualListViewSurface;
  /** The selected row's key (bindable). */
  selected?: VirtualListKeyValue;
  /** Text shown when there are no rows. */
  emptyLabel?: string;
  /** Listbox: called when a row is chosen by click, Enter or Space. A feed never calls it. */
  onSelect?: (item: T, index: number) => void;
  /** Called when the rendered range changes (for an infinite loader). */
  onRangeChange?: (range: { start: number; end: number }) => void;
  class?: ClassValue;
  /** The root element (bindable). */
  ref?: HTMLElement | null;
}

type Props = OwnProps & Omit<HTMLAttributes<HTMLElement>, keyof OwnProps | 'children'>;

let {
  items,
  label,
  mode = 'listbox',
  selectable = true,
  getKey,
  getLabel,
  row,
  getRowLabelId,
  estimateSize = 40,
  overscan = 3,
  size = 'md',
  density = 'default',
  surface = 'box',
  selected = $bindable(),
  emptyLabel = 'No items',
  onSelect,
  onRangeChange,
  class: className,
  ref = $bindable(null),
  id,
  style,
  hidden,
  onkeydown: callerKeydown,
  onscroll: callerScroll,
  onfocus: callerFocus,
  'aria-describedby': callerDescribedBy,
  ...rest
}: Props = $props();

const uid = $props.id();
const listId = $derived(id || `tx-virtual-list-${uid}`);
const emptyId = $derived(`${listId}-empty`);
const optionId = (index: number) => `${listId}-option-${index}`;

const safeSize = $derived(normalizeVirtualListSize(size));
const safeDensity = $derived(normalizeVirtualListDensity(density));
const safeMode = $derived(normalizeVirtualListMode(mode));
const safeSurface = $derived(normalizeVirtualListSurface(surface));
const isFeed = $derived(safeMode === 'feed');
const canSelect = $derived(!isFeed && selectable !== false);
// Feeds and non-selectable lists drop the option chrome; the row snippet owns it.
const plain = $derived(isFeed || selectable === false);
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
// A feed's one tab stop: the focused article, else the first rendered one.
const tabStop = $derived(activeInWindow ? active : view.start);

const keyOf = (item: T, index: number) =>
  getKey ? getKey(item, index) : virtualListKeyOf(item, index);
const labelOf = (item: T, index: number) =>
  getLabel ? getLabel(item, index) : virtualListLabelOf(item, index);
const labelIdOf = (item: T, index: number) =>
  (row && getRowLabelId?.(item, index)) || `${optionId(index)}-label`;

const HEADING = 'h1[id], h2[id], h3[id], h4[id], h5[id], h6[id], [role="heading"][id]';

/**
 * Feed, row snippet: name the article by the element with `labelId` inside it,
 * else its first heading with an id, else by `aria-label` with the row's text,
 * so an article is never unnamed and never points at a missing id.
 */
function nameArticle(labelId: string, fallback: string): Attachment<HTMLElement> {
  return (element) => {
    const own = element.ownerDocument.getElementById(labelId);
    const target = own && element.contains(own) ? own : element.querySelector(HEADING);
    if (target?.id) {
      element.setAttribute('aria-labelledby', target.id);
      element.removeAttribute('aria-label');
    } else {
      element.removeAttribute('aria-labelledby');
      element.setAttribute('aria-label', fallback);
    }
  };
}

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

type ViewportEvent<E extends Event> = E & { currentTarget: EventTarget & HTMLDivElement };

/** The caller's `onscroll` runs; the scroll position is always tracked. */
function handleScroll(event: ViewportEvent<UIEvent>): void {
  callerScroll?.(event);
  scrollTop = event.currentTarget.scrollTop;
}

/** The caller's `onfocus` runs; the listbox always picks its active row. */
function handleFocus(event: ViewportEvent<FocusEvent>): void {
  callerFocus?.(event);
  if (!isFeed) listboxFocus();
}

/** The caller's `onkeydown` runs first; `preventDefault()` skips the listbox keys. */
function handleKeydown(event: ViewportEvent<KeyboardEvent>): void {
  callerKeydown?.(event);
  if (event.defaultPrevented || isFeed) return;
  listboxKeydown(event);
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
  if (canSelect) selected = keyOf(item, index);
  onSelect?.(item, index);
}

function listboxFocus(): void {
  if (active >= 0 || items.length === 0) return;
  const chosen =
    selected === undefined ? -1 : items.findIndex((item, index) => keyOf(item, index) === selected);
  active = chosen >= 0 ? chosen : engine.indexAt(scrollTop);
  scrollToIndex(active);
}

function listboxKeydown(event: KeyboardEvent): void {
  // A key in a row's own control (an input, a button) belongs to that control.
  if (event.target !== event.currentTarget) return;
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
/** Feed: scroll the article at `index` into the window, then move focus to it. */
async function focusArticle(index: number): Promise<void> {
  active = index;
  scrollToIndex(index);
  await tick();
  viewport?.ownerDocument.getElementById(optionId(index))?.focus();
}

/** Feed: Page Down / Page Up on an article move focus to the next or previous one. */
function onArticleKeydown(event: KeyboardEvent, index: number): void {
  if (event.target !== event.currentTarget) return;
  if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
  let next: number;
  if (event.key === 'PageDown') next = Math.min(items.length - 1, index + 1);
  else if (event.key === 'PageUp') next = Math.max(0, index - 1);
  else return;
  event.preventDefault();
  if (next !== index) void focusArticle(next);
}
</script>

<div
  bind:this={ref}
  class={cx('tx-virtual-list', `tx-virtual-list--${safeSize}`, `tx-virtual-list--${safeDensity}`, isFeed && 'tx-virtual-list--feed', safeSurface === 'plain' && 'tx-virtual-list--plain', className)}
  {style}
  {hidden}
  data-tx-component="data-virtual-list"
  data-tx-size={safeSize}
  data-tx-density={safeDensity}
  data-tx-surface={safeSurface}
>
  <!-- svelte-ignore a11y_no_noninteractive_tabindex -- the role is dynamic: a listbox (tab stop) or a feed (no tabindex; its articles take focus). -->
  <div
    {...rest}
    {@attach trackViewport}
    id={listId}
    class="tx-virtual-list__viewport"
    role={isFeed ? 'feed' : 'listbox'}
    tabindex={isFeed ? undefined : items.length === 0 ? -1 : 0}
    aria-label={label}
    aria-activedescendant={!isFeed && activeInWindow ? optionId(active) : undefined}
    aria-describedby={[callerDescribedBy, items.length === 0 ? emptyId : undefined].filter(Boolean).join(' ') || undefined}
    data-tx-mode={safeMode}
    onscroll={handleScroll}
    onfocus={handleFocus}
    onkeydown={handleKeydown}
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
      {@const isSelected = canSelect && selected !== undefined && key === selected}
      {@const isActive = entry.index === active}
      {@const labelId = labelIdOf(item, entry.index)}
      {#snippet content()}
        {#if row}
          {@render row({ item, index: entry.index, active: isActive, selected: isSelected, labelId })}
        {:else}
          <span id={labelId} class="tx-virtual-list__label">{labelOf(item, entry.index)}</span>
          {@const description = virtualListDescriptionOf(item)}
          {#if description}
            <span class="tx-virtual-list__description">{description}</span>
          {/if}
        {/if}
      {/snippet}
      {#if isFeed}
        <!-- svelte-ignore a11y_no_noninteractive_tabindex, a11y_no_noninteractive_element_interactions -- APG feed: each article is focusable and owns Page Up / Page Down. -->
        <article
          {@attach measureRow(entry.index)}
          {@attach row ? nameArticle(labelId, labelOf(item, entry.index)) : undefined}
          id={optionId(entry.index)}
          class="tx-virtual-list__row"
          tabindex={entry.index === tabStop ? 0 : -1}
          aria-setsize={items.length}
          aria-posinset={entry.index + 1}
          aria-labelledby={row ? undefined : labelId}
          data-index={entry.index}
          data-active={isActive ? '' : undefined}
          onfocusin={() => (active = entry.index)}
          onkeydown={(event) => onArticleKeydown(event, entry.index)}
        >
          {@render content()}
        </article>
      {:else}
        <!-- svelte-ignore a11y_click_events_have_key_events, a11y_interactive_supports_focus -- APG listbox with aria-activedescendant: the listbox holds focus and the keys. -->
        <div
          {@attach measureRow(entry.index)}
          id={optionId(entry.index)}
          class={plain ? 'tx-virtual-list__row' : 'tx-virtual-list__option'}
          role="option"
          aria-selected={canSelect ? isSelected : undefined}
          aria-setsize={items.length}
          aria-posinset={entry.index + 1}
          data-index={entry.index}
          data-active={isActive ? '' : undefined}
          onclick={() => choose(entry.index)}
        >
          {@render content()}
        </div>
      {/if}
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
