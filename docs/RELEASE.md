# Release and version policy

**Status:** policy for future, owner-authorized releases. This page documents
the intended process; it does not publish packages or grant release authority.

## Current npm status

`0.4.0` is the current release of all 19 packable packages (owner GO
2026-10-28): the 18 packages of the `0.3.0` line plus `@texuli/deck`, which
is published for the first time in `0.4.0`. The publish workflow publishes
from `main` after the merge, from the verified tarballs with signed
provenance, and moves both the `latest` and `next` dist-tags to the
published version, so a bare `npm install texuli` or `pnpm add texuli` gets
it. `@texuli/drag`, `@texuli/workflows` and `@texuli/deck` are still **in
development** (pre-1.0).

`0.4.0` is a breaking `0.x` minor: it carries the PLAN_007 and PLAN_008
changes listed under "0.4.0" below, none of which were in the `0.3.0`
tarballs. It is still pre-1.0, not a stable release: see "0.x versioning"
below. Workspace manifests remain `private: true`, and every future version
and wave requires a fresh, explicit developer GO. Publishing never
overwrites a published version.

`0.5.0` is **prepared, not published**: the PLAN_009 changes listed under
"0.5.0 (unreleased, prepared)" below are in the repository, but no package
has been bumped to `0.5.0` and npm still serves `0.4.0`. This page is
updated after that release is actually published.

### Not on npm

- `@texuli/examples` is never packed (`NEVER_PACKED` in
  `scripts/packages.ts`).
- `@texuli/editor` is publishable from `0.5.0` (PLAN_009 G17, owner approval
  2026-10-28): `pnpm verify:packages` packs it and the publish workflow
  publishes it after `texuli`, but it is not on npm yet. Its version stays
  the `0.0.0` placeholder until the release bumps it, and the publish
  workflow refuses to publish a `0.0.0` version.

### 0.5.0 (unreleased, prepared)

**Not on npm.** Prepared on the PLAN_009 branch: the packages are still at
`0.4.0` (and `@texuli/editor` at the `0.0.0` placeholder) until the release
task bumps every packable package to `0.5.0` with exact internal pins and the
developer gives a fresh GO. It closes the gaps Protoyard found while adopting
Texuli from npm (PLAN_007 there); the ids below match its register.

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
  once.
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

**Also in the branch:** the agent service's catalog imports every manifest
group, so its hash matches the site catalog (`apps/agent`, not published).

### Known gaps and next steps (planned for the next version, not started)

0.5.0 closes every gap Protoyard reported. These are the known gaps on the
way to a library that every product consumes from npm with one consistent
contract. They are planned, not done; the detailed backlog with sources is
in the PLAN_009 analysis (`next-version-backlog.md`).

- **One API contract everywhere.**
  - `ref`: styled components that wrap a primitive without an element ref
    (menus, combobox, select, popover, navigation menu, sheet and command
    parts, `Radio`, `NumberField.Root`, `Tooltip`) don't take `bind:ref`
    yet; the primitives need ref support first.
  - Caller handlers: menu items, navigation menu, toast, tooltip, tree,
    scroll area, splitter and the sortable handle can still drop or replace
    a caller's handler. 0.5.0 fixed the inputs and 14 primitive parts.
  - A library-wide test that every component spreads rest props, takes
    `ref` and composes handlers, so new components can't regress.
  - Conventions written in [STANDARDS](STANDARDS.md): handler order
    (`Input` and `Textarea` sync their value before the caller; the
    primitives run the caller first), what `headingLevel` sets (`Board`
    columns vs the `NotificationInbox` heading), `onValueChange` payloads
    (`Input` reports text while a numeric `bind:value` holds a number), and
    camelCase callbacks (`onStop`, `onCopy`) vs DOM events.
- **Proof from npm for every package.** The consumers harness installs the
  packed tarballs of 5 packages (core, tokens, primitives, texuli, data) in
  Vite, Astro and SvelteKit apps; extend it to all 20 packable packages, with
  a smoke import of every subpath.
- **Size.** Share the chart families' data-table fallback styles (about
  4.1 KB gzip of lazily loaded CSS); trim the entries raised in 0.5.0
  (`@texuli/catalog` root, `@texuli/data/grid-editing`,
  `@texuli/blocks/structure/renderers`); `@texuli/primitives/date-field` has
  43 B of headroom; confirm that importing only the `texuli/layouts/mobile`
  model helpers drops the new components.
