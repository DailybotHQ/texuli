# Architecture — Texuli

Texuli is built from scratch, in small pieces it owns end to end:
- **texels**, framework-free behavior and policy;
- **primitives**, headless Svelte 5 parts bound to texels;
- **tokens**, the theme engine and CSS contract;
- **styled components** and layouts;
- **domain packages** (data, charts, media, chat, content blocks);
- the **agent catalog** and **tools**.

Dependencies point **down only**, and `scripts/check-layers.ts` enforces it
(`pnpm check:layers`, also part of `pnpm check`).

## The layer graph

The layer of every package is declared once, in `LAYERS` in
`scripts/check-layers.ts`. A package may depend on, and import from, only
packages in lower layers.

| Layer | Package | What it holds | Workspace dependencies |
| --- | --- | --- | --- |
| L0 | `@texuli/core` | Texels: ids, keyboard intents, roving focus and typeahead, focus scope, inert, dismissable layers, layer stack, overlay engine, portal, positioning (math + DOM), presence, scroll lock, tabbable, form bridge, announcer, direction and locale, the URL policy | none |
| L0 | `@texuli/date` | Framework-free Gregorian dates, arithmetic, locale week starts and time-zone-aware today | none |
| L0 | `@texuli/deck` | In development (on npm from `0.4.0`): the framework-free, dependency-free deck engine: deck model v2 and its owned schema kit, migration, the untrusted loader, the Markdown dialect, TeX-subset math, the layout catalog, backgrounds and contrast, navigation, controls, canvas fit and the presenter protocol, lint, patch, the typed builder, brief outlines and templates | none |
| L0 | `@texuli/drag` | In development: framework-free, general-purpose drag engine (sortable lists, boards, trees, spatial canvases, graph editing) | none |
| L0 | `@texuli/spec` | Framework-free blueprint contract and code generation | none |
| L1 | `@texuli/primitives` | 42 owned headless primitives, one subpath each (accordion … tree), held to the WAI-ARIA APG patterns | core, date, drag |
| L1 | `@texuli/document` | In development (on npm from `0.7.0`): the framework-free, DOM-free document engine: the block document format with persisted ids, the validator on the deck schema kit, typed operations and bounded RFC 6902 patches with inverses and an op log, Markdown through the core codec, the pagination engine (`paged`), owned DOCX and PDF writers (`docx`, `pdf`), the CRDT sync core (`sync`) and the document binding for collaboration: comments, suggestions, versions and presence (`collab`) | core, deck |
| L2 | `@texuli/tokens` | The OKLCH theme engine, the `--tx-*` token contract, 200+ themes, compiled CSS, forced colors, the AA gate, the Tailwind preset | none |
| L3 | `texuli` | Styled components (Button … Tree), the class helpers (`cx`, `variants`), icons, layouts and app shells | core, primitives, tokens |
| L4 | `@texuli/charts` | Chart math and every chart family, one lazy subpath per family | core, primitives, tokens, texuli |
| L4 | `@texuli/data` | Data views: grid (core, columns, editing, virtual), tree, board, calendar, timeline, map, activity, files, virtual list | core, drag, primitives, tokens, texuli |
| L4 | `@texuli/media` | Image, gallery, video, audio, captions, image editor, compositions, animation, export | core, primitives, tokens, texuli |
| L4 | `@texuli/chat` | Thread, message list, composer, typing indicator | core, primitives, tokens, texuli |
| L4 | `@texuli/editor` | Rich text editor surface, toolbar, link dialog, headless controller, clipboard import | core, primitives, tokens, texuli |
| L4 | `@texuli/workflows` | In development: interactive, accessible workflow graph editor and viewer (model, layout, editor) | core, drag, primitives, tokens, texuli |
| L4 | `@texuli/forms` | In development (on npm from `0.8.0`): schema-driven forms: the closed form schema and its validator, conditional logic and cross-field rules on `@texuli/core/expression`, named formats, drafts and autosave, and the form controller (`model`, framework-free); `SchemaForm`, which paints any schema with texuli controls, multi-step and keyboard-complete (`.`); the player form host (`host`) | core, texuli |
| L4 | `@texuli/canvas` | In development (on npm from `0.8.0`): the infinite canvas: the canvas format, its untrusted validator, geometry, connector routing on the curve shared with workflows, freehand simplification, operations with inverses and the op-log history (`model`, framework-free); CRDT collaboration on `@texuli/document/sync` (`sync`); SVG and PNG export (`export`); the accessible editor and viewer (`editor`, `viewer`); the player canvas host (`host`) | core, deck, document, drag, texuli |
| L5 | `@texuli/blocks` | Content blocks (text, code, data, diagram, embed, interactive, map, media, structure): closed vocabulary, untrusted guard, formula AST | core, tokens, texuli, charts, data, media |
| L5 | `@texuli/sheets` | In development (on npm from `0.8.0`): spreadsheets: the formula language (a linear-time parser into the `@texuli/core/expression` AST, 54 documented functions, criteria, closed TEXT formats, reference rewriting; `formula`, framework-free); the sheet format, its untrusted validator, the dependency graph with incremental and bounded recalculation and cycle reports, and the workbook engine (`model`, framework-free); CSV import and export that neutralizes formula injection (`csv`); `SheetView` over the data grid editing (`view`); the sheet half of a player host (`host`) | core, date, data, texuli |
| L6 | `@texuli/catalog` | The agent catalog (manifests per group, build) and the renderer with no HTML sinks; `schema-form`, `canvas` and `spreadsheet` drafts are checked by host-injected validators (`checkForm`, `checkCanvas`, `checkSheet` from `@texuli/forms`, `@texuli/canvas` and `@texuli/sheets`), so the catalog depends on none of them and fails closed without one (`form-unchecked`, `canvas-unchecked`, `sheet-unchecked`) | core, spec, texuli, charts, data, blocks, media |
| L7 | `@texuli/player` | Blueprint player runtime and styles | blocks, catalog, charts, chat, data, media, primitives, spec, texuli, workflows |
| L8 | `@texuli/tools` | Copy-in CLI (`texuli-add`, `texuli-init`, `texuli-update`), `texuli-llms`, A2UI adapter, custom elements and the golden set | core, tokens, catalog, blocks, charts, media, deck, document |
| L8 | `@texuli/astro` | Astro integration, site helpers and content layouts | blocks, core, tokens |
| L8 | `@texuli/slides` | The Svelte 5 presentation stage on `@texuli/deck` (canvas, routes, chrome, overview, presenter window, the 21 layouts, backgrounds, the component registry), print and PPTX export, and the model v1 subpaths kept from `0.3.0`; in development | blocks, catalog, deck, media, player, tokens |
| L8 | `@texuli/pages` | In development (on npm from `0.7.0`): the block document editor and reader on `@texuli/document`: text through `@texuli/editor`, a slash menu, block selection and drag on `@texuli/drag`, nested pages, resizable columns and live embeds painted by the player (`editor`, `reader`), the paged view and print (`paged`), Markdown, DOCX and PDF export (`export`), collaboration with comments, suggestions, version history and presence (`collab`), and the document host that lets the player paint agent documents (`host`) | blocks, core, document, drag, editor, player, primitives, tokens, texuli |
| L9 | `@texuli/mcp` | In development, on npm since `0.9.0` (its first release): the local MCP server for agent hosts: the bin `texuli-mcp` (`npx -y @texuli/mcp`) and `startTexuliMcp` serve the stdio server of `@texuli/tools` with every `edge` and `node` operation; pinned exactly to `@texuli/tools` and published right after it (ADR-019) | tools |

