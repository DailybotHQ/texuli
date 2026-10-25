<script lang="ts" generics="T">
import { tick } from 'svelte';
import { type ClassValue, cx } from 'texuli/cx';
import { readValue } from '../engines/grid/columns.ts';
import { createAxis, windowGrid } from '../engines/grid/virtual.ts';
import type { VirtualGridColumn } from './model.ts';
import { moveVirtualCell } from './model.ts';

interface Props {
  rows: readonly T[];
  columns: readonly VirtualGridColumn[];
  getRowId: (row: T) => string;
  caption: string;
  rowSize?: number;
  overscanRows?: number;
  overscanColumns?: number;
  viewportHeight?: number;
  viewportWidth?: number;
  cellValue?: (row: T, column: VirtualGridColumn) => string;
  class?: ClassValue;
}

let {
  rows,
  columns,
  getRowId,
  caption,
  rowSize = 36,
  overscanRows = 4,
  overscanColumns = 2,
  viewportHeight = 360,
  viewportWidth = 640,
  cellValue,
  class: className,
}: Props = $props();

let viewport: HTMLDivElement | undefined = $state();
let scrollTop = $state(0);
let scrollLeft = $state(0);
let measuredHeight = $state(0);
let measuredWidth = $state(0);
let active = $state({ row: 0, col: 0 });

const rowAxis = $derived(createAxis({ count: rows.length, size: rowSize }));
const columnSizes = $derived(
  new Map(
    columns.map((column, index) => [
      index,
      Number.isFinite(column.width) && (column.width ?? 0) > 0 ? (column.width as number) : 160,
    ])
  )
);
const columnAxis = $derived(createAxis({ count: columns.length, size: 1, sizes: columnSizes }));
const window = $derived(
  windowGrid({
    rows: rowAxis,
    columns: columnAxis,
    scrollTop: Math.max(0, scrollTop),
    scrollLeft: Math.abs(scrollLeft),
    viewportHeight: measuredHeight || viewportHeight,
    viewportWidth: measuredWidth || viewportWidth,
    overscanRows,
    overscanColumns,
  })
);
const headerSize = 40;
const activeId = $derived(`tx-virtual-grid-${active.row}-${active.col}`);

function text(row: T, column: VirtualGridColumn): string {
  if (cellValue) return cellValue(row, column);
  const value = readValue(row as Record<string, unknown>, { ...column, type: 'text' });
  if (value === null || value === undefined) return '';
  if (value instanceof Date)
    return Number.isNaN(value.getTime()) ? '' : value.toISOString().slice(0, 10);
  return String(value);
}

function onScroll(event: Event): void {
  const target = event.currentTarget;
  if (!(target instanceof HTMLElement)) return;
  scrollTop = target.scrollTop;
  scrollLeft = target.scrollLeft;
  measuredHeight = target.clientHeight;
  measuredWidth = target.clientWidth;
}

async function onKeydown(event: KeyboardEvent): Promise<void> {
  const rtl = viewport ? getComputedStyle(viewport).direction === 'rtl' : false;
  const next = moveVirtualCell(active, event.key, {
    rows: rows.length,
    columns: columns.length,
    pageSize: Math.max(1, Math.floor((measuredHeight || viewportHeight) / rowSize)),
    rtl,
  });
  if (!next) return;
  event.preventDefault();
  active = next;
  const top = rowAxis.offsetOf(next.row) + headerSize;
  const bottom = top + rowSize;
  if (top < (viewport?.scrollTop ?? 0) + headerSize)
    viewport?.scrollTo({ top: rowAxis.offsetOf(next.row) });
  else if (bottom > (viewport?.scrollTop ?? 0) + (viewport?.clientHeight || viewportHeight))
    viewport?.scrollTo({ top: bottom - (viewport?.clientHeight || viewportHeight) });
  const start = columnAxis.offsetOf(next.col);
  const end = start + columnAxis.sizeOf(next.col);
  if (start < Math.abs(viewport?.scrollLeft ?? 0)) viewport?.scrollTo({ left: start });
  else if (end > Math.abs(viewport?.scrollLeft ?? 0) + (viewport?.clientWidth || viewportWidth))
    viewport?.scrollTo({ left: end - (viewport?.clientWidth || viewportWidth) });
  await tick();
}
</script>

