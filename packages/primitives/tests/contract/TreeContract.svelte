<script lang="ts">
import { Tree, type TreeNode } from '../../src/tree/index.ts';
import type { HarnessProps } from '../support/contract.ts';

let { p, refs }: HarnessProps = $props();
const items: TreeNode[] = [
  { id: 'docs', label: 'Documents', children: [{ id: 'brief', label: 'Brief' }] },
  { id: 'archive', label: 'Archive' },
];
</script>

<Tree.Root {items} aria-label="Files" {...p('tree/TreeRoot')} bind:ref={refs['tree/TreeRoot']} />
