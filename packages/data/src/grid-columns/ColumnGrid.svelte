<script lang="ts" generics="T">
import { lazyChunk } from '@texuli/core/lazy';
import type { Point } from '@texuli/drag';
import type { CollisionStrategy, Droppable } from '@texuli/drag/collision';
import { bindPointerGesture, createPointerTracker } from '@texuli/drag/gesture';
import type { Component } from 'svelte';
import { tick } from 'svelte';
import type { Attachment } from 'svelte/attachments';
import { type ClassValue, cx } from 'texuli/cx';
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableEmpty,
  TableHead,
  TableHeader,
  TableRow,
} from 'texuli/table';
import {
  type ColumnState,
  defaultColumnState,
  pinColumn,
  type ResolvedColumn,
  resolveColumns,
  setColumnHidden,
  showAllColumns,
} from '../engines/grid/columns.ts';
import type { GridSort } from '../engines/grid/sort.ts';
import {
  ariaSort,
  type CellPosition,
  cellText,
  clampCell,
  type DataGridColumn,
  gridRows,
  moveCell,
  nextSort,
  searchRows,
} from '../grid-core/model.ts';
import { type ColumnGridLabels, resolveColumnGridLabels } from './labels.ts';
import {
  type ColumnGroupDef,
  type ColumnMenuAction,
  canHideColumn,
  canMoveColumn,
  columnDropCollision,
  completeState,
  headerGroups,
  moveColumnBy,
  moveColumnTo,
  orderedColumns,
  type PinOffset,
  parseColumnState,
  pinOffsets,
  pinsFit,
  RESIZE_STEP,
  resetColumnWidth,
  resizeColumnBy,
  totalWidth,
  zoneOf,
} from './model.ts';
import type { ColumnGridProps } from './props.ts';
import '../grid-core/grid-core.css';
import './grid-columns.css';

/**
 * ColumnGrid: the data grid with column operations. Columns can be resized
 * (drag the header edge), reordered (drag a header), pinned to the inline
 * start or end (sticky while the grid scrolls), hidden and shown (the column
 * chooser), and grouped under spanning headers. Every pointer operation has a
 * keyboard path through the column menu. The column state is the grid
 * engine's plain `ColumnState`, safe to persist and validated when read.
 */
let {
  rows,
  columns,
  getRowId,
  caption,
  captionHidden = false,
  groups = [],
  columnState = $bindable([]),
  onColumnStateChange,
  sort = $bindable([]),
  onSortChange,
  search = $bindable(''),
  searchable = false,
  filter,
  onRowActivate,
  cell,
  empty,
  loading = false,
  maxBlockSize,
  density = 'default',
  locale,
  resizable = true,
  reorderable = true,
  pinnable = true,
  hideable = true,
  labels,
  class: className,
}: ColumnGridProps<T> = $props();

const text = $derived(resolveColumnGridLabels(labels));
const uid = $props.id();
const searchId = `${uid}-search`;
const instructionsId = `${uid}-instructions`;
const chooserId = `${uid}-chooser`;

const current = $derived(completeState(columns, parseColumnState(columnState)));
const resolved = $derived(resolveColumns(columns, current));
const ordered = $derived(orderedColumns(resolved) as ResolvedColumn<T>[]);
const visibleDefs = $derived(ordered.map((column) => column.def as DataGridColumn<T>));
const offsets = $derived(pinOffsets(resolved));
const runs = $derived(groups.length > 0 ? headerGroups(resolved, groups) : []);
const tableWidth = $derived(totalWidth(resolved));

/** The grid's visible width: pins only stick while they leave room for the rest. */
let frameWidth = $state(0);
const stickyPins = $derived(pinsFit(resolved, frameWidth));
const RESIZE_SETTLE_MS = 120;

// Filter and sort read every column; search reads only what is on screen.
const sorted = $derived(gridRows(rows, { columns, sort, filter, ...(locale ? { locale } : {}) }));
const visible = $derived(search ? searchRows(sorted, visibleDefs, search) : sorted);
const colCount = $derived(ordered.length);
const rowCount = $derived(1 + Math.max(visible.length, 1));
const headerRows = $derived(runs.length > 0 ? 2 : 1);

