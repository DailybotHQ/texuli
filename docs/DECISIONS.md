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
