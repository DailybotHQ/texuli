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

## SplitView

`SplitView` (`texuli/layouts/app/split-view`) is the standalone list and
detail split: `list` (required), `detail` and `empty` snippets, `listLabel`
(`List`) and `detailLabel` (`Details`) name the two regions, and
`detailActive` (bindable) picks the pane narrow containers show. `bind:ref`
is its root element; `class`, `id`, `aria-*`, `data-*`, `style` and handlers
land there too.

| Prop | Default | Notes |
| --- | --- | --- |
| `listWidth` | `minmax(15rem, 22.5rem)` | The list column once both panes show: a CSS length or track (`20rem`, `30%`, `minmax(16rem, 24rem)`), set as `--tx-split-view-list-width`. A value with `;`, `:`, braces, quotes or `url()` is ignored |
| `breakpoint` | `md` | The container width from which list and detail show side by side: `sm` (40rem), `md` (56rem) or `lg` (72rem); narrower, one pane shows (`detailActive` picks it). Rendered as `data-breakpoint` only when given |
| `context` | — | A third pane after the detail (properties, activity), shown only when the container is at least 72rem wide, in a 14rem to 20rem column with a border on its inline-start side. Below 72rem it is hidden, so offer its content another way there (a sheet or a disclosure in the detail) |
| `contextLabel` | — | Names the context pane; with a name it is a region landmark like the list and detail, without one it is a plain section |

```svelte
<SplitView listLabel="Threads" listWidth="20rem" breakpoint="lg" contextLabel="Participants">
  {#snippet list()}…{/snippet}
  {#snippet detail()}…{/snippet}
  {#snippet context()}…{/snippet}
</SplitView>
```

Widths are container widths (the split is an `inline-size` container), not
viewport widths.

## Example

```svelte
import { registerAppLayouts } from 'texuli/layouts/app';
import { LayoutHost } from 'texuli/layouts/host';

registerAppLayouts();

<LayoutHost layout="rail" {nav} path="/inbox" options={{ expanded: true }}>
  <p>Workspace screen</p>
</LayoutHost>
```
