<script lang="ts">
import { createTypeahead } from '@texuli/core/roving';
import type { Snippet } from 'svelte';
import type { HTMLAttributes } from 'svelte/elements';
import { useMessages } from '../i18n/use-messages.ts';
import { chainHandlers, composeHandlers } from '../internal/handlers.ts';
import type { RefProp } from '../internal/ref.ts';
import {
  assertUniqueTreeIds,
  flattenVisibleTree,
  getTreeWindow,
  hasTreeChildren,
  type TreeNode,
  type TreeSelectionMode,
  type VisibleTreeNode,
} from './model.ts';

export type { TreeNode, TreeSelectionMode, VisibleTreeNode } from './model.ts';

interface Props extends Omit<HTMLAttributes<HTMLDivElement>, 'children'> {
  items: readonly TreeNode[];
  expanded?: string[];
  selected?: string[];
  selectionMode?: TreeSelectionMode;
  virtualized?: boolean;
  height?: number;
  rowHeight?: number;
  overscan?: number;
  loadingLabel?: string;
  loadErrorLabel?: string;
  loadChildren?: (node: TreeNode) => Promise<readonly TreeNode[]>;
  onExpandedChange?: (expanded: string[]) => void;
  onSelectedChange?: (selected: string[]) => void;
  item?: Snippet<[VisibleTreeNode]>;
}

let {
  items,
  expanded = $bindable<string[]>([]),
  selected = $bindable<string[]>([]),
  selectionMode = 'single',
  virtualized = false,
  height = 320,
  rowHeight = 36,
  overscan = 3,
  loadingLabel: loadingLabelProp,
  loadErrorLabel: loadErrorLabelProp,
  loadChildren,
  onExpandedChange,
  onSelectedChange,
  item,
  id: suppliedId,
  class: className,
  ref = $bindable(null),
  ...attributes
}: Props & RefProp = $props();
const msg = useMessages();
const loadingLabel = $derived(
  loadingLabelProp ?? msg('primitives.tree.loading-label', 'Loading children')
);
const loadErrorLabel = $derived(
  loadErrorLabelProp ?? msg('primitives.tree.load-error-label', 'Children could not be loaded')
);

const generatedId = $props.id();
const treeId = $derived(suppliedId ?? generatedId);
let rootElement = $state<HTMLDivElement | null>(null);
// `ref` follows the element the part binds for its own behavior.
$effect(() => {
  ref = rootElement ?? null;
});
let activeId = $state<string | undefined>();
let scrollTop = $state(0);
let loadedChildren = $state(new Map<string, readonly TreeNode[]>());
let loadingIds = $state(new Set<string>());
let failedIds = $state(new Set<string>());
const typeahead = createTypeahead({ timeout: 500 });

const expandedIds = $derived(new Set(expanded));
const selectedIds = $derived(new Set(selected));
const rows = $derived(
  flattenVisibleTree(items, expandedIds, selectedIds, {
    loadedChildren,
    loadingIds,
    failedIds,
  })
);
const safeRowHeight = $derived(Math.max(1, Number.isFinite(rowHeight) ? rowHeight : 36));
const safeHeight = $derived(Math.max(safeRowHeight, Number.isFinite(height) ? height : 320));
const treeWindow = $derived(
  virtualized
    ? getTreeWindow(rows.length, scrollTop, safeHeight, safeRowHeight, overscan)
    : { start: 0, end: rows.length, paddingStart: 0, paddingEnd: 0 }
);
const renderedRows = $derived(rows.slice(treeWindow.start, treeWindow.end));

$effect(() => {
  assertUniqueTreeIds(items, loadedChildren);
});

$effect(() => {
  if (rows.length === 0) {
    activeId = undefined;
    return;
  }
  if (activeId && rows.some((row) => row.node.id === activeId)) return;
  activeId = rows.find((row) => !row.node.disabled)?.node.id ?? rows[0]?.node.id;
});

function emitExpanded(next: string[]): void {
  expanded = next;
  onExpandedChange?.(next);
}