let active = $state<CellPosition>({ row: 0, col: 0 });
let root: HTMLDivElement | undefined = $state();
let chooserOpen = $state(false);
let announcement = $state('');
const tableElement = () => root?.querySelector('table') ?? null;

$effect(() => {
  const next = clampCell(active, rowCount, colCount);
  if (next.row !== active.row || next.col !== active.col) active = next;
});

// Measured on mount; later changes apply once they hold for RESIZE_SETTLE_MS
// (a scrollbar toggle or a full-page capture briefly changes the width).
$effect(() => {
  const node = root;
  if (!node || typeof ResizeObserver === 'undefined') return;
  frameWidth = Math.round(node.getBoundingClientRect().width);
  const view = node.ownerDocument.defaultView ?? globalThis;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const observer = new ResizeObserver((entries) => {
    const next = Math.round(entries[0]?.contentRect.width ?? 0);
    clearTimeout(timer);
    timer = view.setTimeout(() => {
      if (next > 0) frameWidth = next;
    }, RESIZE_SETTLE_MS);
  });
  observer.observe(node);
  return () => {
    clearTimeout(timer);
    observer.disconnect();
  };
});

// The column menu (and the Menu primitive behind it) loads after the first
// paint, so a read-only grid does not pay for it up front.
let ColumnMenu = $state<Component<Record<string, unknown>> | undefined>();
let columnMenuReady = $state(false);
$effect(() => {
  if (ColumnMenu) {
    columnMenuReady = true;
    return;
  }
  void lazyChunk('data:grid:column-menu', () => import('./ColumnMenu.svelte')).then((module) => {
    ColumnMenu = module.default as unknown as Component<Record<string, unknown>>;
    columnMenuReady = true;
  });
});

function commitState(next: ColumnState): void {
  columnState = next;
  onColumnStateChange?.(next);
}

function setSort(next: GridSort): void {
  sort = next;
  onSortChange?.(next);
}

function align(column: DataGridColumn<T>): 'start' | 'center' | 'end' {
  return column.align ?? (column.type === 'number' ? 'end' : 'start');
}

function isRtl(): boolean {
  const grid = tableElement();
  return grid ? getComputedStyle(grid).direction === 'rtl' : false;
}

function pinStyle(pin: PinOffset | undefined, extra = ''): string | undefined {
  if (!pin || !stickyPins) return extra || undefined;
  const edge = pin.side === 'start' ? 'inset-inline-start' : 'inset-inline-end';
  return `${edge}: ${pin.offset}px;${extra}`;
}

const isActive = (row: number, col: number) => active.row === row && active.col === col;

function focusTarget(position: CellPosition): HTMLElement | null {
  const cellElement = tableElement()?.querySelector<HTMLElement>(
    `[data-tx-grid-cell="${position.row}:${position.col}"]`
  );
  return cellElement?.querySelector<HTMLElement>('[data-tx-grid-widget]') ?? cellElement ?? null;
}

async function focusCell(position: CellPosition): Promise<void> {
  active = position;
  await tick();
  focusTarget(position)?.focus();
}

/** After a column operation, keep focus on that column's header wherever it went. */
async function focusColumn(key: string): Promise<void> {
  await tick();
  const col = ordered.findIndex((column) => column.def.key === key);
  if (col >= 0) await focusCell({ row: 0, col });
}

function positionOf(target: EventTarget | null): CellPosition | null {
  const cellElement = (target as Element | null)?.closest?.('[data-tx-grid-cell]');
  const value = cellElement?.getAttribute('data-tx-grid-cell');
  if (!value) return null;
  const [row, col] = value.split(':').map(Number);
  return { row: row ?? 0, col: col ?? 0 };
}

