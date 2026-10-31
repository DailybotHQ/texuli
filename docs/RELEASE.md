# Release and version policy

**Status:** policy for future, owner-authorized releases. This page documents
the intended process; it does not publish packages or grant release authority.

## Current npm status

<!-- The release line: the single source of truth for "what npm has" and
"what the manifests are working toward". scripts/release-line.ts parses
the next line; tests and honesty checks read it from there. Change it only
when a publish lands (published) or a new version opens (in development). -->
Release line: published `0.9` · in development `0.10.0`

All 26 published packages are on npm in the 0.9 line: every one at
`0.9.0`, every internal `@texuli/*` pin exactly `0.9.0`. `@texuli/mcp`
(L9, the local MCP server) is published for the first time in `0.9.0`, the
26th package. The blueprint spec in `@texuli/spec@0.9.0` is `0.9.0`, and
the remote MCP server at `https://texuli.com/mcp` is live with the site.
The publish workflow publishes from `main` after the merge of
`release/0.9.0`, from the verified tarballs with signed provenance, and
moves both the `latest` and `next` dist-tags to `0.9.0`, so a bare
`npm install texuli` or `pnpm add texuli` gets it. `@texuli/drag`,
`@texuli/workflows`, `@texuli/deck`, `@texuli/editor`, `@texuli/document`,
`@texuli/pages`, `@texuli/forms`, `@texuli/canvas`, `@texuli/sheets` and
`@texuli/mcp` are still **in development** (pre-1.0). The workspace
manifests are at `0.10.0`, which is in development on the release branch
and not on npm (see "0.10.0 (in development)" below); installs stay on the
0.9 line (`^0.9.0`).

`0.9.0` is a breaking `0.x` minor: it carries the PLAN_011 changes listed
under "0.9.0" below, none of which were in the 0.8 tarballs. It is still
pre-1.0, not a stable release: see "0.x versioning" below. Workspace
manifests remain `private: true`, and every future version requires a
fresh, explicit developer GO (since PR #17, the merge that bumps the
versions into `main`). Publishing never overwrites a published version.

### Not on npm

- `@texuli/examples` is never packed (`NEVER_PACKED` in
  `scripts/packages.ts`).
- The apps (`apps/website`, `apps/agent`) and the native twin (`native/`)
  publish nothing.

### 0.10.0 (in development)

`0.10.0` is design systems (PLAN_011 part B). Like `0.9.0`, it cannot land
on `main` piece by piece: every merge to `main` publishes the versions npm
does not have, and the exact internal pins cascade a spec bump to every
dependent. So design systems integrate on the branch `release/0.10.0`:

- `0.10.0` is opened once on that branch: all 26 published packages move
  to `0.10.0` and every internal pin to exactly `0.10.0`. The blueprint
  spec format stayed `0.9.0` until the design-system task bumped it (below).
- Feature work merges into `release/0.10.0`, not `main`. Nothing on the
  branch is published.
- Only the final merge of `release/0.10.0` into `main`, after the
  developer's GO, publishes `0.10.0`. That merge also moves the release
  line above to published `0.10` with nothing in development.
- Until then npm has the 0.9 line, the install instructions (README, the
  skill, the website) name the 0.9 line (`^0.9.0`), and fixes that must
  ship before `0.10.0` go to `main` as `0.9.x` patch releases.

On the branch so far:

- **Added `@texuli/slides/export-core`** (Protoyard G105):
  `DeckPrintViewCore` and `preloadDeckPrintViewCore`, the print view and
  its preload without the default renderer tables; they take a `defaults`
  source from the host like `DeckStageCore`. A `DeckStageCore` host that
  prints through it emits no default-table chunk or CSS (measured on a
  minimal host: 324 KB instead of 715 KB of JS and 28 KB instead of 72 KB of
  CSS across every chunk, gzip). `@texuli/slides/export` behaves as before:
  `DeckPrintView` is the core with the stage's tables as its defaults.
- **Blueprint spec 0.10.0** (PLAN_011 T-ds-spec, ADR-021; in development
  on `release/0.10.0`, not on npm; `@texuli/spec@0.9.0` on npm still
  carries spec `0.9.0`). Additive: the design-system document schema
  (`schemas/design-system.schema.json`, format `texuli/design-system`,
  `formatVersion` 1) with generated TypeScript and Kotlin types, its
  fixtures under `fixtures/design-systems/`, and (T-ds-blueprint,
  ADR-024) the optional `designSystem` on the envelope and on a
  `document`'s shape (`$defs.designSystemReference`: exactly one of `ref`,
  an exact `id@x.y.z` or `texuli:<theme>`, and `inline`, a whole
  document), with the `brand-report` and `brand-deck` goldens and three
  invalid fixtures. The `0.9.0 → 0.10.0` migration only stamps `spec`;
  the digest `5858625bffea7972f78a2b0f127f75359848aeb5c4792764b17ca45b2d7de4ca` is pinned in `packages/spec/versions.json`.
  `validateDraft` migrates a `0.9.0` envelope and stamps `spec: "0.10.0"`;
  hosts that compare the `spec` string need to accept it.
- **`@texuli/spec/design-system`** (new subpath): `validateDesignSystem`
  with stable codes and JSON paths, `DesignSystemPatch` with
  `validateDesignSystemPatch` and `applyDesignSystemPatch`,
  `migrateDesignSystem` and `checkDesignSystemReference`
  ([design-system.md](../packages/spec/docs/design-system.md)). The
  compiler, runtime, importers and emitters are on the branch too
  (`@texuli/tokens/design-system/*`).
- **Design systems in blueprints and documents** (T-ds-blueprint,
  ADR-024): `validateDraft` (`@texuli/catalog`) checks the envelope's
  `designSystem` (a new `design-system` check; the host passes
  `checkDesignSystem`, usually `checkDesignSystemReference`, for an inline
  document's rules at the draft's tier); `@texuli/player` takes
  `designSystems: { resolve, mode }`, compiles lazily (a blueprint without
  one loads nothing more) and applies the result to its root, keeping the
  default theme with a visible notice when nothing resolves or the document
  is refused; `@texuli/document` documents carry `designSystem` and
  `@texuli/pages`' `PageReader` applies it the same way. `texuli/design-system`
  also exports `applyDesignSystem` and `loadDesignSystemCompiler`.
- **The compiler** (`@texuli/tokens/design-system/compile` and
  `/validate`, T-ds-compiler, ADR-022): resolves `extends`
  (`texuli:<theme>` from the library in lazy chunks, or an exact
  `id@x.y.z` through the host), applies the variant and patches, and
  compiles concrete `--tx-*` variables per mode. Text contrast at the
  declared target, the focus ring at 3:1 and 2 px, and touch targets at
  `accessibility.targetMin` are enforced (refused as `aa-text`, `aa-focus`
  and `target-size` when only pins could fix them; every solver move is in
  the report). `fromTheme` turns any `Theme` into a document; all 210
  library themes compile both ways with zero variable drift.
- **The runtime** (`@texuli/tokens/design-system/apply`, 1,966 B gzip,
  T-ds-runtime, ADR-023): `applyDesignSystem` (one style write per switch,
  element-scoped), `designSystemStyle` for server HTML and
  `designSystemAppearance` for the no-flash cache, byte-identical;
  `DesignSystemProvider` in `texuli/design-system`; the `@texuli/astro`
  `designSystem` option inlines the style with its CSP hash.
- **Importers, emitters, report and diff** (`@texuli/tokens/design-system/
  import | emit | report | diff | fixtures`, T-ds-io): a brand one-liner,
  W3C DTCG, Tokens Studio, a flat role palette (the `protoyard-theme/v1`
  shape), a `Theme` and logo pixels in; scoped CSS, a Tailwind preset,
  compiled JSON, DTCG, Tokens Studio and a role palette out (lossless round
  trips); a static review page; a diff of changed variables, contrast
  regressions and defaults.
- **Outputs follow a design system** (T-ds-outputs): email (colors, fonts,
  radius, spacing and a dark head rule), the blueprint PDF, the document
  PDF and DOCX writers, PPTX, the canvas SVG and PNG export, and the Kotlin
  twin's generated `DesignTokens.kt` (web value conformance in Gradle).
- **Conformance** (T-ds-conformance): `texuli ds check <file>` (stable JSON
  and codes; `--render` paints every agent-emittable catalog component under
  the design system in chromium for axe, painted contrast and literal
  colors) and `@texuli/tools/ds-check` for adopters' CI.
- **Agent operations** (T-ds-agent-tools): `ds.validate`, `ds.compile`
  (JSON, CSS, Tailwind, DTCG, Tokens Studio), `ds.contrast`, `ds.suggest`,
  `ds.import`, `ds.diff`, `ds.preview` (a deterministic SVG or HTML
  snapshot) and `blueprint.theme` on every door, and `ds.save` (local doors
  only, an explicit path inside the working directory); the
  `create-design-system` prompt and `texuli://design-system/{id}`;
  `texuli ds init | validate | compile | export | preview | diff |
  import`. `blueprint.validate` checks an inline design system with the
  spec's rules. The remote Function's initial bundle grew to 223,613 B gzip
  (the operation declarations; the compute loads lazily).
- **Landed on the branch:** the design-system guide (`docs/DESIGN_SYSTEMS.md`),
  the skill's design-systems sub-skill and three fictional example brands in
  `examples/design-systems/` (T-ds-docs-skill); the fixes for every tracked
  conformance finding (`DS_CHECK_KNOWN_FINDINGS` is empty) and the stronger
  token-usage guard (`system-color` and `unknown-token` rules).
- **Also landed on the branch:** the Design System Studio at
  `/theme-studio/` and the `/design-systems/` hub on texuli.com; design
  systems on standalone decks (`designSystem` in `@texuli/deck`, applied by
  the slides stage through `@texuli/player/design-system`), player component
  defaults, and the document writers (Markdown front matter; DOCX and PDF
  report `design-system-unapplied`).
- **In progress on the branch (not merged yet, listed here as they land):**
  the Protoyard gaps G107–G110 (G105 landed: `@texuli/slides/export-core`).

**Removed in 0.10.0** (deprecated in `0.9.0` for one minor; done on the
branch):

- **The seven 0.8 MCP tool names** (`deck`, `document`, `catalog`,
  `component`, `validate`, `example`, `theme`). No door lists them. A
  call is refused with the operation to use: MCP `tools/call` answers
  `-32602` with `The tool "theme" was removed in 0.10.0; call theme.search
  or theme.get instead.`, and `invoke()` returns `unknown-operation` with
  the same text. The server card has `removedTools` (name, `replacedBy`,
  `removedIn`) and `deprecatedTools: []`; the alias mechanism stays for
  the next rename (ADR-017).
- **The tree block's `style` key** (renamed `variant` in `0.9.0`). A
  `tree` block with `style` is refused at `…style` with `style was removed
  in 0.10.0; send variant ("file-tree" or "org") instead`, alone or next
  to `variant`.
- **Token rename aliases:** none. `@texuli/tokens/renames.json` is still
  empty: token contract v2 renamed or removed no `--tx-*` name.

**Migrating from 0.9 to 0.10** (when `0.10.0` is published):

- **MCP hosts:** replace the old tool names in prompts and allowlists:
  `deck` → `deck.run`; `document` → `document.run`, or `document.export`
  with `format: "pdf"` or `"docx"` instead of the `to-pdf` and `to-docx`
  commands; `catalog` → `catalog.search`; `component` → `component.get`;
  `validate` → `catalog.validate`; `example` → `example.search`; `theme` →
  `theme.get` (with `id`) or `theme.search`.
- **Blueprints and blocks:** write `variant` on `tree` blocks, never
  `style`. `validateDraft` migrates a `0.9.0` envelope and stamps `spec:
  "0.10.0"`; a host that compares the `spec` string must accept it.
- **Themes keep working:** `applyTheme`, `compileThemeCss`, scopes
  (`data-tx-scope`), scoped portals and every `--tx-*` read are unchanged;
  a design system is an addition. Start one from a theme with `extends:
  "texuli:<id>"` or `fromTheme`.
- **New subpaths load lazily:** the `@texuli/tokens` and `texuli` roots do
  not import the design-system modules, so an app that adopts none pays
  nothing.
- **Protoyard gaps G100–G104 and G106** (PLAN_011 T-gaps-100-104; each reported on
  0.8.x and still present in 0.9.0):
  - **G104** (`@texuli/data/calendar`): an event chip's accessible name
    now leads with its visible text in the same order (title,
    "recurring", time or "All day", then the date and "press Enter to
    open"; before, the date came before the time, which failed axe's
    label-in-name rule in the agenda view). Month cells drop their
    `aria-label` and are named by their content. `tests/e2e/data.spec.ts`
    runs axe's `label-content-name-mismatch` over every view.
  - **G100** (`@texuli/editor/markdown`, `@texuli/core/editor-markdown`):
    a backslash before any ASCII punctuation is an escape (CommonMark), so
    `\@` reads as `@` and `\@{p|P}` never opens a mention.
  - **G101** (`@texuli/data/filter-builder`): FilterBuilder takes
    `issues` (`{ path, message }[]`), shown after the builder's own issue
    with `aria-invalid` and `aria-describedby` on the condition's value
    control, and enum `FilterField.options` may be `{ value, label }`
    (`FilterFieldOption`, `optionValue`, `optionLabel`). The
    `data-filter-builder` catalog id gains the optional `issues` prop and
    `fields[].optionLabels` (an additive catalog projection refresh inside
    spec `0.10.0`), and the player paints both.
  - **G102** (`texuli/layouts/content`): `trackActiveHeading(container,
    entries, { readingLine, onChange, activeId })` tracks the heading
    being read without ContentLayout's chrome and returns a dispose;
    ContentLayout runs on it.
  - **G103** (`@texuli/data/board`): after a keyboard move into another
    column, focus is restored to the held card in the same task, so the
    next Space or Enter drops it instead of landing on `<body>`.
  - **G106** (`@texuli/data/activity/inbox`): `onReadChange` gets a third
    argument `{ source: 'all' | 'item' | 'open' }`, and the new
    `onMarkAllRead(ids)` takes over "Mark all as read" when given. Either
    may return a promise: the control that started it is `aria-busy`,
    `aria-disabled` and shows texuli's button spinner until it settles,
    and a rejection is announced (`labels.saveFailed`). Existing
    two-argument handlers keep working; both buttons keep the
    `tx-inbox__button` class.
- **Protoyard gaps G111 and G112** (PLAN_011 T-gaps-111-112; reported
  while adopting `@texuli/document` and `@texuli/pages` 0.9.0):
  - **G111** (`@texuli/pages`): `PageReader`, `PageEditor`, `PagedView`,
    `CollabEditor` and `createDocumentPlayerHost` (`@texuli/pages/host`,
    for documents the player paints) take a host block renderer: a `renderBlock`
    snippet and a `blockHost` (`PagesBlockHost`: `claim`, `component`,
    `present`). The host paints the wrapped blocks and embeds the library
    refuses (an unknown family or block, an embed with no payload), and
    every node its `claim` returns `'host'` for; library blocks keep their
    renderers otherwise, and the refused notice still shows when no host
    paints a node. The node is a deep-frozen copy (`PagesHostNode`): host
    code is developer-tier, the node may come from a user or an agent. In
    the editor, host blocks are opaque rows that select, move and delete
    from their handle. Without a host, the slot that paints them never
    loads (it is imported with `import()`).
  - **G112** (`@texuli/document/markdown`): `documentToMarkdown` writes a
    wrapped data `table` as a GFM table (the caption in emphasis on the
    line before; cells on one line with `|` and Markdown punctuation
    escaped), and any other wrapped block as the text the DOCX and PDF
    writers print for it; before, every wrapped block was left out. The
    new `blocks: 'drop'` option leaves them out. Neither reads back as a
    wrapped block (the Markdown subset has no table).