<div
  bind:this={viewport}
  class={cx('tx-virtual-data-grid', className)}
  role="grid"
  aria-label={caption}
  aria-rowcount={rows.length + 1}
  aria-colcount={columns.length}
  aria-activedescendant={rows.length && columns.length ? activeId : undefined}
  tabindex="0"
  onscroll={onScroll}
  onkeydown={onKeydown}
>
  <div class="tx-virtual-data-grid__canvas" style:inline-size="{window.totalWidth}px" style:block-size="{window.totalHeight + headerSize}px">
    <div class="tx-virtual-data-grid__row tx-virtual-data-grid__header" role="row" aria-rowindex="1">
      {#each window.columns.items as item (item.index)}
        {@const column = columns[item.index]}
        {#if column}
          <div
            class="tx-virtual-data-grid__cell tx-virtual-data-grid__heading"
            role="columnheader"
            aria-colindex={item.index + 1}
            style="inset-inline-start: {item.start}px; inline-size: {item.size}px"
          >{column.header}</div>
        {/if}
      {/each}
    </div>
    {#each window.rows.items as rowItem (getRowId(rows[rowItem.index] as T))}
      {@const row = rows[rowItem.index]}
      {#if row}
        <div
          class="tx-virtual-data-grid__row"
          role="row"
          aria-rowindex={rowItem.index + 2}
          style="inset-block-start: {rowItem.start + headerSize}px; block-size: {rowItem.size}px"
        >
          {#each window.columns.items as colItem (colItem.index)}
            {@const column = columns[colItem.index]}
            {#if column}
              <div
                id="tx-virtual-grid-{rowItem.index}-{colItem.index}"
                class="tx-virtual-data-grid__cell"
                role="gridcell"
                aria-colindex={colItem.index + 1}
                style="inset-inline-start: {colItem.start}px; inline-size: {colItem.size}px; block-size: {rowItem.size}px"
              >{text(row, column)}</div>
            {/if}
          {/each}
        </div>
      {/if}
    {/each}
  </div>
</div>

<style>
  @layer tx.components {
    .tx-virtual-data-grid {
      position: relative;
      overflow: auto;
      block-size: min(28rem, 70vh);
      inline-size: 100%;
      border: 1px solid var(--tx-border, ButtonBorder);
      border-radius: var(--tx-radius-md, 0.5rem);
      color: var(--tx-foreground, CanvasText);
      background: var(--tx-surface, Canvas);
      contain: strict;
    }
    .tx-virtual-data-grid:focus-visible {
      outline: 2px solid var(--tx-ring, Highlight);
      outline-offset: 2px;
    }
    .tx-virtual-data-grid__canvas { position: relative; }
    .tx-virtual-data-grid__row {
      position: absolute;
      inset-inline-start: 0;
      inline-size: 100%;
    }
    .tx-virtual-data-grid__header {
      position: sticky;
      position: sticky;
      display: block;
      inset-block-start: 0;
      z-index: 2;
      block-size: 40px;
    }
    .tx-virtual-data-grid__cell {
      position: absolute;
      box-sizing: border-box;
      display: flex;
      align-items: center;
      overflow: hidden;
      padding-inline: 0.75rem;
      border-block-end: 1px solid var(--tx-border, ButtonBorder);
      border-inline-end: 1px solid var(--tx-border, ButtonBorder);
      white-space: nowrap;
      text-overflow: ellipsis;
    }
    .tx-virtual-data-grid__heading {
      position: absolute;
      inset-block-start: 0;
      block-size: 40px;
      font-weight: 600;
      background: var(--tx-elevated, var(--tx-surface, Canvas));
    }
    @media (forced-colors: active) {
      .tx-virtual-data-grid, .tx-virtual-data-grid__cell { border-color: CanvasText; }
      .tx-virtual-data-grid:focus-visible { outline-color: Highlight; }
    }
  }
</style>