function openMenu(col: number): void {
  const trigger = tableElement()?.querySelector<HTMLButtonElement>(
    `[data-tx-grid-cell="0:${col}"] [data-tx-grid-menu]`
  );
  if (!trigger || trigger.getAttribute('aria-disabled') === 'true') return;
  trigger.focus();
  // A keyboard-style click (detail 0) opens the menu on its first item.
  trigger.click();
}

function handleKeydown(event: KeyboardEvent): void {
  const position = positionOf(event.target);
  if (!position) return;
  // Inside a cell's own widgets (the column menu button), keys are theirs.
  if ((event.target as Element).closest('[data-tx-grid-menu]')) return;
  if (
    position.row === 0 &&
    ((event.altKey && event.key === 'ArrowDown') ||
      (event.shiftKey && event.key === 'F10') ||
      event.key === 'ContextMenu')
  ) {
    event.preventDefault();
    openMenu(position.col);
    return;
  }
  if (event.altKey) return;
  const next = moveCell(position, event, { rows: rowCount, cols: colCount, rtl: isRtl() });
  if (next) {
    event.preventDefault();
    void focusCell(next);
    return;
  }
  const bodyRow = position.row > 0 ? visible[position.row - 1] : undefined;
  if (bodyRow && event.key === 'Enter' && onRowActivate) {
    event.preventDefault();
    onRowActivate(bodyRow);
  }
}

function handleFocusIn(event: FocusEvent): void {
  const position = positionOf(event.target);
  if (position && (position.row !== active.row || position.col !== active.col)) active = position;
}

// ---- Column operations -------------------------------------------------

function header(key: string): string {
  return columns.find((column) => column.key === key)?.header ?? key;
}

function announceMove(key: string, next: ColumnState): void {
  const after = orderedColumns(resolveColumns(columns, next));
  const index = after.findIndex((column) => column.def.key === key);
  if (index >= 0) announcement = text.moved(header(key), index + 1, after.length);
}

function hide(key: string): void {
  if (!canHideColumn(resolved, key)) return;
  commitState(setColumnHidden(current, key, true));
  // A hidden column cannot show its sort, so it stops sorting.
  if (sort.some((entry) => entry.key === key)) setSort(sort.filter((entry) => entry.key !== key));
  announcement = text.hidden(header(key));
}

function show(key: string): void {
  commitState(setColumnHidden(current, key, false));
  announcement = text.shown(header(key));
}

function runAction(key: string, id: string): void {
  let next: ColumnState | null = null;
  switch (id) {
    case 'sort-asc':
      setSort([{ key, direction: 'asc' }]);
      break;
    case 'sort-desc':
      setSort([{ key, direction: 'desc' }]);
      break;
    case 'sort-clear':
      setSort(sort.filter((entry) => entry.key !== key));
      break;
    case 'move-earlier':
    case 'move-later':
      next = moveColumnBy(columns, resolved, current, key, id === 'move-earlier' ? -1 : 1);
      commitState(next);
      announceMove(key, next);
      break;
    case 'pin-start':
    case 'pin-end':
    case 'unpin': {
      const side = id === 'pin-start' ? 'left' : id === 'pin-end' ? 'right' : null;
      commitState(pinColumn(current, key, side));
      announcement = text.pinned(
        header(key),
        side === 'left' ? 'start' : side === 'right' ? 'end' : null
      );
      break;
    }
    case 'wider':
    case 'narrower': {
      next = resizeColumnBy(
        columns,
        resolved,
        current,
        key,
        id === 'wider' ? RESIZE_STEP.small * 2 : -RESIZE_STEP.small * 2
      );
      commitState(next);
      const width = orderedColumns(resolveColumns(columns, next)).find(
        (c) => c.def.key === key
      )?.width;
      if (width) announcement = text.resized(header(key), width);
      break;
    }
    case 'reset-width':
      commitState(resetColumnWidth(current, key));
      break;
    case 'hide':
      hide(key);
      // Focus moves to the neighbor that took the column's place.
      void focusCell(clampCell(active, rowCount, colCount - 1));
      return;
  }
  void focusColumn(key);
}

