# Product spec — Texuli

> **Small pieces. Infinite possibilities.**
>
> Status on 2026-10-31: **pre-1.0.** All 26 published packages are
> released on npm in the 0.10 line: 7 at `0.10.0` (core, date, deck, drag, document, primitives, spec) and 19 at `0.10.1` (G125–G127 and their exact-pin dependents) (dist-tags
> `latest` and `next`; published by CI from verified tarballs, with signed
> provenance), which adds design systems ([DESIGN_SYSTEMS](DESIGN_SYSTEMS.md));
> the remote MCP server at `https://texuli.com/mcp` is live
> ([RELEASE](RELEASE.md)); texuli.com deploys from `main` to Cloudflare
> Pages. The
> implementation itself is substantial: every layer from L0 texels to L9
> MCP exists in source with tests, all in this private workspace. The
> "What exists today" table says exactly what is real.

## In one paragraph

Texuli is an open-source (MIT) component library for Svelte 5, made by
Dailybot. It is built from small units it owns end to end. The smallest units
are **texels**: framework-free pieces of behavior and policy such as focus
management, keyboard navigation and URL safety. Texels compose into **Texuli
components** (buttons, dialogs, menus, data grids, charts), and components
compose into **complete interfaces**: apps, dashboards, documents, slides and
media. People use Texuli by writing Svelte; agents use it by choosing from a
closed, documented catalog that can be validated before anything renders.

## The problem

- **Svelte has no complete, owned library.** Other frameworks have one
  library that covers forms, overlays, data tables, layouts and theming.
  Svelte 5 teams assemble the same thing from several projects, and the
  headless layer they build on is a dependency they do not control.
- **Copy-in libraries hand you the code but not the guarantees.** A team can
  own the styled source, but accessibility and focus behavior still come from
  someone else's primitives.
- **Agents need more than documentation.** An agent that builds an interface
  needs a closed list of components it may use, a schema the host can reject,
  rules for when to use and not use each component, and a renderer that cannot
  execute injected HTML. A text file of docs is not enough.

## Who it is for

| Consumer | Why they choose Texuli |
| --- | --- |
| **Svelte 5 developers** | One coherent library from tokens to data views, with accessibility behavior proven rather than assumed. |
| **Coding agents** (Claude Code, Codex, Cursor and others) | A closed catalog with authored manifests, a sink-free renderer and a read-only MCP to look components up. |
| **Protoyard** | The open-source prototyping workspace becomes a consumer: its prototypes will render with Texuli components. |
| **Dailybot** | A later production consumer of the same public library. |

## Key capabilities (target)

1. **Owned primitives.** Every headless primitive (dialog, menu, popover,
   combobox, tabs, and the rest) is written from scratch. Each primitive's
   observable behavior (roles, names, states, focus order, dismissal, events)
   is checked by the behavior suite, held to the WAI-ARIA Authoring Practices
   patterns.
2. **Texels first.** Behavior lives in framework-free TypeScript (ids, roving
   focus, typeahead, focus scope and trap, the dismissable-layer stack, scroll
   lock, positioning, URL policy), so it can be tested without a browser
   framework and reused by every host.
3. **A themeable design system.** An OKLCH theme engine with design tokens and
   plain CSS, so components work with or without Tailwind.
4. **Complete coverage.** Styled components, layouts, data views (grid, tree,
   calendar, board), charts, chat, documents, slides and media (images, video,
   canvas).
5. **Agent-native by construction.** A closed component catalog generated from
   authored manifests (schema, `useWhen`, `dontUseWhen`, accessibility notes,
   examples); a renderer with no HTML sinks; a two-tier URL policy that
   separates developer-written props from untrusted content; and one
   operations registry served as read-only MCP tools (local and remote) and
   as `texuli <group> <verb>` commands, with the server card, the llms Tools
   section and the operation docs generated from it.
