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
| L2 | `@texuli/tokens` | The OKLCH theme engine, the `--tx-*` token contract, 200+ themes, compiled CSS, forced colors, the AA gate, the Tailwind preset | none |
| L3 | `texuli` | Styled components (Button … Tree), the class helpers (`cx`, `variants`), icons, layouts and app shells | core, primitives, tokens |
| L4 | `@texuli/charts` | Chart math and every chart family, one lazy subpath per family | core, primitives, tokens, texuli |
| L4 | `@texuli/data` | Data views: grid (core, columns, editing, virtual), tree, board, calendar, timeline, map, activity, files, virtual list | core, drag, primitives, tokens, texuli |
| L4 | `@texuli/media` | Image, gallery, video, audio, captions, image editor, compositions, animation, export | core, primitives, tokens, texuli |
| L4 | `@texuli/chat` | Thread, message list, composer, typing indicator | core, primitives, tokens, texuli |
| L4 | `@texuli/editor` | Rich text editor surface, toolbar, link dialog, headless controller, clipboard import | core, primitives, tokens, texuli |
| L4 | `@texuli/workflows` | In development: interactive, accessible workflow graph editor and viewer (model, layout, editor) | core, drag, primitives, tokens, texuli |
| L5 | `@texuli/blocks` | Content blocks (text, code, data, diagram, embed, interactive, map, media, structure): closed vocabulary, untrusted guard, formula AST | core, tokens, texuli, charts, data, media |
| L6 | `@texuli/catalog` | The agent catalog (manifests per group, build) and the renderer with no HTML sinks | core, spec, texuli, charts, data, blocks, media |
| L7 | `@texuli/player` | Blueprint player runtime and styles | blocks, catalog, charts, chat, data, media, primitives, spec, texuli, workflows |
| L8 | `@texuli/tools` | Copy-in CLI (`texuli-add`, `texuli-init`, `texuli-update`), `texuli-llms`, A2UI adapter, custom elements and the golden set | core, tokens, catalog, blocks, charts, media |
| L8 | `@texuli/astro` | Astro integration, site helpers and content layouts | blocks, core, tokens |
| L8 | `@texuli/slides` | The Svelte 5 presentation stage on `@texuli/deck` (canvas, routes, chrome, overview, presenter window, the 21 layouts, backgrounds, the component registry), print and PPTX export, and the model v1 subpaths kept from `0.3.0`; in development | blocks, catalog, deck, media, player, tokens |

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
`scripts/packages.ts`); `pnpm verify:packages` packs the other 20.
`@texuli/editor` is publishable from `0.5.0` and not on npm yet; the other
19 are released on npm as `0.4.0`, the first release of
`@texuli/deck` (the previous release, `0.3.0`, had 18 packages);
`@texuli/drag`, `@texuli/workflows` and `@texuli/deck` are in development
and sit in the `publish.yml` wave order ahead of their dependents
([RELEASE](RELEASE.md)).