function menuGroups(column: ResolvedColumn<T>): ColumnMenuAction[][] {
  const key = column.def.key;
  const def = column.def as DataGridColumn<T>;
  const out: ColumnMenuAction[][] = [];
  if (def.sortable !== false) {
    const direction = sort.find((entry) => entry.key === key)?.direction;
    out.push([
      {
        id: 'sort-asc',
        label: text.sortAscending,
        disabled: direction === 'asc' && sort.length === 1,
      },
      {
        id: 'sort-desc',
        label: text.sortDescending,
        disabled: direction === 'desc' && sort.length === 1,
      },
      { id: 'sort-clear', label: text.clearSort, disabled: !direction },
    ]);
  }
  if (reorderable) {
    out.push([
      { id: 'move-earlier', label: text.moveEarlier, disabled: !canMoveColumn(resolved, key, -1) },
      { id: 'move-later', label: text.moveLater, disabled: !canMoveColumn(resolved, key, 1) },
    ]);
  }
  if (pinnable) {
    out.push([
      { id: 'pin-start', label: text.pinStart, disabled: column.pinned === 'left' },
      { id: 'pin-end', label: text.pinEnd, disabled: column.pinned === 'right' },
      { id: 'unpin', label: text.unpin, disabled: !column.pinned },
    ]);
  }
  if (resizable) {
    out.push([
      { id: 'wider', label: text.wider, keepOpen: true },
      { id: 'narrower', label: text.narrower, keepOpen: true },
      { id: 'reset-width', label: text.resetWidth },
    ]);
  }
  if (hideable)
    out.push([{ id: 'hide', label: text.hideColumn, disabled: !canHideColumn(resolved, key) }]);
  return out;
}

const menusEnabled = $derived(
  resizable || reorderable || pinnable || hideable || columns.some((c) => c.sortable !== false)
);

// ---- Pointer: resize and reorder ----------------------------------------

let resizing = $state<string | null>(null);
let dragging = $state<{
  key: string;
  target: { key: string; side: 'before' | 'after' } | null;
} | null>(null);
let suppressClick = false;

// Both run on @texuli/drag/gesture. Resize: capture on the grip, no threshold.
// Reorder: a 6 px sideways threshold and no capture (the header holds the sort
// button and the menu, whose clicks capture would retarget), heard on the
// window; the zone's header cells are measured when the drag starts and on
// scroll, and `columnDropCollision` (wrapping `dropTarget`) picks the side.

/** Pointer resize from a header's inline-end grip. */
function resizeFrom(key: string): Attachment<HTMLElement> {
  return (handle) => {
    // Read at press time only: the attachment itself must not track grid state.
    let base: typeof current | null = null;
    let startResolved: typeof resolved | null = null;
    let direction = 1;
    const onDown = (event: PointerEvent) => {
      if (event.button !== 0) return;
      // The grip never starts a header reorder or selects text.
      event.preventDefault();
      event.stopPropagation();
      base = current;
      startResolved = resolved;
      direction = isRtl() ? -1 : 1;
      resizing = key;
    };
    const end = () => {
      if (resizing !== key) return;
      resizing = null;
      const width = orderedColumns(resolved).find((c) => c.def.key === key)?.width;
      if (width) announcement = text.resized(header(key), width);
    };
    handle.addEventListener('pointerdown', onDown);
    const dispose = bindPointerGesture(
      handle,
      createPointerTracker({
        threshold: 0,
        onMove: (event) => {
          if (base && startResolved) {
            commitState(
              resizeColumnBy(columns, startResolved, base, key, event.delta.x * direction)
            );
          }
        },
        onEnd: end,
        onClick: end,
        onCancel: end,
      })
    );
    return () => {
      handle.removeEventListener('pointerdown', onDown);
      dispose();
    };
  };
}

