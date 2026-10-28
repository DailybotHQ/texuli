<script lang="ts">
import { Sortable, type SortableContainer } from '@texuli/primitives/sortable';
import { behaviorEvent } from '../../harness/client/events.ts';

const labels: Record<string, string> = {
  plan: 'Plan launch',
  draft: 'Draft notes',
  review: 'Review copy',
  ship: 'Ship release',
};

let containers = $state<SortableContainer[]>([
  { id: 'todo', items: ['plan', 'draft', 'review'], group: 'board' },
  { id: 'done', items: ['ship'], group: 'board' },
]);
const names: Record<string, string> = { todo: 'To do', done: 'Done' };
</script>

<section aria-label="Sortable examples">
  <Sortable.Root
    bind:containers
    crossContainers
    onMove={(move) => {
      behaviorEvent('move', { to: move.to, index: move.index, ids: move.placed });
    }}
  >
    {#each containers as list (list.id)}
      <h2 id={`${list.id}-heading`}>{names[list.id]}</h2>
      <Sortable.List id={list.id} label={names[list.id]} style="min-block-size: 48px; padding: 4px; list-style: none;">
        {#snippet children({ items })}
          {#each items as id (id)}
            <Sortable.Item {id} label={labels[id]} style="display: flex; gap: 8px; align-items: center; block-size: 40px;">
              <Sortable.Handle>⠿</Sortable.Handle>
              <span>{labels[id]}</span>
            </Sortable.Item>
          {/each}
        {/snippet}
      </Sortable.List>
    {/each}
  </Sortable.Root>
</section>
