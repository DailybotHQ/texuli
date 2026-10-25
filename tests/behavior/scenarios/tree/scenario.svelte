<script lang="ts">
import { Tree, type TreeNode } from '@texuli/primitives/tree';
import { behaviorEvent } from '../../harness/client/events.ts';

const nodes: TreeNode[] = [
  {
    id: 'workspace',
    label: 'Workspace',
    children: [
      { id: 'readme', label: 'Readme.md' },
      { id: 'roadmap', label: 'Roadmap.md' },
    ],
  },
  { id: 'archive', label: 'Archive', hasChildren: true },
  ...Array.from({ length: 60 }, (_, index) => ({
    id: `asset-${index + 1}`,
    label: `Asset ${index + 1}`,
  })),
];

let expanded = $state<string[]>([]);
let selected = $state<string[]>([]);

async function loadChildren(node: TreeNode): Promise<readonly TreeNode[]> {
  await Promise.resolve();
  return [{ id: `${node.id}-report`, label: 'Archive report' }];
}

function onSelectedChange(next: string[]): void {
  behaviorEvent('selected', next);
}
</script>

<Tree.Root
  items={nodes}
  bind:expanded
  bind:selected
  selectionMode="multiple"
  virtualized
  height={240}
  rowHeight={32}
  overscan={2}
  {loadChildren}
  {onSelectedChange}
  aria-label="Workspace files"
/>
