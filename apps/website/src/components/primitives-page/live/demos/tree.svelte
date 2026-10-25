<script lang="ts" module>
import { attr, type DemoSpec, recipeLine, SCRIPT_END } from '../types.ts';

export const spec: DemoSpec = {
  props: [
    {
      kind: 'enum',
      name: 'selectionMode',
      label: 'selectionMode',
      options: ['none', 'single', 'multiple'],
      default: 'single',
    },
    {
      kind: 'enum',
      name: 'variant',
      label: 'Style',
      options: ['default', 'bordered'],
      default: 'bordered',
    },
    {
      kind: 'enum',
      name: 'density',
      label: 'Density',
      options: ['compact', 'default', 'comfortable'],
      default: 'default',
    },
  ],
  keys: [
    { keys: ['ArrowDown', 'ArrowUp'], action: 'Move to the next or previous visible row' },
    { keys: ['ArrowRight'], action: 'Expand a folder, then move into it' },
    { keys: ['ArrowLeft'], action: 'Collapse a folder, or move to its parent' },
    { keys: ['Home', 'End'], action: 'Move to the first or last visible row' },
    { keys: ['Enter', ' '], action: 'Select the active row' },
  ],
  uncontrolled:
    'A plain expanded list opens "Harbor" first; the tree keeps its own expansion and selection.',
  controlled:
    'bind:expanded and bind:selected keep both in your state, so buttons outside can change them.',
  code: (v) => `<script lang="ts">
  import { Tree, type TreeNode } from '@texuli/primitives/tree';
  const items: TreeNode[] = [
    { id: 'harbor', label: 'Harbor', children: [{ id: 'schedule', label: 'schedule.md' }] },
    { id: 'notes', label: 'notes.md' },
  ];
  let expanded = $state(['harbor']);
  let selected = $state<string[]>([]);
${SCRIPT_END}

<Tree.Root {items} bind:expanded bind:selected${attr('selectionMode', String(v.selectionMode), 'single')} aria-label="Files">
  {#snippet item(row)}{row.node.label}{/snippet}
</Tree.Root>
${recipeLine('treeViewClass', 'texuli/tree', { variant: String(v.variant), density: String(v.density) })}`,
  keyCheck: {
    focus: '[data-demo-part="Tree.Root"]',
    press: 'End',
    expect: {
      selector: '[data-demo-part="Tree.Root"][aria-activedescendant$="-item-notes"]',
      count: 1,
    },
  },
  controlCheck: {
    act: '[data-demo-act="expand"]',
    expect: { selector: '[role="treeitem"][aria-expanded="true"]', count: 2 },
  },
};
</script>

<script lang="ts">
import { Tree, type TreeNode, type VisibleTreeNode } from '@texuli/primitives/tree';
import { Button } from 'texuli/button';
import { treeViewClass } from 'texuli/tree';
import { type DemoProps, str } from '../types.ts';

let { values, mode }: DemoProps = $props();

const ITEMS: TreeNode[] = [
  {
    id: 'harbor',
    label: 'Harbor',
    children: [
      { id: 'schedule', label: 'schedule.md' },
      { id: 'crew', label: 'crew.md' },
    ],
  },
  {
    id: 'archive',
    label: 'Archive',
    children: [{ id: 'report-2025', label: 'report-2025.pdf' }],
  },
  { id: 'notes', label: 'notes.md' },
];

const selectionMode = $derived(
  (['none', 'single', 'multiple'] as const).find((entry) => entry === str(values, 'selectionMode')) ?? 'single'
);
const variant = $derived(str(values, 'variant') === 'default' ? 'default' : 'bordered');
const density = $derived(
  (['compact', 'default', 'comfortable'] as const).find((entry) => entry === str(values, 'density')) ?? 'default'
);
const rootClass = $derived(treeViewClass({ variant, density }));

let expanded = $state<string[]>([]);
let selected = $state<string[]>([]);
</script>

{#snippet row(entry: VisibleTreeNode)}
  <span class="tx-tree__row" data-depth={entry.level - 1} style:--tx-tree-depth={entry.level - 1}>
    {#if selectionMode === 'multiple'}
      <span class="tx-tree__checkbox" data-checked={entry.selected ? 'true' : 'false'} aria-hidden="true">
        {#if entry.selected}
          <svg viewBox="0 0 16 16" focusable="false"><path d="m3 8 3.1 3.1L13 4.5" /></svg>
        {/if}
      </span>
    {/if}
    {#if entry.hasChildren}
      <svg class="tx-tree__node-icon" data-icon={entry.expanded ? 'folder-open' : 'folder'} viewBox="0 0 20 20" aria-hidden="true" focusable="false">
        <path d="M2.5 5.5h5l1.6 1.8h8.4v7.9H2.5z" />
        {#if entry.expanded}<path d="m3.4 9.2 1.1-1h12.3l-1.4 7H2.8z" />{/if}
      </svg>
    {:else}
      <svg class="tx-tree__node-icon" data-icon="file" viewBox="0 0 20 20" aria-hidden="true" focusable="false">
        <path d="M5 2.8h6l4 4v10.4H5z" />
        <path d="M11 2.8v4h4M7.5 10h5M7.5 13h5" />
      </svg>
    {/if}
    <span class="tx-tree__label">{entry.node.label}</span>
  </span>
{/snippet}

{#if mode === 'uncontrolled'}
  {#key selectionMode}
    <Tree.Root items={ITEMS} expanded={['harbor']} {selectionMode} aria-label="Files" class={rootClass} item={row} data-tx-tree data-variant={variant} data-density={density} data-demo-part="Tree.Root" />
  {/key}
{:else}
  <Tree.Root items={ITEMS} bind:expanded bind:selected {selectionMode} aria-label="Files" class={rootClass} item={row} data-tx-tree data-variant={variant} data-density={density} data-demo-part="Tree.Root" />
  <div class="demo-controls">
    <output data-demo-readout>Expanded: {expanded.join(', ') || 'none'} · Selected: {selected.join(', ') || 'none'}</output>
    <Button size="sm" variant="outline" onclick={() => (expanded = ['harbor', 'archive'])} data-demo-act="expand">Expand all</Button>
    <Button size="sm" variant="outline" onclick={() => { expanded = [...new Set([...expanded, 'harbor'])]; selected = ['crew']; }} data-demo-act="select">Select crew.md</Button>
    <Button size="sm" variant="ghost" onclick={() => { expanded = []; selected = []; }}>Reset</Button>
  </div>
{/if}
