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
  versions tracking the npm release line they mirror (`0.7.0`).
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