- **Slides.** With lazy default renderers, `DeckStage` renders a loading
  status on the server; preload the defaults in server builds so no-JS and
  SEO output keep the slides.
- **Chat.** Per-conversation scroll positions (`scrollKey`), a label for each
  message article, and an option for `actions` to replace the built-in send
  button.
- **Smaller items.** A toast replaced by `id` keeps only the newest
  `onSettle`; `Pagination` `stableCount` writes a numeric `style` attribute
  (strict `style-src-attr` hosts need a hash per value); the catalog `tag`
  manifest still states the old remove label; `texuli/icons` needs an
  `icons.css.d.ts`; the website's layer data should name the 0.5.0 data views
  and editor Markdown so the [ARCHITECTURE](ARCHITECTURE.md) layer table can.

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
primitives, texuli, workflows, editor, charts, data, media, chat, blocks,
catalog, tools, astro, player, slides (`@texuli/editor` from `0.5.0`). `@texuli/deck` goes out before
`@texuli/slides` (and before `@texuli/tools`, which pins it);
`@texuli/drag` before `@texuli/primitives`, `@texuli/data` and
`@texuli/workflows`; `@texuli/workflows` before `@texuli/player`; and
`@texuli/spec` before `@texuli/catalog` and `@texuli/player`.

### History

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

Until 1.0.0, a breaking change bumps the minor (`0.4.0` to `0.5.0`) and a
fix bumps the patch (`0.4.0` to `0.4.1`). Consumers pin the exact version or
use `~0.4.0` or `^0.4.0`; for a `0.x` version both ranges accept only
`0.4.x`, so a new minor never arrives unasked. 1.0.0 will be the first stable
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

For example, a fix candidate can progress from `0.4.1-next.0` to
`0.4.1-next.1`; a new feature or breaking change starts `0.5.0-next.0`.
Pre-release dependencies between Texuli packages use exact compatible
pre-release versions. Ordinary ranges do not select prerelease versions by
default.

## Dist-tags

- **`next`** points to the newest owner-approved version, including any
  future `0.x.y-next.N` or other pre-release. The publish workflow always
  publishes with `--tag next`, so it moves only with a new version and a
  fresh GO. It names `0.4.0` once the publish workflow runs after the merge
  (`0.3.0` before that).
