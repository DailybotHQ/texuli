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
- **Status note (2026-10-28, PLAN_009 G17):** on the owner's approval the
  package became publishable: it left `NEVER_PACKED`, gained
  `@texuli/editor/markdown` and joined the publish workflow after `texuli`.
  It is first published with `0.5.0`.

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
  versions tracking the npm release line they mirror (`0.8.0`).
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

## ADR-010: Document sync: an owned CRDT behind an op-log transport

- **Date:** 2026-10-28 · **Ratification:** decided by the PLAN_010
  architecture task under the developer's trust pre-authorization; nothing
  is implemented yet, and the developer may override this decision.
- **Context:** PLAN_010 adds collaborative documents, and the canvas, sheets
  and dashboards that follow need the same merge. Texuli owns its code and
  adds no third-party runtime dependency (no CRDT library), engines are
  framework-free, the library ships no storage engine (`dexie` is banned by
  the layer guard), and every remote input is hostile until validated. The
  rich text model (ADR-003) gives blocks runtime-only ids and a snapshot
  history, neither of which survives concurrent editing. Requirements:
  offline editing that merges later, per-user undo, comments that stay
  anchored while text moves around them, presence, suggestions and version
  history.
- **Options:**
  1. **An owned op log with host ordering.** A server (or the host) assigns
     one total order; clients send operations and rebase their pending ones
     with transform functions (operational transformation). Small metadata
     and simple storage, but it needs a sequencer online to converge, every
     pair of operation kinds needs a transform (quadratic in kinds, and the
     tree move is notoriously hard to transform), and long offline sessions
     rebase badly.
  2. **An owned CRDT only.** Replicas merge in any order with no server.
     Works offline and peer to peer, but carries tombstones and per-item ids,
     and without a defined transport every host invents its own wire format.
  3. **Both: CRDT merge semantics under an op-log transport interface.** The
     CRDT decides the result; operations travel as an append-only, causally
     stamped log through a host adapter. A server that orders operations is
     just one adapter; ordering is optional, never required for
     convergence.