/** Pointer reorder from a header cell, inside its pin zone. */
function reorderFrom(key: string): Attachment<HTMLElement> {
  return (cell) => {
    const view = cell.ownerDocument.defaultView;
    let cells: Droppable[] = [];
    let collision: CollisionStrategy = columnDropCollision();
    let stopScroll: (() => void) | null = null;
    const measure = (zone: string) => {
      cells = [
        ...(tableElement()?.querySelectorAll<HTMLElement>(
          `th[data-column-key][data-zone="${zone}"]`
        ) ?? []),
      ].map((th) => {
        const box = th.getBoundingClientRect();
        return {
          id: th.dataset.columnKey ?? '',
          rect: { x: box.left, y: box.top, width: box.right - box.left, height: box.height },
        };
      });
    };
    const targetAt = (point: Point) => {
      const hit = collision({ pointer: point, droppables: cells });
      return hit?.side ? { key: hit.id, side: hit.side } : null;
    };
    const finish = () => {
      stopScroll?.();
      stopScroll = null;
    };
    return bindPointerGesture(
      cell,
      createPointerTracker({
        axis: 'x',
        threshold: 6,
        onStart: (event) => {
          const column = orderedColumns(resolved).find((entry) => entry.def.key === key);
          if (!column) return;
          const zone = zoneOf(column);
          collision = columnDropCollision(isRtl());
          measure(zone);
          const onScroll = () => measure(zone);
          cell.ownerDocument.addEventListener('scroll', onScroll, true);
          stopScroll = () => cell.ownerDocument.removeEventListener('scroll', onScroll, true);
          dragging = { key, target: targetAt(event.point) };
        },
        onMove: (event) => {
          if (dragging) dragging = { key, target: targetAt(event.point) };
        },
        onEnd: () => {
          finish();
          const drop = dragging?.target;
          if (dragging) suppressClick = true;
          dragging = null;
          if (drop && drop.key !== key) {
            const next = moveColumnTo(columns, resolved, current, key, drop.key, drop.side);
            if (next !== current) {
              commitState(next);
              announceMove(key, next);
              void focusColumn(key);
            }
          }
        },
        onCancel: () => {
          finish();
          dragging = null;
        },
      }),
      {
        capture: false,
        ...(view ? { listenOn: view } : {}),
        accept: (event) =>
          reorderable &&
          !(
            event.target instanceof Element &&
            event.target.closest('[data-tx-grid-menu], .tx-grid-columns__resize')
          ),
      }
    );
  };
}

function sortClick(event: MouseEvent, key: string): void {
  // The click that ends a header drag does not sort.
  if (suppressClick) {
    suppressClick = false;
    return;
  }
  setSort(nextSort(sort, key, event.shiftKey));
}

function dropSide(key: string): 'before' | 'after' | undefined {
  return dragging?.target?.key === key && dragging.key !== key ? dragging.target.side : undefined;
}
</script>

<div
  bind:this={root}
  class={cx('tx-data-grid', 'tx-grid-columns', className)}
  data-tx-data-grid
  data-tx-grid-columns
  data-column-menu-ready={columnMenuReady ? 'true' : 'false'}
  data-grouped={runs.length > 0 ? '' : undefined}
  data-dragging={dragging ? '' : undefined}
  data-resizing={resizing ? '' : undefined}
  data-pins={stickyPins ? undefined : 'static'}
