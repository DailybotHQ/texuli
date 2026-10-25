# App layouts: rail and master-detail

**Ids:** `rail`, `master-detail`  
**Register:** `registerAppLayouts()` from `texuli/layouts/app`  
**Subpaths:** `texuli/layouts/app/rail`, `texuli/layouts/app/master-detail`

## Rail

Narrow primary nav of icons with accessible names and tooltips. Labels appear
when the shell is wide (`min-width: 68rem`) or `options.expanded` / the
`expanded` prop is set. Catalog fallback below `minWidth` (640) is
`mobile-tabs`.

Uses `--tx-app-height` and `--tx-safe-area-*` (with `env(safe-area-inset-*)`
fallbacks) for full-height and notched devices.

## Master-detail

List of primary destinations (top-level nav items) plus the LayoutHost screen
as the detail pane. When a leaf is selected, `data-detail-active="true"`.
Narrow containers show list **or** detail; detail includes a **Back** link to
the brand href. At `@container (min-width: 56rem)` both panes show and Back
hides.

## Example

```svelte
import { registerAppLayouts } from 'texuli/layouts/app';
import { LayoutHost } from 'texuli/layouts/host';

registerAppLayouts();

<LayoutHost layout="rail" {nav} path="/inbox" options={{ expanded: true }}>
  <p>Workspace screen</p>
</LayoutHost>
```