6. **Whole interfaces as JSON.** A blueprint (spec 0.3.0) declares local
   state, flows, two-way bindings and a closed action set, so an agent can
   send a working dashboard, form flow, sortable board or workflow builder
   as data. All 66 agent-emittable ids of the 158-id catalog paint in the
   player, and a blueprint that validates always paints (the spec, catalog,
   player and Kotlin validators share the state surface rules).
7. **One drag engine.** `@texuli/drag` plans every drag as data (sortable
   lists, boards, trees, spatial canvases, graph editing) under one
   keyboard, announcement and i18n contract, with non-drag alternatives.
8. **Workflows.** `@texuli/workflows` is an accessible workflow graph editor
   and viewer: typed nodes and ports, validated operations, layered
   auto-layout, a keyboard model and a treegrid outline.
9. **Presentations from JSON or Markdown.** `@texuli/deck` (in development,
   first on npm as `0.4.0`) validates one deck model generated from JSON or from
   an owned Markdown dialect, with 21 layouts, backgrounds with guaranteed
   text contrast, steps, navigation, lint with fixes and authoring helpers
   for people and agents. `@texuli/slides` (the v2 stage, from `0.4.0`) presents it on a stage
   (canvas, routes, chrome, overview, presenter window), with any
   slide-renderable Texuli component on a slide, and prints it or exports
   it to PPTX.

## What exists today versus what is planned

