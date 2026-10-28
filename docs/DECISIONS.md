# Decisions

Architecture decisions for Texuli: the options, the choice, why, and how to
reverse it. Newest last.

## ADR-001: Keep `@internationalized/date` for calendar and date math

Superseded by ADR-006 as of the `0.3.0` release. The `0.2.0` packages still
reflect this decision.

- **Date:** 2026-10-23 · **Decided by:** the project owner.
- **Context:** Texuli builds its components, primitives and charts from scratch
  and has no third-party runtime dependency except this one. The date
  primitives (Calendar, DateField, TimeField, DatePicker, DateRangePicker) need
  calendar-correct date math.
- **Options:** (1) write our own Gregorian-only math on `Intl`; (2) keep
  `@internationalized/date`; (3) wait for the platform's Temporal API.
- **Choice:** keep `@internationalized/date` (Apache-2.0, maintained alongside
  a widely used accessibility-focused component stack, one tiny helper
  dependency). It is domain infrastructure, like `Intl`, not a component
  library.
- **Why:** it covers what is expensive and risky to rebuild: non-Gregorian
  calendars (Japanese eras, Buddhist, Hebrew, Islamic variants, Persian,
  Ethiopic, Indian), calendar-correct arithmetic (month-end overflow, leap
  years, era changes) and time zones with daylight-saving gaps and overlaps.
  Rewriting it would add risk to a sensitive area for little gain.
- **Reverse when:** Temporal is broadly available in the browsers Texuli
  supports. Then the date primitives move to the platform API and Texuli has no
  third-party runtime dependency. Only `@texuli/primitives` imports it, so the
  change stays inside that package.

## ADR-002: Use browser-native MediaRecorder for WebM export (D13)

- **Date:** 2026-10-25 · **Ratification:** lead-ratified as a
  constraint-forced routine choice under the no-new-dependency rule; the
  developer may override this decision.
- **Context:** `@texuli/media/export` needs a local WebM path for composed
  animations. The export must not upload frames or introduce an encoder
  dependency without explicit developer supply-chain approval.
- **Options:** (1) use browser-native `MediaRecorder` with `canvas.captureStream`
  and an explicit frame clock; (2) bundle a JavaScript or native encoder —
  rejected because adding an encoder dependency requires a separate developer
  supply-chain GO, which is not granted; (3) defer WebM export.
- **Choice:** use browser-native `MediaRecorder` only. Draw validated animation
  samples into an owned canvas, capture at the requested fixed frame rate using
  a monotonic, cancellable frame clock, record the VP8 WebM profile at a fixed
  4 Mbps video bitrate and 1-second chunk interval, and report progress as
  frames are submitted. Canceling stops the recorder and every stream track
  and clears pending frame deadlines.
  No worker is used and no worker network access is introduced.
  Frame timing and settings are deterministic within the selected browser
  profile; encoded bytes are not promised to be bit-identical across browser
  engines or hardware.
- **Why:** this stays inside the browser's built-in media capability, keeps
  rendering local, adds no supply-chain surface, and makes pacing, resource
  release and progress observable through an injectable recorder/canvas
  boundary.
- **Reverse when:** the developer grants supply-chain approval or supported
  browser coverage makes native recording insufficient. Swap the encoder
  boundary while preserving the frame-sampling, progress, cancellation and
  output contracts; an encoder dependency requires explicit developer GO.

## ADR-003: Rich text editor architecture

- **Date:** 2026-10-25 · **Ratification:** proposed by the editor lane of
  PLAN_005 for the lead and the developer. Nothing is implemented yet; the
  developer may override any part.
- **Context:** Texuli has no rich text editor. The developer asked for one
  built from scratch, with no editor dependency, that edits the same content
  the sink-free renderers display (blocks `text` Markdown and catalog rich
  text). Core (L0) is framework-free and cannot import blocks (L5) or catalog
  (L6), and the CSP allows only the `svelte-trusted-html` Trusted Types
  policy. The long-form contract, with the vocabularies, keyboard map and
  tests, is [EDITOR_ARCHITECTURE](EDITOR_ARCHITECTURE.md).
