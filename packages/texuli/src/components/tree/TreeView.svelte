<script lang="ts">
import type { TreeNode, TreeSelectionMode, VisibleTreeNode } from '@texuli/primitives/tree';
import { TreeRoot } from '@texuli/primitives/tree';
import type { Snippet } from 'svelte';
import { useMessages } from '../../i18n/use-messages.ts';
import { cx } from '../../internal/cx.ts';
import type { TreeViewProps } from './props.ts';
import { type TreeDensity, type TreeVariant, treeViewClass } from './variants.ts';
import './tree.css';
import { designDefaults } from '../../internal/design-defaults.ts';

const txDefaults = designDefaults('tree');
let {
  items,
  expanded = $bindable<string[]>([]),
  selected = $bindable<string[]>([]),
  selectionMode = 'single',
  virtualized = false,
  height,
  rowHeight,
  overscan,
  loadingLabel,
  loadErrorLabel,
  loadChildren,
  onExpandedChange,
  onSelectedChange,
  label: labelProp,
  variant = txDefaults().variant ?? 'default',
  density = 'default',
  item,
  class: className,
  ref = $bindable(null),
  ...attributes
}: TreeViewProps = $props();
const msg = useMessages();
const label = $derived(labelProp ?? msg('texuli.tree-view.label', 'Tree'));

function bindRef(node: HTMLElement): () => void {
  ref = node;
  return () => {
    if (ref === node) ref = null;
  };
}

const rootClass = $derived(cx(treeViewClass({ variant, density }), className));
</script>

{#snippet treeItem(row: VisibleTreeNode)}
  <span
    class="tx-tree__row"
    data-depth={row.level - 1}
    style={`--tx-tree-depth: ${row.level - 1}`}
  >
    {#if selectionMode === 'multiple'}
      <span class="tx-tree__checkbox" data-checked={row.selected ? 'true' : 'false'} aria-hidden="true">
        {#if row.selected}
          <svg viewBox="0 0 16 16" focusable="false"><path d="m3 8 3.1 3.1L13 4.5" /></svg>
        {/if}
      </span>
    {/if}
    {#if row.hasChildren}
      <svg class="tx-tree__node-icon" data-icon={row.expanded ? 'folder-open' : 'folder'} viewBox="0 0 20 20" aria-hidden="true" focusable="false">
        <path d="M2.5 5.5h5l1.6 1.8h8.4v7.9H2.5z" />
        {#if row.expanded}<path d="m3.4 9.2 1.1-1h12.3l-1.4 7H2.8z" />{/if}
      </svg>
    {:else}
      <svg class="tx-tree__node-icon" data-icon="file" viewBox="0 0 20 20" aria-hidden="true" focusable="false">
        <path d="M5 2.8h6l4 4v10.4H5z" />
        <path d="M11 2.8v4h4M7.5 10h5M7.5 13h5" />
      </svg>
    {/if}
    <span class="tx-tree__label">
      {#if item}{@render item(row)}{:else}{row.node.label}{/if}
    </span>
  </span>
{/snippet}

<TreeRoot
  {...attributes}
  {@attach bindRef}
  {items}
  bind:expanded
  bind:selected
  {selectionMode}
  {virtualized}
  {height}
  {rowHeight}
  {overscan}
  {loadingLabel}
  {loadErrorLabel}
  {loadChildren}
  {onExpandedChange}
  {onSelectedChange}
  aria-label={label}
  class={rootClass}
  item={treeItem}
  data-tx-tree
  data-variant={variant}
  data-density={density}
>
</TreeRoot>
