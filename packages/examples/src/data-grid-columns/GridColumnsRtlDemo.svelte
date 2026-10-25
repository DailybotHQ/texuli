<script lang="ts">
import { ColumnGrid } from '@texuli/data/grid-columns';
import { DEAL_COLUMNS, DEALS, type Deal } from './deals.ts';

/**
 * Right to left: "start" pins sit on the right, resize handles on each
 * column's left edge, and the arrow keys and drag directions follow.
 */
</script>

<div class="demo" dir="rtl" lang="ar" data-example="data-grid-columns-rtl">
  <ColumnGrid
    rows={DEALS}
    columns={DEAL_COLUMNS.slice(0, 5)}
    getRowId={(deal: Deal) => deal.id}
    caption="Deals, right to left"
    columnState={[{ key: 'name', pinned: 'left' }]}
    density="compact"
  />
</div>

<style>
  .demo {
    max-inline-size: 36rem;
  }
</style>