- **Options and choices,** one per contract. Each line gives the chosen
  option, one rejected alternative, and how to reverse it:
  - **Layers.** **Chosen:** editing texels in core (`text-segment`,
    `input-intent`, `composition`, `editable-selection`), and a new L4
    `@texuli/editor` with the framework-free `model` and `paste` subpaths, a
    lazy entry and a `ui` chunk. Blocks and catalog import `model` downward;
    chat (L4) gets a rich composer through the host `composer` snippet.
    **Rejected:** the document model in core, which would make L0 a content
    format. **Reverse:** move `model` into core, with a re-export at the same
    subpath.
  - **Document model.** **Chosen:** a versioned (`version: 1`) block tree
    with flat text runs and mark sets. The closed node set is `paragraph`,
    `heading` 1–4, `list` (bullet, ordered, todo), `code`, `quote`, `divider`
    and `media` (a host-resolved reference). The closed mark set is `strong`,
    `em`, `strike`, `code` and `link`. Any addition is a new version with a
    migration. **Rejected:** a nested inline tree, which allows several
    stored forms of the same text. **Reverse:** only the adapters see the
    model from outside, so the internals can change behind them.
  - **Selection.** **Chosen:** points made of a block id and a UTF-16
    offset, snapped to graphemes, plus a node selection for void blocks.
    **Rejected:** DOM ranges as the source of truth. **Reverse:** points
    pass through one mapping module.
  - **Transforms.** **Chosen:** pure `{ doc, selection }` to result
    functions with refusal issues and structural sharing, validated by a
    seeded random-edit test. **Rejected:** mutating the DOM and reading it
    back. **Reverse:** a step log can wrap the same functions.
  - **History.** **Chosen:** a snapshot stack (`past`, `present`, `future`,
    at most 200 steps) with typing merges, like the image editor and timeline
    histories. **Rejected:** inverse patches, which need a correct inverse
    for every transform. **Reverse:** add invertible steps if collaborative
    editing is planned; the host API stays.
  - **Input and IME.** **Chosen:** `contenteditable`, with every cancelable
    `beforeinput` handled as a command. During composition the DOM is left
    alone, and at `compositionend` the change is diffed back as one edit.
    The keyboard map and input rules are in the companion doc. **Rejected:**
    a hidden textarea with a drawn caret, which loses input methods,
    spellcheck and screen-reader editing. **Reverse:** the input layer is two
    texels and can be replaced on its own.
  - **Accessibility.** **Chosen:** a labelled `role="textbox"`
    `aria-multiline` surface and a roving `role="toolbar"`. Polite,
    translatable announcements cover mark, block and indent changes, undo,
    paste results and refusals, but not characters. **Rejected:**
    `role="application"`. **Reverse:** roles live only in the `ui` subpath.
  - **Paste and links.** **Chosen:** an owned string tokenizer maps
    clipboard HTML through an allowlist into the vocabulary and never builds
    a DOM. Every href passes `safeHref`. Pasted and autolinked URLs are
    always `untrusted`, and the `trust` prop defaults to `untrusted`.
    **Rejected:** `DOMParser`, a Trusted Types sink that would need a new
    policy. **Reverse:** the platform HTML Sanitizer, behind the same `paste`
    subpath, once it passes the CSP matrix.
  - **Interchange.** **Chosen:** the closed Markdown subset is the wire
    format, through an owned `toMarkdown`/`fromMarkdown` codec. Tree adapters
    live in blocks and catalog. Property tests assert parity with the blocks
    parser and the catalog adapter. Strike degrades with a diagnostic until
    catalog rich text adds it. **Rejected:** catalog `RichTextInline` as the
    model, because it is upward, inline-only and has no strike. **Reverse:**
    once blocks and catalog adopt the model, the adapters become re-exports.
  - **Long documents and size.** **Chosen:** keyed full rendering with
    `content-visibility: auto`. The budget posture is one frame per keystroke
    at the planned 2,000-block limit, measured by the perf suite when the
    editor lands; that is a target, not a measurement. Budget rows for the
    new subpaths are added by the owner, and no existing budget is raised.
    **Rejected:** windowed rendering, which breaks in-page search,
    screen-reader browsing and long selections. **Reverse:** window with the
    data package's virtual list, or lower the limit, as a new decision.