- **Protoyard forms gaps G113–G121** (PLAN_011 T-gaps-113-121, contract
  amendment 15; reported on `@texuli/forms` 0.9.0, which Protoyard uses
  for generated entity forms, page and doc forms and two SaaS forms).
  `$defs.formField` grows inside spec `0.10.0` (additive: new types and
  optional members; the `form-field-type` invalid fixture now uses an
  `html` type, since `password` is a closed type):
  - **G113 host-painted fields**: a `custom` field type (`kind`, scalar
    `config`) painted by the host through SchemaForm's `field` snippet or
    `customFields` (by field name or kind: a snippet or `{ render?,
    component?, validate? }`). It sits in the form landmark in schema
    order with the form's label, description and error, gets `props`
    (`id`, `aria-labelledby`, `aria-describedby`, `aria-invalid`,
    `aria-required`, `disabled`), is validated by a host validator
    (`customValidators`, sync or async), joins the error summary and
    focus-on-error, and is submitted with the rest (any bounded JSON
    value). For agent output a custom field must name a kind the host
    registered: `validateFormSchema({ kinds })`, `checkFormDraft(…,
    kinds)`, `validateDraft({ formKinds })`, `FormPlayerHost.customKinds`
    and `createFormPlayerHost({ customFields })`; anything else is refused
    with the code `kind`.
  - **G114**: `hideTitle` hides the title visually; it still names the
    form (`aria-labelledby`).
  - **G115**: `actions` (a snippet given `SchemaFormActions`: `submitting`,
    `last`, `step`, `steps`, `back`, `next`, `submit`…) or
    `actions={false}`; an outside `<button form="<id>">`, the component's
    `requestSubmit()` and `controller.submit()` all validate and open the
    error summary.
  - **G116**: form-level `disabled` and `readOnly` on SchemaForm and
    `createFormController` (`setDisabled`, `setReadOnly`, state
    `disabled`, `readOnly`): every control and action is disabled (text is
    `readonly` when read-only), and a host submit still sends the values.
  - **G117**: `password` (reveal toggle with `aria-pressed`;
    `current-password` or `new-password`), `otp` (one input,
    `autocomplete="one-time-code"`, `inputmode="numeric"`, `length` 4–12),
    `color` (texuli ColorPicker, hex) and `datetime` (`YYYY-MM-DDTHH:MM`,
    DatePicker + TimeField). Passwords and codes never enter drafts and are
    masked by the new `formatFormValue` and `formValuesToMarkdown`; agent
    output may use them only where the host passes `credentials: true`
    (code `credential`).
  - **G118**: an optional select gets a "None" choice that clears it
    (`labels.selectNone`); `clearable` overrides the default.
  - **G119**: the date, time, datetime, slider, tags, file, color and radio
    controls and the multi-step Stepper load per type on first use, with
    a same-size placeholder. A text, select and checkbox form's host went
    from 90,507 B to 60,048 B of initial JavaScript and from 9,385 B to
    5,266 B of CSS, and a text-only form's from 90,466 B to 60,011 B and
    9,385 B to 5,266 B (gzip; `packages/forms/tests/bundle-graph.test.ts`,
    which asserts that neither initial graph holds those controls).
    For server rendering, pass `SCHEMA_FORM_CONTROLS` from the new
    `@texuli/forms/controls` as `controls`. The form and each placeholder
    carry `data-tx-pending` and `aria-busy` until the controls mount (the
    visual suite waits for it), and each placeholder is sized like its
    control, so nothing shifts when it mounts.
  - **G120**: `onStep({ step, position, values, allValues, signal })` on
    SchemaForm and the controller can block Next with field errors or a
    message (`stepError`); Next shows "Checking…" while it runs.
  - **G121**: url fields take `protocols` (`['https']` by default,
    `['http', 'https']` to accept http); an http answer passes the
    untrusted URL policy as its https twin, and `javascript:`, `data:` and
    every other scheme stay refused.
  - Migration notes: an optional select now shows the "None" choice (set
    `clearable: false` to keep the old list); controls of the lazy types
    paint after their chunk loads (pass `controls` to paint at once, and
    wait for them in tests); `SchemaForm` focuses the summary or the
    confirmation for any finished submit, including `controller.submit()`.

### 0.9.0

Every published package moves to `0.9.0` together, and every internal
`@texuli/*` dependency between them is pinned to exactly `0.9.0`.
`@texuli/mcp` (L9, ADR-019) is published for the first time: it leaves
the workspace for npm right after `@texuli/tools`, which it pins exactly,
and no published package depends on it. `0.9.0` carries PLAN_011: one
operations registry behind every agent surface, the MCP server (local and
remote), an agent-ready texuli.com, token contract v2 adopted by every
styled package, scoped portals, the Protoyard gaps G87–G99 and blueprint
spec `0.9.0`.

**How it was integrated.** Since PR #17 every merge to `main` publishes
the versions npm does not have, and a catalog change needs a spec bump
that the exact pins cascade to every dependent. So `0.9.0` was opened once
on the branch `release/0.9.0` (every package and pin at `0.9.0`), feature
work merged there with full CI, and only the merge of `release/0.9.0` into
`main`, after the developer's GO, publishes it and deploys texuli.com.

**`@texuli/mcp` (new on npm, L9).**

- The bin `texuli-mcp` (`npx -y @texuli/mcp`) serves MCP over stdio with
  every `edge` and `node` operation of the registry, the resources, the
  prompts and the completions; `--help` and `--version`, and stdout
  carries only JSON-RPC.
- `startTexuliMcp(options?)` runs the same server on any pair of streams.
- Host setup for Claude Code, Cursor, VS Code, Windsurf, Codex and generic
  stdio hosts is in its README; `npx texuli mcp` from `@texuli/tools`
  runs the same server.

**`@texuli/tools`.**

- `ops` (ADR-017): the operations registry. Sixteen `group.verb`
  operations, each with a JSON Schema input and output, annotations, a
  runtime class, limits and worked examples: `catalog.search`,
  `catalog.validate`, `component.get`, `example.search`,
  `blueprint.validate`, `block.list`, `block.schema`, `theme.search`,
  `theme.get`, `theme.preview`, `deck.run`, `document.run` (runtime
  `edge`), `document.export` (PDF and DOCX, `node`), and `site.pages`,
  `site.read` and `site.search` (`site`: served by the remote endpoint
  only, reading the built site). `invoke()` checks size, input and output
  with an owned validator and returns stable error codes.
- `mcp`: `createMcpHandler({ registry, mode, runtimes, … })`, an edge-safe
  MCP protocol layer (protocol `2025-11-25`, negotiating `2025-06-18`,
  `2025-03-26` and `2024-11-05`): tools with `outputSchema`,
  `structuredContent` and cursor pagination; resources and templates
  (catalog, component, docs, llms, theme, schema); the `build-ui`,
  `theme-blueprint` and `convert-deck` prompts; completions. Stateless mode
  never requires `initialize`; stdio keeps the handshake. `runMcpCli` and
  `texuli mcp` serve stdio. `createTexuliMcpServer` stays as a deprecated
  alias of `createMcpHandler({ registry, mode: 'stateful' })`.
- The CLI: `texuli <group> <verb>` for every operation, generated from the
  registry (input from stdin, `--json` or `--file`; output to stdout or
  `--out` through the local write policy, which confines writes to the
  working directory). The 0.8 commands (`deck`, `document`, `mcp`) stay,
  and `init`, `theme`, `add`, `diff` and `update` route to their commands.
- `block.schema` serves each block type's shape from the validator's own
  parsers, and `block-schema` diagnostics name the shape expected at the
  failing path.

**`@texuli/catalog`.** `manifests/all`: every manifest group as one
static, edge-safe list (no file system) for Workers, Pages Functions and
the registry, with a test that it builds the same catalog hash as the
discovered groups. Manifest refreshes from the gap fixes: the Button
pending note (G94) and the cartesian charts' `xKind` and `locale` (G97).
Still 168 ids.

**`@texuli/spec`: blueprint spec 0.9.0.** A stamp-only catalog projection
refresh (the gap props above): the envelope shape, the `$defs` and the
diagnostic codes are unchanged, the `spec` enum gains `0.9.0`, and every
golden and invalid fixture is stamped `0.9.0`. The `0.8.0 → 0.9.0`
migration only stamps `spec`; the digest
`497df4d3b0c67d53483163ebd9bd73733b52caf5f8e2966478f1cf860e6f9d9d` is
pinned in `packages/spec/versions.json`, and the generated TypeScript and
Kotlin are regenerated.

**`@texuli/tokens`: token contract v2** (ADR-020, additive).

- `system`: 151 system tokens in 11 families (space, size, type roles,
  elevation, shape, layers, opacity, layout, icons, status and data-viz).
  `base.css` declares the 123 system defaults once per scope on
  `:where(:root, [data-tx-theme], [data-tx-scope])` inside `@layer
  tx.base`; the 28 data-viz tokens are emitted per theme.
- `components`: 364 component tokens for 57 components (`texuli` and the
  domain packages), each read as `var(--tx-<component>-<key>, <registry
  default>)`. Component tokens are never declared: they cost nothing until
  a theme, design system or host sets one on its scope.
  `componentVar`, `systemVar`, `componentTokenFallbacks` and
  `checkTokenReads` (every read in its exact one-level form) ship with it.
- `data-viz` (complete chart tokens for any theme), `renames` and
  `renames.json` (the rename list and its schema; empty in `0.9.0`).
- `applyTheme` marks its element `[data-tx-scope]` (ADR-023), and the
  no-flash script writes the input hook (`data-tx-input-style`).

**`@texuli/core`.** `createScopedPortal`, `createScopedPortalRoot` and
`findPortalScope` (ADR-023): a portaled overlay mounts in a `display:
contents` child of `body` that mirrors the nearest `[data-tx-scope]`'s
`data-tx-*` attributes and inline custom properties, kept in sync while it
lives. `createPortal` keeps its `body` default.

**`@texuli/primitives`.** `Portal`, `Dialog.Portal` and
`AlertDialog.Portal` keep their token scope; `composeHandlers` and
`chainHandlers` are exported (G95); a contained `Toast.Viewport` no longer
reads its container's computed position during the first render, and the
new `positioned` prop skips the read (G99); the sortable handle target
reads `--tx-size-target-min`.

**`texuli`.**

- Every component and layout stylesheet reads its component tokens and
  the system tokens; the button, card, input and focus ring hooks
  (`data-tx-*-style`) are real.
- `texuli/defaults`: `setDesignDefaults`, `getDesignDefaults`,
  `validateDesignDefaults` and `DESIGN_DEFAULTS_VOCABULARY`, default
  `variant` and `size` props for 45 component ids through a Svelte
  context; an explicit prop always wins, and unknown components, props
  and values are dropped and reported.
- Gap fixes: Dialog and AlertDialog report `onOpenChange(false)` once on
  an inside close (G87); CommandPalette shows its Searching status while
  `search` is pending (G88); DatePicker and DateRangePicker take
  `controlClass` (G89); DatePicker, DateRangePicker and TimeField show a
  Field's invalid state (G90); `useFieldLabel` and `getFieldLabelContext`
  are exported from `texuli/field` (G91); `ref` and rest attributes on
  AppShell, SplitView, BottomNav, MobileHeader and MobileAppFrame (G93); a
  pending Button keeps focus (G94); MobileAppFrame
  `stickyFooterUnstyled`, and `composeHandlers` and `chainHandlers` from
  `texuli` (G95); the Toaster takes `positioned` (G99).

**Domain and document packages.**

- `@texuli/charts`: stylesheets read token contract v2, with one canonical
  categorical fallback set; the cartesian canvas layer is sized to the
  plot box (G96); a time x-axis with `xKind`, `formatX` and `locale` used
  by the axis, live region, tooltip and data table (G97);
  `InteractivePlot` honors the `MotionProvider`'s reduced motion (G98).
- `@texuli/data`: component and system token reads; DataGrid table mode
  `rowFocusable` rows activate with Enter and Space (G92), a
  `searchPredicate` and a numbered pager option; `ref` and rest attributes
  on Board (G93).
- `@texuli/chat`: bubbles and composer read their component tokens; `ref`
  and rest attributes on ChatThread, MessageList, Composer and
  TypingIndicator (G93).
- `@texuli/blocks`: tree diagrams take `variant` instead of `style`, so
  agents can send them (the untrusted sink scan refuses every `style`
  key); stylesheets read system tokens.
- `@texuli/media`, `@texuli/forms`, `@texuli/canvas`, `@texuli/sheets`,
  `@texuli/workflows`, `@texuli/editor` and `@texuli/pages`: stylesheets
  read token contract v2 system and component tokens. `@texuli/slides`
  keeps the stage's pixels (exact legacy reads only).
- `@texuli/player`: the regenerated render specs (cartesian `xKind` and
  `locale`).
- `@texuli/date`, `@texuli/drag`, `@texuli/deck`, `@texuli/document` and
  `@texuli/astro`: no source change; version and exact pins only.

**texuli.com** (deployed from `main` with this release).

