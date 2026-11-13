## Install

Install `@texuli/data@0.18.0` for the published dashboard grid. Svelte 5 is a peer dependency. Import `@texuli/tokens/base.css` once, then import the dashboard subpath where the view is used.

```bash
npm install @texuli/data@0.18.0
```

## Render a board

```svelte
<script lang="ts">
  import { Dashboard, DashboardWidget } from '@texuli/data/dashboard';
</script>

<Dashboard label="Operations" editable>
  <DashboardWidget id="signups" title="Signups" x={0} y={0} w={4} h={2}>
    <p>1,284 this week</p>
  </DashboardWidget>
  <DashboardWidget id="revenue" title="Revenue" x={4} y={0} w={8} h={2}>
    <p>$48,200 this week</p>
  </DashboardWidget>
</Dashboard>
```

Positions and sizes are grid units, not pixels. A widget without `x` and `y` takes the first free slot. The sample values above are illustrative; connect the board to data owned by your application.

## Add metric and filter controls

`MetricCard` and `FilterBar` were released in `0.18.0` and are in development. Their API examples are in the integration section.
