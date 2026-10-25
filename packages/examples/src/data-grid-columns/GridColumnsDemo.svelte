<script lang="ts">
import type { ColumnState } from '@texuli/data/grid';
import { ColumnGrid } from '@texuli/data/grid-columns';
import { DEAL_COLUMNS, DEAL_GROUPS, DEALS, type Deal } from './deals.ts';

/**
 * Column operations: the Deal column is pinned to the start and Amount to the
 * end, so they stay put while the grid scrolls sideways. Drag a header edge
 * to resize, drag a header to reorder, or use each column's menu.
 */
let columnState = $state<ColumnState>([
  { key: 'name', pinned: 'left' },
  { key: 'amountCents', pinned: 'right' },
]);
</script>

<div class="demo" data-example="data-grid-columns">
  <ColumnGrid
    rows={DEALS}
    columns={DEAL_COLUMNS}
    groups={DEAL_GROUPS}
    getRowId={(deal: Deal) => deal.id}
    caption="Pipeline by deal"
    searchable
    bind:columnState
  />
  <p class="saved">Saved column state: <code>{JSON.stringify(columnState)}</code></p>
</div>

<style>
  .demo {
    display: grid;
    gap: 0.75rem;
    max-inline-size: 44rem;
  }
  .saved {
    margin: 0;
    color: var(--tx-muted-foreground, CanvasText);
    font-size: 0.75rem;
    overflow-wrap: anywhere;
  }
</style>