function emitSelected(next: string[]): void {
  if (next.length === selected.length && next.every((id, index) => id === selected[index])) return;
  selected = next;
  onSelectedChange?.(next);
}

function focusRoot(): void {
  rootElement?.focus({ preventScroll: true });
}

function setActive(index: number, focus = true): void {
  const row = rows[index];
  if (!row) return;
  activeId = row.node.id;
  if (virtualized && rootElement) {
    const currentWindow = getTreeWindow(
      rows.length,
      scrollTop,
      safeHeight,
      safeRowHeight,
      overscan
    );
    if (index < currentWindow.start || index >= currentWindow.end) {
      const maximum = Math.max(0, rows.length * safeRowHeight - safeHeight);
      const nextScrollTop = Math.min(index * safeRowHeight, maximum);
      rootElement.scrollTop = nextScrollTop;
      scrollTop = nextScrollTop;
    }
  }
  if (focus) focusRoot();
}

function emitLoadState(current: Set<string>, id: string, active: boolean): Set<string> {
  const next = new Set(current);
  if (active) next.add(id);
  else next.delete(id);
  return next;
}

async function requestChildren(node: TreeNode): Promise<void> {
  if (!loadChildren || loadedChildren.has(node.id) || loadingIds.has(node.id)) return;
  loadingIds = emitLoadState(loadingIds, node.id, true);
  failedIds = emitLoadState(failedIds, node.id, false);
  try {
    const children = await loadChildren(node);
    const next = new Map(loadedChildren);
    next.set(node.id, children);
    assertUniqueTreeIds(items, next);
    loadedChildren = next;
  } catch {
    failedIds = emitLoadState(failedIds, node.id, true);
  } finally {
    loadingIds = emitLoadState(loadingIds, node.id, false);
  }
}

function toggleExpanded(row: VisibleTreeNode): void {
  if (!row.hasChildren || row.node.disabled) return;
  const isExpanded = expandedIds.has(row.node.id);
  if (isExpanded) {
    const rowIndex = rows.findIndex((candidate) => candidate.node.id === row.node.id);
    const activeIndex = rows.findIndex((candidate) => candidate.node.id === activeId);
    let activeIsChild = false;
    for (
      let index = rowIndex + 1;
      index < rows.length && (rows[index]?.level ?? 0) > row.level;
      index++
    ) {
      if (index === activeIndex) activeIsChild = true;
    }
    if (activeIsChild) {
      activeId = row.node.id;
    }
    emitExpanded(expanded.filter((id) => id !== row.node.id));
    return;
  }
  emitExpanded([...expanded, row.node.id]);
  if (!loadedChildren.has(row.node.id) && !row.node.children && loadChildren) {
    void requestChildren(row.node);
  }
}

function selectRow(row: VisibleTreeNode): void {
  if (row.node.disabled) return;
  setActive(rows.findIndex((candidate) => candidate.node.id === row.node.id));
  if (selectionMode === 'none') return;
  if (selectionMode === 'single') {
    emitSelected([row.node.id]);
    return;
  }
  emitSelected(
    selectedIds.has(row.node.id)
      ? selected.filter((id) => id !== row.node.id)
      : [...selected, row.node.id]
  );
}

function moveTo(index: number, direction?: 1 | -1): void {
  if (rows.length === 0) return;
  const step = direction ?? (index >= rows.findIndex((row) => row.node.id === activeId) ? 1 : -1);
  let next = index;
  while (rows[next]?.node.disabled && next >= 0 && next < rows.length) next += step;
  if (next >= 0 && next < rows.length && !rows[next]?.node.disabled) setActive(next);
}