- **Why:** the model stays the only source of truth, so behavior is
  deterministic and testable without layout. Content never becomes HTML at
  any step. The editor reuses the patterns the repository already proves (a
  framework-free model with refusals and snapshot history, a lazy UI split,
  and the URL policy tiers).
- **Reverse when:** see each contract above. A reversal of the layer
  placement or the wire format is a new ADR.
- **Amendment (2026-10-25, PLAN_005 task 8):** the model took the layer
  reversal path above. It lives in core as the `editor-model`,
  `editor-transforms`, `editor-history`, `editor-keymap` and
  `editor-markdown` subpaths ([core-editor](../packages/core/docs/core-editor.md)),
  outside the root barrel. **Why:** the lead's task brief placed it in core,
  and no new package (an owner approval) is needed before blocks and the
  catalog can adopt it. The Svelte package, the paste import and the DOM
  selection mapping stay planned at L4. **Reverse:** move the subpaths into
  `@texuli/editor/model` and re-export them from core under the same names.
- **Status note (2026-10-26):** the L4 package now exists as
  `@texuli/editor` (`editor`, `toolbar`, `link-dialog`, `controller`,
  `paste`), with the DOM selection mapping in `./editor`. It stays private
  at `0.0.0` and is never packed (`NEVER_PACKED` in `scripts/packages.ts`);
  the model remains in core as amended above.

## ADR-004: Versioned blueprint envelope with host-owned activation

- **Date:** 2026-10-25 (retro-recorded; the envelope shipped with the
  first version of the catalog) · **Ratification:** retro-recorded by the
  PLAN_005 final review from the shipped `@texuli/catalog/envelope`
  contract; the developer may override this decision.
- **Numbering note:** the catalog docs and sources referenced this
  decision as "ADR-003" from the first commit, expecting a DECISIONS.md
  entry that was never written; the number was later taken by the rich
  text editor ADR. This entry takes ADR-004 and the catalog references
  were updated to it.
- **Context:** the agent service emits blueprints a host must be able to
  trust: what catalog they were written for, who produced them, their
  lifecycle state and what edits were applied. The same artifact crosses
  the untrusted/developer tier boundary, so self-declared trust fields
  cannot be trusted from input.
- **Options:** (1) a versioned envelope wrapping one catalog tree with
  strict field rules, host-owned lifecycle and an edit-provenance log;
  (2) trust the producer's declared status and activation — rejected
  because producer-controlled status fields let an untrusted emitter mark
  itself active; (3) no envelope, host-side metadata only — rejected
  because the metadata must travel with the artifact and be validated by
  the same sink-free pipeline.
- **Choice:** the versioned envelope (`format: texuli-blueprint`,
  `version: 1`) with: strict field validation (`unknown-field`,
  `prototype-key`, display-string and URL-policy rules); lifecycle where
  only validation earns `validated`, only the host's owner flow calls
  `activateEnvelope` (digest-pinned to the reviewed tree), and any edit
  returns the envelope to `draft` and drops activation provenance; a
  provenance log capped at 500 entries; and a `profile` capability field
  where `portable` fails closed (`unsupported-profile`) until an id is
  audited portable. Declared `status`, `activatedBy` and `tier` are never
  trusted from input (warnings `status-ignored`, `activation-ignored`,
  `tier-ignored`); validation receipts are host records, not credentials.
- **Why:** trust transitions stay host-owned and auditable, every field is
  validated by the same closed pipeline that renders the tree, and the
  artifact carries its provenance without gaining a say in its own trust.
- **Reverse when:** a wire-format change is needed — a new `version` with
  a migration, decided as a new ADR; the fail-closed portable profile
  reverses by auditing and listing portable ids.

## ADR-005: Maven coordinates `com.texuli` for the native modules