| Piece | Status | Where |
| --- | --- | --- |
| Workspace (pnpm 11, TypeScript 6 strict + erasable, Biome 2.5, Vitest 5) | **Exists** | repository root |
| L0 texels: the two-tier URL policy (`safeHref`, `safeImageSrc`, `safeMediaSrc`), ids, roving focus and typeahead, focus scope, the layer stack, scroll lock, positioning, dismissable layers, inert, portal, announcer, and the rest of `@texuli/core` | **Exists**, unit tests per texel | [`packages/core`](../packages/core/README.md) |
| `@texuli/date` (L0): dependency-free Gregorian calendar dates for the calendar, date field and date picker | **Exists**, unit tests | [`packages/date`](../packages/date/README.md) |
| `@texuli/primitives` (L1): 42 owned headless primitives (`sortable` new in `0.4.0`) and the behavior suite (44 scenario specs, including `sortable` and `workflow-editor`, on chromium, webkit and a Pixel 7 profile) | **Exists**, private | [`packages/primitives`](../packages/primitives/README.md), [`tests/behavior`](../tests/behavior/README.md) |
| `@texuli/drag` (L0): the framework-free drag engine (sortable, collision, modifiers, auto-scroll, gesture, spatial, graph, messages) | **In development**, on npm as `0.10.0` (first published as `0.3.0` on 2026-10-28); used by primitives, data, workflows and the player from `0.4.0` | [`packages/drag`](../packages/drag/README.md) |
| `@texuli/workflows` (L4): workflow model, layout, spec adapter, editor, viewer and inspector | **In development**, on npm as `0.10.1` (first published as `0.3.0` on 2026-10-28); the player's `workflow-graph` painter ships from `0.4.0` | [`packages/workflows`](../packages/workflows/README.md) |
| Tokens + CSS, OKLCH theme engine (L2): the `--tx-*` contract, 210 themes, compiled CSS, forced colors, the AA gate, the Tailwind preset | **Exists**, private | [`packages/tokens`](../packages/tokens/README.md) |
| `texuli` styled components, layouts and app shells (L3) | **Exists**, private | [`packages/texuli`](../packages/texuli/README.md) |
| Charts, data, media and chat packages (L4) | **Exists**, private | [`packages/charts`](../packages/charts/README.md), [`packages/data`](../packages/data/README.md), [`packages/media`](../packages/media/README.md), [`packages/chat`](../packages/chat/README.md) |
| Blueprint contract (L0): JSON schemas, catalog vocabulary, TypeScript and Kotlin codegen, conformance harness; spec 0.3.0 (state, bindings, closed actions, `reorder`, workflow graphs, the state surface) spec 0.4.0 (deck model v2 on `layout-deck` and `deck-slide`), spec 0.5.0 (the cohort table, notification inbox, filter builder and time field ids), spec 0.6.0 (the closed motion vocabulary), spec 0.7.0 (node keys, the `document` id and `patchDocument`) spec 0.8.0 (data-source bindings, the `schema-form`, `canvas`, `spreadsheet`, `data-dashboard` and `data-dashboard-widget` ids and the closed expression AST), spec 0.9.0 (stamp only) and spec 0.10.0 (the design-system document schema and the envelope and document `designSystem`); streamed blueprints (`@texuli/spec/stream`) | **Exists**, private; npm `@texuli/spec@0.10.0` carries spec 0.10.0 (`@texuli/spec@0.9.0` carried spec 0.9.0, `@texuli/spec@0.8.0` carried spec 0.8.0, `@texuli/spec@0.7.0` carried spec 0.7.0, `@texuli/spec@0.6.0` carried spec 0.6.0, `@texuli/spec@0.5.0` carried spec 0.5.0, `@texuli/spec@0.4.0` spec 0.4.0, `@texuli/spec@0.3.0` spec 0.2.0) | [`packages/spec`](../packages/spec/README.md) |
| Rich text editor (L4), with Markdown in and out (`@texuli/editor/markdown`) | **In development**, on npm as `0.10.1` (first published as `0.5.0`) | [`packages/editor`](../packages/editor/README.md) |
| Content blocks (L5) | **Exists**, private | [`packages/blocks`](../packages/blocks/README.md) |
| Agent catalog and the sink-free renderer (L6) | **Exists**, private | [`packages/catalog`](../packages/catalog/README.md) |
| `@texuli/deck` (L0): deck model v2, the JSON loader and Markdown dialect, math, layouts, backgrounds, engine, lint, patch, builder and templates | **In development**, on npm as `0.10.0` (first published as `0.4.0`); in the publish waves before `@texuli/slides` | [`packages/deck`](../packages/deck/README.md) |
| Blueprint player (L7) | **Exists**, private; the player's spec 0.3.0 interaction, its data, chat, sortable and workflow painters, the `deckHost` seam and `chrome={false}` ship from `0.4.0`; streaming (`<Player stream>`) and spec 0.6.0 node motion from `0.6.0`; the `documentHost` seam for agent documents from `0.7.0`; the `formHost`, `canvasHost` and `sheetHost` seams, data sources (`sourceRegistry`), dashboards and print mode from `0.8.0` | [`packages/player`](../packages/player/README.md) |
| Motion: tokens (`@texuli/tokens/motion`), the Web Animations runtime with an owned spring solver (`@texuli/core/motion`), and the `motion` prop and `MotionProvider` (`texuli/motion`) used by overlays, toasts, tabs, accordions, the Board, the DataGrid and the slides stage | **Exists**, private; on npm from `0.6.0` (ADR-013) | [`packages/core`](../packages/core/README.md), [`packages/texuli`](../packages/texuli/README.md) |
| One component API contract (`bind:ref`, rest attributes, composed handlers, the Field rule), checked by contract tests over every export of `@texuli/primitives` and `texuli` | **Exists**, from `0.6.0`; the layouts join later (planned) | [STANDARDS](STANDARDS.md#component-api-contract) |
| `@texuli/document` (L1): block document model, untrusted schema, typed operations and bounded patches, Markdown, pagination, DOCX and PDF writers, CRDT sync and collaboration; `@texuli/pages` (L8): the block document editor and reader, paged view, export, collaboration and the player's document host; documents as agent data (the `document` catalog id, `patchDocument`, the `texuli document` CLI and MCP tool) | **In development**, `@texuli/document` on npm as `0.10.0` and `@texuli/pages` as `0.10.1` (both first published as `0.7.0`; ADR-010, ADR-011) | [`packages/document`](../packages/document/README.md), [`packages/pages`](../packages/pages/README.md) |
| `@texuli/forms` (L4): the closed form schema, conditions and cross-field rules on `@texuli/core/expression`, steps, drafts and autosave, `SchemaForm` and the player's form host; host data sources (`@texuli/core/data-source`) and the data dashboard (`@texuli/data/dashboard`) | **In development**, on npm from `0.8.0`, its first release (ADR-012, ADR-015) | [`packages/forms`](../packages/forms/README.md), [`packages/core`](../packages/core/README.md), [`packages/data`](../packages/data/README.md) |
| `@texuli/canvas` (L4): the infinite canvas: model, CRDT sync on `@texuli/document/sync`, SVG and PNG export, an accessible editor and viewer, and the player's canvas host | **In development**, on npm from `0.8.0`, its first release (ADR-010, ADR-012) | [`packages/canvas`](../packages/canvas/README.md) |
| `@texuli/sheets` (L5): spreadsheets: the owned formula engine (54 functions, bounded recalculation), the workbook model, CSV with formula-injection neutralization, the sheet view and the player's sheet host | **In development**, on npm from `0.8.0`, its first release (ADR-015) | [`packages/sheets`](../packages/sheets/README.md) |
| Multi-target output: email-safe HTML (`@texuli/tools/email`), print and headless PDF of blueprints (`@texuli/tools/print`, the player's print mode), and component labels through one message catalog (`@texuli/core/i18n`) | **Exists**, from `0.8.0`; English is the only shipped language, email dark mode is planned (ADR-016) | [`packages/tools`](../packages/tools/README.md), [`packages/core`](../packages/core/README.md) |
| Slides (L8): the v2 stage, layouts, backgrounds, components on slides, print and PPTX | **In development**, on npm as `0.10.1` (the v2 stage from `0.4.0`; `@texuli/slides@0.3.0` has the previous deck model) | [`packages/slides`](../packages/slides/README.md) |
| Astro integration (L8) | **Exists**, private | [`packages/astro`](../packages/astro/README.md) |
| Kotlin Multiplatform twin (`texuli-spec`, `texuli-compose`, conformance) | **In development**, nothing published; app shells and most chart families are placeholders | [`native`](../native/README.md) |
| Agent service (prompt → validated blueprint draft) | **In development**, fake replay provider only, not deployed | [`apps/agent`](../apps/agent/README.md) |
| Tools (L8): the copy-in CLIs (`texuli-add`, `texuli-init`, `texuli-update`, `texuli-llms`), A2UI, custom elements, the golden set, and the MCP protocol layer (`@texuli/tools/mcp`) | **Exists**, on npm as `0.10.1` with its bins (`texuli`, `texuli-add`, `texuli-init`, `texuli-llms`, `texuli-update`, `texuli-deck`) | [`packages/tools`](../packages/tools/README.md) |
| Agent surfaces (PLAN_011): the operations registry (`@texuli/tools/ops`), the `texuli <group> <verb>` router, the local MCP (`@texuli/mcp`, `npx -y @texuli/mcp`, every `edge` and `node` operation), the remote MCP at `https://texuli.com/mcp` (`functions/mcp.ts`, the `edge` and `site` operations), and the generated server card, llms Tools section and ops docs (`pnpm check:surfaces` fails on drift) | **Exists** from `0.9.0`, on npm (`@texuli/mcp` first published in `0.9.0`, in development); the remote is live with texuli.com, and a CI job compares its `tools/list` with the registry after each deploy | [`packages/tools/docs/mcp.md`](../packages/tools/docs/mcp.md), [`packages/mcp`](../packages/mcp/README.md) |
| Design systems (PLAN_011): one JSON document per brand ([DESIGN_SYSTEMS](DESIGN_SYSTEMS.md)): the spec schema (`@texuli/spec/design-system`), the compiler, validator, importers, emitters, report and diff (`@texuli/tokens/design-system/*`), `DesignSystemProvider` and `applyDesignSystem` (`texuli/design-system`), the player's `designSystems`, the Astro option, conformance (`texuli ds check`, `@texuli/tools/ds-check`), the `ds.*` operations and the Design System Studio on texuli.com | **Exists** from `0.10.0`, on npm (ADR-021 to ADR-024); example brands in `examples/design-systems/` | [DESIGN_SYSTEMS](DESIGN_SYSTEMS.md), [`packages/tokens`](../packages/tokens/README.md) |
| Multi-page static website (foundation, components, charts, media, guides, examples, showcase, themes; Astro 7 + Svelte islands) | **Exists**, builds statically, deployed at https://texuli.com (Cloudflare Pages) with three Pages Functions (`functions/`: agent-facing request shaping with the read-only JSON API, the remote MCP, and a same-origin Umami analytics proxy, off until the owner provisions it) | [`apps/website`](../apps/website/README.md) |
| npm 0.x release | **Done** — all 26 published packages in the 0.10 line (see [RELEASE](RELEASE.md)), with design systems (after the 0.9 line for 26 packages, the first release of `@texuli/mcp`; the 0.8 line for 25 packages, the first release of `@texuli/forms`, `@texuli/canvas` and `@texuli/sheets`; `0.7.0` for 22 packages, the first release of `@texuli/document` and `@texuli/pages`; `0.6.0` for 20 packages; `0.5.0` for 20 packages, the first release of `@texuli/editor`; `0.4.0` for 19 packages, `0.3.0` for 18, `0.2.0` for 15 and the `0.1.0-next.0`–`next.3` previews), dist-tags `latest` and `next`, CI-published with provenance | [RELEASE](RELEASE.md) |
| npm stable release (1.0.0) | Planned; needs the developer's explicit go. texuli.com deploys from `main` (Cloudflare Pages) | — |

## Success criteria

- A primitive ships only when every row of its behavior scenario passes on
  every browser project and its accessibility checks pass.
- Packages depend on no other component library and contain no HTML sink on
  data.
- Every component an agent may emit has a manifest, and the renderer rejects
  anything outside the catalog or its schema.
- The website is a real consumer: component pages import the workspace
  packages, so a broken component breaks the website build.
- Protoyard runs on Texuli in production use before a 1.0 is called.

## Non-goals

- **Not a wrapper around another headless library.** Every primitive is
  Texuli's own.
- **Not framework-agnostic at the component layer.** Components are Svelte 5;
  only the texels underneath are framework-free.
- **Not a hosted service.** Texuli is a library and a static website. Its
  only server-side code is the Cloudflare Pages Functions beside the
  site (request shaping with the read-only JSON API, the read-only remote
  MCP and the analytics proxy); the agent service in
  `apps/agent` is not deployed.
- **Not "agent-native" by marketing.** The claim waits for the catalog, the
  renderer and their tests to exist.
- **No release before it is earned.** Package names, the token prefix and
  component names stay provisional until the first public artifact.

## Honest boundaries

- The implementation is pre-1.0. All 26 published packages are on npm in the 0.10 line (see [RELEASE](RELEASE.md))
  (published by CI with provenance; `latest` and `next` both point to it; not
  a stable release: under 0.x a new minor may contain breaking changes, and
  1.0.0 will be the first stable release), and the
  workspace packages stay `private: true`. texuli.com deploys from `main` to
  Cloudflare Pages. The repository's remote is
  `https://github.com/DailybotHQ/texuli.git` (`git remote -v`), and GitHub
  reports it as public (`gh repo view DailybotHQ/texuli --json visibility`,
  2026-10-26). No production consumer runs on Texuli yet.
- Package-level existence is not feature-level completeness: specific limits
  stay documented where they apply (for example, the data map accepts a host
  seam but does not draw fence-editing handles, and the blocks text renderer
  does not yet implement the Reveal animation).
- Planned package names and the layer split may change before the first
  public artifact; [ARCHITECTURE.md](ARCHITECTURE.md) tracks the current
  plan.