```text
L8  tools · astro · slides
L7  player
L6  catalog
L5  blocks
L4  charts · data · media · chat · editor · workflows
L3  texuli (styled components, layouts, shells)
L2  tokens (theme engine, CSS contract)
L1  primitives (headless, APG)
L0  core · date · deck · drag · spec (framework-free)
          ▲ dependencies point down only (scripts/check-layers.ts)
```

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
| `@texuli/catalog` (private) | `.`, `build`, `build/node`, `edit`, `envelope`, `manifest`, `manifests/content`, `manifests/chat`, `manifests/composition`, `manifests/data`, `manifests/display`, `manifests/forms`, `manifests/layouts`, `manifests/overlays`, `manifests/state`, `manifests/workflows`, `player`, `render/frame`, `render/grammar`, `render/hostile`, `render/limits`, `render/conditions`, `render/renderer`, `render/richtext`, `validate`, `validate/blocks` |
| `@texuli/charts` (private) | `.`, `canvas`, `colors`, `calendar`, `annotations`, `axis`, `cartesian`, `compact`, `sparkline-lite`, `flow`, `geo`, `histogram`, `interaction`, `math`, `math/scales`, `math/shapes`, `math/layout`, `math/downsample`, `math/color`, `matrix`, `part-whole`, `pack`, `statistical`, `streaming`, `schemas`, `worker`, `worker/entry` |
| `@texuli/chat` (private) | `.` |
| `@texuli/editor` (private, in development) | `.`, `controller`, `editor`, `link-dialog`, `markdown`, `paste`, `toolbar` |
| `@texuli/core` (private) | `.`, `announcer`, `controllable`, `dir-locale`, `dismiss`, `editor-history`, `editor-keymap`, `editor-markdown`, `editor-model`, `editor-transforms`, `env`, `focus-scope`, `form-bridge`, `ids`, `inert`, `keyboard`, `layer-stack`, `lazy`, `overlay`, `overlay-core`, `portal`, `position-dom`, `position-math`, `presence`, `roving`, `scroll-lock`, `tabbable`, `url-policy` |
| `@texuli/date` (private) | `.`, `calendar` |
| `@texuli/deck` (private, in development) | `.`, `model`, `schema`, `engine`, `markdown`, `math`, `authoring`, `templates` |
| `@texuli/drag` (private, in development) | `.`, `sortable`, `collision`, `modifiers`, `auto-scroll`, `gesture`, `spatial`, `graph`, `messages`, `testing` |
| `@texuli/data` (private) | `.`, `activity`, `activity/engine`, `activity/inbox`, `board`, `board/engine`, `calendar`, `cohort`, `files`, `files/engine`, `filter-builder`, `geo`, `grid`, `grid-columns`, `grid-core`, `grid-virtual`, `map`, `timeline`, `timeline/engine`, `tree`, `tree-view`, `virtual-list`, `calendar/view`, `grid-editing` |
| `@texuli/examples` (private) | `.` |
| `@texuli/media` (private) | `.`, `animation`, `animation/player`, `audio`, `captions`, `composition-canvas`, `composition-canvas/draw`, `composition-canvas/render`, `composition-model`, `composition-svg`, `composition-v2`, `export`, `export/ui`, `gallery`, `gallery/lightbox`, `generator-slot`, `image`, `image-editor`, `image-editor/model`, `image-editor/render`, `timeline`, `timeline/model`, `video` |
| `@texuli/player` (private) | `.`, `styles.css` |
| `@texuli/primitives` (private) | `.`, `accordion`, `alert-dialog`, `color-picker`, `context-menu`, `label`, `number-field`, `progress`, `separator`, `sheet`, `slider`, `tags-input`, `toolbar`, `tooltip`, `collapsible`, `command`, `date-picker`, `date-field`, `file-drop`, `radio-group`, `switch`, `checkbox`, `calendar`, `toggle`, `menu`, `menubar`, `popover`, `tabs`, `hover-card`, `tree`, `listbox`, `select`, `splitter`, `portal`, `navigation-menu`, `scroll-area`, `pagination`, `toast`, `dialog`, `pin-input`, `combobox`, `avatar`, `sortable` |
| `@texuli/slides` (private) | `.`, `model`, `grammar`, `export`, `templates`, `stage`, `components`, `layouts`, `styles.css` |
| `@texuli/spec` (private) | `.`, `workflow`, `migrate`, `codegen`, `surface` |
| `@texuli/workflows` (private, in development) | `.`, `model`, `layout`, `spec-adapter`, `editor`, `viewer`, `inspector` |
| `texuli` (private) | `.`, `alert`, `avatar`, `badge`, `button`, `card`, `carousel`, `choice`, `combobox`, `command`, `cx`, `date`, `dialog`, `empty`, `feedback`, `field`, `file-upload`, `icons`, `icons/lucide`, `input`, `kbd-code`, `layouts/app`, `layouts/app/dual-sidebar`, `layouts/app/master-detail`, `layouts/app/rail`, `layouts/app/sidebar`, `layouts/app/split-view`, `layouts/app/top-nav`, `layouts/auth-settings`, `layouts/auth-settings/register`, `layouts/content`, `layouts/content/blog`, `layouts/content/docs`, `layouts/content/editorial`, `layouts/dashboard`, `layouts/dashboard/register`, `layouts/host`, `layouts/host/chrome`, `layouts/host/drawer`, `layouts/marketing`, `layouts/marketing/entry`, `layouts/marketing/landing`, `layouts/marketing/pricing`, `layouts/marketing/register`, `layouts/marketing/section`, `layouts/mobile`, `layouts/mobile/register`, `layouts/shells`, `menus`, `navigation`, `number-pin`, `popover`, `rating`, `resizable`, `scroll-area`, `select`, `separator-aspect`, `sheet`, `sidebar`, `slider`, `stat`, `stepper`, `table`, `tabs-accordion`, `tags-color`, `timeline`, `toast`, `toggle`, `toolbar`, `tooltip`, `tree` |
| `@texuli/tokens` (private) | `.`, `aa-gate`, `aa-gate/components`, `base.css`, `build`, `contract`, `css`, `forced-colors`, `forced-colors.css`, `generator`, `library`, `library-expand`, `modes`, `no-flash`, `palette`, `style-presets`, `tailwind`, `tailwind/preset.css` |
| `@texuli/tools` (private) | `.`, `a2ui`, `cli-add`, `cli-init`, `cli-update`, `llms`, `elements`, `golden`, `deck` |

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