- **`latest`** is npm's default install tag, and npm's package page shows
  the README of the version it names. It tracks the newest release, before
  and after 1.0.0: the publish workflow moves it together with `next`
  (owner decision 2026-10-27; before that, `latest` was reserved for 1.0.0
  and stayed on the first upload, `0.1.0-next.0`). It names `0.4.0` once the
  publish workflow runs after the merge (`0.3.0` before that).
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
versions (for `0.4.0`, every internal pin is exactly `0.4.0`; compatibility
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
| 19 npm packages | `0.4.0` (dist-tags `latest` and `next`) | Each package manifest, with exact `0.4.0` internal pins; published by the publish workflow after the merge (before it: `0.3.0` for 16 packages on 2026-10-27 plus drag and workflows on 2026-10-28, run 40616266068; `0.2.0` for 15 packages on 2026-10-27; previews `0.1.0-next.3` and `0.1.0-next.2` on 2026-10-27; `0.1.0-next.1`: 2026-10-25, run 40238083612). |
| `@texuli/deck` | `0.4.0` (first publication) | `packages/deck/package.json`; published after `@texuli/drag` and before `@texuli/tools` and `@texuli/slides`, which depend on it. In development (PLAN_008, ADR-009), pre-1.0. |
| `@texuli/drag`, `@texuli/workflows` | `0.4.0` (first published as `0.3.0` on 2026-10-28) | Each package manifest. In development, pre-1.0. |
| Blueprint spec | `0.4.0`, digest `fac29f542b16ddb78ab401c508e5b8346f655991c56e25aa811f4931661a8cb3` (after `0.3.0`, digest `a95f691514814a39e5f7f1b98b1598ab08af0e2151a2c019c51eb8d58c0a7848`, which was never on npm) | `packages/spec/versions.json`; every generated file carries the spec version and digest in its stamp. Shipped by `@texuli/spec@0.4.0`. |
| Blueprint spec `0.5.0` (prepared, not on npm) | `0.5.0`, digest `1ba15e8b082f68140c4b2768b8fd69c9f760e655dd117fac756f356a71525b2d` | `packages/spec/versions.json` in the repository; ships only when `@texuli/spec@0.5.0` is published. |
| Blueprint spec in `@texuli/spec@0.3.0` | `0.2.0`, digest `d9eccaba1826e7d87648a4a33787d873245592dda843607a10b2c68a77f1806f` | The previous release's generated sources carry the `0.2.0` stamp. |
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

| Task | Wave | Planned package order | Approval boundary |
| --- | --- | --- | --- |
| 174 | Foundations | `@texuli/core`, then `@texuli/tokens` | Fresh owner GO for the exact Task 174 package/version set after its release gates; core precedes tokens. |
| 0.3.0 | Date foundation | `@texuli/date`, before `@texuli/primitives` (first published in `0.3.0`) | Fresh owner GO for the exact version; `@texuli/date` precedes the primitives that depend on it. |
| 0.3.0 | Drag foundation | `@texuli/drag`, before `@texuli/primitives`, `@texuli/data` and `@texuli/workflows` (first published as `0.3.0` on 2026-10-28) | Fresh owner GO for each version; it must be published **before** every package that depends on it (`@texuli/primitives`, `@texuli/data`, `@texuli/workflows`). |
| 175 | Controls | `@texuli/primitives` | Fresh owner GO after its core dependency and behavior, accessibility, size, pack, and consumer gates pass. |
| 176 | Styled package | `texuli` | Fresh owner GO after core, primitives, and tokens compatibility plus style and consumer gates pass. |
| 0.3.0 | Workflows | `@texuli/workflows`, after `@texuli/drag` and `texuli`, before `@texuli/player` (first published as `0.3.0` on 2026-10-28) | Fresh owner GO for each version; it must be published **before** `@texuli/player`, which depends on it. |
| 0.4.0 | Deck engine | `@texuli/deck`, after `@texuli/drag`, before `@texuli/tools` and `@texuli/slides` (first published in `0.4.0`) | Fresh owner GO for each version; it must be published **before** `@texuli/slides` and `@texuli/tools`, which depend on it. |
| 177 | Domain packages | `@texuli/charts`, `@texuli/data`, `@texuli/media`, `@texuli/chat`, `@texuli/blocks` | Fresh owner GO for the exact ready set after dependency order, package checks, size, pack, and consumer gates pass. |
| 178 | Catalog and integration tools | `@texuli/catalog`, `@texuli/tools`, `@texuli/astro`, `@texuli/player`, `@texuli/slides`, `@texuli/spec` (the order in `publish.yml`; all six went out in the 2026-10-25 `0.1.0-next.1` run) | Fresh owner GO for each exact release set after implementation, dependency, pack, consumer, and relevant website/build gates pass. |

The date, drag, workflows and deck rows are in `.github/workflows/publish.yml`
(order: core, date, spec, drag, deck, tokens, primitives, texuli, workflows,
editor, charts, data, media, chat, blocks, catalog, tools, astro, player,
slides; `@texuli/editor` goes out from `0.5.0`, after `texuli`).
Every packable package is `0.4.0`, and every internal dependency between
them is pinned to exactly `0.4.0`. `pnpm verify:packages` still refuses any
`0.0.0` or `workspace:` range in a published manifest, the guard that keeps
an unversioned dependency out. The publish loop skips versions npm already
has, so a package changed after `0.4.0` needs a new version before its
change reaches npm.

Each outward wave must also pass its task's `pnpm verify:packages` gate and
the applicable tests, type checks, layer checks, behavior, visual, size,
website, and clean-consumer checks from [TESTING_GUIDE](TESTING_GUIDE.md).
Record the exact version, source commit, tarball digest, tests, and chosen
dist-tag before requesting GO. A failure stops downstream waves; fix it in a
new version rather than reusing a published version.

## Honesty in documentation

The npm name reservation (`0.1.0-next.0`) was a prerelease publication by
the owner, not a supported product release. `0.4.0` is a release but not a
stable one: keep `private: true`, the pre-1.0 status, and the absence of a
stable 1.0.0 clear until the corresponding approved stable release actually
exists. A passing pack gate proves only that a tarball
was built and checked; it does not prove that it was published, supported, or
usable by consumers.

## Skill release

The agent skill (`skills/texuli/`) is released apart from the npm packages,
by `.github/workflows/skill-release.yml`. **No skill release has been cut
yet**: the first one happens on the first push to `main` after this
workflow lands, when the run's conditions below hold. Until then the pack
is installed from a checkout ([SKILL_INSTALLATION](SKILL_INSTALLATION.md)).

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
