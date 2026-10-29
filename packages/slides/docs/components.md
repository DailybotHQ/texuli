# Components on slides

**Source:** `packages/slides/src/registry/` (the default component
registry, public as `@texuli/slides/components`), `packages/slides/src/components/` (its painters)  
**Tests:** `tests/components-registry.test.ts` (the renderer table, outline,
state host and capabilities, free-slide extensions, hostile props),
`tests/components-coverage.test.ts` (every catalog id is a slide component
or excluded with a reason, and every slide component renders with steps)

> **Status: in development.** Components on slides are new in `0.4.0`.
> `0.3.0` paints `@texuli/blocks` blocks only.

“Any Texuli component on a slide” means every `@texuli/blocks` family and
every catalog component that belongs on a slide. `DeckStage` paints them by
default, through a component registry built on `@texuli/player`: the
registry turns each component into a one-node blueprint, and the player
validates it again at the stage's tier and paints it with its own lazy
painter ([ADR-009](../../../docs/DECISIONS.md)).

A component goes on a slide in two ways:

```ts
// A whole-slide component.
{ id: 'orders', layout: 'component',
  component: { component: 'data-grid', props: { caption: 'Open orders', columns, rows } } }

// A component item among the blocks of a free slide.
{ id: 'trend', layout: 'free', blocks: [
  { type: 'heading', level: 2, text: 'Releases per month' },
  { type: 'component', component: 'charts-bar', props: { /* … */ }, height: 'md', step: 1 },
] }
```

In Markdown, a component item is a fence with a bounded JSON body:

````md
::: component charts-bar
{ "title": "Releases per month", "series": [ … ] }
:::
````

A component item takes `height` (`sm`, `md`, `lg` or `fill`) and the step
fields (`step`, `fragment`, `reveal`) like any block.

## What a slide paints

`SLIDE_COMPONENTS` lists the 53 slide components with their info
(`SlideComponentInfo`): the lazy chunk family (`SlideComponentFamily`), the
steppable paths, the state the adapter declares and the capability that
unlocks its mutations.

