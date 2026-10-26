<script lang="ts">
import { TreeDataView, type TreeMove } from '../../src/tree-view/index.ts';

let {
  checkboxes = true,
  dir = 'ltr' as 'ltr' | 'rtl',
  selectedIds = [] as string[],
}: {
  checkboxes?: boolean;
  dir?: 'ltr' | 'rtl';
  selectedIds?: string[];
} = $props();

interface Node {
  id: string;
  title: string;
  parentId: string | null;
  rank: string;
  lazy?: boolean;
}

let nodes = $state<Node[]>([
  { id: 'docs', title: 'Docs', parentId: null, rank: 'a0' },
  { id: 'guides', title: 'Guides', parentId: 'docs', rank: 'a0' },
  { id: 'intro', title: 'Intro', parentId: 'guides', rank: 'a0' },
  { id: 'setup', title: 'Setup', parentId: 'guides', rank: 'a1' },
  { id: 'api', title: 'API', parentId: 'docs', rank: 'a1' },
  { id: 'lazy-root', title: 'Lazy folder', parentId: null, rank: 'a1', lazy: true },
]);
let moves = $state<TreeMove[]>([]);
// Intentional one-time seed: the harness owns selection from here on.
// svelte-ignore state_referenced_locally
let selected = $state<string[]>(selectedIds);
let expanded = $state<string[]>(['docs', 'guides']);
let loadCount = $state(0);

async function loadChildren(item: Node): Promise<Node[]> {
  loadCount += 1;
  await Promise.resolve();
  return [
    { id: `${item.id}-child-a`, title: `${item.title} child A`, parentId: item.id, rank: 'a0' },
    { id: `${item.id}-child-b`, title: `${item.title} child B`, parentId: item.id, rank: 'a1' },
  ];
}

async function onChildrenLoaded(parent: Node, children: readonly Node[]): Promise<void> {
  const without = nodes.filter((node) => node.parentId !== parent.id);
  nodes = [...without, ...children];
}

function onMove(move: TreeMove): void {
  moves = [...moves, move];
  const ranks = new Map((move.rerank ?? []).map((entry) => [entry.id, entry.rank]));
  nodes = nodes.map((node) => {
    if (node.id === move.id) {
      return { ...node, parentId: move.parentId, rank: move.rank };
    }
    const rank = ranks.get(node.id);
    return rank === undefined ? node : { ...node, parentId: move.parentId, rank };
  });
}
</script>

<TreeDataView
  items={nodes}
  {dir}
  {checkboxes}
  bind:selected
  bind:expanded
  getId={(node) => node.id}
  getParentId={(node) => node.parentId}
  getRank={(node) => node.rank}
  getLabel={(node) => node.title}
  hasChildren={(node) => node.lazy === true}
  {loadChildren}
  {onChildrenLoaded}
  {onMove}
>
  {#snippet item(node)}
    <span data-node-title={node.id}>{node.title}</span>
  {/snippet}
</TreeDataView>
<output aria-label="Move count">{moves.length}</output>
<output aria-label="Load count">{loadCount}</output>
<output aria-label="Selected ids">{selected.join(',')}</output>