- **Catalog groups.** `@texuli/catalog` builds 158 ids from manifest groups:
  `content`, `display`, `forms`, `layouts`, `overlays`, and (new in `0.4.0`)
  `composition`, `data`, `chat`, `state` and `workflows`. 66 ids are
  agent-emittable; the rest are app tier.
- **Player painters.** `@texuli/player` loads one lazy painter per
  emittable id (`PLAYER_LOADERS`): layouts, blocks, charts, media, data views
  (grid, tree, board, calendar, timeline, map, files), chat display, state
  controls, forms and flows, `sortable-list` (one shared drag scope per
  player) and `workflow-graph` (`@texuli/workflows`). `tests/loader-parity`
  fails when an emittable id has no painter.
- **Decks as data.** Spec 0.4.0 (ADR-009, in the repository) adds the
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
- the local stdio MCP server (`packages/tools/src/mcp`, tested in
  `packages/tools/tests/mcp.test.ts`; no published binary yet).

## Decks: engine and stage

ADR-009 splits presentations in two packages (both on npm as `0.4.0`,
the first release of `@texuli/deck`):

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

Agent decks travel as catalog trees under spec `0.4.0` (in the repository
only), whose `layout-deck` and `deck-slide` manifests carry the model v2
props. `validateDeckDraft` in `@texuli/catalog/validate` maps a tree to a
v2 deck without depending on `@texuli/deck`; the host then runs
`migrateDeck` and `parseDeck`. `@texuli/player` keeps painting decks as a
document and offers a `deckHost` seam (and `chrome={false}`) so a host with
`@texuli/slides` presents them on the stage. Package docs:
[packages/deck](../packages/deck/README.md) and
[packages/slides](../packages/slides/README.md).

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
`pnpm build`. Two Cloudflare Pages Functions in the repository-root
`functions/` run beside the static output:
- `_middleware.ts` serves Markdown twins of docs pages on an explicit
  `text/markdown` preference, a stripped `robots.txt` to audit tools and a
  `problem+json` 404 to agents, and sends bot-hit events; every other
  request gets the static asset response back untouched, so its `_headers`
  (CSP, and `Vary: Accept` on negotiable docs pages) survive;
- `api/umami/[[path]].ts` is the same-origin Umami analytics proxy, off
  until the owner provisions it.

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
    the 19 packable packages, `@texuli/deck` included, to npm as the
    `0.4.0` release (dist-tags `latest` and `next`), with provenance
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