function onKeydown(event: KeyboardEvent): void {
  const current = rows.findIndex((row) => row.node.id === activeId);
  const row = rows[current];
  if (event.key === 'ArrowDown')
    moveTo(current < 0 ? 0 : Math.min(rows.length - 1, current + 1), 1);
  else if (event.key === 'ArrowUp')
    moveTo(current < 0 ? rows.length - 1 : Math.max(0, current - 1), -1);
  else if (event.key === 'Home') moveTo(0, 1);
  else if (event.key === 'End') moveTo(rows.length - 1, -1);
  else if (event.key === 'ArrowRight' && row?.hasChildren) {
    if (!row.expanded) toggleExpanded(row);
    else if (rows[current + 1]?.parentId === row.node.id) moveTo(current + 1);
  } else if (event.key === 'ArrowLeft' && row) {
    if (row.expanded) toggleExpanded(row);
    else if (row.parentId)
      moveTo(rows.findIndex((candidate) => candidate.node.id === row.parentId));
  } else if (event.key === ' ' && row) {
    if (selectionMode === 'multiple') selectRow(row);
    else if (selectionMode === 'single') selectRow(row);
  } else if (event.key === 'Enter' && row) {
    if (selectionMode !== 'none') selectRow(row);
  } else {
    const target = typeahead.match(
      event,
      rows.map((candidate) => candidate.node.label),
      current,
      (index) => !rows[index]?.node.disabled
    );
    if (target >= 0) moveTo(target);
    else return;
  }
  event.preventDefault();
}

function onScroll(event: Event): void {
  scrollTop = (event.currentTarget as HTMLDivElement).scrollTop;
}

function toggleFromPointer(event: MouseEvent, row: VisibleTreeNode): void {
  event.stopPropagation();
  if (row.node.disabled) return;
  setActive(rows.findIndex((candidate) => candidate.node.id === row.node.id));
  toggleExpanded(row);
}
</script>

<div
  {...attributes}
  bind:this={rootElement}
  id={treeId}
  class={className}
  role="tree"
  tabindex="0"
  aria-activedescendant={activeId ? `${treeId}-item-${activeId}` : undefined}
  aria-multiselectable={selectionMode === 'multiple' ? 'true' : undefined}
  aria-busy={loadingIds.size > 0 ? 'true' : undefined}
  data-virtualized={virtualized ? '' : undefined}
  style:block-size={virtualized ? `${safeHeight}px` : undefined}
  style:overflow-y={virtualized ? 'auto' : undefined}
  onkeydown={composeHandlers(attributes.onkeydown, onKeydown)}
  onscroll={chainHandlers(attributes.onscroll, onScroll)}
>
  {#if treeWindow.paddingStart > 0}
    <div role="presentation" aria-hidden="true" style:block-size={`${treeWindow.paddingStart}px`}></div>
  {/if}
  {#each renderedRows as row (row.node.id)}
    <div
      id={`${treeId}-item-${row.node.id}`}
      role="treeitem"
      aria-level={row.level}
      aria-posinset={row.posInSet}
      aria-setsize={row.setSize}
      aria-selected={selectionMode === 'none' ? undefined : row.selected}
      aria-expanded={row.hasChildren ? row.expanded : undefined}
      aria-busy={row.loading || undefined}
      tabindex="-1"
      data-state={row.expanded ? 'open' : 'closed'}
      data-selected={row.selected ? '' : undefined}
      data-disabled={row.node.disabled ? '' : undefined}
      data-loading={row.loading ? '' : undefined}
      data-load-error={row.loadError ? '' : undefined}
      style:block-size={virtualized ? `${safeRowHeight}px` : undefined}
      onclick={() => selectRow(row)}
      onkeydown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.stopPropagation();
          event.preventDefault();
          selectRow(row);
        }
      }}
    >
      {#if row.hasChildren}
        <span
          data-tree-toggle
          aria-hidden="true"
          onclick={(event) => toggleFromPointer(event, row)}
        >{row.expanded ? '▾' : '▸'}</span>
      {:else}
        <span aria-hidden="true" data-tree-spacer></span>
      {/if}
      {#if item}
        {@render item(row)}
      {:else}
        <span>{row.node.label}</span>
      {/if}
      {#if row.loading}<span role="status" aria-live="polite">{loadingLabel}</span>{/if}
      {#if row.loadError}<span role="status" aria-live="polite">{loadErrorLabel}</span>{/if}
    </div>
  {/each}
  {#if treeWindow.paddingEnd > 0}
    <div role="presentation" aria-hidden="true" style:block-size={`${treeWindow.paddingEnd}px`}></div>
  {/if}
</div>