- **Date:** 2026-10-25 · **Decided by:** the project owner.
- **Context:** the native Gradle modules (`texuli-spec`, `texuli-compose`) are
  consumed in place from this repository. A future Maven Central publication
  needs coordinates fixed now so embedding code and docs can name them, and
  immutable artifacts make late renames costly.
- **Options:** (1) no coordinates — keep everything in-repo; (2) `com.texuli`
  — the reverse-DNS of texuli.com, owned by Dailybot, Inc.; (3)
  `io.github.dailybothq` — a GitHub-account namespace, verifiable without a
  domain.
- **Choice:** `com.texuli`, artifacts `texuli-spec` and `texuli-compose`,
  versions tracking the npm release line they mirror (`0.3.0`).
- **Why:** texuli.com is owned and deployed, so the Central Portal can verify
  the namespace by DNS, and the group matches the Kotlin package names the
  sources already use (`com.texuli.spec.runtime`, `com.texuli.compose`).
  `io.github.…` would name the host rather than the product.
- **Reverse when:** before a first publication a rename is two lines per
  build file and free. After a first Central release artifacts are immutable
  — a rename lands as new coordinates, never an overwrite. Publication itself
  (Central Portal account, GPG key, `maven-publish` wiring) remains planned
  and needs an owner GO.

## ADR-006: Own Gregorian date arithmetic in `@texuli/date`

- **Date:** 2026-10-27 · **Decided by:** the project owner.
- **Context:** `@internationalized/date` is the sole third-party runtime
  dependency of Texuli's headless component packages. The owner prioritizes
  owning this behavior and removing that dependency. Texuli's date picker
  stores Gregorian ISO dates; the calendar primitive previously exposed
  additional calendar systems through its `calendar` prop.
- **Options:** (1) keep the external library; (2) implement the Gregorian
  date-only contract in an owned framework-free package; (3) reproduce all
  calendar systems and time-zone features of the external library.
- **Choice:** add L0 `@texuli/date` with `CalendarDate`, Gregorian arithmetic,
  ISO parsing, locale week starts, and time-zone-aware `today`. The calendar
  component accepts `calendar="gregory"`; other calendar systems are not
  supported in this contract. The change ships in the `0.3.0` release, the
  first publication of `@texuli/date`; the `0.2.0` packages keep the
  `@internationalized/date` behavior and dependency.
- **Why:** this is the behavior the date picker uses today, and it eliminates
  the runtime dependency without adopting the much larger maintenance scope
  of 13 calendar systems. The public calendar restriction is a breaking
  change, so it ships in a new pre-1.0 minor, `0.3.0`.
- **Reverse when:** another calendar system becomes a product requirement.
  Extend `@texuli/date` with a tested calendar implementation and widen the
  `CalendarIdentifier` type, or make the additional implementation an
  optional adapter. Reintroducing a third-party library requires a new
  supply-chain decision.

## ADR-007: Own a general-purpose drag engine in `@texuli/drag`

- **Date:** 2026-10-27 · **Decided by:** the project owner (PLAN_007).
- **Context:** drag behavior lives in seven feature-local copies (board, tree
  view, grid columns, calendar, data timeline, media timeline and the website
  builder outline), with duplicated thresholds and index math and English-only
  announcements in two of them. The owner's goal is that Texuli alone builds
  any interface, including workflows, lists, boards, trees and canvases, with
  a general-purpose drag system at least as capable as SortableJS, modular and
  composable across every package. Architecture, performance and security are
  non-negotiable.
- **Options:** (1) adopt a third-party drag library; (2) add drag texels to
  `@texuli/core`; (3) a new L0 package, `@texuli/drag`, framework-free with
  no runtime dependencies, plus a thin Svelte binding in
  `@texuli/primitives/sortable`; (4) build workflows at L5 to reuse the chart
  network layout.