- The remote MCP server at `https://texuli.com/mcp` (and
  `/.well-known/mcp`), ADR-018: stateless Streamable HTTP, the `edge` and
  `site` operations, read-only, no key, with Host, Origin, rate, size and
  time limits ([SECURITY](SECURITY.md#21-remote-mcp-endpoint)). The CI job
  `mcp-remote-smoke` compares its `tools/list` with the registry after
  each deploy.
- An agent-ready site: a Markdown twin of every page (negotiated on every
  path), the agent discovery files, the read-only JSON API under
  `/api/v1/` with `/openapi.json`, the `/developers/` portal, and a WebMCP
  bridge for browser agents (same origin only).
- `/mcp-server/` (setup for every host, every tool and its limits),
  `/tokens/` and `/tokens/components/` (generated from the registries), and
  `0.9.0` on `/whats-new/`.
- The generated surfaces (the server card, the llms Tools section, the
  ops tables, the `/mcp-server/` data) come from the registry, and `pnpm
  check:surfaces` fails on drift.

**Breaking changes and migration notes under `0.x`.** A new minor may
break; check these when upgrading from the 0.8 line:

- **MCP tool names.** The seven 0.8 tool names (`deck`, `document`,
  `catalog`, `component`, `validate`, `example`, `theme`) are deprecated
  aliases of the `group.verb` tools until `0.10.0`, which removes them:
  move host prompts and allowlists to `deck.run`, `document.run` or
  `document.export`, `catalog.search`, `component.get`,
  `catalog.validate`, `example.search`, and `theme.search` or
  `theme.get`.
- **Not initialized is `-32600`.** A stateful (stdio) request before
  `initialize` gets `-32600` (Invalid Request) instead of `-32002`, which
  MCP reserves for an unknown resource.
- **Spec `0.9.0`.** `validateDraft` migrates a `0.8.0` envelope and stamps
  `spec: "0.9.0"`; hosts that compare the `spec` string need to accept it.
- **The catalog hash changes** (`8e72aaa2…` instead of `598075e3…`): a host
  that pins `catalogHash` refuses envelopes written for the 0.8 catalog
  (`catalog-mismatch`) until it pins the new hash or drops the pin.
- **Token contract v2.** Additive: nothing is renamed, and `renames.json`
  is empty in `0.9.0`. Component tokens are fallback-only (never
  declared), so a host reads them with their registry default and sets
  them on a scope; import `@texuli/tokens/base.css`, which now declares
  the system defaults. Default variants and sizes come from
  `setDesignDefaults` (`texuli/defaults`).
- **A pending Button** (`loading` or `autoLoading`) is `aria-disabled`
  with its click suppressed instead of natively `disabled`, so it keeps
  focus; a test or selector that expected `disabled` needs an update.
- **Date controls** (DatePicker, DateRangePicker, TimeField) emit
  `aria-invalid="true"` and `data-invalid` when a Field marks them
  invalid, not only from their own `error` prop.
- **Select and Combobox** content and input follow the design defaults
  instead of a fixed `md` size when a provider sets one.
- **Tree blocks** take `variant` (`file-tree` or `org`); `style` is an
  alias through `0.9.x`, removed in `0.10.0`, and both keys with
  different values are refused.

**Packaging and consumers.** `pnpm verify:packages` packs all 26 packages
(`@texuli/examples` is the only package it skips); the consumers harness
installs the packed tarballs, and `@texuli/mcp` has a packed-bin consumer
test.

**Size budgets** (`texuli.budgets.json`). New rows at measured plus 4%
for the token subpaths, `@texuli/catalog/manifests/all` and the
`functions/mcp` bundle; the rows that grew with token adoption, scoped
portals and the gap fixes were raised at measured plus 4% with their
reasons, and the website routes likewise.

**Security notes** ([SECURITY](SECURITY.md)): the remote MCP endpoint
(section 21), the WebMCP bridge (21a), the agent discovery files (22) and
the public JSON API (23). Each is read-only and anonymous, refuses hostile
input before any work, and keeps per-isolate, best-effort rate limits.

**Protoyard gaps closed in 0.9.0** (reported against npm 0.8.0):

| Gap | Package | Fix |
| --- | --- | --- |
| G87 | `texuli/dialog` | `onOpenChange(false)` fires once on an inside close |
| G88 | `texuli/command` | The Searching status shows while `search` is pending |
| G89 | `texuli/date` | `controlClass` on the bordered control |
| G90 | `texuli/date` | A Field's invalid state reaches DatePicker, DateRangePicker and TimeField |
| G91 | `texuli/field` | `useFieldLabel` and `getFieldLabelContext` exported |
| G92 | `@texuli/data/grid-core` | Keyboard row activation in table mode (`rowFocusable`), `searchPredicate`, a numbered pager |
| G93 | `texuli`, `@texuli/chat`, `@texuli/data` | `ref` and rest attributes on AppShell, SplitView, BottomNav, MobileHeader, MobileAppFrame, the chat parts and Board |
| G94 | `texuli/button` | A pending Button keeps focus (`aria-disabled`) |
| G95 | `texuli`, `@texuli/primitives` | MobileAppFrame `stickyFooterUnstyled`; `composeHandlers` and `chainHandlers` exported |
| G96 | `@texuli/charts/cartesian` | The canvas layer shares the plot box |
| G97 | `@texuli/charts/cartesian` | A time x-axis (`xKind`, `formatX`, `locale`) |
| G98 | `@texuli/charts/interaction` | `InteractivePlot` follows the `MotionProvider`'s reduced motion |
| G99 | `@texuli/primitives/toast`, `texuli` | A contained Toaster forces no layout on mount; `positioned` skips the read |

Not changed: the Toaster's `positioned` prop is not in the agent catalog
(the catalog does not expose `mode` or the container). Chart colors are
`--tx-chart-1` to `--tx-chart-8` (hyphenated).

**Publish order** (`publish.yml`): core, date, spec, drag, deck, tokens,
primitives, document, texuli, workflows, editor, forms, canvas, charts,
data, media, chat, blocks, sheets, catalog, tools, mcp, astro, player,
pages, slides.

### Known gaps in 0.9.0 (planned, not done)

- **Data-viz tokens stay per theme.** Emitting them for every theme moved
  99 captures in 30 examples, because the chart fallbacks differ by design
  (ColorBrewer frames, semantic pie roles, `currentColor` sparklines). The
  design-system compiler planned for `0.10.0` always emits them.
- **Components inside decks keep their literals** instead of following the
  deck theme's tokens (following it moved 84 captures); planned with the
  `0.10.0` design-system runtime and a one-time rebaseline.
- **The list block's optional `style`** has the conflict the tree block
  had (the untrusted sink scan refuses every `style` key), so a list with
  a style cannot come from an agent yet; a rename is planned.
- **`/openapi.json` is about 236 KB**, because its examples are real built
  files; trimming them to small samples is planned.
- **Flaky tests:** the lazy canvas chart renderer, the player's
  `schema-form` lookup, the `site-slides` components deck, a
  stream-session chunking timeout and the `editor-markdown` linear-time
  wall-clock bound each failed once under parallel local load, and the
  WebKit dialog motion scenario once in CI; all passed on rerun. Hardening
  their waits (and an operation-count test for the wall-clock bound) is
  planned.
- **`/component-pages/card/`** reports enforced CSP `style-src-elem`
  inline violations (present before PLAN_011); finding and fixing or
  hashing the inline style is planned.
- **Smaller items.** `Table` keeps its built-in `plain` variant outside
  the design defaults (planned); the Astro integration does not write the
  input hook yet; the remote MCP and the API rate limits are per isolate
  (durable limits need a KV binding the owner creates); the design-system
  document (ADR-021) and its compiler and runtime are planned for
  `0.10.0`.

### 0.8.x patch releases (G86)

Backwards-compatible fixes with no new public API:

| Package | Version | Why |
| --- | --- | --- |
| `@texuli/data` | `0.8.1` | The fix: list motion loads lazily |
| `@texuli/blocks` | `0.8.1` | Pins `@texuli/data` `0.8.1` |
| `@texuli/catalog` | `0.8.1` | Pins `@texuli/data` and `@texuli/blocks` `0.8.1` |
| `@texuli/player` | `0.8.1` | Pins `@texuli/data`, `@texuli/blocks` and `@texuli/catalog` `0.8.1` |
| `@texuli/sheets` | `0.8.1` | Pins `@texuli/data` `0.8.1` |
| `@texuli/pages` | `0.8.1` | Pins `@texuli/blocks` and `@texuli/player` `0.8.1` |
| `@texuli/tools` | `0.8.1` | Pins `@texuli/blocks` and `@texuli/catalog` `0.8.1` |
| `@texuli/astro` | `0.8.1` | Pins `@texuli/blocks` `0.8.1` |
| `@texuli/slides` | `0.8.2` | Pins `@texuli/blocks`, `@texuli/catalog` and `@texuli/player` `0.8.1` |

**The fix (`@texuli/data`).** The Board, the DataGrid and the Dashboard
took list motion from `texuli/motion` statically, so every consumer paid
for its seams, its contract and its provider context even with
`motion={false}`, reduced motion or level `none` (G86, reported by
Protoyard). They now go through a small internal shim that reads the
`MotionProvider` settings at init and loads `texuli/motion` with
`import()` the first time a mounted list could animate a change. With
`motion={false}`, `layout: false`, level `none` or reduced motion (forced
by the provider, or the reader's), it never loads. A change before it has
loaded commits at once. Measured gzip of the initial graph:
`@texuli/data/board` 12,833 to 12,339 B, `@texuli/data/grid-core` 13,416 to
13,082 B, `@texuli/data/grid-editing` 18,224 to 17,889 B,
`@texuli/data/dashboard` 11,529 to 11,194 B and the `@texuli/data` barrel
84,899 to 84,261 B. `texuli` is unchanged and stays at `0.8.0`. Covered by
`packages/data/tests/motion.test.ts` and
`packages/data/tests/motion-bundle.test.ts`.

**Why the dependents moved.** Internal dependencies are exact pins (see
"Workspace dependencies and consumers"), so a published package that pins
`@texuli/data@0.8.0` would keep installing the unfixed version. Every
package that depends on `@texuli/data` directly or through another pinned
package gets a patch release that pins the new versions. The workspace
links them by version (`linkWorkspacePackages`), so the lockfile moves with
them. The `workspace:*` ranges of `@texuli/examples` and the apps are
unchanged. Each is published by the publish workflow after the merge that
bumps it.

### @texuli/slides 0.8.1

A backwards-compatible fix; no other package changes version, and no
published package depends on `@texuli/slides`. At the `untrusted` tier the
chrome row (`.tx-deck-stage__chrome-row`) now wraps: the toolbar keeps at
least `min(100%, 16rem)` beside the **Untrusted content** badge and moves
to its own line when that does not fit, instead of pushing "More" past a
phone's edge (390 px at a 340 px viewport in `0.8.0`). Covered by
`tests/e2e/site-motion.spec.ts` at 340 px. Published by the publish
workflow after the merge that bumped it (publish on merge, PR #17).

### 0.8.0

Every published package moves to `0.8.0` together, and every internal
`@texuli/*` dependency between them is pinned to exactly `0.8.0`.
`@texuli/forms` (L4), `@texuli/canvas` (L4) and `@texuli/sheets` (L5) are
published for the first time (ADR-012, ADR-015): they leave the `0.0.0`
placeholder and join `publish.yml` (`@texuli/forms` and `@texuli/canvas`
after `@texuli/editor`, once `@texuli/core`, `@texuli/deck`,
`@texuli/document`, `@texuli/drag` and `texuli` are out; `@texuli/sheets`
after `@texuli/blocks`, once `@texuli/date` and `@texuli/data` are out).
No published package imports any of the three: `@texuli/catalog` and
`@texuli/player` take their checks and painters from the host. `0.8.0`
carries the PLAN_010 waves 4 to 6: forms and host data sources,
dashboards, the canvas, spreadsheets, multi-target output (email, print
and i18n), blueprint spec `0.8.0`, and the texuli.com feature pages.

**`@texuli/forms` (new on npm, L4).**

- `model` (framework-free): the closed form schema (15 field types,
  sections, multi-step flows, options), named formats only (never a
  regular expression), conditions and cross-field rules as expressions of
  `@texuli/core/expression`, async validators by name, autosaved drafts
  read back as untrusted input, and the form controller.
  `validateFormSchema` and `checkFormDraft` refuse anything outside the
  vocabulary; field names that are `Object.prototype` members are
  reserved, and values are read through own keys only.
- `.`: `SchemaForm`, the form painted with texuli controls, with an error
  summary that takes focus, announced errors and a stepper named after the
  form; a new `form` prop gets a new controller.
- `host`: `createFormPlayerHost()`, the player's `formHost`, which also
  supplies the form check and the host validators by name.

**`@texuli/canvas` (new on npm, L4).**

- `model` (framework-free): the canvas format (`texuli-canvas`) with
  shapes, text, sticky notes, images, frames, groups and connectors routed
  straight, elbow or curved on the curve shared with `@texuli/workflows`;
  `validateCanvas` and `loadUntrustedCanvas` (untrusted by default:
  closed shapes and a token palette, no raw CSS, no control or bidi text,
  image refs through the URL policy, `CANVAS_LIMITS`), the JSON Schema spec
  `0.8.0` pins as `schemas/canvas.schema.json`, hit testing and reading
  order, freehand simplification, and operations with inverses and an op
  log.
- `sync`: collaboration on the `@texuli/document/sync` CRDT core, with
  sessions and presence (the presence store is capped).
- `export`: `canvasToSvg` (escaped markup through `@texuli/core/markup`)
  and `canvasToPng`.
- `editor` and `viewer`: `CanvasEditor` (a `role="application"` surface, a
  toolbar, a minimap and a shape tree, with a complete keyboard model) and
  the read-only `CanvasViewer`.
- `host`: `createCanvasPlayerHost()`, the player's `canvasHost`.

**`@texuli/sheets` (new on npm, L5).**

- `formula` (framework-free): a linear-time parser into the
  `@texuli/core/expression` AST, 54 documented functions, criteria, closed
  TEXT formats and reference rewriting; no dynamic references, and
  operator chains count toward the depth limit, so a hostile formula is
  refused (`too-deep`) instead of overflowing the stack.
- `model` (framework-free): the sheet format (`texuli-sheet`, 1 to 16 tabs
  of up to 10,000 rows and 256 columns), `validateSheet` and
  `loadUntrustedSheet`, the dependency graph with incremental, bounded
  recalculation (`#CYCLE!`, `#REF!`, `#LIMIT!`) and the workbook engine
  with structural edits that rewrite references.
- `csv`: RFC 4180 CSV in and out; export neutralizes formula injection,
  and import reports the reader's own failure code.
- `view`: `SheetView`, the accessible spreadsheet over the
  `@texuli/data` grid editing layer, with tabs and a formula bar (its
  classes are `tx-sheets-view*`, apart from texuli's `Sheet` drawer).
- `host`: `createSheetPlayerHost()`, the player's `sheetHost`, and
  `checkSheetDraft`.

**New subpaths in published packages.**

- `@texuli/core/expression`: the one closed, bounded expression language
  (ADR-015) that forms and sheets share (its AST extends the blueprint
  `condition` and `numberFormula` ops), with step, depth and size limits
  (`#LIMIT!` on overrun).
- `@texuli/core/data-source`: host-registered sources, the closed query
  (projection, the grid filter model, sort, search, page size), and a
  loader with deduplication, cancellation, retries, caching and optimistic
  edits; an invalidated read is never joined by a later one.
- `@texuli/core/i18n`: message catalogs with lazy locales, plural and
  select messages and a pseudo-locale (ADR-016); every `texuli` and
  `@texuli/primitives` label resolves through it (`setI18nContext`,
  `useMessages`, `TEXULI_MESSAGES_EN`, `PRIMITIVES_MESSAGES_EN`). Label
  props keep winning, and English is the only shipped language.
- `@texuli/data/dashboard` and `@texuli/data/dashboard/engine`: a widget
  grid moved and resized by pointer, keyboard or an arrange toolbar on
  `@texuli/drag`, with breakpoints and a saved layout parsed as untrusted
  input (`parseDashboard` lists every clamped value as an issue); a widget
  whose content overflows is a named, focusable group. The `@texuli/data`
  grid editing layer adds `onFocusCell`.
- `@texuli/tools/email` (escaped, table-based email HTML and a plain-text
  part, links and images at the `untrusted` tier) and
  `@texuli/tools/print` (a validated blueprint to a PDF through the
  `@texuli/document` writer).
- `@texuli/spec/source`: the data-source binding checks shared by the spec
  validator, `@texuli/catalog` and the player.

**Blueprint spec 0.8.0** (ADR-012, ADR-015). Additive: data-source
bindings (`{"$source": name, "query": {...}, "map": {...}}` on a
component's sourceable props, checked against the host's descriptors and
refused without them: `source`, `unknown-source`); the agent-emittable
`schema-form` id with the closed form schema (`$defs.formSchema`) and the
closed expression AST (`$defs.expression`); the `canvas` id with the canvas
shape (`$defs.canvas`) and `schemas/canvas.schema.json`; the
`data-dashboard` and `data-dashboard-widget` ids; and the `spreadsheet` id
with the sheet shape (`$defs.sheet`, `$defs.sheetTab`). The
`0.7.0 → 0.8.0` migration only stamps `spec`; the digest
(`f6b6388280d247eb9c3106a925111f35b90d1ec3b59c23652542f06a9f103daf`) is
pinned in `packages/spec/versions.json`, and the generated TypeScript and
Kotlin are regenerated (the native twin validates the new shapes and paints
forms, canvases, sheets and dashboards as placeholders).

**Forms, canvases, sheets and dashboards as agent data.**

- `@texuli/catalog`: 168 ids, 75 agent-emittable. `validateDraft` checks
  `schema-form`, `canvas` and `spreadsheet` nodes with the host's
  `checkForm`, `checkCanvas` and `checkSheet` at the draft's tier; without
  one, every such node is refused (`form-unchecked`, `canvas-unchecked`,
  `sheet-unchecked`). Dashboards follow composition rules
  (`dashboard-child`, `dashboard-parent`, `dashboard-widgets`,
  `dashboard-widget-id`: widgets only directly in a dashboard, unique ids,
  at most 200 widgets).
- `@texuli/player`: the `formHost`, `canvasHost` and `sheetHost` seams
  (the player imports none of the three packages); data sources through
  `sourceRegistry` or `sourceLoader`, with loading, empty and error states,
  paging and optimistic saves; dashboard painters; and a print mode
  (`print`): a static paint with motion off and print styles.
- The agent service (`apps/agent`, not published, not deployed) validates
  forms, canvases, sources and sheets in its draft gate.
- The native twin (`native/`, not published) adds six painters (the
  composition layouts `layout-stack`, `layout-row`, `layout-split` and
  `layout-tile`, `blocks-code` and `blocks-structure`) and
  `TexuliMessages`, the Kotlin side of the message catalog.

**Breaking changes under `0.x`.** A new minor may break; these need a look
when upgrading from `0.7.0`:

- **Spec `0.8.0`.** `validateDraft` migrates a `0.7.0` envelope and stamps
  `spec: "0.8.0"`; hosts that compare the `spec` string need to accept it.
  A `0.8.0` envelope with a `$source` binding or one of the new ids is
  refused by `0.7.0` validators.
- **The catalog hash changes** with the new ids (`598075e3…` instead of
  `c6bd7047…`): a host that pins `catalogHash` refuses envelopes written
  for the `0.7.0` catalog (`catalog-mismatch`) until it pins the new hash
  or drops the pin.
- **`aria-required` inside a `Field`** now lands only on roles that support
  it: a `DatePicker`, `DateRangePicker`, `TimeField` or `Slider` gets native
  `required` on its inputs instead, and a `ColorPicker` drops it; a test or
  selector that expected it on every control needs an update.
- **Component labels** come from the message catalog. The English text is
  the default and label props still win, but a host that set labels
  through other means should check them against `TEXULI_MESSAGES_EN` and
  `PRIMITIVES_MESSAGES_EN`.

Also changed, not breaking: `ValidateDraftOptions` takes `checkForm`,
`checkCanvas` and `checkSheet`; `PlayerOptions` takes the three host seams,
the source registry or loader and `print`; `Select.Value` no longer
recurses during server rendering without children.

**Packaging and consumers.** `pnpm verify:packages` packs all 25 packages
(`@texuli/examples` is the only package it skips), and the consumers
harness installs every one of them from its tarball into Vite, Astro and
SvelteKit apps, imports every exported subpath and renders one component
per UI package: a `CanvasViewer`, a `SchemaForm` and a `SheetView` for the
three new packages ([consumers](quality/consumers.md)).

**Size budgets** (`texuli.budgets.json`). Every entry of the three new
packages, `@texuli/core/expression`, `@texuli/core/data-source` and the two
dashboard subpaths has an exact row at measured plus 4%, written with the
PLAN_010 tasks that built them; `@texuli/core/i18n` falls under the
`@texuli/core/*` default cap, and `@texuli/tools` is not size-budgeted. The
website routes that grew with the shared `0.8.0` component code (mostly the
i18n message catalog) were raised at measured plus 4% with their reasons.

**Security notes** ([SECURITY](SECURITY.md#20-forms-data-sources-canvases-sheets-and-static-outputs)).

- **No pattern, no code.** Forms carry named formats and closed
  expressions only; sheet formulas parse into the same closed AST, with no
  dynamic references and with step, depth and graph budgets.
- **Data is named, never fetched by the blueprint.** A `$source` binding
  names a host-registered source with a closed query; without the host's
  descriptors every binding is refused.
- **Validated twice, painted by the host.** Forms, canvases and sheets pass
  their own package's validator through the host's check before the player
  paints them; without the check they are refused.
- **Static outputs escape by construction.** Email HTML comes from escaped
  builders with links at the `untrusted` tier; CSV export neutralizes
  formula injection; the canvas SVG is escaped markup.

**Also in PLAN_010:** the texuli.com `/forms-page/`, `/canvas-page/`,
`/sheets-page/`, `/dashboards-page/` and `/output-page/`, the
`/whats-new/` hub of every `0.6.0`–`0.8.0` feature, and the expanded
`/motion-page/` and `/documents-page/`.

**Publish order** (`publish.yml`): core, date, spec, drag, deck, tokens,
primitives, document, texuli, workflows, editor, forms, canvas, charts,
data, media, chat, blocks, sheets, catalog, tools, astro, player, pages,
slides.

### Known gaps and next steps (planned for the next version, not started)

0.8.0 publishes forms, the canvas and sheets; these remain. They are
planned, not done:

- **Forms, canvases and sheets.** Collaboration on sheets (a `sync`
  subpath on `@texuli/document/sync`); localized formula display; the
  `sheet`, `canvas` and form embeds in `@texuli/pages` stay typed
  references (painting them there is planned); `EmbedView` in
  `@texuli/pages` sets `data-state="painted"` before the player mounts.
- **Native.** Evaluating expressions and formulas in Kotlin; painting
  documents, forms, canvases, sheets and dashboards natively (each is a
  visible placeholder today); `layout-tile` spans across grid columns;
  loading host data sources natively.
- **Output and i18n.** Email dark mode; translations beyond English;
  tree-shaking the per-component message catalogs further, which most of
  the website route growth in `0.8.0` came from.
- **Documents.** Editing in the paged view (`PagedView` is read-only);
  network transports for sync (the in-memory and `BroadcastChannel`
  adapters ship, any other transport is the host's); a mention people
  picker in the comment composer; a callout's landmark name comes from the
  document, so two editors showing the same callout repeat it.
- **API contract on layouts.** The contract tests exclude the layouts
  (`texuli/layouts/*`); they join in a follow-up. `onValueChange` reporting
  only person-made changes is a written rule, not yet checked by a test.
- **Motion coverage.** `Collapsible`, `NavigationMenu`, `Select`,
  `Combobox`, `CommandPalette`, the `Drawer` backdrop and the layout drawers
  don't take `motion` yet; shared-element transitions between components and
  springs in the `motion` prop are planned (the runtime has them); the v1
  slide reveal steps keep their CSS animation.
- **Size.** Trim the entries raised in 0.5.0 (`@texuli/catalog` root,
  `@texuli/data/grid-editing`, `@texuli/blocks/structure/renderers`) and
  in 0.6.0 (`@texuli/core/editor-model`, `@texuli/core/editor-markdown`,
  `@texuli/editor/markdown`, `@texuli/editor/paste`,
  `@texuli/media/gallery/lightbox`).
- **Chat.** A label for each message article, and an option for `actions`
  to replace the built-in send button.
- **Smaller items.** A toast replaced by `id` keeps only the newest
  `onSettle`; `Pagination` `stableCount` writes a numeric `style` attribute
  (strict `style-src-attr` hosts need a hash per value); the catalog `tag`
  manifest still states the old remove label; `texuli/icons` needs an
  `icons.css.d.ts`.

### 0.7.0

Every published package moves to `0.7.0` together, and every internal
`@texuli/*` dependency between them is pinned to exactly `0.7.0`.
`@texuli/document` (L1) and `@texuli/pages` (L8) are published for the
first time (ADR-010, ADR-011): they leave the `0.0.0` placeholder,
`@texuli/pages` leaves `NEVER_PACKED`, and both join `publish.yml`
(`@texuli/document` after `@texuli/primitives`, once `@texuli/core` and
`@texuli/deck` are out; `@texuli/pages` after `@texuli/player`, once
`@texuli/document`, `@texuli/editor`, `@texuli/blocks` and `texuli` are
out). `0.7.0` carries the PLAN_010 document wave: the document engine and
its editor, blueprint spec `0.7.0` (documents as agent data and node keys),
the catalog, player, tools and agent-service support for documents, and two
texuli.com pages.

**`@texuli/document` (new on npm, L1, framework-free and DOM-free).**

- `model`: the block document format (`texuli-document`, `formatVersion`
  1) with persisted ids: the core editor's text blocks plus `callout`,
  `toggle`, `columns`, `page-link`, wrapped `@texuli/blocks` blocks and
  catalog, deck, sheet and canvas embeds; caps of 2,000 blocks, 200,000
  characters, 8 levels and 64-character ids.
- `schema`: the validator on the `@texuli/deck` schema kit, the URL policy
  for links and media, `loadUntrustedDocument` (bytes capped before
  parsing) and the JSON Schema export (`documentJsonSchema`, the file spec
  `0.7.0` pins as `schemas/document.schema.json`).
- `ops`: typed operations by persisted id with exact inverses, bounded
  RFC 6902 patches with inverse patches (`applyDocumentPatch`, all or none)
  and the op log with undo and redo.
- `markdown`: Markdown in and out through the linear-time core editor
  codec; raw HTML stays literal text.
- `paged`: the pagination engine (page sizes and margins in points,
  explicit breaks, headings kept with what follows, widow and orphan
  control, headers and footers with page fields) over a measurer the
  caller injects.
- `docx` and `pdf`: owned DOCX (WordprocessingML) and PDF 1.7 writers on
  `@texuli/core/markup` and `@texuli/core/zip` (ADR-016), loaded lazily.
- `sync`: the owned CRDT core (a Fugue sequence, a move-safe tree,
  last-writer-wins registers, selective undo, presence, and in-memory and
  `BroadcastChannel` `SyncAdapter`s); every remote batch is validated
  before it integrates.
- `collab`: documents on the CRDT: a `DocumentSync` session from an
  editor's op log to replica operations and back, comments anchored to item
  ids, suggestions, named versions with restore, and presence.

**`@texuli/pages` (new on npm, L8).**

- `editor`: `PageEditor`: text rows through `@texuli/editor`, an APG slash
  menu of every block type, block selection and drag on `@texuli/drag` with
  keyboard equivalents, nested pages with a breadcrumb, resizable columns,
  and live component and deck embeds painted by `@texuli/player` at the
  `untrusted` tier; every edit is a `@texuli/document` operation in one op
  log.
- `reader`: `PageReader`, read-only, with anchored headings and an outline.
- `paged`: `PagedView`, real pages laid out by `@texuli/document/paged`,
  printed one sheet per page and isolated to the view.
- `export`: `exportDocument` (Markdown, DOCX or PDF as a `Blob`, writers
  loaded on first use), `exportFileName` and `downloadBlob`.
- `collab`: `CollabEditor` on a `CollabSession`: comments (an APG feed),
  suggestion mode with accept and reject, version history with restore,
  remote carets (`aria-hidden`) and an accessible collaborator list. Every
  landmark it names carries the person whose view it is
  (`CollabLabels.landmark`, "Comments (Ada)"), so two editors on one page
  never repeat a landmark name (axe `landmark-unique`).
- `host`: `createDocumentPlayerHost()`, the player's `documentHost` that
  paints agent `document` blueprints with the reader, and
  `checkDocumentDraft`, the document check for `validateDraft`.

**Blueprint spec 0.7.0** (ADR-011, ADR-012, ADR-014). Additive: an
optional node `key` (`$defs.nodeKey`, `^[A-Za-z0-9._:-]{1,64}$`, unique in
the tree; a repeat is `duplicate-key`); the agent-emittable `document`
catalog id whose `doc` prop has the document shape (`$defs.document`); the
`patchDocument` edit op addressed by path or key, with a bounded RFC 6902
patch (`$defs.documentPatch`, at most 1,000 operations); and
`schemas/document.schema.json`, pinned from `@texuli/document`. The
`0.6.0 → 0.7.0` migration only stamps `spec`; the digest
(`43e44fa9a198d337d686b4e2d86882a06a676ae1e1c1f02d023b3a525795a8b2`) is
pinned in `packages/spec/versions.json`, and the generated TypeScript and
Kotlin are regenerated (the native twin validates documents and keys with
the TypeScript codes and paints a document as a placeholder).

**Documents as agent data.**

- `@texuli/catalog`: the `document` id
  (`@texuli/catalog/manifests/documents`, 163 ids, 70 agent-emittable).
  `validateDraft` checks a document with the host's `checkDocument` at the
  draft's tier, then its wrapped blocks and component embeds as catalog
  nodes at the same tier; with no `checkDocument` every document is refused
  (`document-unchecked`). `document` is a frame root. The `patchDocument`
  edit op (`applyEditOps(tree, ops, { patchDocument })`) applies all or
  none through the host's patcher with an exact inverse, and the commit
  gate validates the result again. Node keys ride on the draft and the
  render tree, and `validateStreamNode` refuses a key already admitted.
- `@texuli/player`: the `documentHost` seam paints `document` blueprints
  through a host such as `createDocumentPlayerHost()` from
  `@texuli/pages/host`, which also supplies the document check; without a
  host a document is refused. A streamed node that repeats a painted key is
  held (`duplicate-key`).
- `@texuli/tools`: the `@texuli/tools/document` subpath and the `document`
  command of the `texuli` bin, with ten commands (`capabilities`,
  `schema`, `validate`, `inspect`, `patch`, `from-markdown`,
  `to-markdown`, `to-blueprint`, `to-docx`, `to-pdf`); the local MCP
  server has them as a read-only `document` tool.
- The agent service (`apps/agent`, not published, not deployed) validates
  document drafts with `@texuli/document` at the `untrusted` tier, so valid
  documents pass and hostile ones are refused (`document-schema`).

**Breaking changes under `0.x`.** A new minor may break; these need a look
when upgrading from `0.6.0`:

- **Spec `0.7.0`.** `validateDraft` migrates a `0.6.0` envelope and stamps
  `spec: "0.7.0"`; hosts that compare the `spec` string need to accept it.
  A `0.7.0` envelope with node keys or a `document` node is refused by
  `0.6.0` validators.
- **The catalog hash changes** with the new `document` id
  (`c6bd7047…` instead of `4ac7eced…`): a host that pins `catalogHash`
  refuses envelopes written for the `0.6.0` catalog (`catalog-mismatch`)
  until it pins the new hash or drops the pin.
- **`EditOp` gains `patchDocument`.** An exhaustive `switch` over `EditOp`
  or `EditOpKind` needs a branch; `applyEditOps` and `applyEditOp` take an
  optional third argument (`ApplyEditOptions`), and without
  `patchDocument` that op is refused (`invalid-op`).

Also changed, not breaking: `RenderNode` and `CatalogTreeInput` carry an
optional `key`; `PlayerOptions` takes `checkDocument`; the `texuli` bin
gains the `document` command.

**Packaging and consumers.** `pnpm verify:packages` packs all 22 packages
(`@texuli/examples` is the only package it skips), and the consumers
harness installs every one of them from its tarball into Vite, Astro and
SvelteKit apps, imports every exported subpath and renders one component
per UI package, a `PageReader` for `@texuli/pages` included
([consumers](quality/consumers.md)). The harness's installed-graph walk now
follows package `imports` (the `#deck-ssr` and `#deck-ssr-core` specifiers
of `@texuli/slides`), which it used to report as undeclared packages.

**Size budgets** (`texuli.budgets.json`). Every entry of
`@texuli/document` and `@texuli/pages` has an exact row at measured plus 4%,
and `@texuli/catalog/manifests/documents` gets its own (1,664 B; measured
1,566 B). No row of the packages whose code changed in this wave
(`@texuli/document`, `@texuli/pages`, `@texuli/catalog`, `@texuli/spec`,
`@texuli/player`) had more than 4% of headroom, so none was tightened;
`@texuli/tools` is not size-budgeted. `@texuli/slides` (53,632 B; measured
51,535 B) and `@texuli/slides/grammar` (44,352 B; measured 42,629 B) were
over at the release's starting point, after the document check and node
keys joined `@texuli/catalog/validate`, which both bundle; they are raised
to measured plus 4%.

**Security notes.**

- **Documents are validated twice.** A document from an agent passes
  `@texuli/document` at the `untrusted` tier (shape, closed vocabulary, URL
  policy on every link and media ref, caps), and its wrapped blocks and
  embeds are validated again as catalog nodes and by their own renderers
  (two-phase validation, ADR-011). No validator, no paint.
- **Patches are bounded.** `patchDocument` carries at most 1,000 RFC 6902
  operations, refuses prototype paths (`/__proto__/…`), applies all or
  none and validates the result again; the inverse restores the input
  exactly.
- **Static outputs escape by construction.** DOCX parts come from the
  escaped `@texuli/core/markup` builders and the PDF writer writes every
  string as a hex string, with no JavaScript, forms or embedded files;
  links pass `safeHref` at the `untrusted` tier.
- **Sync is not authorization.** Remote batches are validated before they
  integrate, and the host decides who may write
  ([SECURITY](SECURITY.md#19-documents-as-agent-data-patches-and-collaboration)).

**Also in PLAN_010:** the texuli.com `/documents-page/` (the live block
editor, the reader and paged view, Markdown, DOCX and PDF export, two
collaborators side by side, and an agent document with a bounded patch and a
refused hostile one) and `/live-generation/` (recorded drafts streamed into
the player, with no network, model or key).

**Publish order** (`publish.yml`): core, date, spec, drag, deck, tokens,
primitives, document, texuli, workflows, editor, charts, data, media, chat,
blocks, catalog, tools, astro, player, pages, slides.

### 0.6.0

Every published package moves to `0.6.0` together, and every internal
`@texuli/*` dependency between them is pinned to exactly `0.6.0`. No package
is published for the first time: `@texuli/document` and `@texuli/pages`
exist in the repository only (`0.0.0`, `private`, not in `publish.yml`;
their first release is planned for `0.7.0`). `0.6.0` carries PLAN_010 so
far: the one API contract, motion, streamed blueprints, blueprint spec
`0.6.0`, packaging fixes proven by a consumers harness over every package,
and the gaps Protoyard reported on `0.5.0` (G48 to G85). The ids below match
Protoyard's register.

**Closed gaps.**

| Gap | Package / subpath | What changed |
| --- | --- | --- |
| G48 | `@texuli/editor/markdown`, `@texuli/core/editor-model`, `@texuli/core/editor-markdown` | Host inline extensions: mentions and references register a sigil from a closed set (`createInlineExtensions`, `EDITOR_EXTENSION_SIGILS`) and round-trip as `<sigil>{id\|label}` with an `extension` mark that keeps their id; ids and labels are bounded and matched in linear time, and host links pass `safeHref` at the `untrusted` tier |
| G49 | `@texuli/data/filter-builder` | A property catalog: host operators (`FilterOperatorDef`) with typed value editors, validation and predicates, field groups (`groupFields`), `catalogSchema` and `compileCatalogFilter`, and serializable saved segments (`serializeSegment`, `parseSegment`, bounded metadata) |
| G50 | `@texuli/data/activity/inbox` | `allowMarkUnread={false}` hides "Mark unread", and `onMarkUnread(ids)` reports it separately |
| G51 | `@texuli/data/cohort` | `heatScale` (2 to 10 hex steps or token names) and `heatText`; a palette with a step under 4.5:1 is refused, and each step picks its text color (`resolveHeatScale`) |
| G52 | `texuli/layouts/content` | Active-heading tracking: the current TOC link gets `aria-current="location"`, with `activeId` and `onActiveHeadingChange` |
| G53 | `texuli/dialog`, `texuli/command` | `Dialog`, `AlertDialog` and `CommandPalette` take `mode` and `container` (contained in a framed preview), `onDismissRequest` and `onCloseAutoFocus` (both can be vetoed with `preventDefault()`) |
| G54 | `texuli/tabs-accordion` | A tab's `badge` is part of its accessible name, or `badgeLabel` names it |
| G55 | `@texuli/data/grid-core` | `DataGrid` `activateOnClick` (pointer row activation), `mode="table"` (native table semantics, no `role="grid"`), per-column `hideBelow`, and an `empty` snippet that receives `{ query, filtered }` |
| G56 | `texuli/file-upload` | `id` (or `inputId`) reaches the file input, so `<label for>` and a `Field` name it |
| G57 | `texuli/toast` | `action.retryOnError` keeps the toast open with an error line (`errorText`) when the action rejects, so an undo can be retried; it still settles exactly once |
| G58 | `texuli/avatar` | `data-avatar` becomes `initials` after the image fails to load (and for a refused `src`) |
| G59 | `@texuli/chat` | `ChatAuthor.avatarSrcset`, each candidate through the `untrusted` image URL policy |
| G60 | `texuli/tags-color`, `@texuli/primitives/tags-input` | `TagsInput` `readonly`; `id` lands on the input, so `<label for>` works |
| G61 | `texuli/tags-color`, `@texuli/primitives/tags-input` | `delimiter` takes a list of keys (`[',', ';', ' ']`) or a RegExp (`isDelimiterKey`) |
| G62 | `texuli/card` | `CardGrid` `gap` takes a step, a plain CSS length or a custom property name (anything else is ignored), and a caller `style` no longer replaces the column template |
| G63 | `texuli/date`, `@texuli/primitives/date-field` | `DatePicker`, `DateRangePicker` and `TimeField` take `hideLabel` and hide their own label inside a `Field`; `id` reaches the first segment and `aria-describedby` / `aria-invalid` every segment (`inputId` on the primitive roots) |
| G64 | `texuli/date`, `@texuli/primitives/calendar` | `Calendar` opens on a chosen month with nothing selected: `defaultFocusedValue`, `bind:focusedValue` and `onFocusedValueChange` |
| G65 | `@texuli/primitives/date-field` | A date is reported only once the year has four digits (never `0002-…`) |
| G66 | `@texuli/primitives/date-picker`, `texuli/date` | `DateRangePicker` `required` (both fields), and `onInvalid(text, reason, { side })` says whether the start or the end caused a refusal |
| G67 | `@texuli/data/board` | `BoardColumnDef.description` (describes the column's lists) and a `columnHeader(column, { count })` snippet |
| G68 | `texuli/layouts/mobile` | `MobileAppFrame` renders no padded, bordered wrapper for an empty `stickyFooter` |
| G69 | `@texuli/data/board` | Column-only mode: without `getRank`, cards keep the `items` order and only move between columns |
| G70 | `@texuli/chat` | `MessageList` day separators are their own full-width row above the avatar and bubbles |
| G71 | `@texuli/chat` | A reading position: `bind:anchor` (`ChatReadingAnchor`: `messageId`, `offset`, `atLatest`) and `onAnchorChange`, restored when the host sets it; `ChatThread` forwards them |
| G72 | `@texuli/slides/stage-core` (new) | `DeckStageCore`: the stage with no reference to the default renderer tables, so a host that brings every renderer emits none of their chunks, CSS or prefetches |
| G73 | `@texuli/slides/stage` | `loadDeckMigration()` and `loadedDeckMigration()`, so a host awaits the migration chunk before mounting an earlier-shape deck |
| G74 | `@texuli/astro/appearance` | `AppearanceSwitcher` `size="sm"`, and same-tab sync between switchers of one namespace (`APPEARANCE_CHANGE_EVENT`) |
| G75 | `@texuli/core/inert`, `@texuli/core/overlay`, `@texuli/primitives` | An overlay opened inside a modal dialog stays above its backdrop: exemptions take `raise: false` (dialog backdrops and overlays nested in a modal), so only the toast region is re-raised |
| G76 | `@texuli/data/board` | The board scroller is positioned, so its screen-reader text can't widen a phone page |
| G77 | `texuli/toast`, `@texuli/primitives/toast` | No top-layer viewport while the `Toaster` is empty, and `mode="contained"` with a `container` for framed previews |
| G78 | `@texuli/tokens` (`base.css`), `@texuli/player` | Reduced motion sets `0s` durations and delays (it was `0.01ms`), so `visibility` changes are instant and nested content never appears one level per frame; the player and the website builder follow |
| G79 | `@texuli/primitives/avatar`, `texuli/avatar` | The loading image is hidden by style, never `[hidden]`, so a host reset (`[hidden] { display: none !important }`) can't stop it loading |
| G80 | `@texuli/slides/export` | Print isolation applies only while a print view with `isolate` is mounted (`:root:has([data-tx-print-isolate])`), so an early Ctrl/Cmd+P no longer prints a blank page |
| G81 | `@texuli/slides/export` | `preloadDeckPrintView(options?)` readies the print view before the user prints |
| G82 | `@texuli/slides/stage` | A `tools` snippet adds host controls to the toolbar as a last "More tools" group |
| G83 | `@texuli/slides/stage` | A prepared deck input: an `ok` result of `prepareDeck` or the new `prepareDeckV2` (`isPreparedDeck`, `PreparedDeckOk`) paints at the `developer` tier without migrating or validating again; look-alikes and `untrusted` stages are still validated |
| G84 | `texuli/layouts/marketing/section`, `texuli/layouts/marketing` | `MarketingSectionHeader`: the section header type scale on a plain `div`, with no landmark and no padding |
| G85 | `@texuli/chat` | `MessageList` `onEditUnchanged(message)` when an edit is saved unchanged (a host can treat it as a resend); `ChatThread` forwards it |

**Breaking changes under `0.x`.** A new minor may break; these need a look
when upgrading from `0.5.0`:

- **Field ids reach the focusable control (G56, G60, G63).** `FileUpload`'s
  `id` lands on the file input and `TagsInput`'s on its text input (both
  landed on the wrapper); `DatePicker`, `DateRangePicker` and `TimeField`
  put `id` on their first segment. CSS or tests that found these components
  by `id` need the wrapper's own hook instead.
- **Date controls inside a `Field` hide their own label (G63).** The Field's
  label names the group instead, so the label is no longer shown twice; pass
  your label to the `Field`.
- **`InputGroup` sends attributes to its input.** `id`, `aria-*`, `data-*`,
  handlers and the form and focus attributes reach the input (`aria-*` and
  `data-*` used to land on the group); layout hooks stay on the group, and
  with `children` (your own control) everything stays on the group.
- **Caller handlers compose on more parts.** Menu items (focus and blur;
  every handler of checkbox and radio items and sub-triggers), the
  navigation menu root, list, trigger and link, toast roots and viewports,
  the tree, splitter handles, the command input, the carousel and the input
  group run a caller's handler first and then their own, unless the caller
  called `event.preventDefault()` (actions) or always (bookkeeping such as
  focus and blur). Before, some of them dropped or replaced it. The order is
  in [STANDARDS](STANDARDS.md#component-api-contract).
- **`texuli/avatar` (G58):** after an image error, `data-avatar` is
  `initials` (it stayed `image`). Host styles keyed on it change state.
- **`@texuli/primitives/date-field` (G65):** `onValueChange` and
  `bind:value` stay `null` until the year has four digits; a value such as
  `0002-01-05` while typing is no longer reported.
- **Reduced motion is `0s` (G78).** `base.css` (and the player) set
  animation and transition durations and delays to `0s` instead of
  `0.01ms` under `prefers-reduced-motion: reduce`. A transition of `0s`
  starts no transition, so code that waits for `transitionend` under reduced
  motion no longer gets one.
- **Motion through the runtime, not CSS keyframes.** The toast
  (`tx-toast-in`, `tx-toast-out`), tooltip (`tx-tooltip-in`) and slides
  stage transition keyframes (`tx-deck-slide-*`) are gone: enter, exit,
  reflow, slide transitions and v2 fragments play through
  `@texuli/core/motion` (Web Animations), and `styles.css` holds only end
  states. Host CSS that overrode those keyframes no longer applies; use the
  `motion` prop or a `MotionProvider` (`texuli/motion`).
- **Overlay exits keep the part mounted.** With motion on, a closing dialog,
  sheet, popover, menu, hover card, tooltip or accordion panel stays mounted
  with `data-state="closed"` and `inert` until its exit ends (at most
  1.2 s); focus, `inert` and the layer stack are released at once. Tests that
  expect the part to leave the DOM synchronously should run under reduced
  motion or `motion={false}`.
- **`Toaster` (G77):** the top-layer viewport is not rendered while there
  are no toasts.
- **`@texuli/chat` (G70):** the day separator moved out of the group's flex
  row into its own row above it (`.tx-chat-message-group__row` holds the
  avatar and bubbles). Host CSS on that structure needs a look.
- **`@texuli/data` `FilterCondition.operator` (G49)** widens from
  `FilterOperator` to `FilterOperator | FilterCustomOperatorId` (a catalog
  operator id); an exhaustive `switch` over it needs a default branch. The
  grid engine still refuses catalog operators.
- **`AccordionRootProps` and `SliderRootProps`** members are type aliases
  (`RootShared & { … }`) instead of interfaces, so consumers' checkers no
  longer fail with TS2590; they can't be augmented by declaration merging.
- **Spec `0.6.0`.** `validateDraft` migrates a `0.5.0` envelope and stamps
  `spec: "0.6.0"`; hosts that compare the `spec` string need to accept it. A
  `0.6.0` envelope with motion is refused by `0.5.0` validators.

Also changed, not breaking:

- `Tooltip` takes `bind:ref` (the tooltip element, `null` while hidden) and
  rest attributes, which land on the tooltip element.
- `DateRangePicker`'s `onInvalid` gains a third argument (`{ side }`);
  two-argument handlers keep working.
- `DeckStage` is now `DeckStageCore` with the default renderer tables set
  (`defaults`); its props and behavior are unchanged, and
  `@texuli/slides/stage` exports both.
- `DataGrid`'s `empty` snippet receives `{ query, filtered }`; snippets that
  ignore it keep working.

**One API contract (G53, G56, G60, G63).** About 150 primitive parts and 100
styled components take `bind:ref` and pass unused attributes (`id`,
`aria-*`, `data-*`, `class`, `style`, handlers) to their root; providers that
render nothing are listed as exclusions. Contract tests
(`packages/primitives/tests/contract.test.ts`,
`packages/texuli/tests/contract.test.ts`) derive the component list from the
package exports, so a new export without a case fails. The rules (rest
attributes and `ref`, the form-control split, the Field rule, handler order,
callback naming, `onValueChange` payloads) are in
[STANDARDS](STANDARDS.md#component-api-contract). The layouts
(`texuli/layouts/*`) are not under the contract yet (planned). The catalog coverage gate lists the new `MarketingSectionHeader` (marketing chrome) and `MotionProvider` (a contentless utility) as exclusions, raising its ceiling from 208 to 210 under the same rule as 0.5.0: chrome and parts get exclusion rows, content gets a manifest.

**Motion (ADR-013).** `@texuli/tokens/motion` holds 5 durations, 5 easings
and 3 springs (precomputed `linear()` curves) and the `--tx-motion-*`
properties, which reduced motion zeroes. `@texuli/core/motion` animates
through the Web Animations API: presence, FLIP layout, shared elements,
sequences and timelines, and an owned spring solver
(`@texuli/core/motion/spring`), instant on the server, under reduced motion,
at level `none`, without the API and on a detached element. `texuli/motion`
holds the `motion` prop contract and `MotionProvider` (levels `full`,
`subtle`, `none`): dialogs, sheets, popovers, hover cards, menus, tooltips,
toasts, tabs, accordions and the `@texuli/data` Board and DataGrid animate,
and the slides stage plays transitions and fragments through the same
runtime. Nothing animates on the server or on hydration.

**Streamed blueprints (ADR-014).** `@texuli/spec/stream` tokenizes chunked
JSON in linear time with byte and depth caps and assembles node events;
`validateStreamNode` (`@texuli/catalog/validate`) runs `validateDraft`'s
checks on each node's chain, so nothing `validateDraft` refuses ever paints.
`<Player stream={source}>` shows skeletons, stays busy and inert, announces
progress politely, keeps actions disarmed until the full draft validates,
and keeps painted nodes with a retry on interruption. `validateDraft` stays
the only verdict.

**New packages and subpaths.**

- `@texuli/core/motion` and `@texuli/core/motion/spring`.
- `@texuli/core/markup` (ADR-016): typed, escaped XML and HTML builders
  (`el`, `text`, `serializeXml`, `serializeHtml`) with no raw-markup API;
  URL attributes only through `linkUrl` and `imageUrl`, which apply the URL
  policy; allowlisted HTML elements; iterative serialization.
- `@texuli/core/zip` (ADR-016): a deterministic ZIP writer (`writeZip`,
  `writeZipAsync` with `CompressionStream` deflate where the platform has
  it, `crc32`). The `@texuli/document` writers that use these two stay in
  the repository only.
- `@texuli/tokens/motion`.
- `texuli/motion`; `MarketingSectionHeader` in the existing
  `texuli/layouts/marketing` and `texuli/layouts/marketing/section`.
- `@texuli/spec/motion` and `@texuli/spec/stream`.
- `@texuli/slides/stage-core`.
- `@texuli/slides` declares package `imports` (`#deck-ssr`,
  `#deck-ssr-core`) that preload the default renderers in server builds;
  the packer now maps `imports` to `dist`.
- No new packages on npm. `@texuli/document` (`.`, `model`, `schema`, `ops`,
  `markdown`, `sync`) and `@texuli/pages` (`.`, `editor`, `reader`,
  `styles.css`) are in the repository only.

**Blueprint spec 0.6.0** (ADR-012, ADR-013). Additive: the closed motion
vocabulary. A node may carry `motion` (`enter` and `exit` presets `fade`,
`rise`, `scale`, `slide-start` and `slide-end`; `layout`; `stagger` `none`,
`fast` or `base`; `duration` `fast`, `base` or `slow`) and the envelope
`motion.level` (`full`, `subtle`, `none`). The catalog refuses raw CSS,
keyframes, milliseconds and unknown names (`invalid-motion`; the renderer
drops the motion and keeps the node), the player plays motion lazily through
`@texuli/core/motion`, never on the server or on hydration, and the Kotlin
twin decodes and maps it to Compose. No new catalog ids (162). The
`0.5.0 → 0.6.0` migration only stamps `spec`; the digest
(`37141b85b9ab9f02af849a62a9c97ba729d6c5c2705130290bcdf45b308ea4cc`) is
pinned in `packages/spec/versions.json`, and the generated TypeScript and
Kotlin are regenerated.

**Static output foundations.** `@texuli/core/markup` and `@texuli/core/zip`
are the shared base ADR-016 decides for every static output: escaping
happens in one place, by construction, and archives are byte-for-byte
reproducible. The DOCX and PDF writers and the paged view built on them
(`@texuli/document/paged`, `docx`, `pdf`; `@texuli/pages` paged view and
export) are in the repository only, planned for `0.7.0`.

**Packaging and consumers.**

- **Packed declarations type-check.** svelte2tsx names each component's
  declaration after its file, so 15 components (in blocks, slides, editor and
  player) that imported a binding with their own name shipped a broken
  `.d.ts` (TS2440); the imports are aliased and a test scans every
  component. `AccordionRootProps` and `SliderRootProps` no longer make
  consumers' checkers give up (TS2590).
- **The packer maps `imports`**, so `@texuli/slides` from npm resolves
  `#deck-ssr`.
- **Proof from npm for every package.** The consumers harness installs every
  packable package from its tarball into Vite, Astro and SvelteKit apps,
  imports every exported subpath (372 across 21 packages, `@texuli/document`
  included), type-checks every app, runs every bin and checks server-rendered
  and hydrated output ([consumers](quality/consumers.md)).

**Size and performance.**

- The sixteen chart components that render a data-table fallback share one
  stylesheet per table look (lazily loaded chart CSS 34,528 to 29,731 B raw).
- The core editor Markdown reader is linear on long plain text (99,000
  characters with soft breaks: 106 to 6.5 ms).
- `DeckStage` preloads its default renderers in server builds, so server
  output keeps the slide content; browser graphs are unchanged.
- A test checks that importing only the `texuli/layouts/mobile` model
  helpers drops the components.
- Size budgets: entries that grew with motion, the API contract and G48 are
  at measured plus 4%, and entries with room were tightened to measured plus
  4% (`texuli.budgets.json`).

**Security notes.**

- **Streams add speed, not trust.** The stream tokenizer runs in linear time
  with bounded memory (a 264 KiB byte budget and 128 nested containers by
  default) and refuses duplicate keys and `__proto__`, `constructor` and
  `prototype` anywhere. A streamed node paints only after the same checks
  `validateDraft` runs on its chain, actions stay disarmed until the whole
  draft validates, and `validateDraft` is still the only path to a valid
  draft ([SECURITY](SECURITY.md#18-streamed-blueprints-and-motion-as-data)).
- **Motion is data, never CSS.** Agents name motion only with the closed
  spec vocabulary; CSS, keyframes, durations and unknown names are refused.
- **Bounded host extensions.** Editor inline extensions use a closed sigil
  set, bounded ids and labels, linear-time matching and `safeHref` at the
  `untrusted` tier; filter segments bound their metadata and JSON
  (200,000 characters), and catalog filters are checked like the grid
  engine's (6 levels, 200 nodes); cohort palettes accept hex colors or
  token names only, and `CardGrid` `gap` only a step, a plain length or a
  custom property name, so no value can carry a CSS declaration.
- **Prepared decks are developer-tier only (G83).** The prepared brand is
  the prepare functions' own record, not the object's shape: a look-alike
  (agent output, a JSON or `structuredClone` copy) is validated like any
  input, and an `untrusted` stage validates a prepared deck again. Never
  prepare agent content for the developer tier.
- **Agent service (`apps/agent`, not published, not deployed).** The new
  provider interface streams typed events; the Anthropic Messages and
  OpenAI-compatible adapters take every setting, the key included, from
  constructor options and are tested only against recorded server-sent
  event bytes through a fake fetch. No adapter has called a provider.

**Also in PLAN_010:** ADR-010 to ADR-016 (document sync, the document
packages, spec evolution, motion, streaming, expressions, static outputs and
i18n) in [DECISIONS](DECISIONS.md); the `@texuli/document` engine and the
`@texuli/pages` editor and reader, in the repository only; the texuli.com
`/motion-page/`; and an offline evaluation harness and server-sent event
streaming of validated drafts in the agent service.

**Publish order** (`publish.yml`), unchanged from `0.5.0`: core, date,
spec, drag, deck, tokens, primitives, texuli, workflows, editor, charts,
data, media, chat, blocks, catalog, tools, astro, player, slides.
`@texuli/document` and `@texuli/pages` are not in it.

### 0.5.0

Every packable package moves to `0.5.0` together, and every internal
`@texuli/*` dependency between them is pinned to exactly `0.5.0`.
`@texuli/editor` is published for the first time (PLAN_009 G17, owner
approval 2026-10-28; the publish workflow refuses a `0.0.0` placeholder
version). It closes the gaps Protoyard found while adopting Texuli from npm
(PLAN_007 there); the ids below match its register.

**Closed gaps.**

| Gap | Package / subpath | What changed |
| --- | --- | --- |
| G1 | `texuli/icons` | No Texuli change, by decision: Lucide icons go through the existing `LucideIcon` bridge in `texuli/icons/lucide` (and `IconRef` props accept a Lucide component) |
| G2 | `@texuli/charts/compact` | `formatValue(value)` on `Sparkline`, `BulletChart`, `Gauge` and `ProgressRing` (wins over `format`; a host callback, never set by blueprints) |
| G3 | `@texuli/charts/matrix` | `RampLegend`: an accessible, CSP-safe color-ramp legend for a heatmap |
| G4 | `@texuli/core/inert`, `texuli/dialog` | Focus-exempt regions (`getInertRegistry().exempt(…)`; the `Toaster` is exempt), and a `stack` (`LayerStack`) option on `Dialog` and `AlertDialog` |
| G5 | `texuli/dialog`, `texuli/tabs-accordion`, `texuli/input` | `bind:ref` and rest attributes on `Dialog`, `Tabs`, `Accordion`, `Collapsible`, `TextCounter`, `Toolbar`, `ToggleGroup` and about 35 more components |
| G6 | `texuli/sheet` | `ResponsiveModal` `force` (`auto`, `dialog`, `sheet`) and sizing by a `host` element's inline size (`breakpoint`) instead of the viewport |
| G7 | `@texuli/data/grid-core` | `DataGrid` client paging (`pageSize`, `bind:page`), `rowClass(row)`, and `filters`, `toolbar` and `bulkActions` snippets |
| G8 | `texuli/file-upload` | `onFilesAdd(files)` and `onFileRemove(file)` |
| G9 | `texuli/toast` | `onSettle(reason)` with `timeout`, `action` or `dismiss`, called exactly once (undo flows) |
| G10 | `texuli/avatar` | `srcset` and `sizes`; every candidate passes the image URL policy at `srcTrust` (`avatarSrcset`) |
| G11 | `texuli/tags-color` | `TagsInput` `onInvalid({ tag, reason })` (`duplicate`, `max`, `invalid`) and a bindable draft (`bind:inputValue`) |
| G12 | `texuli/date`, `@texuli/primitives` calendar and date picker, `@texuli/date` | `today` (no clock reads), `weekStartsOn` (default from `localeWeekStart`), range highlight, `maxDays` and `onInvalid`; `@texuli/date` adds `localeWeekStart`, `weekStartDay` and `daysBetween` |
| G13 | `texuli/date` | A styled `TimeField` (`hourCycle`, `minuteStep`, `"HH:mm"` value) over the `@texuli/primitives/date-field` `TimeField`, which now spins with the APG spinbutton keys; catalog id `time-field` |
| G14 | `@texuli/data/board` | `columnFooter(column, { count })` snippet and `headingLevel` |
| G15 | `texuli/layouts/mobile` | Standalone `BottomNav`, `MobileHeader` and `MobileAppFrame` |
| G16 | `@texuli/astro/appearance` (new) | `AppearanceSwitcher`: a light, dark or system radio-group island over the per-site appearance cache (changes through `onValueChange`), with no inline script or style |
| G17 | `@texuli/editor` (first publication), `@texuli/editor/markdown` (new) | The editor becomes publishable (owner approval 2026-10-28); `markdownToDocument` and `documentToMarkdown` read and write Markdown at the `untrusted` tier, with HTML kept as literal text |
| G18 | `@texuli/data/filter-builder` (new) | `FilterBuilder`: nested and/or groups with operators by field type (changes through `onValueChange`), and the pure `applyFilter`; catalog id `data-filter-builder` |
| G19 | `@texuli/data/activity/inbox` (new) | `NotificationInbox`: unread state, mark read and unread, mark all, item actions and arrival announcements; catalog id `data-notification-inbox` |
| G20 | `@texuli/data/cohort` (new) | `CohortTable`: cohort retention table semantics (row and period headers, readable numbers, heat cells); catalog id `data-cohort-table` |
| G21 | `@texuli/blocks` (text, structure, data) | Heading and text `align`, text `size`, list `check` and `icon` styles, quote `role` and `avatar`, callout and card `icon`, divider `label` and `variant`, stat `title`, `source` and `trend`; host `resolveIcon` and `resolveAvatar` |
| G22 | packaging | No packaging defect: a consumer bundle from the packed dist matches one from source (+0.01% raw). `scripts/dist-parity.ts` and its test (dist-parity test added) keep it so |
| G23 | `@texuli/charts/sparkline-lite` (new) | A light `Sparkline` (same props, no data table): 2.2 to 2.6 KB gzip of first-screen JavaScript against 3.4 to 3.6 KB for the compact one ([PERFORMANCE](PERFORMANCE.md)). The broader first-screen CSS diet stays a follow-up |
| G24 | `@texuli/slides/stage` | `DeckStage` imports the default renderer tables only when `defaultRenderers` is on; `loadValidateBlock` loads a host block check lazily |
| G25 | `@texuli/slides` print path | The print paint loads the default renderer tables the same way |
| G26 | `texuli/input` and every input-like component | A caller `oninput` composes with the internal handler (it used to replace it and stop `bind:value`); 14 primitive parts compose or chain caller handlers |
| G27 | `texuli/sheet` | `Header`, `Body`, `Footer` and `CloseButton` parts on `Sheet` and `Drawer` |
| G28 | `texuli/menus` | `destructive` tone on menu `Item`s |
| G29 | `texuli/tabs-accordion` | Tab item `icon` (`IconRef`, decorative) |
| G30 | `texuli/navigation` | `Pagination` `stableCount` (constant token count, page buttons sized for the widest number) and `getStablePageTokens` |
| G31 | docs | `--tx-app-height` documented for `AppShell`, the app layouts and `MobileAppFrame` ([layouts-shells](../packages/texuli/docs/layouts-shells.md)) |
| G32 | `@texuli/chat` | `Composer` `streaming` with `onStop` (Stop button, Escape), an `onkeydown` hook and an `actions` snippet; `ChatThread` forwards them |
| G33 | `@texuli/chat` | `MessageList` per-message `actions`, inline edit (`onEdit`), and a bottom-anchored scroll with "Jump to latest" |
| G34 | `texuli/card` | A link `Card` passes `target`, `rel` (always with `noopener` for `_blank`) and `download` |
| G35 | `@texuli/blocks/code` | `header` and `toolbar` snippets on the code block bar (`CodeBlockBarContext`) |
| G36 | `texuli/kbd-code` | `CopyButton` `onCopy(value)` and `onCopyError(value)` |
| G37 | `texuli/badge` | `Tag` remove button named after the tag; `removeLabel` takes a template, a prefix or a function |
| G38 | `texuli/input` | `type="file"`: `files` is `null` until a pick and resets with `null` |
| G39 | `texuli/layouts/content` (new) | `ContentLayout` for direct use: content as children, host TOC entries, `tocLevels` (2 to 6) and preserved heading ids |
| G40 | `texuli/toggle` | `ToggleGroup` `name` (and `form`): one entry per pressed value |
| G41 | `texuli/toggle` | `ToggleGroup` rest attributes, `bind:ref`, and the Tab stop on the first pressed item |
| G42 | `texuli/number-pin` | `PinInput.Root` typed `name` and other input attributes; `bind:inputRef` forwarded |
| G43 | `texuli/card` | `CardGrid` `maxColumns` |
| G44 | `texuli/input` | `type="number"` and `type="range"` bind a number, or `null` while empty |
| G45 | `texuli/toast` | `pause`, `resume` and `isPaused` on the store (stacked holds by key), and `announcement(id?)` |
| G46 | `@texuli/slides/stage` | The default block check, the built-in free-slide renderer and `migrateDeck` load on first use (`loadBuiltinDeckBlocks`), only when no table brings a block check, a free slide falls back to the built-in renderer, or the deck is not v2; until then the stage validates nothing, and a failed import refuses the deck. A host with `defaultRenderers={false}`, its own `validateBlock`, `free` renderer and `loadTheme` and a v2 deck: 115,885 B to 85,113 B gzip of initial JavaScript in `tests/bundle-graph.test.ts`. The stage's landmark name comes from the deck's title also while it loads |
| G47 | `@texuli/slides/stage` theme | No stage defect: the default `loadDeckLibraryTheme` and the seed generator were already dynamic imports in `0.4.0` (the theme records in the reported first chunk come from a host package that imports the token library); `tests/bundle-graph.test.ts` now checks that a host with its own `loadTheme` has no library records and no generator in its initial graph |

**Breaking changes under `0.x`.** A new minor may break; these need a look
when upgrading from `0.4.0`:

- **`texuli/input`:** with `type="number"` or `type="range"`, `bind:value`
  holds a `number` or `null` (it was the field's text); `onValueChange`
  still receives the text. With `type="file"`, `files` starts as `null`.
- **Caller handlers compose (G26):** a handler you pass (`oninput` on
  `Input`, `Textarea`, `InputGroup` and `TextCounter`; `onclick`,
  `onkeydown` and others on 14 primitive parts and on `CopyButton`) runs
  first and no longer replaces the built-in one. Call
  `event.preventDefault()` in a click or key handler to skip the built-in
  behavior.
- **`Tag`:** the remove button's default name is "Remove {label}" (for
  example "Remove Design"; it was "Remove: Design"). A `removeLabel` prefix
  now gets the label appended without a colon.
- **`toast`:** the store owns the auto-dismiss timers. They count from the
  moment a toast is published, whether or not a `Toaster` is mounted, and
  each toast settles exactly once (`onSettle`).
- **`DeckStage`:** with `defaultRenderers` on (the default), the default
  renderer tables load on first use, so the first stage on a page paints a
  polite loading status (`aria-busy`) for one chunk, also in server-side
  rendering. Await `loadDefaultDeckRenderers()` before mounting to paint at
  once. With `defaultRenderers={false}`, a stage whose tables bring no block
  check, or whose deck is not v2, also waits for one lazy chunk (the
  built-in block support or `migrateDeck`); await `loadBuiltinDeckBlocks()`
  to paint at once. A loading stage is named after its input's title, and
  is unnamed (no landmark) when the input names none.
- **`texuli/layouts/content`:** `TocItem.level` and `TocHeading.level` widen
  from `2 | 3` to `TocLevel` (`2 | 3 | 4 | 5 | 6`); exhaustive checks on the
  old union need the new levels.
- **Callback naming:** the new host callbacks are camelCase props, not DOM
  events: `Composer` `onStop`, `CopyButton` `onCopy` and `onCopyError`,
  toast `onSettle`, and `onValueChange` on the new `FilterBuilder` and
  `AppearanceSwitcher`. `onCopy` and `onCopyError` are not the native
  `oncopy` and `onerror` DOM events.

**New packages and subpaths.**

- `@texuli/editor`: first publication, with the new `@texuli/editor/markdown`.
- `@texuli/charts/sparkline-lite`.
- `@texuli/data/filter-builder`, `@texuli/data/activity/inbox` and
  `@texuli/data/cohort`.
- `texuli/layouts/content` (until now only `blog`, `docs` and `editorial`
  under it).
- `@texuli/astro/appearance`.

**Blueprint spec 0.5.0.** Additive: four new catalog ids,
`data-cohort-table`, `data-notification-inbox` and `data-filter-builder`
(agent-emittable, painted by `@texuli/player`; inbox links at the
`untrusted` tier) and `time-field` (app tier, forms group), for 162 ids. The
`0.4.0 → 0.5.0` migration only stamps `spec`; the digest is pinned in
`packages/spec/versions.json`, and the generated TypeScript and Kotlin are
regenerated. The light `Sparkline` shares the compact `charts-sparkline`
manifest. The catalog's coverage gate lists eight host-composed parts
(`SheetHeader`, `SheetBody`, `SheetFooter`, `SheetCloseButton`,
`BottomNav`, `MobileHeader`, `MobileAppFrame`, `RampLegend`) as exclusions,
raising the exclusion ceiling from 200 to 208 by developer decision.

**Security hardening: linear-time parsing of untrusted text.** Agent or user
text could make some parsers backtrack (regular-expression denial of
service). They now run in linear time:
`@texuli/blocks/text/markdown` (heading, fence and rule lines, emphasis,
links and backticks), the core editor Markdown codec
(`@texuli/core/editor-markdown`, read and write), the catalog's rich text
parser, and the catalog's draft sink scan (`looksExecutable` and the
HTML-tag check). Differential fuzzing matched the old parsers' output. See
[SECURITY](SECURITY.md#17-linear-time-parsing-of-untrusted-text-redos).

**Also in PLAN_009:** the agent service's catalog imports every manifest
group, so its hash matches the site catalog (`apps/agent`, not published).

**Publish order** (`publish.yml`): core, date, spec, drag, deck, tokens,
primitives, texuli, workflows, editor, charts, data, media, chat, blocks,
catalog, tools, astro, player, slides. `@texuli/editor` goes out after
`texuli` (and after `@texuli/core`, `@texuli/primitives` and
`@texuli/tokens`, which it pins); the other dependency rules are those of
`0.4.0` below.

### 0.4.0

Every packable package moves to `0.4.0` together, and every internal
`@texuli/*` dependency between them is pinned to exactly `0.4.0`.

**PLAN_007: drag adoption and interactive blueprints.**

- **Breaking, `@texuli/data`:** `@texuli/data/board` and
  `@texuli/data/tree-view` no longer export `DRAG_THRESHOLD_PX` or
  `indexFromPointer` (`0.3.0` had them). Every drag surface (board, tree
  view, calendar, timeline, grid column moves) now runs on `@texuli/drag`
  with localized `DragMessages`. Replacements:
  - `DRAG_THRESHOLD_PX` (4): the `threshold` option of `createPointerTracker`
    in `@texuli/drag/gesture`, whose default is the same 4 px. There is no
    exported constant; pass `threshold` to change it.
  - `indexFromPointer(middles, y)`: `midpointIndex(midpoints, coordinate)`
    in `@texuli/drag/collision`, which returns the same insertion index for
    ascending midpoints (by binary search).

  *Correction (2026-10-28, reported by Protoyard):* the first version of
  these notes named the subpaths without the exact exports above.
- **`@texuli/primitives`:** a new `@texuli/primitives/sortable` binding
  (`Sortable.Root`, `List`, `Item`, `Handle`) on `@texuli/drag`.
- **Blueprint spec 0.3.0** (ADR-008): envelope `spec`, `state` and `flow`;
  node `bind` and `on`; `$state` and `$data` bindings; the closed actions
  (`setState`, `toggleState`, `moveItem`, `flowGo`, `emit`, `submit`);
  `reorder` (drag as data) and `workflowGraph` (`schemas/workflow.schema.json`);
  migrations from 0.2.0 (`@texuli/spec/migrate`); the state surface and list
  item text rules (`@texuli/spec/surface`); and catalog coverage of 158 ids.
  A 0.2.0 blueprint migrates purely and still validates.
- **`@texuli/catalog`:** JSON coverage for every component and validation
  of the interaction surface (bindings, actions, flows).
- **`@texuli/player`:** paints every agent-emittable id from JSON (data views,
  chat display, sortable lists with a shared drag scope, workflow graphs)
  and runs the closed actions.

**PLAN_008: the deck engine and the v2 slides stage (ADR-009).**

- **New, `@texuli/deck` (first publication):** the framework-free,
  dependency-free deck engine at layer L0: deck model v2
  (`formatVersion: 2`) from JSON or Markdown, navigation, hash routes,
  canvas fit, the presenter protocol, lint, patches, text twins and the
  authoring builder.
- **Breaking, `@texuli/slides`:** a new stage on `@texuli/deck` (canvas,
  routes, chrome, overview, presenter window, 21 layouts, backgrounds, any
  slide-renderable component, v2 print and PPTX), plus the public
  `@texuli/slides/components` and `@texuli/slides/layouts` subpaths for
  hosts. The `0.3.0` model v1 API stays exported and v1 decks migrate on the
  fly, but the stage's defaults change (it writes the URL hash, a click
  advances, slides scale on a fixed canvas), and `@texuli/slides` moves to
  layer L8 with new dependencies on `@texuli/deck` and `@texuli/player`. The
  upgrade path is
  [packages/slides/docs/migration.md](../packages/slides/docs/migration.md).
- **Blueprint spec 0.4.0** (ADR-009 addendum): additive. `layout-deck` and
  `deck-slide` gain optional deck model v2 props, and the
  `0.3.0 → 0.4.0` migration only stamps `spec`. The digest pin is in
  `packages/spec/versions.json`, and the generated Kotlin is regenerated.
  `@texuli/spec@0.4.0` ships these generated sources.
- **`@texuli/catalog` and `@texuli/player`:** the catalog validates v2 deck
  trees; the player offers a `deckHost` seam for `layout-deck` blueprints
  and `chrome={false}` for frameless painting.
- **`@texuli/tools`:** `texuli deck` CLI commands and deck tools on the
  read-only MCP server.
- **Unchanged, for the record:** the chat composer stays host chrome. The
  catalog has no `chat-composer` entry, and the player refuses the id at
  every tier; hosts mount a composer in their own chrome. The
  `CalendarIdentifier` narrowing to `'gregory'` already shipped in `0.3.0`.

**Publish order** (`publish.yml`): core, date, spec, drag, deck, tokens,
primitives, texuli, workflows, charts, data, media, chat, blocks, catalog,
tools, astro, player, slides. `@texuli/deck` goes out before
`@texuli/slides` (and before `@texuli/tools`, which pins it);
`@texuli/drag` before `@texuli/primitives`, `@texuli/data` and
`@texuli/workflows`; `@texuli/workflows` before `@texuli/player`; and
`@texuli/spec` before `@texuli/catalog` and `@texuli/player`.

### History

- `0.8.0` (2026-10-29; merged and published from `main` on 2026-10-29
  UTC): a breaking `0.x` minor for 25 packages, the first publication of
  `@texuli/forms`, `@texuli/canvas` and `@texuli/sheets` (PLAN_010 waves 4
  to 6; see "0.8.0" above), followed by the `0.8.x` patches above. Its
  tarballs ship blueprint spec `0.8.0`; `@texuli/mcp` was in the
  repository only.
- `0.7.0` (2026-10-29; merged and published from `main` on 2026-10-29
  UTC): a breaking `0.x` minor for 22 packages, the first publication of
  `@texuli/document` and `@texuli/pages` (PLAN_010 waves 2 and 3: the
  document engine, the block document editor, collaboration and documents
  as agent data; see "0.7.0" above). Its tarballs ship blueprint spec
  `0.7.0`; `@texuli/forms`, `@texuli/canvas` and `@texuli/sheets` were in
  the repository only.
- `0.6.0` (2026-10-29; merged and published from `main` on 2026-10-29
  UTC): a breaking `0.x` minor for 20 packages, with no first publication
  (PLAN_010 waves 0 and 1: the one API contract, motion, streamed
  blueprints, `@texuli/core/markup` and `zip`, and Protoyard's gaps G48 to
  G85; see "0.6.0" above). Its tarballs ship blueprint spec `0.6.0`;
  `@texuli/document` and `@texuli/pages` were in the repository only.
- `0.5.0` (2026-10-28; merged and published from `main` on 2026-10-29
  UTC): a breaking `0.x` minor for 20 packages, the first publication of
  `@texuli/editor` (PLAN_009; see "0.5.0" above). Its tarballs ship
  blueprint spec `0.5.0` and predate PLAN_010.
- `0.4.0` (2026-10-28): a breaking `0.x` minor for 19 packages, the first
  publication of `@texuli/deck` (PLAN_007 and PLAN_008; see "0.4.0"
  above). Its tarballs ship blueprint spec `0.4.0` and predate PLAN_009.
- `0.3.0` (2026-10-27): a breaking `0.x` minor for 16 packages, the first
  publication of `@texuli/date`. `@texuli/primitives` re-exports
  `CalendarDate` from `@texuli/date` instead of `@internationalized/date`
  (no longer a dependency), and `CalendarIdentifier` is narrowed to
  `'gregory'`; the calendar entry fell from about 13.05 to 5.15 KiB gzip and
  the date picker from about 28.60 to 20.26 KiB. `@texuli/drag@0.3.0` and
  `@texuli/workflows@0.3.0` were first published on 2026-10-28 (UTC) by a
  manual `workflow_dispatch` of `publish.yml` on `main` (run
  https://github.com/DailybotHQ/texuli/actions/runs/40616266068), which
  skipped the other 16 packages because npm already had them. The `0.3.0`
  tarballs ship blueprint spec `0.2.0` and predate PLAN_007 and PLAN_008.
- `0.2.0` (2026-10-27): the first non-prerelease `0.x` line, for the 15
  packages that were packable then. `@texuli/primitives@0.2.0` is immutable
  and still depends on `@internationalized/date`; `0.3.0` replaces it with
  `@texuli/date`.
- `0.1.0-next.0` through `0.1.0-next.3` (previews): `0.1.0-next.0` was the
  name reservation, `0.1.0-next.1` went out on 2026-10-25 (run
  https://github.com/DailybotHQ/texuli/actions/runs/40238083612), and
  `0.1.0-next.2` (the PLAN_006 package fixes) and `0.1.0-next.3` (consumer
  READMEs and two CLI fixes) on 2026-10-27.

### 0.x versioning

Until 1.0.0, a breaking change bumps the minor (`0.9.0` to `0.10.0`) and a
fix bumps the patch (`0.9.0` to `0.9.1`). Consumers pin the exact version or
use `~0.9.0` or `^0.9.0`; for a `0.x` version both ranges accept only
`0.9.x`, so a new minor never arrives unasked. 1.0.0 will be the first stable
release.

## Independent package versions

Texuli uses independent SemVer versions per package, following the independent
package-version model recommended by ADR-002's monorepo strategy. A release in
one package does not require unrelated packages to share its version. Internal
dependency constraints and compatibility still follow the down-only package
graph.

Before a package reaches 1.0.0, its `0.x` minor is the API compatibility line:

- `0.x.y-next.N` is a pre-release. Increment `N` for another candidate on the
  same `0.x.y` line; do not replace or republish an existing version.
- Increment `y` for a backwards-compatible fix that does not add public API.
- Increment `x` for a backwards-compatible public feature or any breaking API
  change. A breaking change gets a new minor because `0.x` has no major-version
  slot to communicate incompatibility.
- Start each new `0.x.y` candidate line at `-next.0`. Once the API contract,
  support window, and stable release gates are accepted, a package may proceed
  to `1.0.0` under a separate developer GO. Packages make that transition
  independently.

For example, a fix candidate can progress from `0.5.1-next.0` to
`0.5.1-next.1`; a new feature or breaking change starts `0.6.0-next.0`.
Pre-release dependencies between Texuli packages use exact compatible
pre-release versions. Ordinary ranges do not select prerelease versions by
default.

## Dist-tags

- **`next`** points to the newest owner-approved version, including any
  future `0.x.y-next.N` or other pre-release. The publish workflow always
  publishes with `--tag next`, so it moves only with a new version and a
  fresh GO. It names `0.9.0` once the publish workflow runs after the merge
  of `release/0.9.0` (the 0.8 line before that; `@texuli/mcp` has no
  earlier version).
- **`latest`** is npm's default install tag, and npm's package page shows
  the README of the version it names. It tracks the newest release, before
  and after 1.0.0: the publish workflow moves it together with `next`
  (owner decision 2026-10-27; before that, `latest` was reserved for 1.0.0
  and stayed on the first upload, `0.1.0-next.0`). It names `0.9.0` once the
  publish workflow runs after the merge of `release/0.9.0` (the 0.8 line
  before that).
  The workflow moves `latest` on every run, so publishing a future
  pre-release without moving `latest` needs a workflow change first.
- Dailybot v4 and other production consumers must pin exact package versions
  in their manifests and lockfiles. They must not rely on a moving dist-tag;
  `next` is for deliberate pre-release integration only.

Promoting a version to a dist-tag does not change that version's bytes. Publish
a new immutable version for every fix or change; never overwrite an existing
version.

## Workspace dependencies and consumers

Task 172 made every published dependency an intentional semver range: the
published package manifests pin internal `@texuli/*` dependencies to exact
versions (for `0.9.0`, every internal pin is exactly `0.9.0`, and on the
`release/0.10.0` branch every one is exactly `0.10.0`; compatibility
between Texuli packages is exact, per "Independent package versions" above), while the private development
manifests (`apps/website`, `apps/agent`, `packages/examples`) keep the
pnpm `workspace:` protocol. The release packer enforces that boundary
(`scripts/packages.ts` rewrites `workspace:` to the exact workspace version
and fails the pack when a published manifest would still carry
`workspace:*`, `link:`, `file:` or `0.0.0`).

This changes consumers from workspace resolution to registry resolution.
Applications such as Dailybot v4 and Protoyard must install published package
versions, record compatible exact versions in their lockfiles, and validate
the packed artifacts in their own consumer gates. A local workspace install
does not prove that a clean consumer can resolve the dependency graph. The
workspace remains the development source; the published semver ranges define
the package-to-package contract outside this repository.

## Compatibility map: npm, spec and native

| Surface | Version | Where it is pinned |
| --- | --- | --- |
| 26 npm packages | `0.9.0` (dist-tags `latest` and `next`) | Each package manifest, with exact `0.9.0` internal pins; published by the publish workflow after the merge of `release/0.9.0` (before it: the 0.8 line for 25 packages, `0.8.0` on 2026-10-29 UTC plus the `0.8.x` patches in "0.8.x patch releases (G86)"; `0.7.0` for 22 packages on 2026-10-29 UTC; `0.6.0` for 20 packages on 2026-10-29 UTC; `0.5.0` for 20 packages on 2026-10-29 UTC; `0.4.0` for 19 packages on 2026-10-28; `0.3.0` for 16 packages on 2026-10-27 plus drag and workflows on 2026-10-28, run 40616266068; `0.2.0` for 15 packages on 2026-10-27; previews `0.1.0-next.3` and `0.1.0-next.2` on 2026-10-27; `0.1.0-next.1`: 2026-10-25, run 40238083612). |
| `@texuli/forms`, `@texuli/canvas`, `@texuli/sheets` | `0.9.0` (first published as `0.8.0`) | Each package manifest (and `FORMS_PACKAGE_VERSION`, `CANVAS_PACKAGE_VERSION`, `SHEETS_PACKAGE_VERSION`); `@texuli/forms` and `@texuli/canvas` are published after `@texuli/editor`, once `@texuli/core`, `@texuli/deck`, `@texuli/document`, `@texuli/drag` and `texuli` are out, and `@texuli/sheets` after `@texuli/blocks`, once `@texuli/date` and `@texuli/data` are out; no published package depends on them. In development (ADR-012, ADR-015), pre-1.0. |
| `@texuli/document`, `@texuli/pages` | `0.9.0` (first published as `0.7.0`) | Each package manifest (and `PAGES_PACKAGE_VERSION`); `@texuli/document` is published after `@texuli/core` and `@texuli/deck` and before `@texuli/tools` and `@texuli/pages`, which depend on it; `@texuli/pages` after `@texuli/player`. In development (ADR-010, ADR-011), pre-1.0. |
| `@texuli/editor` | `0.9.0` (first published as `0.5.0`) | `packages/editor/package.json` (and `EDITOR_PACKAGE_VERSION`); published after `texuli`, which it depends on. In development (ADR-003), pre-1.0. |
| `@texuli/deck` | `0.9.0` (first published as `0.4.0`) | `packages/deck/package.json`; published after `@texuli/drag` and before `@texuli/document`, `@texuli/tools` and `@texuli/slides`, which depend on it. In development (PLAN_008, ADR-009), pre-1.0. |
| `@texuli/drag`, `@texuli/workflows` | `0.9.0` (first published as `0.3.0` on 2026-10-28) | Each package manifest. In development, pre-1.0. |
| `@texuli/mcp` | `0.9.0` (first published as `0.9.0`) | `packages/mcp/package.json`, with `@texuli/tools` pinned to exactly its own version; published right after `@texuli/tools`. In development (ADR-019), pre-1.0. |
| Blueprint spec on `release/0.10.0` (in development, not on npm) | `0.10.0`, digest `5858625bffea7972f78a2b0f127f75359848aeb5c4792764b17ca45b2d7de4ca` | `packages/spec/versions.json`; the workspace's generated sources carry the `0.10.0` stamp. Ships only when `@texuli/spec@0.10.0` publishes; a stamp-only migration from `0.9.0`. |
| Blueprint spec | `0.9.0`, digest `497df4d3b0c67d53483163ebd9bd73733b52caf5f8e2966478f1cf860e6f9d9d` | `packages/spec/versions.json`; every generated file carries the spec version and digest in its stamp. Shipped by `@texuli/spec@0.9.0`; a stamp-only migration from `0.8.0`. |
| Blueprint spec in `@texuli/spec@0.8.0` | `0.8.0`, digest `f6b6388280d247eb9c3106a925111f35b90d1ec3b59c23652542f06a9f103daf` | The 0.8 line's generated sources carry the `0.8.0` stamp. |
| Blueprint spec in `@texuli/spec@0.7.0` | `0.7.0`, digest `43e44fa9a198d337d686b4e2d86882a06a676ae1e1c1f02d023b3a525795a8b2` | The previous release's generated sources carry the `0.7.0` stamp. |
| Blueprint spec in `@texuli/spec@0.6.0` | `0.6.0`, digest `37141b85b9ab9f02af849a62a9c97ba729d6c5c2705130290bcdf45b308ea4cc` | The `0.6.0` release's generated sources carry the `0.6.0` stamp. |
| Blueprint spec in `@texuli/spec@0.5.0` | `0.5.0`, digest `1ba15e8b082f68140c4b2768b8fd69c9f760e655dd117fac756f356a71525b2d` | The `0.5.0` release's generated sources carry the `0.5.0` stamp. |
| Blueprint spec in `@texuli/spec@0.4.0` | `0.4.0`, digest `fac29f542b16ddb78ab401c508e5b8346f655991c56e25aa811f4931661a8cb3` (after `0.3.0`, digest `a95f691514814a39e5f7f1b98b1598ab08af0e2151a2c019c51eb8d58c0a7848`, which was never on npm) | The `0.4.0` release's generated sources carry the `0.4.0` stamp. |
| Blueprint spec in `@texuli/spec@0.3.0` | `0.2.0`, digest `d9eccaba1826e7d87648a4a33787d873245592dda843607a10b2c68a77f1806f` | The `0.3.0` release's generated sources carry the `0.2.0` stamp. |
| Native modules (`texuli-spec`, `texuli-compose`) | source-consumed, no artifact | `native/` builds from `packages/spec/generated/kotlin`; planned Maven coordinates `com.texuli` (decision [ADR-005](DECISIONS.md)). Not published. |

- A normative spec change takes a new spec version and a fresh digest pin in
  `packages/spec/versions.json` (`tests/spec.test.ts` enforces the pin);
  regeneration re-stamps the generated TypeScript and Kotlin.
- Consumers pin exact npm versions ("Dist-tags" above) and can assert the
  contract they built against via the digest stamp in `@texuli/spec`'s
  generated sources.
- The native modules are compatible with exactly the spec version whose
  generated Kotlin they consume — the conformance module tests against the
  same committed sources, so there is no separate native version to track
  until a Maven Central publication exists (owner GO; ADR-005).

## Publication waves

Tasks 174–178 establish this dependency order. Completing a task or passing a
gate does not publish anything; **each wave requires a separate, fresh owner
GO** for the exact packages, versions, tarball digests, and `next` or `latest`
tag. Any GO for Task 170's name reservation covers only that reservation.
Since 0.8.0 (owner decision 2026-10-29), merging a pull request that bumps
the versions into `main` is that GO: once CI passes on the merge commit,
`publish.yml` publishes the new versions on its own ([CI](CI.md)).

| Task | Wave | Planned package order | Approval boundary |
| --- | --- | --- | --- |
| 174 | Foundations | `@texuli/core`, then `@texuli/tokens` | Fresh owner GO for the exact Task 174 package/version set after its release gates; core precedes tokens. |
| 0.3.0 | Date foundation | `@texuli/date`, before `@texuli/primitives` (first published in `0.3.0`) | Fresh owner GO for the exact version; `@texuli/date` precedes the primitives that depend on it. |
| 0.3.0 | Drag foundation | `@texuli/drag`, before `@texuli/primitives`, `@texuli/data` and `@texuli/workflows` (first published as `0.3.0` on 2026-10-28) | Fresh owner GO for each version; it must be published **before** every package that depends on it (`@texuli/primitives`, `@texuli/data`, `@texuli/workflows`). |
| 175 | Controls | `@texuli/primitives` | Fresh owner GO after its core dependency and behavior, accessibility, size, pack, and consumer gates pass. |
| 176 | Styled package | `texuli` | Fresh owner GO after core, primitives, and tokens compatibility plus style and consumer gates pass. |
| 0.5.0 | Editor | `@texuli/editor`, after `texuli` (first published in `0.5.0`) | Fresh owner GO for each version; it must be published **after** `@texuli/core`, `@texuli/primitives`, `@texuli/tokens` and `texuli`, which it depends on. |
| 0.3.0 | Workflows | `@texuli/workflows`, after `@texuli/drag` and `texuli`, before `@texuli/player` (first published as `0.3.0` on 2026-10-28) | Fresh owner GO for each version; it must be published **before** `@texuli/player`, which depends on it. |
| 0.4.0 | Deck engine | `@texuli/deck`, after `@texuli/drag`, before `@texuli/tools` and `@texuli/slides` (first published in `0.4.0`) | Fresh owner GO for each version; it must be published **before** `@texuli/document`, `@texuli/slides` and `@texuli/tools`, which depend on it. |
| 0.7.0 | Document engine | `@texuli/document`, after `@texuli/core`, `@texuli/deck` and `@texuli/primitives`, before `@texuli/tools` and `@texuli/pages` (first published in `0.7.0`) | Fresh owner GO for each version; it must be published **after** `@texuli/core` and `@texuli/deck` and **before** `@texuli/tools` and `@texuli/pages`, which depend on it. |
| 0.7.0 | Document editor | `@texuli/pages`, after `@texuli/player` and before `@texuli/slides` (first published in `0.7.0`) | Fresh owner GO for each version; it must be published **after** `@texuli/document`, `@texuli/editor`, `@texuli/blocks`, `@texuli/player`, `@texuli/drag`, `@texuli/primitives`, `@texuli/tokens`, `texuli` and `@texuli/core`, which it depends on. |
| 0.8.0 | Forms and canvas | `@texuli/forms` and `@texuli/canvas`, after `@texuli/editor` (first published in `0.8.0`) | Fresh owner GO for each version; `@texuli/forms` must be published **after** `@texuli/core` and `texuli`, and `@texuli/canvas` **after** `@texuli/core`, `@texuli/deck`, `@texuli/document`, `@texuli/drag` and `texuli`, which they depend on. No published package depends on either. |
| 0.9.0 | Local MCP server | `@texuli/mcp`, right after `@texuli/tools` (first published in `0.9.0`) | Fresh owner GO for each version (the merge of `release/0.9.0`); it must be published **after** `@texuli/tools`, which it pins exactly. No published package depends on it. |
| 0.8.0 | Spreadsheets | `@texuli/sheets`, after `@texuli/blocks` and before `@texuli/catalog` (first published in `0.8.0`) | Fresh owner GO for each version; it must be published **after** `@texuli/core`, `@texuli/date`, `@texuli/data` and `texuli`, which it depends on. No published package depends on it. |
| 177 | Domain packages | `@texuli/charts`, `@texuli/data`, `@texuli/media`, `@texuli/chat`, `@texuli/blocks` | Fresh owner GO for the exact ready set after dependency order, package checks, size, pack, and consumer gates pass. |
| 178 | Catalog and integration tools | `@texuli/catalog`, `@texuli/tools`, `@texuli/astro`, `@texuli/player`, `@texuli/slides`, `@texuli/spec` (the order in `publish.yml`; all six went out in the 2026-10-25 `0.1.0-next.1` run) | Fresh owner GO for each exact release set after implementation, dependency, pack, consumer, and relevant website/build gates pass. |

The date, drag, workflows, deck, editor, document, pages, forms, canvas,
sheets and mcp rows are in `.github/workflows/publish.yml` (order: core, date,
spec, drag, deck, tokens, primitives, document, texuli, workflows, editor,
forms, canvas, charts, data, media, chat, blocks, sheets, catalog, tools,
mcp, astro, player, pages, slides; `@texuli/editor` goes out from `0.5.0`,
after `texuli`, `@texuli/document` and `@texuli/pages` from `0.7.0`,
`@texuli/forms`, `@texuli/canvas` and `@texuli/sheets` from `0.8.0`, and
`@texuli/mcp` from `0.9.0`).
Every published package is `0.9.0`, and every internal dependency between
them is pinned to exactly `0.9.0`; the workflow refuses to start publishing while any listed
package is still `0.0.0`. `pnpm verify:packages` still refuses any
`0.0.0` or `workspace:` range in a published manifest, the guard that keeps
an unversioned dependency out. The publish loop skips versions npm already
has, so a package changed after `0.9.0` needs a new version before its
change reaches npm.

Each outward wave must also pass its task's `pnpm verify:packages` gate and
the applicable tests, type checks, layer checks, behavior, visual, size,
website, and clean-consumer checks from [TESTING_GUIDE](TESTING_GUIDE.md).
Record the exact version, source commit, tarball digest, tests, and chosen
dist-tag before requesting GO. A failure stops downstream waves; fix it in a
new version rather than reusing a published version.

## Honesty in documentation

The npm name reservation (`0.1.0-next.0`) was a prerelease publication by
the owner, not a supported product release. `0.9.0` is a release but not a
stable one: keep `private: true`, the pre-1.0 status, and the absence of a
stable 1.0.0 clear until the corresponding approved stable release actually
exists. A passing pack gate proves only that a tarball
was built and checked; it does not prove that it was published, supported, or
usable by consumers.

## Skill release

The agent skill (`skills/texuli/`) is released apart from the npm packages,
by `.github/workflows/skill-release.yml`. Skill releases are tagged from
`skill-v0.2.0` on (`skill-v0.3.3` is the latest when the `0.9.0` packages
are released). A checkout install is described in
[SKILL_INSTALLATION](SKILL_INSTALLATION.md).

**Tags.** Skill releases are tagged `skill-vX.Y.Z`. The npm publish
workflow triggers on `v*` tags; GitHub matches tag filters against the
whole tag name, so `skill-v0.3.0` never starts an npm publish, and a
package tag never starts a skill release (the skill workflow does not
trigger on tags at all).

**Trigger.** The workflow runs on `workflow_run` after the `CI` workflow
completes for a push to `main`, and only when CI succeeded. It is skipped
when the head commit is a release commit (`chore(release):`) or carries
`[skip release]`, and when no commit since the last `skill-v` tag touches
`skills/texuli/`.

**Version.** The router's quoted `version:` in `skills/texuli/SKILL.md` is
the only source; the release writes it into every `SKILL.md`
(`pnpm check:skill` fails on a sub-skill that disagrees). The bump comes from
the Conventional Commits that touch `skills/texuli/` since the last stable
`skill-vX.Y.Z` tag: a breaking change (`type!:` or a `BREAKING CHANGE:`
footer) is a major, `feat` a minor, anything else a patch. Before 1.0.0 a
breaking change bumps the minor, as for the packages. When the router is
already ahead of the last tag (the first release, or a deliberate 1.0.0
set by hand in a reviewed commit), that version is released as written.

**Steps.** With `contents: write` only in the release job:

1. `pnpm exec tsx scripts/check-skill.ts --release-plan` decides the version
   and tag; `--release <version>` syncs the version into every `SKILL.md`,
   stamps `skills/texuli/CHANGELOG.md` (the commit subjects, then the folded
   body of the hand-written `## [Unreleased]` block, which is left empty),
   regenerates `SHA256SUMS` (`--write-sums`), refreshes the dogfood mirror
   `.agents/skills/texuli/` and its `skills-lock.json` hash, and validates the
   pack.
2. The release commit `chore(release): texuli skill X.Y.Z [skip release]`
   and the annotated tag `skill-vX.Y.Z` are pushed together with
   `git push --atomic`: either both land or neither does, so a rejected push
   (branch protection, or `main` moved on) leaves no dangling tag.
3. `git archive` builds `texuli-skill-X.Y.Z.tar.gz` from the tag (the pack
   only, unpacking to `texuli/`); `SHA256SUMS` lists the archive and every
   unpacked file, and the job checks both with `sha256sum -c` and
   `setup.sh --verify --dir … --expect-version` before publishing.
4. `gh release create` publishes the GitHub Release with the stamped
   changelog section as its notes and both assets.
5. A separate job with read-only permissions and no persisted credentials
   installs the new tag with the skills CLI, pinned by its tree URL, into a
   temp project and asserts the installed version and checksums.

Pushing the release commit to a protected `main` needs the
`AUTOMATION_GITHUB_TOKEN` secret (a token allowed to bypass branch
protection); without it the job falls back to `GITHUB_TOKEN` and the
atomic push fails cleanly. Pre-releases of the skill are not automated.

**Provenance.** Releases are checksummed, not signed. The pack's own
`SHA256SUMS` travels with the files; only the release `SHA256SUMS` asset is
independent provenance ([TRUST.md](../skills/texuli/TRUST.md#provenance)).