| Group | Catalog ids | Notes |
| --- | --- | --- |
| Blocks (9) | `blocks-text`, `blocks-media`, `blocks-data`, `blocks-code`, `blocks-structure`, `blocks-interactive`, `blocks-map`, `blocks-embed`, `blocks-diagram` | Each family is its own lazy chunk. Interactive blocks (poll, quiz, calculator, counter, tabs, reveal) keep their state in memory. `blocks-embed` paints its safe start card only (the `embeds` capability is reserved, see [Capabilities](#capabilities)) |
| Charts (23) | `charts-area`, `charts-bar`, `charts-cartesian`, `charts-combo`, `charts-line`, `charts-stacked-bar`, `charts-bullet`, `charts-gauge`, `charts-progress-ring`, `charts-sparkline`, `charts-funnel`, `charts-network`, `charts-sankey`, `charts-geo-map`, `charts-geo-point-map`, `charts-bubble`, `charts-heatmap`, `charts-scatter`, `charts-donut`, `charts-pie`, `charts-sunburst`, `charts-treemap`, `charts-canvas-renderer` | One chunk per chart family (cartesian, compact, flow, geo, matrix, part-whole, canvas) |
| Media (3) | `media-image`, `media-composition-svg`, `media-composition-canvas` | |
| Data views (10) | `data-board`, `data-tree-view`, `data-calendar`, `data-grid`, `data-files`, `data-map`, `data-timeline`, `data-cohort-table`, `data-notification-inbox`, `data-filter-builder` | Board card moves need `reorder` |
| Chat (2) | `chat-thread`, `chat-message` | Display only; the composer is host chrome |
| Workflows (1) | `workflow-graph` | View mode; `edit` needs `workflow-edit` |
| Sortable (1) | `sortable-list` | Reordering needs `reorder` |
| Controls (4) | `control-toggle`, `control-choice`, `control-slider`, `control-filter` | Their state is declared for them |
| Forms (3) | `action-form`, `form-field`, `form-submit` | A lone field or submit is wrapped in an `action-form`; submitting needs the host's `onAction` |

## What a slide refuses, and why

Every catalog id is in exactly one of three tables, and the coverage test
fails when a new catalog id is in none of them. `slideComponentSupport(id)`
returns a `SlideComponentSupport`: `component`, `excluded` with its reason,
or `unknown`.

`SLIDE_COMPONENT_EXCLUSIONS` holds player-painted ids that do not belong on
a slide, each with its reason:

| Ids | Reason |
| --- | --- |
| `layout-deck`, `deck-slide` | Deck wrappers: the stage is the deck, and slides come from the deck model |
| `host-region` | A host-owned region that authored slides cannot reach |
| `flow-view`, `flow-action` | Blueprint flows: the deck owns navigation (slides and steps) |
| `layout-page`, `layout-doc` | Page and document shells with landmarks: a slide is not a page |
| `layout-card`, `layout-grid`, `layout-row`, `layout-split`, `layout-stack`, `layout-tile` | Containers of catalog child nodes: a component item has no children; use a slide layout, a master or `blocks-structure` |

`SLIDE_EXCLUDED_GROUPS` holds whole catalog groups the player has no painter
for:

| Group | Reason |
| --- | --- |
| `display` (17 ids: `alert`, `badge`, `callout`, `card`, `kpi`, `stat`, `table`, `timeline`, …) | Developer-tier styled components; slides paint the same content through the blocks families |
| `overlays` (26 ids: `dialog`, `drawer`, `popover`, `tooltip`, `command-palette`, …) | Overlays and app navigation need a focus trap, a portal and an Escape lifecycle owned by the host app |
| `layouts` (21 ids: `layout-dashboard-grid`, `layout-sidebar`, `layout-wizard`, …) | Application shells and route hosts own routing and page chrome, which a slide never does |
| `forms` (29 ids: `button`, `input`, `select`, `checkbox`, …) | Developer-tier form primitives with callbacks; slides use the `control-*` and `form-*` components |

An excluded id fails deck validation with `component-excluded`, whose
message carries the reason and whose fix points to a slide layout, a master
or a block family. An id in no table is `unknown-component`.

## Validation in two phases

1. **Parse.** `parseDeck` (run by `DeckStage` through `prepareDeck`) checks
   the component id and exclusions through the registry's
   `validateComponent` hook. By default it does not check props at parse
   time, because that would load the catalog and the block engines eagerly
   (about 35 KiB gzip more). `validateSlideComponent` checks props too
   (`component-props` issues) for a host that wants refusals at parse time.
2. **Paint.** The player validates the one-node blueprint with the catalog
   at the stage's `tier` before it paints. Nothing invalid is painted: the
   player refuses invalid or hostile props with a visible note.

Free-slide blocks go through `validateSlideBlock` (`validateDeckBlock` on
the stage), which accepts what the deck Markdown writes beyond the core
block schema: `math` blocks, images without `width` and `height`, and the
`diagram`, `map` and `embed` families (`checkSlideFamilyBlock`).

## State host

Interactive components keep local state between mounts (the stage mounts at
most three slides, so a slide leaving and coming back remounts). A
`SlideStateHost` reads and writes a `SlideStateSnapshot` under a key the
stage builds from the slide id and the item path (`slideStateKey`, for
example `intro/blocks.3`), never from content. The default,
`createMemoryStateHost()`, is a map in memory that lasts as long as the
page.

## Declared state and `$declare`

The player needs state declared before a component can bind to it. The
adapter declares it for the author (`componentState`):

- every `{"$state": name}` the props read becomes an empty list (`stateReads`);
- a control's `state` variable gets the type its control needs (a
  `control-choice` infers its enum from its `options`);
- `$declare`, the only reserved props key (`DECLARE_KEY`), adds or replaces
  declarations, and is removed before the node sees its props.

For example, a `control-slider` with `state: "budget"` gets
`{ "type": "number", "min": 0, "max": 100 }` declared for it, and a sortable
list that binds a list declares its initial items with `$declare`:

```json
{
  "type": "component",
  "component": "sortable-list",
  "props": {
    "label": "Priorities",
    "reorder": { "bind": { "$state": "priorities" } },
    "$declare": {
      "priorities": {
        "type": "list",
        "initial": [
          { "id": "ship", "label": "Ship" },
          { "id": "measure", "label": "Measure" }
        ]
      }
    }
  }
}
```

`componentBlueprint` builds the one-node envelope (always `draft`, never
activated) inside an untitled document frame, so a component adds no
headings to the slide outline, and the player paints it with
`chrome={false}`: the slide is the frame.

## Capabilities

`SlideCapabilities` are the mutations a host allows. Without a capability,
`gatedProps` paints the component read-only (`hasCapability`):

| Capability (`SlideCapability`) | Default | Unlocks |
| --- | --- | --- |
| `reorder` | on (local state only) | Reordering a `sortable-list`, moving `data-board` cards |
| `workflowEdit` (`workflow-edit`) | off | `workflow-graph` in `edit` mode (otherwise `view`) |
| `embeds` | off | **Reserved, not wired.** Nothing reads it yet, and the stage never passes a `mountEmbed` to the player, so `blocks-embed` always paints its safe start card, with or without it |
| `actions` | — | Form submits go to the host's `onAction`; without it, forms cannot submit |

`embeds` is reserved for a later host seam that mounts `embed-app` blocks.
`hasCapability(capabilities, 'embeds')` answers the flag, and the catalog
table tags `blocks-embed` with it, but no painter consults it today:
granting it changes nothing on a slide.

## Math and measured images

Free slides get three extensions the core block schema does not have
(`extendedItem` tells them apart, as an `ExtendedItem`):

- **Math.** A `{ "type": "math", "tex": "…" }` block (Markdown `$$`) is
  converted by `texToMath` from `@texuli/deck/math`, an owned TeX subset
  (no `\href`, `\color`, `\html*` or macros), to a MathML node tree, and
  painted element by element from an allowlist as MathML Core. The TeX
  source is the accessible text. A formula outside the subset shows its
  source as code with a note, never as markup. Inline `$…$` math inside
  text blocks is not rendered yet.
- **Measured images.** An `image` or `figure` without `width` and `height`
  (Markdown `![alt](src)`, `isUnsizedImage`) is not refused: its source
  passes the URL policy at the host's tier, it paints at its natural size
  scaled into its region, and its measured size is set once it loads, so
  the layout stops shifting. Validation uses stand-in dimensions
  (`withStandInSize`) to check everything else.
- **Player block families.** `diagram`, `map` and `embed` blocks on a free
  slide paint through the player (`playerFamilyOf`).

## Lazy loading

The registry table holds only data and lazy entries. The player and each
painter family load when a slide that needs them mounts or is prefetched,
so a deck with only text pulls no chart or data code (the
`tests/perf/slides.test.ts` lazy-chunk check). `BLOCK_FAMILY_IDS` maps each
block family to its `blocks-*` id.

## Overrides and configuration

The registry factory (`createComponentRenderers`) takes the state host,
capabilities, `onAction`, `overrides` (replace the painter of a catalog id,
or add a host component id; a painter receives `SlideComponentPainterProps`)
and `exclude` (ids this host does not allow on slides). The stage installs
the default registry (`componentRenderers`: memory state, local reorder, no
actions, no overrides).

**Import.** The registry is the `@texuli/slides/components` subpath:

```ts
import { createComponentRenderers } from '@texuli/slides/components';

const renderers = createComponentRenderers({
  stateHost: myPersistentStateHost,
  capabilities: { reorder: true, workflowEdit: false, embeds: false },
});
// <DeckStage {deck} {renderers} />: the host table answers first.
```

| Name | What it is |
| --- | --- |
| `ComponentRegistryOptions` | The factory options: `stateHost` (default a new memory host), `capabilities` (default local reorder only), `onAction` (form actions; without it forms cannot submit), `overrides` (replace a catalog id's painter or add a host id), `exclude` (ids not allowed on slides), `validateProps` (an opt-in parse-time props check, for example `validateSlideComponent`, about 35 KiB gzip more) and `validationTier` (default `untrusted`) |
| `ComponentRenderers` | The renderer table the factory returns: a `DeckRenderers` table marked with `REGISTRY_OPTIONS` |
| `REGISTRY_OPTIONS` | The symbol that marks a table built by this registry, so its painters find their options |
| `ResolvedRegistryOptions` | The options with defaults applied (`exclude` as a set) |
| `registryOptions(renderers)` | The resolved options from a stage's renderer list (defaults when none is there) |
| `paintsComponent(id, options)` | True when the registry paints `id`: a slide component or a host override, not excluded |
| `slideCatalog()` | The player's render catalog, built once on first use |
| `SlideComponentCheck` | The options of `validateSlideComponent`: `tier` and `capabilities` |

A host that only needs to replace some painting can still pass its own
`renderers` without the factory: its table answers before the default
registry ([stage.md](stage.md#renderers)).