- **Choice:** option 3. `@texuli/drag` exports small subpaths (`sortable`,
  `collision`, `modifiers`, `auto-scroll`, `gesture`, `spatial`, `graph`,
  `messages`, `testing`) around one session state machine. Strategies,
  collisions, modifiers and messages are pluggable. Because the layer guard
  refuses same-layer imports, the engine takes `announce`, text direction and
  navigation intents from the caller; the L1 binding maps keys through
  `@texuli/core/keyboard` and announcements through `@texuli/core/announcer`.
  Four interaction kinds stay separate: OS file drop (unchanged), continuous
  gestures (`gesture`), sortable interactions, and graph editing.
  `@texuli/workflows` is a new L4 package built on `@texuli/drag`, with a
  framework-free `model` and `layout`. Both packages start private at `0.0.0`
  and stay "in development" until an owner-approved publish wave.
- **Why:** an owned engine keeps the dependency count at zero, gives one
  accessibility and i18n contract to every surface (`packages/drag/docs/contract.md`),
  and lets every package compose the same pieces. Core stays small: drag
  changes do not touch the most widely imported package, and drag gets its
  own release line. Workflows at L4 keep editing independent of chart math;
  `@texuli/blocks` (L5) can adopt `workflows/layout` later.
- **Reverse when:** a measured gap (capability, performance or size) cannot be
  closed in the owned engine. Then adopt a library behind the same subpath
  contract, which needs a new supply-chain decision.

## ADR-008: Blueprint spec 0.3.0 — bindings, closed actions, events, prop schemas, drag and workflows as data

- **Date:** 2026-10-27 · **Decided by:** the project owner (PLAN_007).
- **Context:** the goal is that complete interfaces are built from validated
  JSON. Today every one of the 133 spec ids reports `capability: "unknown"`;
  board, tree view, calendar, files, map, chat and workflows have no spec id;
  14 player loaders have no spec id and 92 spec ids have no loader; local
  state, actions and host data exist only in `@texuli/player`, so the
  blueprint schema and the Kotlin twin cannot see them; `array` and `object`
  props are opaque; spec migrations are planned but not built.
- **Options:** (1) keep behavior in the player and extend only manifests;
  (2) an additive spec minor that moves state, actions, events and prop
  schemas into the contract, with migrations; (3) allow host-supplied code in
  blueprints.
- **Choice:** option 2, spec `0.3.0` (additive; `0.2.0` documents migrate).
  A node is `{ id, props, children | slots, when, bind, on }`. New `$defs`:
  `binding` (`{"$state": name}` or `{"$data": name}`), a **closed** `action`
  set (`setState`, `toggleState`, `moveItem`, `flowGo`, `emit` to a host
  intent, `submit`), `eventMap` (`on: { <event>: action[] }`) and
  `propSchema` (a dialect subset, so array and object props carry item
  schemas). Drag is data: a container prop
  `reorder: { bind, axis, group, accepts, locked }` drives the closed
  `moveItem` reducer. Workflows are data: a `workflow-graph` id whose `graph`
  validates against `schemas/workflow.schema.json` (at most 500 nodes and
  2,000 edges) with closed `nodeTypes`. Every normative change is pinned in
  `versions.json`; pure `migrations/<from>-<to>.ts` functions run before
  validation; a manifest `deprecated: { since, replacement }` warns for one
  minor before removal. Enforcement: catalog coverage (every public component
  has a manifest or a reasoned, shrink-only exclusion), player loader parity,
  example round-trips, codegen freshness and a hostile corpus, all in Vitest.
- **Why:** option 1 leaves the contract unable to describe whole interfaces
  and keeps the Kotlin twin blind. Option 3 breaks the no-sink, closed-catalog
  security model. A closed action set keeps blueprints data-only while making
  them able to express interaction, and the drift gates make the "any
  interface from JSON" claim checkable.
- **Reverse when:** a needed interaction cannot be expressed with the closed
  set. Add a new action in a later minor with its schema, reducer, tests and
  migration; never open the set to code.
