<script lang="ts">
import { Sortable, type SortableContainer } from '../../src/sortable/index.ts';
import type { HarnessProps } from '../support/contract.ts';

let { p, refs }: HarnessProps = $props();
let containers = $state<SortableContainer[]>([{ id: 'todo', items: ['a', 'b'] }]);
</script>

<Sortable.Root bind:containers announce={() => {}} autoScroll={false} {...p('sortable/SortableRoot')} bind:ref={refs['sortable/SortableRoot']}>
  <Sortable.List {...p('sortable/SortableList')} id="todo" label="To do" bind:ref={refs['sortable/SortableList']}>
    {#snippet children({ items })}
      {#each items as id (id)}
        {#if id === 'b'}
          <Sortable.Item {...p('sortable/SortableItem')} {id} label={`Card ${id}`} bind:ref={refs['sortable/SortableItem']}>
            <Sortable.Handle {...p('sortable/SortableHandle')} bind:ref={refs['sortable/SortableHandle']} />
          </Sortable.Item>
        {:else}
          <Sortable.Item {id} label={`Card ${id}`}><Sortable.Handle /></Sortable.Item>
        {/if}
      {/each}
    {/snippet}
  </Sortable.List>
</Sortable.Root>