>
  {#if searchable || hideable}
    <div class="tx-data-grid__toolbar">
      {#if searchable}
        <label class="tx-data-grid__search-label" for={searchId}>{text.search}</label>
        <input id={searchId} class="tx-data-grid__search" type="search" autocomplete="off" bind:value={search} />
      {/if}
      {#if hideable}
        <button
          type="button"
          class="tx-grid-columns__chooser-toggle"
          aria-expanded={chooserOpen}
          aria-controls={chooserId}
          onclick={() => (chooserOpen = !chooserOpen)}
        >
          {text.columns}
          <span aria-hidden="true">{resolved.hidden.length > 0 ? ` (${ordered.length}/${columns.length})` : ''}</span>
        </button>
      {/if}
    </div>
  {/if}
  {#if hideable && chooserOpen}
    <fieldset id={chooserId} class="tx-grid-columns__chooser">
      <legend class="tx-data-grid__sr-only">{text.columns}</legend>
      <ul class="tx-grid-columns__chooser-list">
        {#each current as entry (entry.key)}
          {@const isShown = !entry.hidden}
          <li>
            <label class="tx-grid-columns__chooser-item">
              <input
                type="checkbox"
                checked={isShown}
                disabled={isShown && !canHideColumn(resolved, entry.key)}
                onchange={(event) => (event.currentTarget.checked ? show(entry.key) : hide(entry.key))}
              />
              {header(entry.key)}
            </label>
          </li>
        {/each}
      </ul>
      <div class="tx-grid-columns__chooser-actions">
        <button
          type="button"
          class="tx-grid-columns__chooser-action"
          disabled={resolved.hidden.length === 0}
          onclick={() => {
            commitState(showAllColumns(current, columns));
            announcement = text.reset;
          }}>{text.showAll}</button
        >
        <button
          type="button"
          class="tx-grid-columns__chooser-action"
          onclick={() => {
            commitState(defaultColumnState(columns));
            announcement = text.reset;
          }}>{text.resetColumns}</button
        >
      </div>
    </fieldset>
  {/if}
  <p id={instructionsId} class="tx-data-grid__sr-only">{text.instructions}</p>
  <Table
    class="tx-grid-columns__table"
    style={`inline-size: ${tableWidth}px`}
    {density}
    stickyHeader={Boolean(maxBlockSize)}
    {...maxBlockSize ? { maxBlockSize } : {}}
    busy={loading}
    role="grid"
    aria-rowcount={visible.length + headerRows}
    aria-colcount={colCount}
    aria-describedby={instructionsId}
    onkeydown={handleKeydown}
    onfocusin={handleFocusIn}
  >
    <TableCaption hidden={captionHidden}>{caption}</TableCaption>
    <colgroup>
      {#each ordered as column (column.def.key)}
        <col style={`inline-size: ${column.width}px`} />
      {/each}
    </colgroup>
    <TableHeader>
      {#if runs.length > 0}
        <TableRow aria-rowindex={1} class="tx-grid-columns__group-row">
          {#each runs as run (run.key)}
            {@const pin = run.zone === 'center' ? undefined : offsets.get(run.firstKey)}
            <TableHead
              scope="colgroup"
              colspan={run.span}
              aria-colindex={run.start + 1}
              class={cx('tx-grid-columns__group', !run.group && 'tx-grid-columns__group--empty')}
              data-pin={pin?.side}
              data-pin-edge={pin?.edge ? '' : undefined}
              style={pinStyle(pin)}
            >
              {run.group?.header ?? ''}
            </TableHead>
          {/each}
        </TableRow>
      {/if}
      <TableRow aria-rowindex={headerRows}>
        {#each ordered as column, col (column.def.key)}
          {@const def = column.def as DataGridColumn<T>}
          {@const sortable = def.sortable !== false}
          {@const pin = offsets.get(def.key)}
          {@const direction = sort.find((entry) => entry.key === def.key)?.direction}
          <TableHead
            align={align(def)}
            data-tx-grid-cell={`0:${col}`}
            data-column-key={def.key}
            data-zone={zoneOf(column)}
            data-pin={pin?.side}
            data-pin-edge={pin?.edge ? '' : undefined}
            data-drop={dropSide(def.key)}
            data-dragged={dragging?.key === def.key ? '' : undefined}
            aria-colindex={col + 1}
            aria-sort={sortable ? ariaSort(sort, def.key) : undefined}
            tabindex={!sortable && isActive(0, col) ? 0 : !sortable ? -1 : undefined}
            class={cx('tx-grid-columns__head', def.headerClass)}
            style={pinStyle(pin)}
            {@attach reorderFrom(def.key)}
          >
            <span class="tx-grid-columns__head-inner">
              {#if sortable}
                <button
                  type="button"
                  class="tx-data-grid__sort"
                  data-tx-grid-widget
                  data-direction={direction}
                  tabindex={isActive(0, col) ? 0 : -1}
                  aria-keyshortcuts="Alt+ArrowDown Shift+F10"
                  onclick={(event) => sortClick(event, def.key)}
                >
                  {def.header}
                  <span class="tx-data-grid__sort-icon" aria-hidden="true">
                    <svg viewBox="0 0 12 12" aria-hidden="true" focusable="false">
                      {#if direction === 'asc'}
                        <path d="M6 10V2M3 5l3-3 3 3" />
                      {:else if direction === 'desc'}
                        <path d="M6 2v8m-3-3 3 3 3-3" />
                      {:else}
                        <path d="M6 1.5v9m-2.5-6L6 2l2.5 2.5m-5 3L6 10l2.5-2.5" />
                      {/if}
                    </svg>
                  </span>
                  {#if sort.length > 1 && direction}
                    <span class="tx-data-grid__sort-rank" aria-hidden="true">{sort.findIndex((entry) => entry.key === def.key) + 1}</span>
                  {/if}
                </button>
              {:else}
                <span class="tx-grid-columns__label">{def.header}</span>
              {/if}
              {#if menusEnabled}
                {#if ColumnMenu}
                  <ColumnMenu
                    label={text.columnMenu(def.header)}
                    groups={menuGroups(column)}
                    onAction={(id: string) => runAction(def.key, id)}
                  />
                {:else}
                  <button
                    type="button"
                    class="tx-grid-columns__menu-button"
                    aria-label={text.columnMenu(def.header)}
                    aria-disabled="true"
                    tabindex={-1}
                    data-tx-grid-menu=""
                  >
                    <svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="3" cy="8" r="1.4" /><circle cx="8" cy="8" r="1.4" /><circle cx="13" cy="8" r="1.4" /></svg>
                  </button>
                {/if}
              {/if}
            </span>
            {#if resizable}
              <span
                class="tx-grid-columns__resize"
                aria-hidden="true"
                data-active={resizing === def.key ? '' : undefined}
                {@attach resizeFrom(def.key)}
                ondblclick={() => commitState(resetColumnWidth(current, def.key))}
              ></span>
            {/if}
          </TableHead>
        {/each}
      </TableRow>
    </TableHeader>
    <TableBody>
      {#if loading}
        <TableEmpty colspan={colCount} role="gridcell" data-tx-grid-cell={`1:0`} tabindex={isActive(1, 0) ? 0 : -1}>{text.loading}</TableEmpty>
      {:else if visible.length === 0}
        <TableEmpty colspan={colCount} role="gridcell" data-tx-grid-cell={`1:0`} tabindex={isActive(1, 0) ? 0 : -1}>
          {#if empty}{@render empty()}{:else}{text.noResults}{/if}
        </TableEmpty>
      {:else}
        {#each visible as row, rowIndex (getRowId(row))}
          {@const r = rowIndex + 1}
          <TableRow aria-rowindex={r + headerRows}>
            {#each ordered as column, col (column.def.key)}
              {@const def = column.def as DataGridColumn<T>}
              {@const pin = offsets.get(def.key)}
              <TableCell
                role="gridcell"
                align={align(def)}
                numeric={def.type === 'number'}
                data-tx-grid-cell={`${r}:${col}`}
                data-pin={pin?.side}
                data-pin-edge={pin?.edge ? '' : undefined}
                aria-colindex={col + 1}
                tabindex={isActive(r, col) ? 0 : -1}
                class={cx('tx-grid-columns__cell', def.class)}
                style={pinStyle(pin)}
              >
                {#if cell}{@render cell(row, def)}{:else}{cellText(row, def)}{/if}
              </TableCell>
            {/each}
          </TableRow>
        {/each}
      {/if}
    </TableBody>
  </Table>
  <p class="tx-data-grid__status" role="status" aria-live="polite">
    {text.rowCount(visible.length, rows.length)}
  </p>
  <p class="tx-data-grid__sr-only" role="status" aria-live="polite" aria-atomic="true">{announcement}</p>
</div>
