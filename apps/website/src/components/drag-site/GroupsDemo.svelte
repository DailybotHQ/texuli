<script lang="ts">
import { Sortable, type SortableContainer } from '@texuli/primitives/sortable';
import { LABELS, labelOf } from './data.ts';

/**
 * Multi-container groups: a palette that clones into a page (it accepts
 * nothing back and never reorders), a locked item that keeps its place, and
 * multi-select so several blocks move as one.
 */

let containers = $state<SortableContainer[]>([
  {
    id: 'palette',
    items: ['heading', 'text', 'chart', 'quote'],
    group: { name: 'blocks', pull: 'clone', put: false },
    sort: false,
  },
  { id: 'page', items: ['pinned', 'text-copy', 'chart-copy'], group: 'blocks', locked: ['pinned'] },
]);
let selection = $state<string[]>([]);

function toggle(id: string): void {
  selection = selection.includes(id)
    ? selection.filter((entry) => entry !== id)
    : [...selection, id];
}
</script>

<div class="groups-demo">
<Sortable.Root bind:containers {selection} crossContainers class="groups">
  {#each containers as list (list.id)}
    <div class="groups__column">
      <h3>{LABELS[list.id]}</h3>
      <Sortable.List id={list.id} label={LABELS[list.id]} class="groups__list">
        {#snippet children({ items })}
          {#each items as id (id)}
            <Sortable.Item {id} label={labelOf(id)} class="groups__item">
              <Sortable.Handle class="groups__grip"><span aria-hidden="true">⠿</span></Sortable.Handle>
              {#if list.id === 'page' && id !== 'pinned'}
                <input
                  type="checkbox"
                  aria-label={`Select ${labelOf(id)}`}
                  checked={selection.includes(id)}
                  onchange={() => toggle(id)}
                />
              {/if}
              <span>{labelOf(id)}</span>
            </Sortable.Item>
          {/each}
        {/snippet}
      </Sortable.List>
    </div>
  {/each}
</Sortable.Root>
</div>

<style>
  .groups-demo :global(.groups) {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(min(100%, 14rem), 1fr));
    gap: 1rem;
  }
  .groups__column {
    display: grid;
    align-content: start;
    gap: 0.5rem;
  }
  h3 {
    margin: 0;
    font-size: 1rem;
  }
  .groups-demo :global(.groups__list) {
    display: grid;
    gap: 0.4rem;
    margin: 0;
    padding: 0.4rem;
    list-style: none;
    border-radius: 0.75rem;
    background: var(--tx-muted, Canvas);
    min-block-size: 3rem;
  }
  .groups-demo :global(.groups__item) {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    min-block-size: 2.5rem;
    padding: 0.25rem 0.6rem 0.25rem 0.25rem;
    border: 1px solid var(--tx-border, CanvasText);
    border-radius: 0.6rem;
    background: var(--tx-surface, Canvas);
  }
  .groups-demo :global(.groups__item[data-locked]) {
    border-style: dashed;
  }
  .groups-demo :global(.groups__item[data-selected]) {
    border-color: var(--tx-primary, Highlight);
  }
  .groups-demo :global(.groups__grip) {
    display: inline-grid;
    place-items: center;
    min-inline-size: 2rem;
    min-block-size: 2rem;
    border: 0;
    border-radius: 0.45rem;
    background: transparent;
    color: inherit;
  }
  input {
    inline-size: 1.25rem;
    block-size: 1.25rem;
  }
</style>