- **Addendum (2026-10-27, implementation design):** the action discriminator
  is `op` (as in `condition` and `editOp`); the envelope gains optional
  `spec`, `state` and `flow`, so the Kotlin twin sees what `$state` names;
  children keep the per-child `slot` field (no second `slots` encoding, which
  would make edit paths and canonical hashes ambiguous); migrations are
  exported from the root of `@texuli/spec`; catalog components gain
  `events` (a closed event vocabulary) and `bindable`; `reorder` also takes
  `pull` (`move`, `clone`, `none`) and `disabled`. Every new semantic
  diagnostic has a Kotlin twin, so native fixture parity holds. Until a
  publish wave ships `0.3.0`, later normative changes inside the same plan
  amend the `0.3.0` pin in `versions.json` rather than minting new minors.

## ADR-009: A from-scratch deck engine (`@texuli/deck`) and a full presentation stage (`@texuli/slides`)

- **Date:** 2026-10-27 · **Decided by:** the project owner (PLAN_008).
- **Context:** `@texuli/slides` 0.3.0 has a validated model, reveal steps,
  presenter tools, print and PPTX, but no URL routing, fixed-canvas scaling,
  touch, blackout, laser, help, copy link, auto-slide, auto-animate,
  imperative API, i18n or per-slide backgrounds, and it cannot place most
  Texuli components on a slide. Protoyard's deck generator
  (`@protoyard/decks`, `@protoyard/decks-ui`) has the most complete model and
  stage behavior we own (21 layouts, 13 backgrounds with a contrast scrim,
  style, outline, fragments, controls registry, hash routing, canvas fit,
  chrome, overview, presenter, print, lint, patch), built on zod and
  Protoyard's runtime. The developer asked for one complete library built from
  scratch on the Texuli ecosystem, generating decks from JSON and Markdown,
  with any Texuli component on a slide, which Protoyard then consumes.
  Research inputs: `.dwp/plans/PLAN_008_slides_complete_library/analysis_results/adr-inputs/`.
- **Options:** (A) engine subpaths inside `@texuli/slides` (L7) with an
  import-guard test; (B) a new L0 engine package plus the stage moved to L8;
  (C) keep one package and add features. For components: (1) the stage imports
  `@texuli/player`; (2) the host injects every renderer; (3) a default
  registry built from blocks and player painters that hosts can replace or
  extend.
