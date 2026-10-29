# Dashboards page (texuli.com)

**App:** `apps/website`
**Path:** `/dashboards-page/` (Components group, after Sheets)
**Packages:** `@texuli/data/dashboard` and `/dashboard/engine`,
`@texuli/core/data-source`, `@texuli/player`; the dashboard is a new subpath
of `@texuli/data`, unreleased and coming in `0.8.0` (not in the published
`0.7.0`); the `data-dashboard` and `data-dashboard-widget` catalog ids are
spec `0.8.0`
**Tests:** `apps/website/tests/site-dashboards.test.ts`, `tests/e2e/site-dashboards.spec.ts`

## Goal

Show the widget grid working: pointer and keyboard moves and resizes with
every announcement made visible, breakpoints, compaction and reduced
motion, persistence that reads saved layouts as untrusted input, widgets
bound to a host data source, and a dashboard an agent wrote.

## Layout

| Section | Island | What it shows |
| --- | --- | --- |
| `#live` | `DashboardWorkbench.svelte` | An editable `Dashboard` of five widgets (one locked) whose metrics and tickets come from the in-page host (`sources.ts`: `ops.metrics` and `tickets` through a `createSourceLoader`), with width (the widest grid by default, any breakpoint forced, or measured from the container), compaction and motion controls, Refresh and Reset; panels for what a screen reader hears (a copy of the dashboard's own polite live region), the saved layout (`serializeDashboard`) and the source calls. |
| `#keyboard` | static | The keys, the refusal reasons and every announcement template, read from `DEFAULT_DASHBOARD_MESSAGES`. |
| `#breakpoints` | static | `DEFAULT_DASHBOARD_BREAKPOINTS`. |
| `#persistence` | `PersistenceLab.svelte` | `parseDashboard` on a saved layout and tampered ones (`persistence.ts`: duplicates, overlaps, out-of-grid numbers, markup ids, an unknown breakpoint, another format, broken JSON, a state over 512 KiB), drawn as a grid and written back canonically. Engine only. |
| `#agents` | `AgentDashboardDemo.svelte` | The blueprint (two gauges and a grid bound to `tickets`, the layout bound to a list state) and the hostile URL binding; the real `<Player>` with the host's `sourceRegistry`. The player persists changes on the widest grid only, so the frame is 1,120 px wide and scrolls on small screens. |
| `#safety`, `#package-docs` | static | Rules, limits, code samples, the planned work (sync binding, adding widgets from the view) and doc paths. |