- **Decision:** option 3, as the framework-free `@texuli/document/sync`
  subpath ([ADR-011](#adr-011-document-packages-texulidocument-l1-engine-and-texulipages-l8-editor)):
  - **Identity.** Every operation has an id `(replica, counter)` with a
    Lamport clock; the replica id is host-supplied (random per session).
    Operations carry their causal dependencies as a version vector, are
    delivered at least once in any order, and are deduplicated by id and
    buffered until causally ready.
  - **Text and every ordered list:** an owned sequence CRDT with
    non-interleaving inserts (the Fugue left/right-origin design), stored as
    run-length items so typing a word costs one item, not one per character.
    Marks are anchored to item ids with per-mark expand rules (`strong`,
    `em`, `strike`, `code` grow at their end; `link` never grows), so
    concurrent formatting composes.
  - **Block tree:** a move-safe tree CRDT (the replicated move operation:
    moves ordered by Lamport timestamp, applied with undo-do-redo, and a move
    that would create a cycle is skipped deterministically). Sibling order
    is a sequence CRDT position, so concurrent inserts and moves converge.
  - **Properties:** a last-writer-wins register per node property (Lamport
    timestamp, then replica id).
  - **Transport:** a `SyncAdapter` (`send(batch)`, `subscribe(onBatch)`,
    optional `loadSnapshot`/`saveSnapshot`, and an ephemeral presence
    channel). Texuli ships an in-memory adapter (tests and same-page panes)
    and a `BroadcastChannel` adapter (tabs); network transports and
    persistence (WebSocket, IndexedDB, a server) are host adapters.
  - **Offline:** local operations append to the log and the host's adapter
    persists them; on reconnect both sides exchange what the other's version
    vector lacks. No step needs a server online.
  - **Undo:** local and selective. Each local transaction records its
    inverse intent and undo emits new operations (delete what it inserted,
    revive what it deleted, move back when the old parent still exists,
    rewrite the previous property value), never a rewind of shared history.
    The ADR-003 snapshot history stays for unsynced editors; synced documents
    use the operation-based undo, which is the reversal ADR-003 foresaw.
  - **Comments and suggestions:** a comment anchors to a pair of item ids
    (start and end, each with a side), so it follows the text through
    concurrent edits; when its whole range is deleted the thread is kept as
    "orphaned" with its quoted text. Block comments anchor to block ids.
    Suggestions are operations tagged with a suggestion id (inserts carry a
    suggested-insert mark, deletes a suggested-delete mark); accepting or
    rejecting emits ordinary operations.
  - **Presence:** ephemeral and never in the log: replica, a host-provided
    display name, a token color index and cursor anchors as item ids, expired
    30 seconds after the last heartbeat.
  - **Version history:** named snapshots of (version vector, state); restore
    emits the operations that turn the current state into the snapshot,
    so restoring is itself collaborative and undoable.
  - **Compaction:** tombstones are dropped only below a version the host
    reports as stable across replicas; until then they are kept, within
    the document caps.
  - **Hostile input:** every remote batch is validated before integration
    (operation shape, id ranges, payload bytes, at most 10,000 operations per
    batch, the document's own caps and node vocabulary). Integration is
    linear in the batch plus the touched runs. A merge can never produce a
    document that fails the document schema. Sync is not authorization:
    the host decides who may write.
  - **Reuse:** the subpath is generic and imports nothing else in
    `@texuli/document` (an import-guard test enforces it). The canvas uses
    the tree (frames hold shapes), registers (geometry and style) and a
    sequence (z-order, shape text); sheets use sequences for row and column
    order and a register map keyed by stable row and column ids, so
    inserting a row never collides with a concurrent cell edit; dashboards
    use a sequence of widgets with register layouts.
- **Why:** convergence without a server is the only model that honors
  offline editing and peer panes, and it removes the quadratic transform
  table and the tree-move transform, which are where operational
  transformation systems fail. A transport interface keeps hosts in control
  of networking and storage, which the library must not own. Anchoring by
  item id is what keeps comments, cursors and suggestions stable.
- **Consequences:**
  - **Packages and layers:** the subpath lives in `@texuli/document` (L1);
    `@texuli/canvas` and `@texuli/data/dashboard` (L4) and `@texuli/sheets`
    (L5) import it downward. No new package for sync.
  - **Subpaths and budgets:** `@texuli/document/sync` loads lazily (only a
    collaborative session imports it); its cap is set at measured + 4% when
    it lands. No existing budget grows.
  - **Spec:** none. Sync is host-to-host, not agent output; agents edit
    documents through validated patches
    ([ADR-011](#adr-011-document-packages-texulidocument-l1-engine-and-texulipages-l8-editor)), which the engine turns into operations.
  - **Native twin:** none in PLAN_010; a Kotlin replica is planned.
  - **Tests:** seeded convergence property tests (random concurrent
    operations delivered in random orders and duplicated reach identical
    states), move-cycle tests, undo tests, and hostile batches with time
    bounds.
- **Reverse when:** a measured gap (metadata size or merge speed at the
  document caps) cannot be closed in the CRDT. Keep the `SyncAdapter` and
  operation shapes and swap the merge for host-ordered rebasing behind the
  same subpath; adopting a third-party CRDT needs a new supply-chain
  decision.

- **Addendum (2026-10-29, PLAN_010 T-canvas, 0.8.0): the canvas on the shared
  sync and graph geometry.** `@texuli/canvas/sync` binds the canvas to this
  subpath as planned (shapes are tree nodes whose sibling order is the
  z-order, geometry and style are registers, shape text is a sequence; the
  projection is validated by the canvas schema).
  The side-aware edge curve (`sideCurveControls`, `sideCurvePath`) moved
  from `@texuli/workflows` down to `@texuli/drag/graph`, so canvas
  connectors and workflow edges route on one geometry instead of two
  copies; `@texuli/workflows` re-uses it unchanged (its tests still pass),
  and the `@texuli/drag/graph` cap grew to measured + 4%. Reverse by moving
  the curve back up if the two editors need different routing; the canvas
  would then carry its own copy.

## ADR-011: Document packages: `@texuli/document` (L1 engine) and `@texuli/pages` (L8 editor)

- **Date:** 2026-10-28 · **Ratification:** decided by the PLAN_010
  architecture task under the developer's trust pre-authorization; the
  developer may override this decision.
- **Context:** PLAN_010 adds block documents (a page editor and reader,
  nested pages, columns, embeds, paged export, collaboration). The pieces
  already exist at different layers: the rich text model and Markdown
  codec in `@texuli/core` (L0), the deck engine and its owned schema kit in
  `@texuli/deck` (L0), the editor surface in `@texuli/editor` (L4), the
  content blocks in `@texuli/blocks` (L5), and the player (L7) that paints
  any catalog component. The layer guard refuses same-layer imports, so an
  L0 engine could use neither the core text model nor the deck schema kit.
- **Options:**
  1. **One Svelte package** holding model and UI. Simple, but Node tools,
     agents and the native twin could not use the model without Svelte, and
     framework-free engines are a project rule.
  2. **An L0 engine plus an L8 editor**, as proposed. The L0 engine would
     have to duplicate the text model, the Markdown codec and the schema
     kit, because L0 packages cannot import each other.
  3. **An L1 framework-free engine plus an L8 editor.** The engine imports
     `@texuli/core` (text model, Markdown codec) and `@texuli/deck` (schema
     kit, deck validation) downward and stays DOM-free; the editor sits above
     the player so it can paint any catalog component.
- **Decision:** option 3.
  - **`@texuli/document` (L1, new, framework-free, DOM-free, depends on
    `@texuli/core` and `@texuli/deck`).** Subpaths: `.`, `model` (the
    format and types), `schema` (the validator and its JSON Schema export,
    on the deck schema kit), `ops` (typed operations and a bounded RFC 6902
    patch, like `@texuli/deck/authoring`), `markdown` (import and export
    through the linear core codec), `paged` (the pagination engine: page
    sizes, margins, breaks, headers and footers, over a measurer the view
    supplies), `docx`, `pdf`
    ([ADR-016](#adr-016-static-output-targets-and-i18n)) and `sync`
    ([ADR-010](#adr-010-document-sync-an-owned-crdt-behind-an-op-log-transport)).
    The engine imports nothing that touches the DOM, which an import-guard
    test enforces, as in `@texuli/deck`.
  - **The format:** `{ format: "texuli-document", formatVersion: 1, meta,
    page, blocks, annotations }`. Blocks carry persisted ids (unique, at most
    64 characters), which the core text model's runtime ids map onto. Text
    blocks are the core editor vocabulary (paragraph, heading, list, code,
    quote, divider, media) with its runs and marks. Document blocks add
    `columns` and `column`, `callout`, `toggle`, `page-link` (a nested page
    is its own document, resolved by the host, which keeps every document
    within the 2,000-block editor target of ADR-003), and two embed kinds:
    `block` wraps any `@texuli/blocks` family block (`{ family, type,
    props }`, so documents reuse the blocks vocabulary instead of copying
    it), and `embed` holds a `component` (a one-node catalog blueprint),
    `deck` (deck model v2), `sheet` or `canvas` payload, inline up to a byte
    cap or as a host-resolved `ref`. `annotations` holds comment threads,
    suggestions and named versions, apart from content; exports drop them
    by default.
  - **Validation in two phases** (the slides precedent): the engine
    validates structure and closed vocabularies at the untrusted tier,
    validates embedded decks with `@texuli/deck`, and checks URL syntax only;
    payloads that belong to higher layers (blocks props, catalog
    components, sheets, canvases) are validated again by their own
    validators when the editor paints them, at the host's tier
    (`untrusted` by default).
  - **`@texuli/pages` (L8, new, Svelte 5).** Subpaths: `.`, `editor`,
    `reader`, `paged` (the paged view and print), `collab` (comments,
    suggestions, history and presence UI; lazy), `export` (download actions
    that lazily load `@texuli/document/docx` and `pdf`) and `styles.css`.
    Text is edited through `@texuli/editor`; non-text blocks are void,
    node-selectable blocks; each column holds its own editor surface with
    arrow-key handoff. Block drag uses `@texuli/drag`; the slash menu is an
    APG combobox-with-listbox on the owned primitives. `block` nodes paint
    with the `@texuli/blocks` renderers, `component` embeds with the player
    (a one-node blueprint validated again at the host's tier), `sheet` and
    `canvas` embeds with their packages' read-only views (lazy).
  - **Decks inside documents:** `@texuli/slides` is also L8, so pages cannot
    import it. A deck embed paints through the player as a document by
    default, and a host that has `@texuli/slides` passes its stage through
    the player's existing `deckHost` seam.
  - **Relation to `@texuli/editor`:** the editor stays the rich text surface
    and gains what pages needs (void block renderers through a snippet,
    persisted id mapping), without depending on documents. Its single-user
    snapshot history stays; synced sessions use the operation-based undo of
    ADR-010.
  - **Relation to `@texuli/blocks`:** blocks stays the vocabulary and
    renderer of content blocks and gains no dependency on documents.
  - **Agents:** spec 0.7.0
    ([ADR-012](#adr-012-spec-evolution-one-additive-minor-per-release-wave))
    adds an agent-emittable `document` catalog id whose `doc` prop carries the
    document format, and agents edit documents with bounded RFC 6902
    patches (at most 1,000 operations, `test` operations encouraged) that
    the engine applies, validates and, for synced documents, turns into
    ADR-010 operations by an id-keyed tree diff.
- **Why:** an L1 engine reuses the linear Markdown codec, the text model and
  the schema kit instead of forking them, while staying framework-free and
  usable from Node, agents and the native twin. L8 is the only place that
  can paint the full catalog through the player, as ADR-009 established for
  the slides stage. Wrapping blocks instead of copying them keeps one
  content vocabulary.
- **Consequences:**
  - **Layers:** `LAYERS` in `scripts/check-layers.ts` gains
    `@texuli/document: 1` and `@texuli/pages: 8` when each package lands;
    the layer table in this repository's ARCHITECTURE and the website's
    architecture layer data change in the same commit (the website section
    contract test compares them).
  - **Owner-held:** two new workspace packages (`pnpm install` by the
    owner), budget rows at measured + 4%, and the publish workflow order
    (`@texuli/document` after `@texuli/deck`, `@texuli/pages` after
    `@texuli/player`). Both are first published with 0.7.0, after a GO.
  - **Spec:** a `document` id and `schemas/document.schema.json` in 0.7.0;
    the schema is exported by `@texuli/document` and pinned in the spec with
    a freshness test, because the spec (L0) cannot import the engine.
  - **Native twin:** generated Kotlin types and the document diagnostics
    in 0.7.0 (validation parity); painting documents natively is planned.
- **Reverse when:** the engine needs nothing from core or deck (then it can
  drop to L0), or a lower package must present documents (then move the
  painting registry into an L8 integration and the editor down, as ADR-009
  describes for slides). The engine must never take a framework; split the
  framework part out instead.

- **Addendum (2026-10-29, PLAN_010 T-doc-collab): `@texuli/document/collab`.** The document-to-CRDT binding (projection, diff, commit, comments, suggestions, versions and presence for documents) is its own subpath, `collab`, next to `sync`: ADR-010 keeps `sync` free of any other `@texuli/document` import so canvas, sheets and dashboards can reuse it, and the binding needs the model, ops and schema. `@texuli/pages/collab` is its UI.

- **Addendum (2026-10-29, PLAN_010 0.8.0): host seams for canvases and
  forms.** The `documentHost` pattern is the rule for every engine the
  player could import but should not load eagerly:
  - **`canvasHost`** (T-canvas). `@texuli/canvas` is L4, below the player,
    so a direct import was allowed, but the canvas validator alone is about
    10 KB gzip and would sit in the player's first-load chunk for every
    blueprint. The player injects the host's `checkCanvas` into
    `validateDraft` and hands a valid `canvas` root to `present`;
    `@texuli/canvas/host` (`createCanvasPlayerHost`) mounts the viewer
    lazily. Without a host a canvas is refused (`canvas-unchecked`).
  - **Shape style is `paint`.** A canvas shape's fill, stroke, stroke
    width, dash and opacity live in a field named `paint`, not `style`: the catalog's sink
    scan (`@texuli/catalog/validate` sinks and the hostile render run)
    refuses any `style`, `styles`, `class` or `className` key anywhere in
    agent props, which is what keeps CSS out of agent output. Renaming the
    field keeps that rule absolute instead of adding an exception for
    canvases; the values are still closed (colors of the closed palette or
    `none`, bounded numbers, a closed dash set), never CSS.
  - **`formHost`** (0.8.0 integration). The first forms painter imported
    `@texuli/forms` from the player (lazily, behind the `schema-form`
    loader), which made `@texuli/forms` a runtime dependency of the player.
    That broke packing (the player pinned the forms `0.0.0` placeholder,
    which the packer refuses while forms is unreleased) and tied every
    player release to the forms package. Options: (a) let the packer accept
    `0.0.0` workspace dependencies until forms ships, (b) keep the
    dependency and publish forms first, (c) a host seam. Chosen: (c),
    `formHost` (`FormPlayerHost`): the player injects the host's `checkForm`
    and its `validators` names into `validateDraft`, renders an element per
    valid `schema-form` node and hands it to `present` with a `submit` that
    proposes the node's action through `onAction`. `@texuli/forms/host`
    (`createFormPlayerHost({ validators, labels })`) mounts `SchemaForm`
    lazily. Without a host a form is refused (`form-unchecked`). The player
    no longer depends on `@texuli/forms` at all, its first load carries no
    form code, and the packer rule (no `0.0.0` in packed ranges) stays
    strict. Unlike documents and canvases, forms may appear anywhere in the
    tree, so the seam is per node, not per root. Reverse when the forms
    engine is small enough for the player's first load and is released:
    then the player may paint `schema-form` itself again behind its lazy
    loader, keeping `formHost` as an override.

## ADR-012: Spec evolution: one additive minor per release wave

- **Date:** 2026-10-28 · **Ratification:** decided by the PLAN_010
  architecture task under the developer's trust pre-authorization; the
  developer may override this decision.
- **Context:** PLAN_010 extends what agents can declare: motion, documents,
  stable node keys for streaming, forms, data sources, dashboards, canvases
  and sheets. The blueprint spec pins every released version to a digest
  (`versions.json`), migrates older documents with pure
  `migrations/<from>-<to>.ts` functions before validation, generates
  TypeScript and Kotlin from one source, and the Kotlin twin must keep
  validation parity (ADR-008). Spec versions follow the release that
  first ships them (spec `0.5.0` in release `0.5.0`).
- **Options:**
  1. **One additive minor per release wave:** spec `0.6.0` with release
     0.6.0, `0.7.0` with 0.7.0, `0.8.0` with 0.8.0. Agents, hosts and the
     twin get each vocabulary as soon as it ships; each delta is small enough
     to review and migrate.
  2. **One batched minor at 0.8.0.** Fewer pins, but the motion and document
     vocabularies would ship in packages that agents cannot address for two
     releases, and one large normative delta is harder to review and to
     mirror in Kotlin.
  3. **A minor per task.** Pins with no release behind them, which
     contradicts the ADR-008 rule that unreleased changes amend the open pin.
- **Decision:** option 1, with these contents:
  - **`0.6.0` (release 0.6.0): motion.** A closed `motion` member on nodes
    (`enter` and `exit` presets, `layout`, `stagger` in token steps) and an
    envelope motion level (`full`, `subtle`, `none`), with token names in
    place of milliseconds
    ([ADR-013](#adr-013-motion-runtime-web-animations-with-an-owned-spring-solver)).
  - **`0.7.0` (release 0.7.0): documents and streaming.** The `document` id
    and document schema
    ([ADR-011](#adr-011-document-packages-texulidocument-l1-engine-and-texulipages-l8-editor)),
    document patch operations, and an optional node `key` (stable instance
    id, unique in a tree) used by streaming and live updates
    ([ADR-014](#adr-014-streaming-generation-paint-only-validated-closed-node-shells)).
  - **`0.8.0` (release 0.8.0): forms, data, dashboards, canvas and sheets.**
    The forms vocabulary, data-source bindings, the shared expression AST
    extensions ([ADR-015](#adr-015-one-bounded-expression-language-and-closed-vocabularies-for-agent-logic)),
    the dashboard ids, `schemas/canvas.schema.json` and the sheet id.
  - **Inside a wave**, later normative changes amend the open pin until the
    release publishes (the ADR-008 rule). A wave with no normative change
    does not mint a spec version.
  - **Migrations:** every minor ships `migrations/<from>-<to>.ts`; additive
    minors only restamp `spec`. A removal needs a manifest `deprecated`
    warning for one full minor first. Under 0.x the packages may break in a
    minor, but the blueprint spec stays additive inside PLAN_010.
  - **Kotlin codegen and the twin:** the task that changes the spec
    regenerates `packages/spec/generated` in the same change (the freshness
    test fails otherwise), gives every new semantic diagnostic a Kotlin
    twin, and runs the native check (`./native/gradlew -p native check`
    with the isolated Gradle home). Validation parity is required in the
    same wave; native painting of a new family may lag, and then the Compose
    renderer fails closed with an `unsupported` diagnostic and the native
    docs mark the family planned.
- **Why:** each release then says exactly what agents can address, and the
  digest, migration and Kotlin parity stay small reviewable steps. It is the
  policy the spec already follows from `0.2.0` to `0.5.0`.
- **Consequences:**
  - **Packages:** `@texuli/spec` gains `0.6.0`, `0.7.0` and `0.8.0` pins and
    three migrations, plus a `stream` subpath in 0.7.0 (ADR-014); the
    catalog, player, tools (`texuli-llms`, golden set) and the website's
    public catalog and LLM files regenerate with each.
  - **Native twin:** generated types and diagnostics each wave. Plan tasks
    that change the spec but whose Validation omits the native check
    (T-doc-agents, T-forms, T-data-sources, T-dashboard, T-canvas, T-sheets)
    must still run it; the lead records that through `/dwp-refine`.
  - **Layers and budgets:** none beyond the spec's own entries.
- **Reverse when:** release waves become too frequent for a minor each
  (then batch two waves into one minor), or a vocabulary must change
  incompatibly (a new ADR with a migration that is not just a restamp).

## ADR-013: Motion runtime: Web Animations with an owned spring solver

- **Date:** 2026-10-28 · **Ratification:** decided by the PLAN_010
  architecture task under the developer's trust pre-authorization; the
  developer may override this decision.
- **Context:** Texuli animates in pieces today: `@texuli/core/presence`
  keeps nodes mounted through exit animations, the theme contract has three
  durations and one easing, the deck engine resolves transitions with a
  motion ceiling (`full`, `subtle`, `none`) and plays them in the slides
  stage with View Transitions or CSS, and lists, boards, toasts and tabs
  have no layout animation. The site runs under a strict style CSP (no
  `style` attributes; CSSOM and Web Animations only), components render on
  the server, and reduced motion must be honored. No animation library may
  be added.
- **Options:**
  1. **CSS transitions and keyframes only.** Smallest, but no interruption
     with velocity, no FLIP for reorders, no shared elements and no
     timelines.
  2. **A requestAnimationFrame engine** that writes styles every frame.
     Full control, but main-thread cost every frame, more code, and per-frame
     style writes are what the CSP rules discourage.
  3. **The Web Animations API plus an owned spring solver.** The browser
     interpolates on its compositor; the solver turns springs into keyframes
     or a `linear()` easing and supplies the velocity to retarget an
     interrupted animation; View Transitions serve cross-tree shared
     elements where the browser has them.
- **Decision:** option 3.
  - **Texels in `@texuli/core/motion`** (outside the core root barrel, so a
    component that does not animate pays nothing): `animate` (the Web
    Animations wrapper with cancellation, the motion level and reduced
    motion built in), presence enter and exit on top of `core/presence`,
    `flip` (measure, invert, play for reorder, insert and remove, with
    batched reads and writes and logical directions), `shared` (paired
    elements across two states: View Transitions when available and scoped,
    else FLIP with a cross-fade), `sequence` and `timeline` (declared steps
    with play, pause, seek, reverse and cancel, and `stagger`), and `spring`
    (a pure damped-oscillator solver with closed forms for every damping
    case, keyframe sampling, `linear()` easing strings with a sample cap,
    settle detection and the velocity at any time). Hostile inputs are
    clamped (stiffness, damping, mass, durations at most 1,000 ms, sample
    counts) and tested for time bounds.
  - **Tokens in `@texuli/tokens`:** durations `instant`, `fast`, `base`,
    `slow`, `slower` (the existing `fast`, `base`, `slow` keep their values),
    easings `standard`, `emphasized`, `enter`, `exit`, `linear`, and springs
    `gentle`, `snappy`, `bouncy` as data (stiffness, damping, mass) and as
    `--tx-motion-*` custom properties with precomputed `linear()` values.
    The theme contract change is additive.
  - **Reduced motion:** under `prefers-reduced-motion: reduce` (or a host
    override), every texel commits the end state at once: no frames run,
    the finished promise resolves and callbacks fire in order. The one
    exception is a policy, not a texel default: the deck stage keeps its
    shipped 150 ms opacity-only slide fade (no movement) by passing a
    `fade` reduced-motion policy.
  - **Motion levels:** the deck's `full`, `subtle` and `none` become the
    shared vocabulary: `subtle` shortens durations and drops scale and
    travel, `none` is instant. Precedence is host, then blueprint or deck,
    then the component default; the viewer's preference can only lower it.
  - **Decks and slides:** `@texuli/deck` keeps resolving transitions as
    data (it is L0 and cannot import core); the slides stage plays the
    resolved transition and fragments through `@texuli/core/motion`, so View
    Transitions, the CSS fallback and `morph` share one runtime.
  - **SSR and hydration:** texels never run on the server and write no
    styles there; the server paints the end state. Enter animations do not
    play on hydration (`appear` is off by default). Animations start only
    after mount, use `fill: "none"` and leave no lasting inline style; final
    state lives in classes, attributes or props.
- **Why:** the compositor does the interpolation, which is the cheapest path
  on phones, and it fits the CSP posture the slides stage already proves. A
  spring solver is small and pure, and it is what makes interruptions feel
  continuous. Making reduced motion instant by construction removes a whole
  class of per-component mistakes.
- **Consequences:**
  - **Packages and subpaths:** `@texuli/core` gains `motion` (and may split
    `motion/spring` if the solver is needed alone); `@texuli/tokens` gains
    motion tokens; `texuli`, `@texuli/data`, `@texuli/slides` and the
    primitives adopt them behind a motion prop contract (`enter`, `exit`,
    `layout`).
  - **Budgets:** new caps at measured + 4%; components that adopt motion
    take it as a separate import, and the overlay, list and grid budgets may
    grow only by the measured adoption cost.
  - **Spec 0.6.0:** the closed motion vocabulary of ADR-012; agents name
    presets and token steps, never keyframes, durations in milliseconds or
    code.
  - **Native twin:** the vocabulary maps to Compose (visibility enter and
    exit, content size, spring specs from the same token data), with the
    system animation scale standing in for reduced motion.
- **Reverse when:** a measured gap (a needed effect the Web Animations API
  cannot express, or jank the compositor path cannot avoid) appears. Add a
  frame-driven path behind the same texel API for that effect only.

## ADR-014: Streaming generation: paint only validated, closed node shells

- **Date:** 2026-10-28 · **Ratification:** decided by the PLAN_010
  architecture task under the developer's trust pre-authorization; the
  developer may override this decision.
- **Context:** agents produce blueprints token by token, and today the
  player paints only a complete, validated draft. PLAN_010 wants interfaces
  to appear while they stream, without weakening the closed vocabulary, the
  URL tiers or the limits. Blueprint nodes have no stable instance ids
  (live updates match nodes by path and catalog id), and the agent service
  (`apps/agent`) runs only on a fake replay provider whose tool calls
  arrive whole.
- **Options:**
  1. **Repair partial JSON and validate it as a whole on every chunk**
     (closing open brackets). Simple, but it paints guesses: a half-arrived
     string or prop list validates as something the agent never wrote.
  2. **An incremental tokenizer that tracks which values have closed**, with
     painting gated on closed node shells that pass the full node-level
     checks, and the whole-draft validation kept as the final verdict.
  3. **A separate streaming wire format** (one node per line). Easy to
     parse, but it forks the contract, the Kotlin twin and every tool.
- **Decision:** option 2.
  - **Location:** a new framework-free `@texuli/spec/stream` subpath (L0,
    used by the catalog, the player, the agent service and tools): an
    incremental JSON tokenizer with a byte budget, a depth cap and linear
    time on any input, which reports values as they close and refuses
    duplicate keys, prototype keys and malformed input at a byte offset.
  - **The canonical order:** streamed nodes put `children` last
    (`key`, `id`, `slot`, `props`, `when`, `bind`, `on`, `children`), and
    envelopes put `state` and `flow` before the tree. A node whose
    `children` has started is shell-final: a member after `children` is a
    `stream-order` error that holds that subtree as a placeholder until the
    final verdict.
  - **Partial validation without weakening:** a node paints only once its
    shell is final and passes every node-level rule the full validator
    applies (catalog id, closed props and prop schemas, URL policy at the
    stream's tier, sink scan, the limits measured so far). A node that binds
    or acts on state that has not been declared yet waits as a skeleton.
    Rules that need the whole tree (grammar roles, root checks, totals) run
    only in the final `validateDraft`, which stays authoritative: if it
    refuses, the painted prefix is replaced by the refusal notice. While
    streaming, the tree is inert: `emit` and `submit` actions are disarmed
    and the envelope stays `draft` until the final verdict.
  - **Stable ids:** spec 0.7.0 adds an optional node `key` (unique in the
    tree). Streaming identifies a node by its key, else by its path, which
    stays stable because streamed children only append. Live updates prefer
    keys too, so state survives a regeneration.
  - **Player streaming mode:** `<Player stream={source}>`, where `source`
    is an `AsyncIterable<string>` or a `createBlueprintStream()` handle
    (`write`, `end`, `abort`). Statuses add `streaming` and `interrupted`
    (then `ready` or `invalid`). Nodes whose shell has not closed show the
    skeleton of their catalog family (or a generic one); the region is
    `aria-busy` with a polite progress announcement at most every few
    seconds, never one per node.
  - **Errors and interruption:** a tokenizer error, an abort or a dropped
    connection stops intake, keeps the painted, validated nodes marked
    incomplete, and never runs activation. A retry is a new stream that the
    player applies as a live update, matching nodes by key.
  - **Agent service:** provider events gain `tool-delta` (`callId`, `name`,
    `text`); the service streams draft chunks to clients as server-sent
    events and sends the final validated draft last. Real providers are
    adapters behind the existing `Provider` interface, use `fetch` with no
    provider SDK, and read keys at run time from outside the repository;
    adding one, using credentials and deploying stay developer checkpoints.
    Tests use the fake replay provider with recorded deltas.
- **Why:** gating on closed shells means nothing is painted that the agent
  did not finish writing, and keeping the whole-draft validation as the only
  activation path means streaming adds speed but no new trust. One wire
  format keeps the twin, the tools and the golden set unchanged.
- **Consequences:**
  - **Packages and subpaths:** `@texuli/spec/stream` (new),
    `@texuli/catalog` exposes node-level validation for shells,
    `@texuli/player` gains the streaming mode, `apps/agent` gains deltas and
    server-sent events. No new package.
  - **Budgets:** `@texuli/spec/stream` gets its own cap at measured + 4%;
    the player's streaming code loads only when `stream` is used.
  - **Spec 0.7.0:** node `key` and the documented canonical order (an
    ordering rule for streams, not a schema change).
  - **Native twin:** `key` in the generated types; native streaming is
    planned.
  - **Tests:** chunk-boundary fuzzing (every split of the golden set
    paints the same final tree), hostile streams with time bounds,
    interruption at every offset, and a browser spec for the streaming
    player.
- **Reverse when:** providers can guarantee whole-node chunks (then the
  tokenizer stays as a guard only), or the canonical order cannot be
  enforced on a provider (then that provider's nodes paint at object close
  rather than at shell close).

## ADR-015: One bounded expression language, and closed vocabularies for agent logic

- **Date:** 2026-10-28 · **Ratification:** decided by the PLAN_010
  architecture task under the developer's trust pre-authorization; the
  developer may override this decision.
- **Context:** sheets need formulas, forms need conditional logic and
  validation, and generated views need data. Today the blueprint spec has a
  closed JSON formula AST (`numberFormula` and `condition`, ADR-008), which
  `@texuli/blocks/formula` (L5) evaluates with small caps (64 nodes, depth
  12). Forms (L4) and sheets (L5, beside blocks) cannot import blocks. Agents
  never ship code, so formula text, conditions and data access written by an
  agent must be data that a closed evaluator reads in bounded time. No
  formula library may be added.
- **Options:**
  1. **A separate engine per feature:** a sheets formula engine, a forms
     rule engine and a query language. Each fits its use, but three
     evaluators mean three security reviews and three sets of limits.
  2. **One expression core with per-feature front ends**, and data access
     kept out of expressions as its own closed vocabulary.
  3. **A general scripting subset** (a JavaScript-like language). Flexible,
     but it is code in all but name: loops, closures and unbounded
     evaluation.
- **Decision:** option 2.
  - **`@texuli/core/expression` (L0):** the closed expression AST (the
    spec's `numberFormula` and `condition` as the base, extended with
    strings, booleans, references, ranges and calls to named functions), a
    parser for the JSON form, dependency extraction, and a bounded
    evaluator. Functions come from a closed table the caller registers;
    an expression can only name a function in that table. Limits: at most
    1,000 AST nodes and depth 32 per expression, 100,000 evaluation steps
    per expression and 10,000,000 per recalculation pass, strings at most
    32 KB and arrays at most 10,000 items. Step counts make limits
    deterministic; wall-clock time only slices work for responsiveness.
    Exceeding a limit is a `#LIMIT!` error value, never an exception or a
    hang. `@texuli/blocks/formula` keeps its API and later delegates to the
    core evaluator.
  - **`@texuli/sheets` sits at L5**, because its sheet view builds on the
    `@texuli/data` grid editing (L4) and the layer guard refuses same-layer
    imports; its `formula` and `model` subpaths stay framework-free.
  - **The sheet formula grammar** (in `@texuli/sheets/formula`, an owned
    linear-time Pratt parser into the core AST): a leading `=`, numbers,
    double-quoted strings with `""` escapes, `TRUE`/`FALSE`, A1 references
    with `$` anchors, ranges (`A1:B3`, whole columns bounded to the used
    range), sheet references (`Sheet2!A1`, `'Q1 plan'!A1`), the operators
    `+ - * / ^ & % = <> < <= > >=` with unary minus, and function calls.
    Not supported: R1C1, structured references, array literals, `INDIRECT`,
    `OFFSET`, `LAMBDA` and anything that builds a reference from text,
    so every dependency is static. Formulas are stored with canonical
    separators (`,` and `.`); localized display is planned.
  - **The function set** (about 45, documented with examples): math and
    aggregates (`SUM`, `AVERAGE`, `MIN`, `MAX`, `COUNT`, `COUNTA`, `ROUND`,
    `ABS`, `SUMIF`, `COUNTIF`, `AVERAGEIF` with linear wildcard criteria),
    logic (`IF`, `IFS`, `AND`, `OR`, `NOT`, `IFERROR`), text (`CONCAT`,
    `LEN`, `LEFT`, `RIGHT`, `MID`, `UPPER`, `LOWER`, `TRIM`, `TEXT` with a
    closed format set), lookup (`INDEX`, `MATCH`, `VLOOKUP`, `XLOOKUP`) and
    dates on `@texuli/date` (`DATE`, `YEAR`, `MONTH`, `DAY`, and `TODAY` and
    `NOW` from a host clock). `RAND` is excluded (evaluation stays
    deterministic). Errors: `#DIV/0!`, `#VALUE!`, `#REF!`, `#NAME?`,
    `#NUM!`, `#N/A`, `#CYCLE!`, `#LIMIT!`.
  - **Dependency graph:** cells keyed by stable row and column ids (ADR-010),
    ranges stored as intervals instead of one edge per cell, incremental
    recalculation of the dirty set in topological order, and cycles found
    on the dirty subgraph and reported as `#CYCLE!`.
  - **Forms logic:** `when` (show, require, enable) is the condition AST
    with a `field` operand; validation is a closed rule set (required,
    length, range, step, and named formats such as email, URL, phone and
    date). Agents never send regular expressions (backtracking risk);
    a developer may register a named custom validator, which agents can
    only name.
  - **Data-source bindings are not expressions:** a binding names a source
    the host registered (`{"$source": name}`) with a closed query object
    (fields, filters as the condition AST over `field` operands, sort keys,
    a page size with a cap). The host adapter receives the validated query
    and decides how to execute it; Texuli never builds URLs, SQL or code
    from it, and agents never name URLs.
- **Why:** one evaluator with one set of limits is one thing to audit and
  fuzz, and the AST the spec already validates becomes the shared base
  instead of a fork. Excluding dynamic references keeps the dependency graph
  static, which is what makes both incremental recalculation and the bounds
  provable. Keeping data access out of expressions means a formula can never
  reach the network.
- **Consequences:**
  - **Packages and subpaths:** `@texuli/core/expression` (first needed by
    T-forms, so that task's surface gains `packages/core/src/expression/**`
    and the core test, docs and manifest files through `/dwp-refine`),
    `@texuli/sheets/formula`, the forms model, and the data-source texels in
    `@texuli/core/data-source`.
  - **Budgets:** the expression core and the sheet function library have
    separate caps at measured + 4%; the function library loads with the
    sheet, not with forms.
  - **Spec 0.8.0:** the AST extensions, the forms vocabulary and the
    data-source binding; the catalog validates agent sheet formulas with
    `@texuli/sheets/formula` at draft time.
  - **Native twin:** generated types and validation parity; Kotlin
    evaluation of formulas is planned, and until then native sheets show
    cached values.
  - **Tests:** hostile formulas (deep nesting, huge ranges, long strings,
    cycles, step exhaustion) with time bounds, and parity tests between the
    blocks and core evaluators.
- **Reverse when:** a needed function cannot be written as a pure entry in
  the closed table, or dynamic references become a product requirement
  (then add them as a new ADR with a dynamic dependency model and its own
  bounds); never open the language to code.

- **Addendum (2026-10-29, PLAN_010 T-data-sources, 0.8.0): source filters
  use the grid filter model, not the expression AST.** This ADR planned
  data-source filters "as the condition AST over `field` operands". The
  implementation (`@texuli/core/data-source`, `@texuli/spec/source`) uses
  the `@texuli/data` grid filter model instead: `{ type: 'group', op:
  'and' | 'or', children }` over `{ type: 'condition', field, operator,
  value }`, with exactly the grid's `FILTER_OPERATORS`. Why: a source
  filter is a query a host adapter must translate to its own store (SQL,
  REST parameters, an in-memory list), and an and/or tree of
  field-operator-value conditions maps onto every store, while a general
  expression (arithmetic, function calls, nested comparisons between
  fields) does not and would have to be refused piecemeal. The grid, the
  filter builder and the source query now share one shape, so a filter a
  user builds in the grid travels to the source unchanged. The limits stay
  ADR-015's: operators the field allows, values that fit the field's type,
  6 levels and 64 nodes measured without recursion, and nothing ever
  concatenated into a URL or query string. Expressions remain the language
  for conditions, computed values and rules (forms, `when`). Reverse when a
  host needs computed predicates in a source query: add them as a closed
  `expression` member of the query, evaluated by the adapter's own engine,
  never by turning the filter into code.

- **Addendum (2026-10-29, PLAN_010 T-sheets, 0.8.0): the
  catalog id of a spreadsheet is `spreadsheet`, not `sheet`.** Agents emit a
  sheet as a `spreadsheet` node whose `sheet` prop holds the
  `@texuli/sheets` format (`$defs.sheet` in spec 0.8.0). The natural id
  `sheet` is already taken: it is the texuli `Sheet` overlay (a drawer) in
  the catalog's `overlays` group, and catalog ids are one flat namespace,
  so reusing it would make one id mean two components (and break every
  draft, manifest and llms page that names the drawer). `validateDraft`
  checks each `spreadsheet` node under its `sheets` check with the host's
  `checkSheet` (`checkSheetDraft` from `@texuli/sheets/model`, which parses
  every formula at draft time) and refuses it without one
  (`sheet-unchecked`). The player paints it through a `sheetHost` seam
  (`createSheetPlayerHost` from `@texuli/sheets/host`), like `canvasHost`
  and `formHost`, so the formula engine stays out of the player's first
  chunk and the player (L7) never imports `@texuli/sheets` (L5). Native
  painting of sheets is planned (the twin validates the sheet's envelope
  and paints a placeholder). Reverse when the drawer is renamed in a
  breaking minor; then `sheet` could become an alias, never a second
  meaning.

## ADR-016: Static output targets and i18n

- **Date:** 2026-10-28 · **Ratification:** decided by the PLAN_010
  architecture task under the developer's trust pre-authorization; the
  developer may override this decision.
- **Context:** PLAN_010 renders validated content outside the live web:
  email HTML and print or PDF from blueprints, and PDF and DOCX from
  documents. Static outputs are strings and bytes, which is exactly where
  HTML sinks hide. `@texuli/slides` already owns a typed XML writer with no
  raw-markup API and a deterministic stored ZIP writer for PPTX; both live
  at L8, where documents (L1) cannot import them. Component labels today
  are English defaults with per-component `labels` or `messages` props,
  with no shared catalog or locale loading.
- **Options:**
  1. **A new static-output package** holding every writer. One home, but
     it would sit either too low to see the catalog or too high for the
     document engine to use.
  2. **Shared escaped builders low in core, and each writer next to its
     input:** email in `@texuli/tools/email` (L8, which already sees the
     catalog), DOCX and PDF in `@texuli/document`, print in the player.
  3. **String templates** with an escaping helper. Smallest, but one missed
     call is an injection, so it is not sink-free by construction.
- **Decision:** option 2.
  - **Builders in `@texuli/core`:** `markup` (typed element and text nodes
    serialized to XML or HTML; element and attribute names checked against
    an allowlist, every text and attribute value escaped, URL-valued
    attributes accepted only through a builder that calls the URL policy
    with an explicit tier, and no raw-markup API) and `zip` (the
    deterministic stored writer). The slides PPTX writer moves onto them when
    its surface is next open; until then the two copies are tested for
    identical output.
  - **Email:** `@texuli/tools/email` renders a validated blueprint
    (`validateDraft` at the `untrusted` tier) to `{ html, text,
    diagnostics }`. A closed email mapping covers an email-safe subset
    (text, headings, rich text, button links, images, dividers, lists,
    tables, stats, callouts, up to two columns); any other id falls back to
    its text or is dropped with an `email-unsupported` diagnostic. Layout is
    tables. **CSS inlining** uses no CSS parser: each mapped node gets a
    typed style object from a closed property allowlist, with values
    resolved from the theme (`--tx-*` resolved to concrete sRGB, since mail
    clients lack OKLCH and custom properties), serialized into escaped
    `style` attributes; the head carries only a small typed rule set
    (resets and a dark-mode media query). Links pass `safeHref` and images
    `safeImageSrc` at the `untrusted` tier, and must be absolute `https`
    (relative URLs need a host base). No scripts, forms or remote fonts.
  - **Print and PDF of blueprints:** the player gains a print mode (print
    styles and page breaks) and "Save as PDF" goes through the browser; a
    headless PDF of a blueprint goes through the document path when the
    blueprint maps to document blocks.
  - **DOCX and PDF of documents:** `@texuli/document/docx` writes
    WordprocessingML on the core builders. `@texuli/document/pdf` is an
    owned PDF 1.7 writer over the paged layout model: the standard 14 fonts
    with WinAnsi encoding for Latin text, a host-supplied TrueType font
    embedded whole (with a `ToUnicode` map) for other scripts, link
    annotations only through the URL policy, PDF strings escaped by the
    writer, no JavaScript or forms, deterministic bytes. Font subsetting is
    planned. Both load lazily.
  - **i18n in `@texuli/core/i18n`:** a message catalog is `{ locale,
    messages }`, where each message id (namespaced, such as
    `texuli.dialog.close`) maps to a string with `{name}` placeholders or a
    plural or select object resolved through `Intl.PluralRules`; formatting
    is linear and non-recursive, and output is always text. Locales register
    as lazy loaders (`registerLocale(locale, () => import(…))`) so only the
    active locale loads. English defaults stay next to each component, so
    tree shaking keeps working. Resolution order: the instance prop
    (existing `labels` and `messages` props keep working), then the
    catalog from context (a `texuli` provider), then the English default.
    Components migrate family by family behind a test that every
    user-visible string resolves through an id, with a pseudo-locale for
    coverage; shipped translations beyond English are planned.
- **Why:** escaping by construction is the only sink-free posture that
  survives new writers, and the slides writers already prove it. Placing each
  writer next to its input keeps the layers honest: email needs the catalog
  (L6), DOCX and PDF need only the document engine. A tiny owned formatter
  covers the plural and placeholder needs without a message-format library.
- **Consequences:**
  - **Packages and subpaths:** `@texuli/core` gains `markup`, `zip` and
    `i18n` (`markup` and `zip` land with T-doc-engine, whose surface covers
    core); `@texuli/tools` gains `email`; `@texuli/document` gains `docx`
    and `pdf`; the player gains print mode.
  - **Budgets:** each writer has its own cap at measured + 4% and loads only
    when an export runs; `i18n` must stay small enough for every component
    package to import.
  - **Spec:** none in 0.8.0 (the email subset is a tools capability list; an
    `email` envelope profile may come in a later minor).
  - **Native twin:** more Compose components join the twin in 0.8.0, and
    the message catalog format is shared so native labels can use the same
    ids.
  - **Security:** every writer gets hostile-input tests (markup in text,
    `javascript:` and relative URLs, control characters, huge inputs) with
    time bounds, and the layer guard's sink scan covers all of them.
- **Reverse when:** the platform HTML Sanitizer or a vetted email renderer
  becomes available and passes the CSP and security matrix (then swap a
  writer behind its subpath), or a single static-output package becomes
  possible without a layer conflict.

- **Note (2026-10-29, PLAN_010 T-targets, 0.8.0): email dark
  mode is planned.** The decision above planned a head rule set with "a
  dark-mode media query". The `@texuli/core/markup` builders have no
  `<style>` element (deliberately: a style sheet is free text, and the
  builders accept only typed, escaped nodes), so `@texuli/tools/email`
  inlines typed styles only and the output declares `color-scheme: light`.
  A host can render a dark variant with `mode: 'dark'`, which resolves the
  theme's dark palette into the inline styles. A `prefers-color-scheme`
  rule set in the head is planned; it needs a typed, closed `<style>`
  builder (selectors and properties from an allowlist, values escaped)
  before it can ship.

## ADR-017: One operations registry (`@texuli/tools/ops`) for every agent surface

- **Date:** 2026-10-30 · **Ratification:** decided by the PLAN_011
  architecture task under the developer's trust pre-authorization; the
  developer may override this decision. **Status: planned** (release
  0.9.0); nothing below is shipped yet.
- **Context:** `@texuli/tools` exposes the library to agents through seven
  read-only MCP tools (`packages/tools/src/mcp/server.ts`: `catalog`,
  `component`, `validate`, `example`, `theme`, `deck`, `document`), a CLI
  split across six bins, `texuli-llms`, the server card and the skill. Each
  surface is written by hand and they have drifted: the server card names 5
  tools and protocol `2025-06-18` while the server has 7 and `2025-11-25`
  (and a test locks in the stale card), `SERVER_VERSION` is `0.0.0`, the
  CLI `theme list` and the MCP `theme` tool use two implementations, and
  `check-skill` does not check MCP tool names or the `texuli deck|document`
  commands. The developer's rule for PLAN_011 (amendment 1) is that an agent
  can drive everything in Texuli, and that every surface stays current.
- **Options:**
  1. **Keep hand-written surfaces** and add more parity tests. No new
     module, but every new tool still needs N edits and N tests, and drift
     is found in review, not by a gate.
  2. **A framework-free registry inside `@texuli/tools`** (a new `ops`
     subpath) from which every door is generated.
  3. **A separate `@texuli/ops` package.** A clean name, but the handlers
     need the catalog, deck, document and theme code `@texuli/tools`
     already depends on, so the package would sit at the same layer as
     tools and duplicate its dependency set; one more package to version
     and publish for no consumer that wants the registry without tools.
- **Decision:** option 2.
  - **Operation shape:** `{ name, title, summary, input, output,
    annotations, runtime, limits, examples, handler }`. `input` and
    `output` are JSON Schemas, so the MCP gets `inputSchema`,
    `outputSchema` and `structuredContent` from the same source.
    Annotations mark read-only, idempotent and closed-world operations. A
    schema-checked `invoke()` validates input and output and returns stable
    error codes; tool errors are `isError` results, never transport errors.
  - **Naming:** a `group.verb` namespace (`catalog.search`,
    `component.get`, `blueprint.validate`, `deck.convert`, `ds.compile`
    …). Today's seven tool names stay as aliases for one minor (flagged
    deprecated in their descriptions), then go.
  - **Runtime class:** `edge` (pure compute, runs anywhere, including the
    remote endpoint), `node` (needs Node: the file system, the heavier PDF
    and DOCX writers, local writes) and `site` (remote only, reads the
    built site through `env.ASSETS`; see
    [ADR-018](#adr-018-the-remote-mcp-on-pages-functions)). Each door
    filters by class.
  - **Limits and examples** live on the operation (input bytes, item caps,
    a time budget) and feed docs, evals, tests and the remote caps.
  - **Generated doors:** the MCP `tools/list` (local and remote), the CLI
    router (`texuli <group> <verb>`, JSON from stdin, `--file`, `--out`;
    existing commands kept), `texuli help`, the server card, the `/mcp/`
    docs page, the llms "Tools" section and `packages/tools/docs/ops.md`.
    The skill names operations; `check-skill` fails on an unknown operation,
    argument or `texuli …` command. A new root `check:surfaces` script
    regenerates every artifact and fails on a diff, and `pnpm check` runs
    it.
  - **One theme implementation** serves the CLI and the operations, and
    `serverInfo.version` is read from the package manifest.
  - **Edge-safe catalog:** the static manifest list moves to
    `@texuli/catalog/manifests/all` (the `apps/agent` pattern), with a hash
    parity test against file-system discovery.
- **Why:** one source makes drift a CI failure instead of a review comment,
  and it is the cheapest way to keep the doors equal as operations are
  added (the `ds.*` family of ADR-021 alone adds about ten). Placing the
  registry in tools keeps the layer graph unchanged: tools already sits
  above everything the handlers call.
- **Agent-first and adoption-first:** every capability an agent can call
  is one named, schema-described, example-carrying operation, identical
  over local MCP, remote MCP and the CLI. An adopter extends Texuli by
  adding one operation, not by editing five surfaces.
- **Consequences:**
  - **Packages and subpaths:** `@texuli/tools` gains `ops`;
    `@texuli/catalog` gains `manifests/all`. No new layer edge.
  - **Owner-held files:** root `package.json` (the `check:surfaces`
    script and its place in `check`) and `texuli.budgets.json` (an `ops`
    entry) need the owner.
  - **Compatibility:** the old MCP tool names keep working for one minor.
- **Reverse when:** a surface needs behavior the registry cannot describe
  (then hand-write that one door over `invoke()` and keep the registry for
  the rest), or a consumer needs the registry without tools (then split it
  into its own package below tools, with handlers injected).

## ADR-018: The remote MCP on Pages Functions

- **Date:** 2026-10-30 · **Ratification:** decided by the PLAN_011
  architecture task under the developer's trust pre-authorization; the
  developer may override this decision. **Status: planned** (release
  0.9.0 for library operations, the site operations with the agent-ready
  website work of the same plan); nothing below is shipped yet.
- **Context:** many MCP hosts accept only a URL, and an agent on a phone or
  in a hosted IDE cannot run a local binary. texuli.com already runs
  Cloudflare Pages Functions (`functions/_middleware.ts` serves Markdown
  twins and `problem+json` 404s, verified on 2026-10-30), so a Function at
  `/mcp` needs no new hosting, account, server or secret. The site also has
  to become agent-ready (Part C of the plan): agents want to read the site
  itself, and browser agents look for WebMCP tools in the page. The
  endpoint is public and unauthenticated, so abuse and injection are the
  main risks; `_headers` does not apply to Function responses
  ([SECURITY](SECURITY.md#15-website-edge-functions-and-analytics)).
- **Options:**
  1. **A Pages Function, stateless Streamable HTTP with JSON responses**,
     serving the registry's `edge` and `site` operations.
  2. **A separate Cloudflare Worker project.** More control (bindings,
     routes, its own deploy), but a new project, deploy pipeline and
     account configuration that only the owner can create, for no
     capability the Function lacks today.
  3. **Stateful sessions with an SSE stream** (Durable Objects or KV for
     session state). Needed only for server-initiated messages, which no
     operation uses, and it adds storage and session cleanup.
  4. **Durable rate limits in KV now.** Stronger limits, but a binding
     the owner must create; planned and gated on that binding, not
     required.
  5. **No remote endpoint** (local only). Leaves URL-only hosts out.
- **Decision:** option 1.
  - **Transport:** `functions/mcp.ts` answers `POST /mcp` (and
    `/.well-known/mcp`, routed by the middleware) with JSON-RPC, single or
    batched, and JSON responses; no SSE stream and no session id. The
    handshake is accepted but never required between requests. `GET`
    returns `405` with a docs pointer (the server card for agent user
    agents); `OPTIONS` answers CORS. Protocol `2025-11-25`, negotiating
    the three earlier versions.
  - **Operations:** only `edge` and `site` operations are bundled. `node`
    operations (file writes, PDF and DOCX conversion) never run remotely.
    The `site` class adds `site.pages`, `site.read` (a page's Markdown
    twin, path-validated) and `site.search` over the built twins, read
    through `env.ASSETS`. The site gets no second MCP: library and site
    share this one endpoint.
  - **Limits:** request body at most 256 KB (counted while streaming,
    refused early), batch at most 10, per-operation item caps from the
    registry, and a 5 s wall-clock guard per call. A per-isolate token
    bucket keyed by the client IP is best-effort; the documented Cloudflare
    rate-limiting rule is the owner's optional stronger layer.
  - **Origin and Host:** a browser `Origin` must be on the allowlist
    (texuli.com and preview hosts); requests without `Origin` (server-side
    agents) are allowed; `Host` must be texuli.com or a preview host
    (DNS-rebinding defense).
  - **Headers:** the Function sets its own CSP (`default-src 'none'`),
    `nosniff`, `Cache-Control: no-store`, `X-Robots-Tag: noindex` and CORS
    for the allowed origins. Errors outside JSON-RPC are `problem+json`.
  - **Never at runtime:** network fetch, storage, secrets, `eval`, HTML
    sinks or logging of request bodies. Untrusted inputs pass the existing
    validators at the `untrusted` tier, and returned URLs pass `safeHref`
    and `safeImageSrc` at the `untrusted` tier.
  - **Observability:** counters only (operation, status, duration bucket)
    through the existing bot-event path; no arguments recorded.
  - **Bundle:** the catalog comes from the static manifest module
    ([ADR-017](#adr-017-one-operations-registry-texulitoolsops-for-every-agent-surface)),
    theme loaders stay lazy chunks, and the Function gets its own budget in
    `pnpm size`.
  - **Currency:** the endpoint deploys from `main` with the site, and its
    `serverInfo.version` equals the npm packages built from the same
    commit. A post-deploy CI smoke check compares `tools/list` on
    texuli.com with the registry.
  - **WebMCP:** a bridge in the site layout registers a few tools through
    `navigator.modelContext` on load (search docs and components, read a
    component page, validate a blueprint in the browser), feature-detected,
    calling the same registry code, with no network beyond same-origin
    JSON and the CSP and Trusted Types policy unchanged.
- **Why:** it uses hosting that already runs, keeps the endpoint
  read-and-compute only, and a stateless handler has nothing to steal,
  corrupt or clean up. Every limit is enforceable without a binding, and
  the stronger layers are owner switches, not code changes.
- **Agent-first and adoption-first:** any MCP host reaches Texuli with one
  URL and no install; the same operations answer locally and remotely with
  identical results for `edge` operations (checked by the agent evals), and
  the site itself is readable and searchable as tools.
- **Consequences:**
  - **Files:** `functions/mcp.ts` (new), a middleware route for
    `/.well-known/mcp`, pure logic tested in `apps/website/tests/` or
    `packages/tools/tests/` with real `Request` objects, including hostile
    and oversized inputs.
  - **Owner-held files and actions:** `texuli.budgets.json` (the Function
    entry). The Cloudflare rate-limiting rule and any KV binding are owner
    actions in the Cloudflare dashboard; the plan never changes Cloudflare
    settings.
  - **Docs:** a remote-endpoint section in
    [SECURITY](SECURITY.md) and a deploy note in [CI](CI.md).
- **Reverse when:** the endpoint needs server-initiated messages, durable
  state or authenticated writes (then move it to a Worker project with
  the bindings it needs, behind the same registry), or abuse outgrows the
  per-isolate limits and the Cloudflare rule (then make the KV-backed
  limits required).

## ADR-019: The `@texuli/mcp` package and its binary

- **Date:** 2026-10-30 · **Ratification:** decided by the PLAN_011
  architecture task under the developer's trust pre-authorization; the
  developer may override this decision, and the layer below is an
  exception the developer confirms. **Status: in development:**
  `packages/mcp`, `texuli mcp`, the L9 entry and the consumer test exist
  in the repository (T-mcp-local); first published in release 0.9.0, not
  on npm yet.
- **Context:** the stdio server exists in `packages/tools/src/mcp` with no
  published binary. Every MCP host documents a one-word install of the
  form "npx -y" plus a package name, and `@texuli/tools` is a library
  with six bins whose package name says nothing about MCP. The layer guard forbids same-layer
  dependencies (`target >= ownLayer` in `scripts/check-layers.ts`), and
  `@texuli/tools` is L8.
- **Options:**
  1. **A thin `@texuli/mcp` package** whose bin `texuli-mcp` runs the
     stdio server from `@texuli/tools`, pinned exactly.
  2. **Only a bin in `@texuli/tools`** (run through npx with
     `-p @texuli/tools`, plus `texuli mcp`). No new package, but an install line
     hosts do not recognize, and a library package that grows a server
     role.
  3. **Move the MCP server code into `@texuli/mcp`.** The server would then
     depend on tools for the registry anyway, and the CLI's `texuli mcp`
     would have to depend upward or duplicate it.
- **Decision:** option 1.
  - **The package** holds only the bin entry and its README; the server
    and the registry stay in `@texuli/tools`. Its version always equals
    `@texuli/tools` (an exact pin, published in the same wave right after
    tools), and `serverInfo.version` is read from the manifest.
  - **Operations:** all classes but `site` (`edge` and `node`). Writes
    (`ds.save`, file outputs of deck and document operations) accept only
    an explicit path that resolves inside the working directory; traversal
    is refused. The stdio server keeps the initialization gate the
    specification requires.
  - **`texuli mcp`** in the tools CLI runs the same server, so users of
    the CLI need no second package.
  - **Layer:** **L9**, a new top layer, because an L8 package cannot
    depend on `@texuli/tools` (L8) under the same-layer rule. This keeps
    the down-only rule intact; the plan's sketch said L8, which the guard
    would refuse. The alternative that keeps the graph at L8 is option 2.
  - **Tests:** a consumer test installs the packed tarballs, spawns
    `node_modules/.bin/texuli-mcp`, completes a handshake, `tools/list`
    and one call, and exits cleanly.
- **Why:** the install line is the adoption surface for MCP hosts, so it
  should be the shortest one possible, and an exact pin means the binary
  can never drift from the library it serves. Keeping the server in tools
  leaves one implementation.
- **Agent-first and adoption-first:** one copy-paste line installs the full
  local server in Claude Code, Cursor, VS Code, Windsurf, Codex or any stdio
  host, with every operation, including the local-only ones.
- **Consequences:**
  - **New package and layer:** `packages/mcp` with an `L9` entry in
    `LAYERS` in `scripts/check-layers.ts`, the layer table and graph in
    this file updated when it lands, and `scripts/packages.ts`.
  - **Owner-held files:** `pnpm-lock.yaml` (the owner runs `pnpm install`;
    `pnpm-workspace.yaml` already globs `packages/*`), and
    `texuli.budgets.json` if the bin gets an entry.
  - **Release:** `.github/workflows/publish.yml` publishes it after
    `@texuli/tools`, and [RELEASE](RELEASE.md) lists it; first publication
    needs the developer's GO like every release.
- **Reverse when:** the extra package costs more than it adds (then drop
  it, keep the bin in `@texuli/tools` and document running
  `texuli-mcp` through npx with `-p @texuli/tools`), which also removes
  L9.

## ADR-020: Token contract v2: additive families and a real component tier

- **Date:** 2026-10-30 · **Ratification:** decided by the PLAN_011
  architecture task under the developer's trust pre-authorization; the
  developer may override this decision. **Status: planned** (the families
  in release 0.9.0, adoption across packages and the component tier in
  0.10.0); nothing below is shipped yet.
- **Context:** `@texuli/tokens` has a strong color engine (OKLCH seeds with
  AA guarantees, 210 seed-defined themes, a validated `Theme`), but a
  design system cannot reach most of the UI. Tier-3 component hooks are
  written and no CSS reads them; `--tx-space-*` is used in 0 files and
  controls hardcode rem sizes (`button.css`); there are no line-height,
  type-role, z-index, opacity, elevation-ladder, icon, target-size or
  layout-grid tokens; chart tokens are optional and fall back to hex.
  Protoyard, the first consumer, migrates about 2,300 files by codemod and
  asked (in its PLAN_011 review) for one minor of aliases plus a
  machine-readable rename list for any change.
- **Options:**
  1. **Additive families with defaults that reproduce today's values**,
     adopted package by package behind a zero-visual-diff gate.
  2. **A new contract (v2 names) replacing v1** in one minor. Cleaner
     names, but every adopter rewrites its reads at once and pixels move.
  3. **Leave sizes and spacing hardcoded** and only theme color. Smallest,
     but "everything respects the design system" stays false.
- **Decision:** option 1.
  - **System families** (all in `base.css` with defaults equal to today's
    rendered values): space `--tx-space-0…12` (scaled by `--tx-density`),
    size (`--tx-size-control-{xs,sm,md,lg}`, `--tx-size-icon-{sm,md,lg}`,
    `--tx-size-target-min`), type roles
    (`--tx-type-{display,title,heading,body,label,caption,code}-{size,line,weight,tracking}`
    mapped from the existing scale), elevation (`--tx-elevation-0…5`,
    glass alpha and blur), shape (`--tx-radius-*` from the radius scale,
    border widths), layers (`--tx-z-*`), opacity, layout (content widths,
    grid columns and gutters per breakpoint), icons (stroke and style), and
    the data-viz and status set, now **always emitted** for every theme.
  - **Component tier:** a registry, `@texuli/tokens/components`, declares
    each component's tokens and default reference (for example
    `--tx-button-radius: var(--tx-radius-md)`). Component CSS reads only
    its component tokens. The registry is the closed vocabulary a design
    system may set, the source of each component's generated token table,
    and the input of the hardcode guard.
  - **Component defaults** (default `variant` and `size`, which CSS cannot
    express) come from a small context in `texuli`, read only when a prop
    is omitted; the cost is zero when nothing is set.
  - **Migration:** every adoption task must keep `pnpm visual` at no
    changes under the default themes, so the refactor is invisible until a
    design system changes something.
  - **Hardcode guard:** `scripts/check-token-usage.ts` fails on literal
    colors and literal size or space values in component CSS (an allowlist
    with reasons). It lands only after adoption, so it never blocks a half
    migration.
  - **Renames:** v2 is additive, so 0.9.0 removes nothing. Any later rename
    keeps the old name as an alias for one minor, and
    `@texuli/tokens/renames.json` lists `{ from, to, since, removeIn }` for
    codemods (an empty list is valid).
- **Why:** additive defaults make every step provable by an existing gate
  (visual baselines) instead of by review, and the component registry turns
  "which tokens can a design system set" into data that docs, validators,
  agents and the guard all read.
- **Agent-first and adoption-first:** an agent or adopter changes the look
  of any component through named tokens listed in a machine-readable
  registry, never by writing CSS; adopters with their own token readers
  get a rename list they can feed to a codemod.
- **Consequences:**
  - **Subpaths:** `@texuli/tokens` gains `components` and `renames.json`;
    the theme JSON schema, the Tailwind preset (spacing from
    `--tx-space-*`) and the token docs regenerate.
  - **Packages:** `texuli`, the primitives' styled consumers and every
    domain package adopt the tokens, one task per family of packages.
  - **Owner-held files:** `texuli.budgets.json` (`base.css` and changed
    entries at measured + 4%); root `package.json` if the guard joins
    `pnpm check`.
- **Reverse when:** a family proves wrong for adopters (then deprecate it
  through the alias and `renames.json` path for one minor), or adoption
  cannot reach zero visual diff in a package (then that package keeps its
  literals on the guard's allowlist with a reason, and the gap is
  documented).

## ADR-021: The design-system document

- **Date:** 2026-10-30 · **Ratification:** decided by the PLAN_011
  architecture task under the developer's trust pre-authorization; the
  developer may override this decision. **Status: planned** (release
  0.10.0); nothing below is shipped yet.
- **Context:** a company should describe its brand once, as data, and have
  every Texuli surface follow it; agents should author and change it with
  the same closed-vocabulary discipline as blueprints. Today the closest
  thing is a `Theme` (colors, fonts, radius, a few style knobs), with no
  versioning, inheritance, overrides, assets, layout, voice or
  accessibility targets. Protoyard, the first consumer, needs three levels
  (workspace, prototype, scenario), constrained overrides, a lossless home
  for every knob of its own `Theme`, and a document that a saved user theme
  can never "brick" across schema versions (its PLAN_011 input and
  review).
- **Options:** for placement, (A) schema and compiler both in
  `@texuli/tokens`; (B) schema in `@texuli/spec` (L0), compiler in
  `@texuli/tokens` (L2); (C) a new design-system package. For the
  vocabulary, (1) closed, versioned by `formatVersion`; (2) open, with
  free CSS or token passthrough. For overrides, (i) RFC 6902 patches;
  (ii) typed partial documents.
- **Decision:** B, 1 and ii.
  - **Identity and versions:** `format: "texuli/design-system"`,
    `formatVersion: 1` (the schema), and a semver `version` (the
    document). `migrate(doc)` is pure and total, with a fixture for every
    version; an unknown future `formatVersion` is refused with a code,
    never thrown.
  - **Placement:** the schema, TypeScript types, `DesignSystemPatch`, the
    JSON-path validator and `migrate` live in `@texuli/spec`, so blueprints
    can embed or reference a design system and Kotlin types are generated
    from the same source. The compiler lives in `@texuli/tokens`, the owner
    of the OKLCH engine, which gains a down-only dependency on
    `@texuli/spec`.
  - **Closed vocabulary:** sections for color (brand seeds, exact pins,
    explicit role pins per mode, modes, data-viz per mode), typography
    (family stacks, self-hosted font files, scale, roles), shape, space and
    density, elevation, surface, motion personality, layout, icons,
    components (tokens from the ADR-020 registry and defaults), assets,
    voice and lexicon, accessibility targets, metadata, `extends` and
    `variants`. Unknown keys are refused with their JSON path. Every
    Protoyard `Theme` knob has a named field, proven by a fictional
    `protoyard-theme/v1` fixture published at
    `@texuli/tokens/design-system/fixtures`.
  - **Data only:** colors are parsed to OKLCH; lengths are numbers in a
    closed unit; strings that reach CSS pass the `css-safe` check; fonts and
    assets are same-origin relative paths or size-capped `data:` URLs,
    checked with the URL policy; remote URLs are refused; the compiler never
    fetches and reports total inline bytes; SVG assets render only as
    `<img>`.
  - **`extends`:** a library theme (`texuli:<id>`; each of the 210 themes is
    a valid base, and `fromTheme` turns any `Theme` into a document) or a
    design system by exact `id@version`, resolved through a caller-supplied
    resolver. Ranges, cycles and chains deeper than 4 are refused.
  - **Variants:** named selections (`high-contrast`, `compact`, seasonal)
    orthogonal to mode; every variant compiles for every declared mode.
  - **Patches:** `DesignSystemPatch` is a typed partial document. Objects
    merge, arrays replace, `null` removes an optional field, and the
    result is re-validated. Precedence is override, then variant, then the
    `extends` chain. The `hash` is computed over a canonical JSON form, so
    key order never changes it.
  - **Stable codes,** shared by `validate`, `compile`, the CLI and the MCP:
    `unknown-key`, `extends-cycle`, `extends-depth`, `extends-range`,
    `url-refused`, `inline-bytes`, `format-version`, plus the guarantee
    codes of [ADR-022](#adr-022-design-system-guarantees-enforced-never-reported).
- **Why:** the spec is the cross-language contract (TypeScript, Kotlin, the
  catalog), so a document that blueprints carry belongs there; the compiler
  needs the color engine and belongs with it. A closed vocabulary is the
  only way agent-written design systems can never carry CSS or code, and
  typed partials are easier for agents and reviewers to write than JSON
  Pointer patches while still being checkable.
- **Agent-first and adoption-first:** a design system is one JSON document
  an agent can write, validate and diff through the `ds.*` operations, with
  machine-readable error codes and JSON paths; adopters keep their own
  precedence models and map them onto patches, and every library theme is
  already a valid starting point.
- **Consequences:**
  - **Packages:** `@texuli/spec` gains the design-system schema (a schema
    file next to the existing ones, types and generated Kotlin);
    `@texuli/tokens` gains `design-system/validate`, `design-system/compile`
    and `design-system/fixtures`, and the `@texuli/spec` dependency.
  - **Native twin:** generated Kotlin types and the native check in the
    same change (ADR-012).
  - **Adapters:** Protoyard's `fromProtoyardTheme` and `fromBrand` stay in
    Protoyard over Texuli's generic importers; Texuli never imports
    `@protoyard/*`.
- **Reverse when:** the vocabulary needs a field the closed form cannot
  express safely (then add it in a `formatVersion` bump with a migration,
  never as passthrough), or the spec dependency weighs on `@texuli/tokens`
  (then move the compiler-side validator into tokens and keep the schema
  source in the spec).

## ADR-022: Design-system guarantees: enforced, never reported

- **Date:** 2026-10-30 · **Ratification:** decided by the PLAN_011
  architecture task under the developer's trust pre-authorization; the
  developer may override this decision. **Status: planned** (release
  0.10.0); nothing below is shipped yet.
- **Context:** the theme generator already guarantees AA for generated
  text pairs, and the AA gate (`@texuli/tokens/aa-gate`) checks shipped
  themes. A design-system document adds inputs the generator does not
  choose: exact brand colors, explicit role palettes (Protoyard's 33-role
  palettes per mode), variants and overrides from agents. Agents cannot see
  the result, and a report they may ignore protects nobody.
- **Options:**
  1. **Report only:** compile anything, list failing pairs as warnings.
  2. **Fix everything:** move any color, pins included, until it passes.
     Always accessible, but a brand's exact colors silently change.
  3. **Enforce, with a solver for derived colors only:** keep what the
     author pinned, derive the rest to pass, and refuse what cannot pass.
- **Decision:** option 3.
  - **Guarantees, per mode and per variant:** every text pair meets the
    declared target (`accessibility.contrast`, AA by default, AAA
    available); focus indicators meet 3:1 against their surroundings;
    interactive targets meet `accessibility.targetMin` (24 CSS px by
    default).
  - **Pinned brand colors** (`color.pin`) are kept exactly where they are
    used as fills. The solver derives accessible on-colors, tints and
    states around them and records every adjustment it made in
    `report`.
  - **Explicit role pins** (`color.roles.{light,dark}`) are checked, never
    moved: if a pinned pair fails, the document is refused.
  - **Refusal semantics:** a document, variant or patch that breaks a
    guarantee is refused as a result (not an exception) carrying the code
    (`aa-text`, `aa-focus`, `target-size`), the failing pairs with their
    ratios and modes, and JSON paths to the fields involved. Overrides are
    re-validated after the merge, so a patch can never weaken the result.
  - **Conformance:** `texuli ds check --json` renders the catalog
    components under a design system and asserts the guarantees in every
    mode, with the same codes; adopters run it in their own CI.
- **Why:** an author's pins are their intent and must not move silently;
  derived colors are the engine's job and can always be solved. Refusing,
  with a precise reason, is the only behavior an agent can loop on
  reliably: fix the named field, re-validate.
- **Agent-first and adoption-first:** an agent cannot produce an
  inaccessible design system through any surface, and each refusal names
  the field to change; adopters get the same codes in the CLI, the MCP and
  their CI, verbatim.
- **Consequences:**
  - **Compiler:** property tests (random valid documents compile and the
    guarantees hold), snapshot determinism and a compile-time bound in
    the opt-in perf suite.
  - **Forced colors** keep today's behavior; the system colors win there.
- **Reverse when:** a measured, legitimate case cannot meet a guarantee
  (then add a named, reported waiver field in a `formatVersion` minor that
  the conformance run still flags; never a silent pass).

## ADR-023: Design-system runtime and scoping

- **Date:** 2026-10-30 · **Ratification:** decided by the PLAN_011
  architecture task under the developer's trust pre-authorization; the
  developer may override this decision. **Status: planned** (scoping and
  portals with the 0.10.0 adoption work, the runtime in 0.10.0); nothing
  below is shipped yet.
- **Context:** `applyTheme` already writes `--tx-*` properties on an
  element through the CSSOM, and the no-flash script replays a cached,
  filtered variable map before first paint (it rejects `var(`, `url(` and
  similar values). Hosts need several design systems on one page (studio
  previews, galleries), live switching with no rebuild, server rendering
  that matches the client, and no cost for apps that never use a design
  system. Overlay portals mount outside the trigger's subtree today, so they
  lose an element-scoped theme.
- **Options:**
  1. **Compile to variables plus attributes, applied per element**, with
     portals that follow the nearest scope.
  2. **A generated stylesheet per design system.** Simple selectors, but a
     CSS bundle per design system, a rebuild to switch, and a
     stylesheet-injection surface.
  3. **`:root` only.** Smallest, but one design system per page and no
     previews.
- **Decision:** option 1.
  - **Compiled shape:** `CompiledDesignSystem.vars[mode]` is a flat
    ``Record<`--tx-${string}`, string>`` of concrete values (no `var()` or
    `url()`, so the existing replay filter accepts it), and `attrs` keys
    come from a published allowlist (`DESIGN_SYSTEM_ATTRIBUTES`). It also
    carries `fontFaces`, `assets`, component `defaults`, `report` and
    `hash`.
  - **Apply:** `applyDesignSystem(el, compiled, { mode, variant })`
    writes the variable map and the allowed attributes on one element,
    marks it `[data-tx-scope]`, hands component defaults to the context
    and returns a dispose. Nothing needs `:root`.
  - **Portals:** the portal texel mounts overlays (dialog, sheet, popover,
    menu, select, combobox, tooltip, toast, command, date pickers) in a
    portal root that mirrors the trigger's nearest `[data-tx-scope]`
    attributes and custom properties, kept in sync, or in a container the
    host passes.
  - **SSR and no flash:** `designSystemStyle(compiled, { selector })`
    returns the same declarations `apply` writes, so server HTML, the
    no-flash replay and the client produce identical output; a test
    compares them byte for byte.
  - **Fonts** load lazily as `FontFace` on first use or on switch, never
    eagerly, and never from a remote host.
  - **Cost:** 0 B eager for apps that do not use design systems (proven by
    a consumer import test); an app that uses one ships its compiled
    variables plus `apply`; switching is one write per scope, with no
    per-design-system CSS.
  - **Budgets:** `design-system/validate` at most 4 KB gz,
    `design-system/apply` at most 2 KB gz, `design-system/compile` on its
    own lazy entry (loaded only in the studio, the CLI, builds and the
    MCP); a perf test switches design systems on a 1,000-node page within
    one frame on chromium.
  - **Hosts:** a `DesignSystemProvider` in `texuli` (scope element plus
    defaults context) and an `@texuli/astro` integration option that
    inlines the style.
- **Why:** variables plus attributes are already how themes work, so the
  runtime is a small extension of proven code and stays inside the CSP
  posture (CSSOM writes, no style strings in markup). Scoping by element is
  what makes side-by-side previews and per-blueprint design systems
  possible, and portals that follow scope are what makes them correct.
- **Agent-first and adoption-first:** a host can apply a compiled design
  system to any element with one call and a plain map it can cache, filter
  and replay itself; nothing assumes a framework, a bundler or a single
  design system per page.
- **Consequences:**
  - **Packages:** `@texuli/tokens` gains `design-system/apply`;
    `@texuli/core` portal behavior and every overlay family change, held
    by the behavior suite on chromium and webkit and a new e2e page with
    two scopes and open overlays in each (computed colors plus axe).
  - **Owner-held files:** `texuli.budgets.json` (the new entries).
- **Reverse when:** the platform offers scoped custom properties for
  top-layer content natively (then drop the mirrored portal root), or a
  measured case needs more than one write per switch (then batch inside
  `apply`, keeping the output map unchanged).

## ADR-024: Design systems on every surface

- **Date:** 2026-10-30 · **Ratification:** decided by the PLAN_011
  architecture task under the developer's trust pre-authorization; the
  developer may override this decision. **Status: planned** (release
  0.10.0, spec `0.10.0`); nothing below is shipped yet.
- **Context:** blueprints, decks and documents have no design-system
  reference (only the web-only deck `themeRef`); email covers color and
  font only and has no dark rule (the ADR-016 note); PDF, DOCX, canvas
  export and the native twin ignore the theme (`TexuliTheme` hardcodes six
  colors). Agents emit blueprints that the player paints with no build, so
  the design system must travel with the content.
- **Options:** for content, (1) references only (`id@version`); (2) inline
  documents only; (3) both. For outputs, (A) each writer reads the
  design-system document itself; (B) the compiler emits plain data per
  target, and each writer takes that data as input.
- **Decision:** 3 and B.
  - **Spec 0.10.0** adds `designSystem: { ref: "id@version" } | { inline:
    … }` to blueprints, decks (`DeckThemeReference` gains it) and
    documents, as one additive minor
    ([ADR-012](#adr-012-spec-evolution-one-additive-minor-per-release-wave));
    the migration only restamps `spec`. The catalog validates references
    and inline documents with the ADR-021 and ADR-022 codes.
  - **Player, deck stage and pages reader** take a host-supplied resolver
    (no fetch) for references, compile or receive a compiled design
    system, and apply it to their root scope (ADR-023).
  - **Emitters** (`@texuli/tokens/design-system/emit/*`, lazy): scoped
    CSS, a Tailwind preset, DTCG round-trip, compiled JSON, an email
    palette (color, font, radius, spacing, dark), PDF and DOCX themes,
    PPTX `theme1.xml`, the canvas export palette, and a static review page
    (swatches, type ramp, component sheet, contrast table). The writers in
    `@texuli/document`, `@texuli/canvas`, `@texuli/slides` and
    `@texuli/tools/email` accept the emitted data, so none of them imports
    the compiler, and the L1 document engine never depends on L2 tokens.
  - **Email dark mode** lands through the typed, closed style builder the
    ADR-016 note requires, never a free-text stylesheet.
  - **Importers:** the one-line brand, W3C DTCG, Tokens Studio JSON, a
    flat role palette, an existing `Theme`, and logo pixels to a suggested
    palette (deterministic). `diff(a, b)` lists changed tokens per mode,
    contrast regressions and changed defaults.
  - **Native:** Kotlin token codegen from a compiled design system;
    `TexuliTheme` reads the generated tokens; conformance tests compare web
    and native values.
  - **Agent tools:** `ds.validate`, `ds.compile`, `ds.contrast`,
    `ds.suggest`, `ds.import`, `ds.diff`, `ds.preview` (deterministic:
    fixed fonts, no time, stable ids) and `blueprint.theme` as `edge`
    operations, `ds.save` as `node`, and the `create-design-system` prompt
    (ADR-017).
- **Why:** references keep blueprints small and reviewable, and inline
  documents let the no-install player render a themed blueprint with
  nothing else; supporting both is one discriminated field. Emitting plain
  data keeps every writer at its layer and testable on its own values.
- **Agent-first and adoption-first:** an agent sets one field to brand a
  whole blueprint, deck or document, and the same document drives web,
  email, print, office formats, canvas and native, so an adopter describes
  the brand once.
- **Consequences:**
  - **Spec:** a `0.10.0` pin in `versions.json`, a restamp migration,
    regenerated Kotlin and the native check (ADR-012).
  - **Packages:** the player, `@texuli/slides`, `@texuli/pages`,
    `@texuli/document`, `@texuli/canvas`, `@texuli/tools` and `native/`
    take compiled input; `@texuli/catalog` validates the field; agent docs,
    llms bundles and the catalog snapshot regenerate.
  - **Website:** the theme studio grows into a client-only Design System
    Studio (no server, no storage; sharing through the URL hash).
- **Reverse when:** a surface needs design-system data the emitters
  cannot express (then add an emitter for it; writers still never read
  the document), or inline documents make blueprints too large in practice
  (then cap inline size in the catalog limits and prefer references).