Not layers, because they consume the library:
- **`@texuli/examples`** (private) is the examples registry. Every component
  writes its examples once, for tests, visual baselines and the website.
- **`@texuli/website`** (`apps/website`) is texuli.com.
- **`@texuli/agent`** (`apps/agent`, private) is the texuli.com agent
  service: a stateless worker that turns a chat prompt into a validated,
  untrusted blueprint draft. It runs only on a fake replay provider and is
  not deployed.
- **`native/`** is a self-contained Gradle Kotlin Multiplatform build
  (`texuli-spec`, `texuli-compose`, `conformance`) that consumes the
  generated Kotlin from `@texuli/spec`. It is not a pnpm package and the
  layer guard does not see it.
- **`functions/`** holds the Cloudflare Pages Functions deployed with the
  website (see [The website](#the-website)).

`@texuli/examples` is never packed (`NEVER_PACKED` in
`scripts/packages.ts`); `pnpm verify:packages` packs the other 26, and all
26 are released on npm as `0.9.0`, the first release of `@texuli/mcp` (new
in PLAN_011; the 0.8 line had 25 packages);
`@texuli/drag`, `@texuli/workflows`, `@texuli/deck`, `@texuli/editor`,
`@texuli/document`, `@texuli/pages`, `@texuli/forms`, `@texuli/canvas`,
`@texuli/sheets` and `@texuli/mcp` are in development
and sit in the `publish.yml` wave order ahead of their dependents
([RELEASE](RELEASE.md)).

```text
L9  mcp (the local MCP server bin, over tools)
L8  tools · astro · slides · pages
L7  player
L6  catalog
L5  blocks · sheets
L4  charts · data · media · chat · editor · workflows · forms · canvas
L3  texuli (styled components, layouts, shells)
L2  tokens (theme engine, CSS contract)
L1  primitives (headless, APG) · document (framework-free engine)
L0  core · date · deck · drag · spec (framework-free)
          ▲ dependencies point down only (scripts/check-layers.ts)
```

Every package PLAN_010 decided has landed and is in this table and in
`LAYERS` (the motion, streaming, markup, ZIP and stage-core subpaths landed
in `0.6.0`; `@texuli/document` and `@texuli/pages` are on npm from `0.7.0`,
`@texuli/forms`, `@texuli/canvas` and `@texuli/sheets` from `0.8.0`, and
`@texuli/mcp` from `0.9.0`, all in development). What is still planned, and the decided
names and layers, are listed in
[Planned (PLAN_010)](#planned-plan010).

### What the layer guard enforces

`pnpm check:layers` reads every workspace manifest and every shipped source
file. It fails on:
- an upward or same-layer dependency or import;
- a deep import past a package's public `exports` (for example
  `@texuli/core/src/...`);
- a banned dependency;
- an HTML or code sink in shipped code (`{@html}`, `eval(`,
  `new Function(`, `innerHTML`/`outerHTML` assignments,
  `insertAdjacentHTML(`);
- a static `style="..."` attribute in shipped Svelte markup.

Comments and strings are masked first, so documentation that names a sink
passes.

## Package subpaths

The export map for each package is recorded below. A consumer can import a
specific subpath instead of the package root. Each budgeted subpath has a size
cap in `texuli.budgets.json` (`pnpm size`).

| Package | `package.json` export subpaths |
| --- | --- |
| `@texuli/astro` (private) | `.`, `appearance`, `content`, `integration`, `site`, `styles.css`, `layouts/ContentLayout`, `sections/Hero`, `sections/Section` |
| `@texuli/blocks` (private) | `.`, `code`, `code/engine`, `code/renderers`, `code/tokenizer`, `core`, `data`, `data/engine`, `data/renderers`, `diagram`, `diagram/engine`, `diagram/renderers`, `embed`, `embed/engine`, `embed/renderers`, `formula`, `interactive`, `interactive/engine`, `interactive/renderers`, `map`, `map/engine`, `map/renderers`, `media`, `media/engine`, `media/renderers`, `structure`, `structure/engine`, `structure/renderers`, `text`, `text/engine`, `text/markdown`, `text/renderers` |
| `@texuli/catalog` (private) | `.`, `build`, `build/node`, `edit`, `envelope`, `manifest`, `manifests/content`, `manifests/chat`, `manifests/composition`, `manifests/data`, `manifests/documents`, `manifests/display`, `manifests/forms`, `manifests/layouts`, `manifests/schema-forms`, `manifests/canvas`, `manifests/sheets`, `manifests/overlays`, `manifests/state`, `manifests/workflows`, `manifests/all` (every group statically, for the edge; ADR-017), `player`, `render/frame`, `render/grammar`, `render/hostile`, `render/limits`, `render/conditions`, `render/renderer`, `render/richtext`, `validate`, `validate/blocks` |
| `@texuli/charts` (private) | `.`, `canvas`, `colors`, `calendar`, `annotations`, `axis`, `cartesian`, `compact`, `sparkline-lite`, `flow`, `geo`, `histogram`, `interaction`, `math`, `math/scales`, `math/shapes`, `math/layout`, `math/downsample`, `math/color`, `matrix`, `part-whole`, `pack`, `statistical`, `streaming`, `schemas`, `worker`, `worker/entry` |
| `@texuli/chat` (private) | `.` |
| `@texuli/editor` (private, in development) | `.`, `controller`, `editor`, `link-dialog`, `markdown`, `paste`, `toolbar` |
| `@texuli/core` (private) | `.`, `announcer`, `controllable`, `data-source`, `dir-locale`, `dismiss`, `editor-history`, `editor-keymap`, `editor-markdown`, `editor-model`, `editor-transforms`, `env`, `expression`, `focus-scope`, `form-bridge`, `i18n`, `ids`, `inert`, `keyboard`, `layer-stack`, `lazy`, `markup`, `motion`, `motion/spring`, `overlay`, `overlay-core`, `portal`, `position-dom`, `position-math`, `presence`, `roving`, `scroll-lock`, `tabbable`, `url-policy`, `zip` |
| `@texuli/date` (private) | `.`, `calendar` |
| `@texuli/deck` (private, in development) | `.`, `model`, `schema`, `engine`, `markdown`, `math`, `authoring`, `templates` |
| `@texuli/document` (private, in development) | `.`, `model`, `schema`, `ops`, `markdown`, `paged`, `docx`, `pdf`, `sync`, `collab` |
| `@texuli/drag` (private, in development) | `.`, `sortable`, `collision`, `modifiers`, `auto-scroll`, `gesture`, `spatial`, `graph`, `messages`, `testing` |
| `@texuli/data` (private) | `.`, `activity`, `activity/engine`, `activity/inbox`, `board`, `board/engine`, `calendar`, `cohort`, `files`, `files/engine`, `filter-builder`, `geo`, `grid`, `grid-columns`, `grid-core`, `grid-virtual`, `map`, `timeline`, `timeline/engine`, `tree`, `tree-view`, `virtual-list`, `calendar/view`, `grid-editing`, `dashboard`, `dashboard/engine` |
| `@texuli/canvas` (private, in development) | `.`, `model`, `sync`, `export`, `editor`, `viewer`, `host` |
| `@texuli/sheets` (private, in development) | `.`, `formula`, `model`, `csv`, `view`, `host` |
| `@texuli/examples` (private) | `.` |
| `@texuli/forms` (private, in development) | `.`, `model`, `host`, `styles.css` |
| `@texuli/media` (private) | `.`, `animation`, `animation/player`, `audio`, `captions`, `composition-canvas`, `composition-canvas/draw`, `composition-canvas/render`, `composition-model`, `composition-svg`, `composition-v2`, `export`, `export/ui`, `gallery`, `gallery/lightbox`, `generator-slot`, `image`, `image-editor`, `image-editor/model`, `image-editor/render`, `timeline`, `timeline/model`, `video` |
| `@texuli/player` (private) | `.`, `design-system` (in development for `0.10.0`: the lazy design-system step, shared with the slides stage), `styles.css` |
| `@texuli/pages` (private, in development) | `.`, `editor`, `reader`, `paged`, `export`, `host`, `collab`, `styles.css` |
| `@texuli/primitives` (private) | `.`, `accordion`, `alert-dialog`, `color-picker`, `context-menu`, `label`, `number-field`, `progress`, `separator`, `sheet`, `slider`, `tags-input`, `toolbar`, `tooltip`, `collapsible`, `command`, `date-picker`, `date-field`, `file-drop`, `radio-group`, `switch`, `checkbox`, `calendar`, `toggle`, `menu`, `menubar`, `popover`, `tabs`, `hover-card`, `tree`, `listbox`, `select`, `splitter`, `portal`, `navigation-menu`, `scroll-area`, `pagination`, `toast`, `dialog`, `pin-input`, `combobox`, `avatar`, `sortable` |
| `@texuli/slides` (private) | `.`, `model`, `grammar`, `export`, `templates`, `stage`, `stage-core`, `components`, `layouts`, `styles.css` |
| `@texuli/spec` (private) | `.`, `workflow`, `migrate`, `codegen`, `surface`, `motion`, `stream`, `source`, `design-system` (in development for `0.10.0`) |
| `@texuli/workflows` (private, in development) | `.`, `model`, `layout`, `spec-adapter`, `editor`, `viewer`, `inspector` |
| `texuli` (private) | `.`, `alert`, `avatar`, `badge`, `button`, `card`, `carousel`, `choice`, `combobox`, `command`, `cx`, `date`, `defaults`, `dialog`, `empty`, `feedback`, `field`, `file-upload`, `icons`, `icons/lucide`, `input`, `kbd-code`, `layouts/app`, `layouts/app/dual-sidebar`, `layouts/app/master-detail`, `layouts/app/rail`, `layouts/app/sidebar`, `layouts/app/split-view`, `layouts/app/top-nav`, `layouts/auth-settings`, `layouts/auth-settings/register`, `layouts/content`, `layouts/content/blog`, `layouts/content/docs`, `layouts/content/editorial`, `layouts/dashboard`, `layouts/dashboard/register`, `layouts/host`, `layouts/host/chrome`, `layouts/host/drawer`, `layouts/marketing`, `layouts/marketing/entry`, `layouts/marketing/landing`, `layouts/marketing/pricing`, `layouts/marketing/register`, `layouts/marketing/section`, `layouts/mobile`, `layouts/mobile/register`, `layouts/shells`, `menus`, `motion`, `navigation`, `number-pin`, `popover`, `rating`, `resizable`, `scroll-area`, `select`, `separator-aspect`, `sheet`, `sidebar`, `slider`, `stat`, `stepper`, `table`, `tabs-accordion`, `tags-color`, `timeline`, `toast`, `toggle`, `toolbar`, `tooltip`, `tree` |
| `@texuli/tokens` (private) | `.`, `aa-gate`, `aa-gate/components`, `base.css`, `build`, `components`, `contract`, `css`, `data-viz`, `forced-colors`, `forced-colors.css`, `generator`, `library`, `library-expand`, `modes`, `motion`, `no-flash`, `palette`, `renames`, `renames.json`, `style-presets`, `system`, `tailwind`, `tailwind/preset.css` |
| `@texuli/tools` (private) | `.`, `a2ui`, `cli-add`, `cli-init`, `cli-update`, `llms`, `elements`, `golden`, `deck`, `document`, `email`, `print`, `ops` (the operations registry, ADR-017), `mcp` (the MCP protocol layer, its stdio transport and `runMcpCli`) |
| `@texuli/mcp` (private, in development) | `.` (`startTexuliMcp`, `runTexuliMcpCli`, `TEXULI_MCP_VERSION`; the bin `texuli-mcp`) |

This inventory is checked against each package's `package.json` `exports`;
each package's README and `docs/*.md` describe its subpaths
([docs/README.md](README.md) lists them all).

## Cross-cutting engines

- **One overlay engine.** Every floating part (dialog, sheet, popover, menu,
  select, combobox, tooltip, hover card) sits on `@texuli/core/overlay`.
  That covers:
  - the layer stack;
  - Escape and outside dismissal;
  - focus scope and restore;
  - `inert` outside the top layer;
  - scroll lock;
  - top-layer or contained modes.

  Exempt regions (the toast region) stay reachable under a modal.
- **Positioning is owned:** `position-math` (pure) and `position-dom`. No
  third-party positioning library.
- **Roving focus:** `core/roving` gives one tab stop per composite widget,
  and the selected item is that stop in single-selection widgets.
- **Ids:** consumer ids always win on every part, and every reference follows
  the effective id (`packages/primitives/docs/consumer-ids.md`).
- **The URL policy is the only door for links and media:** `safeHref`,
  `safeImageSrc` and `safeMediaSrc`, with the `developer` tier for
  app-authored props and `untrusted` for agent or user content.
- **Class composition is owned:** `cx` and `variants` from `texuli/cx`.
  Consumer classes win through the `@layer tx.base, tx.components` cascade
  layers.

## The agent path

```text
agent output (JSON) ─► @texuli/spec migrate + validate (closed vocabulary, state surface, list text)
                    ─► @texuli/catalog validation (closed ids, schemas, interaction, limits)
                    ─► sink-free renderer (no HTML strings, no style/class passthrough)
                    ─► @texuli/player painters ─► URL policy ('untrusted') on every link and source
```

- **Catalog groups.** `@texuli/catalog` builds 168 ids from manifest groups:
  `content`, `display`, `forms`, `layouts`, `overlays`, (new in `0.4.0`)
  `composition`, `data`, `chat`, `state` and `workflows`, (new in `0.7.0`)
  `documents`, whose `document` id carries a Texuli document as data,
  validated by a host-supplied check (`@texuli/pages/host`), and (new in
  `0.8.0`) `schema-forms`, `canvas` and `sheets` (`schema-form`, `canvas`
  and `spreadsheet`, checked by `@texuli/forms/host`, `@texuli/canvas/host`
  and `@texuli/sheets/host`), plus `data-dashboard` and
  `data-dashboard-widget` in `data`. 75 ids are agent-emittable; the rest
  are app tier.
- **Player painters.** `@texuli/player` loads one lazy painter per
  emittable id (`PLAYER_LOADERS`): layouts, blocks, charts, media, data views
  (grid, tree, board, calendar, timeline, map, files), chat display, state
  controls, forms and flows, `sortable-list` (one shared drag scope per
  player) and `workflow-graph` (`@texuli/workflows`). `tests/loader-parity`
  fails when an emittable id has no painter.
- **Decks as data.** Spec 0.4.0 (ADR-009) adds the
  deck model v2 props to `layout-deck` and `deck-slide`; see
  [Decks: engine and stage](#decks-engine-and-stage).
- **Interaction as data.** Spec 0.3.0 (ADR-008) adds `state`, `flow`,
  `bind`, `on` and a closed action set (`setState`, `toggleState`,
  `moveItem`, `flowGo`, `emit`, `submit`). The player runs them in its
  reducers (`packages/player/src/state/`); nothing in a blueprint is
  evaluated. `@texuli/spec/surface` holds the state surface rules the spec,
  the catalog and the Kotlin twin share with the player, so a blueprint
  that validates paints.

`@texuli/tools` exposes the same catalog to agents through:
- the copy-in CLI;
- `texuli-llms` (LLM-readable docs);
- the A2UI adapter;
- custom elements;
- the local stdio MCP server (`packages/tools/src/mcp`, exported as
  `@texuli/tools/mcp`), which `texuli mcp` and the `texuli-mcp` bin of
  `@texuli/mcp` (L9, on npm since `0.9.0`) both run; tested in
  `packages/tools/tests/mcp-protocol.test.ts`, `mcp-cli.test.ts` and the
  consumer test `tests/consumers/mcp.spec.ts`.

- the `texuli` router (`packages/tools/src/cli/router.ts`): `texuli <group>
  <verb>` for every operation, generated from the registry, plus the 0.8
  commands; `texuli help` is a snapshot test;
- the remote MCP (`functions/mcp.ts`, live at `https://texuli.com/mcp` since
  release 0.9.0, deployed with the site from `main`): the same handler,
  stateless, the `edge` and `site` operations.

Every agent-facing description of these doors is generated from the
operations registry by `scripts/generate-surfaces.ts` (builders in
`scripts/agent-surfaces.ts`): the server card
(`apps/website/public/.well-known/mcp/server-card.json`), the "Tools" section
of the site `llms.txt`, the tables of `packages/tools/docs/ops.md` and the
`/mcp-server/` page data. `pnpm check:surfaces` (inside `pnpm check`)
regenerates them into a temporary directory and fails on any difference;
`check-skill` parses every `texuli …` command with the router and checks
every operation name and argument the skill cites; and the CI job
`mcp-remote-smoke` compares texuli.com's `tools/list` with the registry
after each deploy of `main`.

## Decks: engine and stage

ADR-009 splits presentations in two packages (both on npm as `0.9.0`;
`@texuli/deck` was first released in `0.4.0`):

- **`@texuli/deck` (L0)** owns everything that is data: deck model v2
  (`formatVersion: 2`; slides told apart by `layout`: 20 catalog layouts,
  `free`, `component`, `custom`), validated by an owned schema kit that
  reports every issue at once and exports JSON Schema from the same
  definition (no zod). JSON (`parseDeck`, `loadUntrustedDeck`) and Markdown
  (`parseDeckMarkdown`, an owned dialect that refuses HTML) produce the same
  validated deck, and `migrateDeck` lifts model v1 decks, catalog grammar
  trees and Protoyard decks. The engine (navigation, hash routes, the
  controls registry, canvas fit, auto-slide, the presenter protocol, the
  controller) imports nothing outside the package, which
  `packages/deck/tests/engine-import-guard.test.ts` enforces. It checks URL
  syntax only; it never carries a trust tier.
- **`@texuli/slides` (L8)** is the Svelte 5 stage on the engine: canvas,
  chrome, overview, presenter window, the layout renderers, backgrounds,
  print and PPTX. It sits at L8, above `@texuli/player` (L7), because its
  default **component registry** paints catalog components through the
  player: a slide component becomes a one-node blueprint that the player
  validates again at the stage's tier and paints with its lazy painter
  (53 slide components; app shells, overlays, route hosts and the deck
  wrappers are excluded with reasons, and a coverage test keeps every
  catalog id classified). Hosts answer first through `renderers`. The URL
  policy applies at paint with the host's tier (`untrusted` by default).

Agent decks travel as catalog trees under spec `0.4.0` and later, whose `layout-deck` and `deck-slide` manifests carry the model v2
props. `validateDeckDraft` in `@texuli/catalog/validate` maps a tree to a
v2 deck without depending on `@texuli/deck`; the host then runs
`migrateDeck` and `parseDeck`. `@texuli/player` keeps painting decks as a
document and offers a `deckHost` seam (and `chrome={false}`) so a host with
`@texuli/slides` presents them on the stage. Package docs:
[packages/deck](../packages/deck/README.md) and
[packages/slides](../packages/slides/README.md).

## Planned (PLAN_010)

**Planned, not shipped**, except the rows marked as released in `0.6.0`
(`@texuli/core/motion`, `@texuli/core/markup`, `@texuli/core/zip`, the
`@texuli/tokens` motion tokens, `@texuli/spec/stream` and the player's
streaming mode), in `0.7.0` (`@texuli/document` and `@texuli/pages`,
every subpath, `collab` included, and spec `0.7.0`) and in `0.8.0`
(`@texuli/forms`, `@texuli/canvas`, `@texuli/sheets`, the core
`expression`, `data-source` and `i18n` subpaths, the data dashboard, the
tools email and print outputs, the player print mode and spec `0.8.0`).
These are the package
names, layers and subpaths decided by
ADR-010 to ADR-016 in [DECISIONS](DECISIONS.md) for the 0.6.0, 0.7.0 and
0.8.0 release waves. Each package stays "in development" until a release
the developer approves publishes it, and joins the layer table,
`LAYERS` in `scripts/check-layers.ts` and the package subpaths table only
when it lands.

New packages:

| Planned layer | Package | Subpaths | What it will hold | Will depend on | Release wave | Decision |
| --- | --- | --- | --- | --- | --- | --- |
| L1 | `@texuli/document` (released in `0.7.0`: `.`, `model`, `schema`, `ops`, `markdown`, `paged`, `docx`, `pdf`, `sync`, `collab`; in the layer table) | none left | Framework-free, DOM-free document engine: the block document format with persisted ids, typed operations and bounded RFC 6902 patches, the untrusted loader, Markdown through the core codec, pagination, DOCX and PDF writers, and the CRDT sync layer | core, deck | 0.7.0 | [ADR-011](DECISIONS.md#adr-011-document-packages-texulidocument-l1-engine-and-texulipages-l8-editor), [ADR-010](DECISIONS.md#adr-010-document-sync-an-owned-crdt-behind-an-op-log-transport) |
| L4 | `@texuli/forms` (released in `0.8.0`: `.`, `model`, `host`, `styles.css`; in the layer table) | none left | Schema-driven forms: fields, steps, conditional logic on the shared expression AST, closed validation rules, drafts and autosave | core, texuli | 0.8.0 | [ADR-015](DECISIONS.md#adr-015-one-bounded-expression-language-and-closed-vocabularies-for-agent-logic) |
| L4 | `@texuli/canvas` (released in `0.8.0`: `.`, `model`, `sync`, `export`, `editor`, `viewer`, `host`; in the layer table) | none left | Infinite canvas: shapes, text, connectors, frames, selection, zoom and pan on `@texuli/drag` spatial geometry (the edge curve moved into `@texuli/drag/graph`, shared with workflows), synced through `@texuli/document/sync` | core, deck, document, drag, texuli | 0.8.0 | [ADR-010](DECISIONS.md#adr-010-document-sync-an-owned-crdt-behind-an-op-log-transport) |
| L5 | `@texuli/sheets` (released in `0.8.0`: `.`, `formula`, `model`, `csv`, `view`, `host`; in the layer table) | `sync` (collaboration on `@texuli/document/sync`, planned) | Spreadsheets: the owned formula engine (parser, function set, dependency graph, incremental and bounded recalculation), a sheet view over the data grid editing, CSV import and export; L5 because it builds on `@texuli/data` (L4) | core, date, data, texuli | 0.8.0 | [ADR-015](DECISIONS.md#adr-015-one-bounded-expression-language-and-closed-vocabularies-for-agent-logic) |
| L8 | `@texuli/pages` (released in `0.7.0`: `.`, `editor`, `reader`, `paged`, `export`, `host`, `collab`, `styles.css`; in the layer table) | none left | The block document editor and reader on `@texuli/editor`: slash menu, block drag, nested pages, columns, live embeds painted by the player, paged view and print, comments, suggestions, history and presence | document, editor, blocks, player, drag, primitives, tokens, texuli, core | 0.7.0 | [ADR-011](DECISIONS.md#adr-011-document-packages-texulidocument-l1-engine-and-texulipages-l8-editor) |

New subpaths in existing packages:

| Package | Planned subpaths | What they will hold | Release wave | Decision |
| --- | --- | --- | --- | --- |
| `@texuli/core` | `motion`, `motion/spring` (released in `0.6.0`) | Presence enter and exit, FLIP layout, shared elements, sequences and timelines, the spring solver, on the Web Animations API; reduced motion is instant | 0.6.0 | [ADR-013](DECISIONS.md#adr-013-motion-runtime-web-animations-with-an-owned-spring-solver) |
| `@texuli/core` | `markup`, `zip` (released in `0.6.0`) | Typed, escaped XML and HTML builders with URL-policy attributes, and the deterministic ZIP writer (stored, or deflated through `CompressionStream`) | 0.6.0 | [ADR-016](DECISIONS.md#adr-016-static-output-targets-and-i18n) |
| `@texuli/core` | `expression`, `data-source` (released in `0.8.0`) | The bounded expression evaluator with a closed function table; host-registered data sources with pagination, filters, sorting, optimistic updates and cancellation | 0.8.0 | [ADR-015](DECISIONS.md#adr-015-one-bounded-expression-language-and-closed-vocabularies-for-agent-logic) |
| `@texuli/core` | `i18n` (released in `0.8.0`) | The message catalog, placeholder, plural and select formatting, lazy locale loading, a pseudo-locale; `texuli` and `@texuli/primitives` resolve their labels through it (`setI18nContext`, `useMessages`) | 0.8.0 | [ADR-016](DECISIONS.md#adr-016-static-output-targets-and-i18n) |
| `@texuli/tokens` | `motion`, and motion properties in the existing CSS (released in `0.6.0`) | Durations, easings and springs as data and `--tx-motion-*` properties | 0.6.0 | [ADR-013](DECISIONS.md#adr-013-motion-runtime-web-animations-with-an-owned-spring-solver) |
| `@texuli/spec` | `stream` and `motion` (released in `0.6.0`, with spec `0.6.0`); spec `0.7.0` (released in `0.7.0`: the document shape, the patch schema and node keys); spec `0.8.0` (released in `0.8.0`: data-source bindings, forms, canvases, dashboards and spreadsheets) | The incremental, bounded JSON tokenizer for streamed blueprints and the closed motion vocabulary; spec minors 0.6.0, 0.7.0 and 0.8.0 | 0.6.0 (`stream`, `motion`), 0.7.0 (documents), 0.8.0 (sources, forms, canvases, dashboards, sheets) | [ADR-014](DECISIONS.md#adr-014-streaming-generation-paint-only-validated-closed-node-shells), [ADR-012](DECISIONS.md#adr-012-spec-evolution-one-additive-minor-per-release-wave) |
| `@texuli/data` | `dashboard`, `dashboard/engine` (released in `0.8.0`) | The widget grid with drag and resize, keyboard equivalents, breakpoints and persistence; painted by the player as `data-dashboard` and `data-dashboard-widget` | 0.8.0 | [ADR-010](DECISIONS.md#adr-010-document-sync-an-owned-crdt-behind-an-op-log-transport) |
| `@texuli/tools` | `email`, `print` (released in `0.8.0`) | Email-safe HTML and plain text from validated blueprints, with typed inline styles (email dark mode is planned); and a headless PDF of a validated blueprint through `@texuli/document` (`print`) | 0.8.0 | [ADR-016](DECISIONS.md#adr-016-static-output-targets-and-i18n) |
| `@texuli/player` | streaming mode (released in `0.6.0`: `<Player stream>`), print mode (released in `0.8.0`; no new subpath) | Paint validated node shells while a blueprint streams; print styles for blueprints | 0.6.0 (streaming), 0.8.0 (print) | [ADR-014](DECISIONS.md#adr-014-streaming-generation-paint-only-validated-closed-node-shells), [ADR-016](DECISIONS.md#adr-016-static-output-targets-and-i18n) |

## Planned (PLAN_011)

**Planned (PLAN_011), not shipped.** The 0.9.0 wave of ADR-017 to ADR-020
and ADR-023 has landed and is released: `@texuli/mcp` (L9) is in the layer
table, and `@texuli/tools` `ops` and `mcp`, `@texuli/catalog`
`manifests/all`, the token contract v2 subpaths of `@texuli/tokens`
(`system`, `components`, `data-viz`, `renames`, `renames.json`) and
`texuli/defaults` are in the package subpaths table above; the remote MCP
(`functions/mcp.ts`) is described under [The website](#the-website). What
remains are the package, subpath and file names decided by ADR-021 to
ADR-024 in [DECISIONS](DECISIONS.md) for the 0.10.0 (design systems) release
wave. Each entry joins the package subpaths table only when it lands, and
the release needs the developer's GO.

New packages: none left.

New subpaths in existing packages:

| Package | Planned subpaths | What they will hold | Release wave | Decision |
| --- | --- | --- | --- | --- |
| `@texuli/tokens` | `design-system/validate` and `design-system/compile` (built on `release/0.10.0`, not on npm; [design-system-compiler.md](../packages/tokens/docs/design-system-compiler.md)); `design-system/import`, `design-system/emit`, `design-system/report`, `design-system/diff` and `design-system/fixtures` (built on `release/0.10.0`, not on npm; [design-system-io.md](../packages/tokens/docs/design-system-io.md)); `design-system/apply` (built on `release/0.10.0`, not on npm; [design-system-runtime.md](../packages/tokens/docs/design-system-runtime.md)) | The design-system runtime, all lazy: the validator with the compiled-map guarantee check, the compiler (`extends`, variants, patches, the pinned-color solver, enforced guarantees, `CompiledDesignSystem`, `fromTheme`), the importers (brand one-liner, DTCG, Tokens Studio, flat role palette, Theme, logo pixels), the emitters (scoped CSS, Tailwind preset, DTCG, compiled JSON), the static report, the diff and the fictional `protoyard-theme/v1` fixture, and `applyDesignSystem`, `designSystemStyle` and `designSystemAppearance` for element scope, SSR and no flash; `@texuli/tokens` gains a down-only dependency on `@texuli/spec` | 0.10.0 | [ADR-021](DECISIONS.md#adr-021-the-design-system-document), [ADR-022](DECISIONS.md#adr-022-design-system-guarantees-enforced-never-reported), [ADR-023](DECISIONS.md#adr-023-design-system-runtime-and-scoping), [ADR-024](DECISIONS.md#adr-024-design-systems-on-every-surface) |
| `@texuli/spec` | the design-system schema and spec `0.10.0` (schema, types, validator, patch, migrate and Kotlin types built on `release/0.10.0`, not on npm; the envelope wiring is planned, PLAN_011) | The `texuli/design-system` document (`formatVersion` 1): schema, TypeScript types, `DesignSystemPatch`, the JSON-path validator, `migrate`, stable error codes and generated Kotlin (`@texuli/spec/design-system`, [design-system.md](../packages/spec/docs/design-system.md)); spec `0.10.0` adds `$defs.designSystemReference` (`ref` or `inline`); carrying it on blueprints, decks and documents is planned | 0.10.0 | [ADR-021](DECISIONS.md#adr-021-the-design-system-document), [ADR-024](DECISIONS.md#adr-024-design-systems-on-every-surface) |

## The website

`apps/website` is texuli.com, built with Astro 7 and `@astrojs/svelte` as a
static site with `client:visible` islands:
- the docs shell and sidebar;
- component, primitive, chart, block and media pages;
- live demos;
- themes (gallery, switcher, studio, color explorer);
- the playground, search, showcase and examples;
- the agents and skill pages;
- SEO with compile-time social images.

It imports the workspace packages directly, so a broken component breaks
`pnpm build`. Cloudflare Pages Functions in the repository-root
`functions/` run beside the static output:
- `_middleware.ts` serves the Markdown twin of any page (`/index.md` for
  `/`) on an explicit `text/markdown` preference, labels `.md` files
  `text/markdown`, a stripped `robots.txt` to audit tools and a Markdown
  404 to agents (`problem+json` under `/api/` and for JSON clients), and
  sends bot-hit and `markdown_request` events; every other request gets the
  static asset response back untouched, so its `_headers` (CSP, and
  `Vary: Accept` on every page with a twin) survive;
- `api/umami/[[path]].ts` is the same-origin Umami analytics proxy, off
  until the owner provisions it.
- `mcp.ts` is the remote MCP endpoint for `/mcp` (the middleware routes
  `/.well-known/mcp` to the same server): the `edge` and `site` operations,
  with its own limits and headers
  ([SECURITY](SECURITY.md#21-remote-mcp-endpoint)). It is live with
  texuli.com since release 0.9.0.

The pure decisions live in `apps/website/src/lib/` and are tested in
`apps/website/tests/` ([SECURITY](SECURITY.md#15-website-edge-functions-and-analytics)). Per-route budgets live in
`apps/website/src/components/perf/budgets.ts`. Each area's design is in
`apps/website/docs/`.

## Build and test shape

- **Source-first packages.** The `exports` map points at `src/**`, and
  consumers compile with their own toolchain.
  - `pnpm verify:packages` builds, packs and checks each library package the
    way npm would publish it: `dist/` via `@sveltejs/package`, a derived
    manifest, publint and attw. It publishes nothing.
  - Workspace packages stay `private: true`; the publish workflow publishes
    the 26 packable packages, `@texuli/mcp` included, to npm as the `0.9.0`
    release (dist-tags
    `latest` and `next`), with provenance
    ([RELEASE](RELEASE.md)).
- **Tests:**
  - **Unit:** Vitest (happy-dom) in `packages/*/tests/`,
    `apps/website/tests/` and `scripts/tests/`, plus perf tests in `tests/perf/` (opt in with
    `TEXULI_PERF=1`).
  - **Browser:** Playwright with Chromium, WebKit and Pixel 7. Checks live
    in `tests/e2e/`, the behavior suite in `tests/behavior/`, visual
    baselines in `tests/visual/` and consumer apps in `tests/consumers/`.
  - **Fixture app:** `tests/fixtures/app` renders every example, served by
    Vite on `TEXULI_E2E_PORT`.

  See [TESTING_GUIDE](TESTING_GUIDE.md).

## Root tooling

| File | Role |
| --- | --- |
| `package.json` | Root scripts (see [DEVELOPMENT_COMMANDS](DEVELOPMENT_COMMANDS.md)), pnpm, Node ≥ 24.20 |
| `pnpm-workspace.yaml` | Workspace globs `packages/*`, `apps/*`, `tests/fixtures/*` |
| `tsconfig.base.json` | Strict, `erasableSyntaxOnly`, `verbatimModuleSyntax`, `noUncheckedIndexedAccess`, `allowImportingTsExtensions` |
| `biome.json` | Lint and format |
| `vitest.config.ts` | Svelte plugin, happy-dom; includes `packages/*/tests`, `apps/website/tests`, `scripts/tests`, and `tests/perf` only on a perf run (`apps/agent` has its own config) |
| `playwright.config.ts` | Chromium, WebKit and Pixel 7 against `tests/fixtures/app` on `TEXULI_E2E_PORT` |
| `texuli.budgets.json` | gzip caps per export subpath (`pnpm size`) |

## Where to change things

| Change | Where | Gates |
| --- | --- | --- |
| A texel | `packages/core/src/<area>/` + `packages/core/tests/<area>.test.ts` | `pnpm check` (core is shared by every layer) |
| A primitive | `packages/primitives/src/<name>/` + `tests/` + `tests/behavior/scenarios/<name>` | unit tests, behavior suite on chromium and webkit (phone rows in a Pixel 7 context), `pnpm size` |
| A styled component | `packages/texuli/src/components/<name>/` + an example in `packages/examples` + visual baselines | unit tests, `pnpm visual -g <example>` |
| A website page | `apps/website/src/pages/`, `apps/website/src/components/` + `tests/e2e/site-*.spec.ts` | `pnpm build` + its site spec |
| Edge behavior (middleware, analytics proxy) | `functions/` + its pure logic in `apps/website/src/lib/` + `apps/website/tests/` | `pnpm vitest run apps/website`, `pnpm build`, then a post-deploy header check |
| A new package or layer | `packages/<name>/` and `LAYERS` in `scripts/check-layers.ts` | owner approval (workspace, lockfile), then `pnpm check` |
