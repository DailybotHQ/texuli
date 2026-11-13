## Keep data in the host

The dashboard renders widget content supplied by the host. Fetch and transform metrics in your application, then pass formatted values and text labels into components. Texuli does not accept a data URL, run queries, or persist dashboards for you.

## Persist layouts

Bind `layouts` and serialize updates in the host. On restore, parse the stored value as untrusted input before binding it back to the view.

```svelte
<script lang="ts">
  import { onMount } from 'svelte';
  import {
    Dashboard,
    DashboardWidget,
    type DashboardLayout,
    parseDashboard,
    serializeDashboard,
  } from '@texuli/data/dashboard';

  let layouts = $state<Record<string, DashboardLayout>>({});

  onMount(() => {
    layouts = { ...parseDashboard(localStorage.getItem('ops-dashboard') ?? '').state?.layouts };
  });
</script>

<Dashboard
  label="Operations"
  editable
  bind:layouts
  onLayoutChange={() => localStorage.setItem('ops-dashboard', serializeDashboard(layouts))}
>
  <DashboardWidget id="signups" title="Signups" w={4} h={2}>1,284</DashboardWidget>
</Dashboard>
```

## Filter and date controls

The published `@texuli/data/filter-builder` exposes the filter model and `applyFilter` for host-owned filtering. `FilterBar` from `@texuli/data/filter-bar` was released in `0.18.0` and is in development. It edits the same `FilterGroup` model used by the filter builder and data grid.

Use `DateRangePicker` from `texuli/date` to collect a date range. The host applies that range to its own sample or live data. Pass `today` when a deterministic preset origin is needed, such as for an SSR example or a test.

## Metric cards

`MetricCard` was released in `0.18.0` and is in development. Its API accepts a formatted value, comparison and trend label, optional loading or empty state, and an optional sparkline snippet. The sparkline needs its own text alternative.
