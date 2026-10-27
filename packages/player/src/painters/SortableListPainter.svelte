<script lang="ts">
import { Sortable, type SortableContainer, type SortableMove } from '@texuli/primitives/sortable';
import { getPlayerInteraction } from '../context.ts';

/**
 * `sortable-list` (spec 0.3.0 `reorder`): the items are the bound list
 * variable; a drag or keyboard move runs the closed `moveItem` reducer
 * through the player, then the node's `on.move` actions.
 */
let {
  label,
  itemLabel = 'label',
  itemDetail,
  txPath,
}: {
  label: string;
  reorder?: unknown;
  itemLabel?: string;
  itemDetail?: string;
  txPath?: string;
} = $props();

const interaction = getPlayerInteraction();
const info = $derived(txPath !== undefined ? (interaction?.reorder(txPath) ?? null) : null);
const byId = $derived(new Map((info?.list ?? []).map((item) => [item.id, item])));
const containerId = $derived(`list-${txPath ?? 'none'}`);
const containers = $derived<SortableContainer[]>([
  {
    id: containerId,
    items: (info?.list ?? []).map((item) => item.id),
    orientation: info?.axis ?? 'vertical',
    disabled: info?.disabled ?? true,
    locked: info?.locked ?? [],
  },
]);

const text = (id: string, field: string | undefined): string => {
  if (field === undefined) return '';
  const value = byId.get(id)?.[field];
  return value === undefined ? '' : String(value);
};

function onMove(move: SortableMove): boolean {
  const item = move.items[0]?.id;
  if (txPath === undefined || item === undefined) return false;
  return interaction?.move(txPath, item, txPath, move.index) ?? false;
}
</script>

<div class="tx-player-sortable" data-axis={info?.axis ?? 'vertical'}>
  <Sortable.Root {containers} {onMove}>
    <Sortable.List id={containerId} {label} class="tx-player-sortable__list">
      {#snippet children({ items })}
        {#each items as id (id)}
          <Sortable.Item {id} label={text(id, itemLabel) || id} class="tx-player-sortable__item">
            <Sortable.Handle class="tx-player-sortable__handle">⠿</Sortable.Handle>
            <span class="tx-player-sortable__text">
              <span>{text(id, itemLabel) || id}</span>
              {#if itemDetail && text(id, itemDetail)}
                <small>{text(id, itemDetail)}</small>
              {/if}
            </span>
          </Sortable.Item>
        {/each}
      {/snippet}
    </Sortable.List>
  </Sortable.Root>
</div>

<style>
  .tx-player-sortable :global(.tx-player-sortable__list) {
    display: grid;
    gap: 0.5rem;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .tx-player-sortable[data-axis='horizontal'] :global(.tx-player-sortable__list) {
    grid-auto-flow: column;
    justify-content: start;
  }

  .tx-player-sortable :global(.tx-player-sortable__item) {
    display: flex;
    gap: 0.5rem;
    align-items: center;
    padding: 0.5rem 0.75rem;
    border: 1px solid var(--tx-border, CanvasText);
    border-radius: var(--tx-radius-md, 0.5rem);
    background: var(--tx-surface, Canvas);
  }

  .tx-player-sortable :global(.tx-player-sortable__handle) {
    min-inline-size: 24px;
    min-block-size: 24px;
  }

  .tx-player-sortable__text {
    display: grid;
  }

  .tx-player-sortable__text small {
    color: var(--tx-muted-foreground, GrayText);
  }
</style>