- **Choice:** B with 3.
  - **`@texuli/deck` (L0, new):** framework-free, DOM-free, zero runtime
    dependencies. Owns the canonical model v2, an owned schema kit
    (combinators as data giving all-issues validation, `Infer` types and a
    JSON Schema 2020-12 export from one source; no zod), the untrusted loader,
    the JSON and Markdown codecs, the 21-layout catalog with
    `useWhen`/`dontUseWhen`/`pacing`, style and background data with contrast
    math, fragments and steps, transitions, navigation (incl. vertical stacks),
    hash routing, the controls registry and input decisions, canvas fit,
    auto-slide, the presenter protocol, quality lint, full RFC 6902 patch,
    text and outline twins, the typed builder, brief outlines and templates.
  - **`@texuli/slides` (moves L7 → L8):** the Svelte 5 stage, chrome,
    overview, presenter, print and PPTX export, layout and background
    rendering. It depends on `@texuli/deck` and `@texuli/player`, and ships a
    default component registry (every blocks family plus every slide-renderable
    player painter) that a host can replace or extend per catalog id.
    Component families load lazily; only mounted slides trigger imports.
  - **Model v2** (`formatVersion: 2`): Protoyard's shape is the base — `style`,
    `slides` discriminated by `layout` (`<catalog layout>` | `free` |
    `component` | `custom`), `outline`, `hidden`, step labels, backgrounds
    (13 presets, hex colors with contrast check, image/video specs), the
    8 fragment effects plus a highlight tone and v1's `items` kind,
    transitions `none`, `fade`, `fade-up`, `slide`, `zoom`, `morph`, aspects
    16:9, 4:3, 9:16, 1:1. Texuli adds `meta` (title, locale, description),
    catalog or embedded themes with modes, masters on free slides, notes up
    to 6,000 characters. More than 32 steps on a slide is an error. One
    `DeckDiagnostic` shape (code, severity, path, jsonPath, message, fix,
    slideId, source line/column) capped at 200 issues. Migration detects the
    input shape (Texuli v1 deck, Texuli grammar tree, Protoyard deck) and is
    lossless; lifting a master to a layout is a lint suggestion, never
    automatic. The chart layout uses the Texuli chart block; the Protoyard
    importer converts its ChartSpec.
  - **Markdown dialect:** reveal.js is an inspiration, not a compatibility
    target. An owned linear parser with line/column diagnostics: closed-key
    scalar frontmatter, `---` slides and `--` vertical stacks, `Note:`,
    `<!-- .slide: -->` and `<!-- .element: -->` comments with a closed
    attribute set (reveal aliases mapped), fragments, code `[1-2|4-6]` steps,
    `$$` block math, `layout="<id>"` with `:::` regions for every layout, and
    `::: component <catalog-id> {…}` fences with a bounded JSON body. HTML,
    iframes, `class`, `style` and `on*` are refused with a diagnostic. Inline
    text keeps the Markdown string `@texuli/blocks` already paints.
    `deckToMarkdown` is canonical; supported features round-trip.
  - **Math:** an owned TeX subset to a MathML node tree (no `\href`,
    `\color`, `\html*` or macros), rendered as MathML Core. Block math ships
    in this plan; inline math inside text blocks needs an opt-in in
    `@texuli/blocks` and is a follow-up.
  - **Components on slides:** "any component" means every slide-renderable
    catalog component and every blocks family. App shells, overlays, route
    hosts and the deck wrappers themselves are excluded with reasons.
    Untrusted decks are read-only by default except the interactive blocks
    (poll, quiz, calculator, counter, tabs, reveal, chart controls, form) on
    in-memory state; mutating data views, sortable lists, workflow editing and
    embeds need a host capability. Component props are validated in a second
    phase by the registry at the host's tier.
  - **Security:** the deck never carries its own trust tier. The engine
    checks URL syntax only; the stage applies `@texuli/core/url-policy` at
    paint with the host's tier (`untrusted` by default).
  - **i18n:** every stage string comes from overridable messages with English
    defaults; `meta.locale` becomes `lang`.
  - **Versions:** both packages ship as `0.4.0`; `@texuli/deck` publishes
    before `@texuli/slides` in the waves. Publication needs a separate GO.
- **Why:** a package boundary enforces "standalone like reveal.js" better
  than a test inside a Svelte package, and lets Protoyard, Node tools and
  agents use the engine without Svelte. The layer guard forbids same-layer
  imports, so the stage must sit above the player to render the full catalog
  by default; an injectable registry keeps hosts (Protoyard's runtime state,
  embeds, custom slides) in control without forking. Protoyard's model is the
  most complete and battle-tested; Texuli's themes, masters and closed
  security model are kept on top.
- **Reverse when:** the stage at L8 blocks a lower package from presenting
  decks (then move the default registry into an L8 integration package and
  return the stage to L7), or the engine needs a framework (it must not:
  split the framework part out instead).
- **Addendum (2026-10-28, PLAN_008 T-catalog-player): spec 0.4.0.** The
  `layout-deck` and `deck-slide` manifests now project deck model v2 (9:16
  aspect, `slide`/`zoom`/`morph` transitions, motion, navigation, outline,
  slide layout, background, steps and component slides), which changes the
  projected catalog and the normative digest, so the blueprint spec takes an
  additive minor, `0.4.0` (`versions.json` pin
  `fac29f542b16ddb78ab401c508e5b8346f655991c56e25aa811f4931661a8cb3`).
  `migrations/0.3.0-0.4.0.ts` only restamps `spec`. The generated Kotlin
  under `packages/spec/generated/kotlin` is regenerated; the native runtime
  twin's interaction contract (ADR-008) is unchanged. `@texuli/catalog`
  validates deck trees with `validateDeckDraft` and maps them to and from
  deck v2 without depending on `@texuli/deck`; `@texuli/player` keeps
  painting decks as a document and exposes a `deckHost` seam (and
  `chrome={false}`) so a host with `@texuli/slides` presents them on the
  stage.
