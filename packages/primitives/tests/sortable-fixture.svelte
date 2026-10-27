<script lang="ts">
import {
  type DragMessagesOverrides,
  Sortable,
  type SortableContainer,
  type SortableEvent,
  type SortableMove,
} from '@texuli/primitives/sortable';

interface Props {
  containers: SortableContainer[];
  selection?: readonly string[];
  preview?: 'in-place' | 'overlay';
  mode?: 'insert' | 'swap';
  messages?: DragMessagesOverrides;
  crossContainers?: boolean;
  announce: (message: string) => void;
  onMove?: (move: SortableMove) => boolean | undefined;
  onEvent?: (event: SortableEvent) => void;
  dir?: 'ltr' | 'rtl';
}

let {
  containers = $bindable(),
  selection = [],
  preview = 'in-place',
  mode = 'insert',
  messages,
  crossContainers = false,
  announce,
  onMove,
  onEvent,
  dir = 'ltr',
}: Props = $props();

const label = (id: string) => `Card ${id}`;
</script>

<div {dir}>
  <Sortable.Root
    bind:containers
    {selection}
    {preview}
    {mode}
    {messages}
    {crossContainers}
    {announce}
    {onMove}
    {onEvent}
    autoScroll={false}
  >
    {#each containers.filter((c) => c.parentId == null) as list (list.id)}
      {@render renderList(list.id)}
    {/each}
  </Sortable.Root>
</div>

{#snippet renderList(listId: string)}
  <Sortable.List id={listId} label={`List ${listId.toUpperCase()}`}>
    {#snippet children({ items })}
      {#each items as id (id)}
        <Sortable.Item {id} label={label(id)}>
          <Sortable.Handle />
          <span>{label(id)}</span>
          {#each containers.filter((c) => c.parentId === id) as child (child.id)}
            {@render renderList(child.id)}
          {/each}
        </Sortable.Item>
      {/each}
    {/snippet}
  </Sortable.List>
{/snippet}
