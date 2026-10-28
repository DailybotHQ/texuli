<script lang="ts">
import { FileBrowser } from '@texuli/data/files';
import { getPlayerInteraction } from '../context.ts';

/** `data-files`: folders and files from flat JSON entries with `parent`. */
interface Entry {
  id: string;
  name: string;
  kind: 'folder' | 'file';
  parent?: string;
  type?: string;
  size?: number;
  updatedAt?: string;
}

let {
  label,
  entries,
  layout = 'grid',
  density = 'comfortable',
  txPath,
}: {
  label: string;
  entries: readonly Entry[];
  layout?: 'grid' | 'list';
  density?: 'comfortable' | 'compact';
  txPath?: string;
} = $props();

const interaction = getPlayerInteraction();
const files = $derived(
  entries.map((entry) => ({
    id: entry.id,
    parentId: entry.parent ?? null,
    name: entry.name,
    kind: entry.kind,
    ...(entry.type ? { type: entry.type } : {}),
    ...(entry.size !== undefined ? { size: entry.size } : {}),
    ...(entry.updatedAt ? { updatedAt: entry.updatedAt } : {}),
  }))
);
let shown = $state<'grid' | 'list'>('grid');
$effect.pre(() => {
  shown = layout;
});
</script>

<section class="tx-player-data" aria-label={label}>
  <FileBrowser
    entries={files}
    bind:layout={shown}
    onLayoutChange={(next: 'grid' | 'list') => {
      if (txPath === undefined) return;
      interaction?.write(txPath, 'layout', next);
      interaction?.dispatch(txPath, 'change', { value: next });
    }}
    onSelectedChange={(selected: string[]) => {
      if (txPath !== undefined) interaction?.dispatch(txPath, 'select', { value: selected[selected.length - 1] ?? '' });
    }}
    {density}
  />
</section>
