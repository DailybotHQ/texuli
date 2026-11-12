## What Dashboards is

`@texuli/data/dashboard` provides a responsive widget grid. People can arrange widgets with pointer or keyboard controls. The framework-free layout engine is also available from `@texuli/data/dashboard/engine`. The dashboard and engine APIs are published in `@texuli/data@0.17.4`, which remains in development before 1.0.

The interactive page demo uses fictional data in the browser. It does not contact a service or save filters and layouts.

## Components and release status

`Dashboard` and `DashboardWidget` are in the published dashboard subpath. The `FilterBar` and `MetricCard` additions described here were added after `0.17.4`; they are in development and need a later `@texuli/data` release. Check the current package release before importing those two subpaths in an npm consumer.

## What you get

- A grid expressed in row and column units, with responsive breakpoints and reading-order rendering.
- Pointer and keyboard move and resize controls, including announced steps and a no-drag arrange toolbar.
- Pure layout operations and bounded parsing for persisted layout data.
- Host-owned rendering and persistence: Texuli does not fetch metric data or save a dashboard for you.
