<script lang="ts">
import { rankSequence } from '@texuli/data/board';
import type { TreeMove } from '@texuli/data/tree';
import { TreeDataView } from '@texuli/data/tree-view';
import { getPlayerInteraction } from '../context.ts';

/** `data-tree-view`: a hierarchy from flat JSON items with `parent`. */
interface Entry {
  id: string;
  label: string;
  parent?: string;
  rank?: string;
}

let {
  label,
  items,
  checkboxes = true,
  density = 'comfortable',
  txPath,
}: {
  label: string;
  items: readonly Entry[];
  checkboxes?: boolean;
  density?: 'comfortable' | 'compact';
  txPath?: string;
} = $props();

const interaction = getPlayerInteraction();
let entries = $state.raw<readonly Entry[]>([]);
$effect.pre(() => {
  const ranks = rankSequence(items.length);
  entries = items.map((entry, i) => (entry.rank ? entry : { ...entry, rank: ranks[i] as string }));
});

function onMove(move: TreeMove): void {
  const reranked = new Map((move.rerank ?? []).map((entry) => [entry.id, entry.rank]));
  const next = entries.map((entry) => {
    if (entry.id === move.id) {
      const { parent: _parent, ...rest } = entry;
      return { ...rest, rank: move.rank, ...(move.parentId ? { parent: move.parentId } : {}) };
    }
    const rank = reranked.get(entry.id);
    return rank ? { ...entry, rank } : entry;
  });
  entries = next;
  if (txPath === undefined) return;
  interaction?.write(txPath, 'items', next);
  interaction?.dispatch(txPath, 'move', { value: move.id });
}
</script>

<section class="tx-player-data" aria-label={label}>
  <TreeDataView
    items={entries}
    getId={(entry: Entry) => entry.id}
    getParentId={(entry: Entry) => entry.parent ?? null}
    getRank={(entry: Entry) => entry.rank ?? ''}
    getLabel={(entry: Entry) => entry.label}
    {onMove}
    onSelectedChange={(selected: string[]) => {
      if (txPath !== undefined) interaction?.dispatch(txPath, 'select', { value: selected[selected.length - 1] ?? '' });
    }}
    {checkboxes}
    {density}
  />
</section>
