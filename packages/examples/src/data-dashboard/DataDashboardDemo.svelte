<script lang="ts">
import {
  Dashboard,
  type DashboardLayout,
  DashboardWidget,
  serializeDashboard,
} from '@texuli/data/dashboard';

/** An operations overview: four widgets, editable, with the saved layout shown as JSON. */
const metrics = [
  {
    id: 'signups',
    title: 'Signups',
    value: '1,284',
    note: 'This week, up 12%',
    x: 0,
    y: 0,
    w: 4,
    h: 2,
  },
  {
    id: 'revenue',
    title: 'Revenue',
    value: '$48,200',
    note: 'Month to date',
    x: 4,
    y: 0,
    w: 4,
    h: 2,
  },
  { id: 'uptime', title: 'Uptime', value: '99.98%', note: 'Last 30 days', x: 8, y: 0, w: 4, h: 2 },
] as const;

let layouts = $state<Record<string, DashboardLayout>>({});
let saved = $state('');
</script>

<div data-example="data-dashboard" class="demo">
  <Dashboard
    label="Operations overview"
    editable
    rowHeight={64}
    bind:layouts
    onLayoutChange={() => {
      saved = serializeDashboard(layouts);
    }}
  >
    {#each metrics as metric (metric.id)}
      <DashboardWidget id={metric.id} title={metric.title} x={metric.x} y={metric.y} w={metric.w} h={metric.h}>
        <p class="value">{metric.value}</p>
        <p class="note">{metric.note}</p>
      </DashboardWidget>
    {/each}
    <DashboardWidget id="incidents" title="Open incidents" x={0} y={2} w={12} h={3} minH={2}>
      <ul class="list">
        <li>Checkout latency on eu.example.com, investigating</li>
        <li>Webhook retries for partner.example, monitoring</li>
      </ul>
    </DashboardWidget>
  </Dashboard>
  <p class="saved" aria-live="off">{saved ? `Saved layout: ${saved.length} bytes of JSON` : 'Layout not changed yet'}</p>
</div>

<style>
  .demo {
    display: grid;
    gap: 0.75rem;
  }

  .value {
    margin: 0;
    font-size: 1.5rem;
    font-weight: 600;
  }

  .note,
  .saved {
    margin: 0;
    color: var(--tx-muted-foreground, CanvasText);
    font-size: 0.875rem;
  }

  .list {
    margin: 0;
    padding-inline-start: 1.25rem;
  }
</style>
