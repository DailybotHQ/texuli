# The spec contract: files, generation, conformance and versioning

The contributor reference for `@texuli/spec`. The package's front page,
including install and quick start, is [../README.md](../README.md).

`@texuli/spec` is the schema-first blueprint contract: the platform-neutral
source of truth for blueprint structure, the catalog vocabulary, capability
tiers and diagnostics. TypeScript and Kotlin are deterministic projections
generated from it, and a conformance harness keeps everything from drifting.
Kotlin is generated as committed text by this package's TypeScript
generator; no Kotlin toolchain runs here, and nothing is compiled or
published to Maven.

The package tarball build compiles `generated/typescript/` into the matching
`dist/generated/typescript/` location. The source stays beside `src/` so the
spec generator and integrity manifest keep their established output paths;
the packer maps runtime and declaration imports to emitted `.js` and `.d.ts`
files there. Kotlin projections, the schemas, the catalog documents and the
fixtures are not part of the npm package.

## Layout

| Path | What it holds |
| --- | --- |
| `schemas/` | The normative JSON schemas: `blueprint` (envelope v1, local state, flow and the node tree), `catalog`, `diagnostics`, `manifest`, `workflow` (workflow graphs), and from 0.7.0 `document`, `@texuli/document`'s JSON Schema export pinned by digest (`EXTERNAL_SCHEMAS`: not in the dialect, no projection; `packages/catalog/tests/validate-document.test.ts` keeps it equal to `documentJsonSchema()`), and from 0.8.0 `canvas`, `@texuli/canvas`'s export pinned the same way (`packages/catalog/tests/validate-canvas.test.ts` keeps it equal to `canvasJsonSchema()`; the blueprint's `$defs.canvas` checks a `canvas` node's envelope), and from 0.10.0 `design-system` (the design-system document, generated from `src/design-system/vocabulary.ts` by `scripts/design-system-schema.ts`; in the dialect, projected like the others) |
| `catalog/components.json` | The closed vocabulary, projected from the built catalog: id, label, summary, group, placement (`app`/`content`), emit tiers, capability and props |
| `catalog/capabilities.json` | Reviewed capability claims. Empty: no id is audited portable yet, so every capability is `unknown` (ADR-003) |
| `fixtures/golden/` | Ten blueprints that must validate (fictional data): a report, a dashboard, a proactive deck and a report with a named slot and a `when` condition (0.2.0 envelopes), and five 0.3.0 interfaces: `app-dashboard` (filters bound to state), `mobile-flow` (flow views, forms, `flowGo`), `sortable-board` (reorder groups, locked, clone, `on.move`), `workflow-builder` (an edit-mode `workflow-graph` bound to state) and `lego` (layouts, a data board, charts, media, blocks, a sortable palette and outline, and a workflow editor in one tree). `@texuli/player`'s `golden.test.ts` and `lego.test.ts` paint them |
| `fixtures/invalid/` | Blueprints that must fail with exact diagnostic codes, one or more per code, including slot and condition cases (an undeclared or root `slot`, an unknown condition `op`, an extra condition field) and the 0.3.0 cases (a refused state declaration, an unknown variable, a two-key binding, an undeclared event, an action missing its fields, an unknown `spec` version) and the state surface cases (bidi in a list item, form nodes outside an `action-form`, a control and a flow view with nothing declared) |
| `fixtures/design-systems/` | From 0.10.0: `acme.json` (every section) and `minimal.json`, which must validate; `invalid/` documents (`{ description, expect, trust?, resolve?, document }`, one per validate code) that must fail with exact codes and paths; and `migrations/v<n>.json`, one per `formatVersion`. Kept out of `golden/` and `invalid/`, which hold blueprints |
| `fixtures/workflow/` | `golden/` workflow graphs that must validate (a six-node pipeline) and `invalid/` graphs (`{ expect, graph }`) that must fail with exact codes: a dangling edge, an undeclared node type, a forbidden cycle |
| `manifest.json` | The spec version, the dialect and a SHA-256 per normative file |
| `versions.json` | Every released spec version pinned to its spec digest (not normative: it pins the normative files) |
| `generated/typescript/`, `generated/kotlin/` | The projections. Never edit them |
| `generated-manifest.json` | A SHA-256 per generated file |

## The dialect

Schemas use a closed subset of JSON Schema 2020-12 (`DIALECT_KEYWORDS`):
`type`, `properties`, `required`, `additionalProperties`, `items`, `enum`,
`const`, string, number and array bounds, `pattern`, and local `$ref` /
`$defs`. Objects must be closed (`additionalProperties: false`) or explicit
maps. Anything else fails `checkSchemaDocument`, and generation refuses it.

## Exports

- `@texuli/spec`, the runtime half:
  - the generated types (`BlueprintEnvelope`, `SpecCatalog`, `SpecValidation` …);
  - `SPEC_COMPONENT_IDS` and `SpecComponentProps`;
  - `validateInstance` (the dialect validator);
  - `validateBlueprint` (the target-neutral blueprint check: envelope
    schema, closed ids and props, prop kinds and enums, required props, no
    platform-extension props from data, a node `slot` that names a slot prop
    of its parent (`unknown-slot`), the portable profile failing closed,
    and an optional catalog binding);
  - from 0.3.0, the state, flow, binding, `bind`, `on` and property-schema
    rules below and the contract constants (`src/contract.ts`), which
    `tests/spec.test.ts` keeps equal to the schemas;
  - `canonicalJson` and a synchronous `sha256`.
- `@texuli/spec/workflow` (`src/workflow.ts`), opt-in at run time:
  `validateWorkflowGraph`. The root never imports it, so blueprints without
  workflow graphs do not pay for it. `validateBlueprint` checks a `workflow`
  state variable or a `workflowGraph` prop only when `SpecDocuments` carries
  both `workflowSchema` and `validateWorkflowGraph`; without either, they
  fail closed (`state` and `prop-type`).
- `@texuli/spec/migrate` (`src/migrations/index.ts`), opt-in at run time:
  `migrateBlueprint`, `SPEC_MIGRATIONS` and `UNDECLARED_SPEC_VERSION`.
- `@texuli/spec/surface` (`src/surface.ts`, no imports): `checkStateSurface`,
  `surfaceInputs`, `SPEC_CONTROL_STATE_TYPES`, `SURFACE_PLAYER_CODES` and
  `LIST_TEXT_PATTERN`. `validateBlueprint` runs it, and `@texuli/catalog`'s
  `validateDraft` imports it, so both refuse the same nodes.
- `@texuli/spec/codegen`, build time: `buildSpec`, `projectCatalog`,
  `checkConformance`, `checkCatalogContract`, `formatJson`. The conformance
  harness passes the workflow validator itself.

URL policy, tree limits, grammar and rendering stay in the runtime validator,
`@texuli/catalog/validate`.

## Projections

- **Web extensions.** Props of kind `slot`, `event` or `unknown`, and the
  `class`, `className`, `style` and chart `renderer` props, are marked
  `extension: "web"`. They are left out of `SpecComponentProps`, and data
  that sets them is refused.
- **Kotlin** (`com.texuli.spec`, Kotlin 1.9+ for `entries` and
  `data object`): data classes, closed enums and static decoders over a
  generated `JsonValue` model, with no library dependency. Decoders check
  JSON types, required and unknown fields, enums and constants. Patterns
  and limits are the shared validator's job. A wire name starting with `$`
  (`$state`, `$data`, a property schema's `$ref`) becomes a property without
  it (`state`, `data`, `ref`); the wire name is always an escaped string
  literal, never a Kotlin string template, and two names that would
  collide fail generation.
- **Stamp.** Every generated file carries the spec version and a digest of
  the normative files. There are no timestamps, and output is
  byte-identical for the same inputs in any order.

## Regenerate

```bash
pnpm exec tsx packages/spec/scripts/bootstrap-catalog.ts   # refresh catalog/components.json from the built catalog
pnpm exec tsx packages/spec/scripts/generate.ts            # write manifests and projections
pnpm exec tsx packages/spec/scripts/generate.ts --check    # fail on drift
```

## Conformance

`pnpm vitest run packages/spec` runs the harness. Drift is a failed gate:
- every schema stays in the dialect;
- the manifest digests match the normative files;
- regenerating gives byte-identical files, none missing or extra;
- the golden fixtures validate and the invalid fixtures fail with exactly
  their codes, covering every diagnostic code (with the workflow fixtures);
- the blueprint and workflow `$defs` stay disjoint; every catalog property
  schema is in the dialect, sits on an array or object prop and names only
  contract `$ref`s; bindable props are declared portable props; and no
  `deprecated` entry outlives its window (see below);
- `components.json` equals the projection of the live catalog, and the
  blueprint schema matches the envelope `@texuli/catalog` reads;
- generation is deterministic and refuses schemas outside the dialect;
- the Kotlin text declares its package, balances its brackets, defines
  every type it references and decodes closed;
- the spec version and digest match the newest release in `versions.json`.

When the catalog changes, refresh `components.json`, regenerate and review
the diff. Then classify the change, bump the version, and pin it (see
Versioning).

## Versioning

**The spec digest** is the SHA-256 of `manifest.json`'s canonical JSON: the
spec version, the dialect and a digest per normative file (schemas,
`catalog/components.json`, `catalog/capabilities.json` and every fixture).
Every generated file carries it in its stamp (`// Spec 0.3.0, digest …`).
The same normative files always give the same digest.

**The version follows the digest.** Every normative change changes the
digest, and a changed digest needs a new semantic version.
`tests/spec.test.ts` fails when the digest moves without one. The
release goes in `versions.json`: its version, its digest, its change class
and a one-line summary.

| Class | What it covers | Before 1.0.0 | From 1.0.0 |
| --- | --- | --- | --- |
| patch | Nothing accepted changes: descriptions, diagnostic wording, a new fixture for behavior that already holds | patch | patch |
| minor | Additive: optional fields, new catalog ids, new optional props, new diagnostic codes for data that was already refused, new named extensions. Existing portable fixtures still pass | minor | minor |
| major | Removing or renaming ids, props or fields; changing a prop type; making something required; changing what accepted data means | minor | major |

`nextSpecVersion(previous, class)` computes the step and
`checkVersionHistory` enforces it. Before 1.0.0, any change to accepted data
bumps the minor number. Moving to 1.0.0 is a release decision for the owner,
not a side effect of a change. 0.1.0, the bootstrap, has no pinned digest:
its normative files moved without a version until 0.2.0.

**What a projection change means for consumers:**
- **TypeScript (`@texuli/spec`):** a patch release leaves the generated types
  and `SPEC_COMPONENT_IDS` alone, apart from the stamp. Code that compiled
  against a minor release keeps compiling, but new optional fields and ids
  can appear in data it reads. A major-class change (a minor bump before
  1.0.0) may remove or retype what it relied on.
- **Kotlin and native (`native/`):** `texuli-spec` compiles
  `generated/kotlin` from this package, so a native build always matches the
  checked-out spec. The generated decoders are closed: a blueprint that uses
  a field from a newer spec fails to decode on an older native build with a
  `schema` diagnostic. It does not pass silently. After a change, regenerate,
  rebuild native, and refresh the conformance traces when goldens moved
  (`pnpm exec tsx native/conformance/web/trace.ts --write`). Native
  conformance compares the native refusals with every invalid fixture's
  codes.
- **Blueprints:** a blueprint binds to an exact catalog hash. From 0.3.0
  an envelope may declare the exact spec version it was written for
  (`spec`, an enum of the current version; omitted means 0.2.0). A field
  for a compatible spec *range* is **planned, not built**.

**Migrations** (`src/migrations/<from>-<to>.ts`, exported from
`@texuli/spec/migrate` as `migrateBlueprint`, `SPEC_MIGRATIONS` and
`UNDECLARED_SPEC_VERSION`) run
before validation. Each step is pure (it never mutates its input) and
moves one version. `migrateBlueprint(input, target = SPEC_VERSION)` never
throws: a value that is not an envelope, or one declaring a version no
chain starts from, passes through with `applied: []` (validation then
refuses an unknown `spec`). It is idempotent, touches only the `spec`
field (the tree, status, provenance and activation digest stay valid), and
keeps a parsed `__proto__` key as an own property, which validation still
refuses. `0.2.0 → 0.3.0` is additive: it stamps `spec: "0.3.0"`. Every later step
(`0.3.0 → 0.4.0`, `0.4.0 → 0.5.0`, `0.5.0 → 0.6.0`, the
motion vocabulary in [motion.md](motion.md), `0.6.0 → 0.7.0`, node keys
and documents, `0.7.0 → 0.8.0`, data sources, forms, canvases and sheets,
`0.8.0 → 0.9.0`, a catalog projection refresh, and `0.9.0 → 0.10.0`, the
design-system document) is additive and stamps only `spec` as well. The tests
check that `SPEC_MIGRATIONS` covers every consecutive pinned pair in
`versions.json` from 0.2.0 to `SPEC_VERSION`. Inside a plan that has not
published a spec version, later normative changes amend that version's pin
rather than minting a new one (ADR-008).

**Deprecation.** A catalog component or prop may carry
`deprecated: { since, replacement? }`. Validation then adds a `deprecated`
warning (`SpecValidation.warnings`; `ok` is unaffected). It warns for one
minor: conformance fails once the spec minor reaches `since` + 1, so the
entry must be removed by then.


## Spec 0.7.0: node keys and documents

ADR-011, ADR-012 and ADR-014; additive, so the `0.6.0 → 0.7.0` migration
stamps `spec` only.

- **Node keys.** A node may carry `key` (`$defs.nodeKey`,
  `^[A-Za-z0-9._:-]{1,64}$`, `SPEC_PATTERNS.nodeKey`): a stable instance id,
  unique in its tree. A repeat is `duplicate-key` (a new code, for data the
  envelope already carried); the schema refuses a malformed key. Streaming,
  live updates and the `patchDocument` edit op address nodes by key.
- **Documents.** The agent-emittable `document` catalog id takes a required
  `doc` prop whose property schema is `{ "$ref": "#/$defs/document" }`
  (`SPEC_PROP_REFS` gains `document`). `$defs.document` checks the
  document's envelope only: `format` `texuli-document`, `formatVersion` 1,
  `meta`, `page`, `blocks` (at most `SPEC_LIMITS.documentBlocks`, 2,000
  objects) and `annotations`, nothing else. The closed block vocabulary, text
  safety, the URL policy and the caps belong to `@texuli/document/schema`,
  which `@texuli/catalog`'s `validateDraft` runs through the host's
  `checkDocument` (structure only here, as for every prop).
- **Document patches.** `$defs.editOp` gains `patchDocument` with `key` and
  `patch` (`$defs.documentPatch`: at most `SPEC_LIMITS.documentPatchOps`,
  1,000 `$defs.documentPatchOperation`s, each `{ op, path, from?, value? }`
  with `op` in `add`, `remove`, `replace`, `move`, `copy`, `test`), so a
  provenance chain can record document edits. The catalog edit parser
  decides which fields each op takes.
- **Fixtures.** The `document-brief` golden (a keyed document with a link, a
  list, a wrapped stat, a component embed and a callout) and the
  `duplicate-key`, `node-key`, `document-format`, `document-extra-field` and
  `document-patch-op` invalid fixtures. The Kotlin twin decodes and refuses
  the same; painting documents natively is planned (a visible placeholder).

## Spec 0.8.0: forms (T-forms)

ADR-012 and ADR-015; additive, so the `0.7.0 → 0.8.0` migration stamps
`spec` only. (Spec 0.8.0 ships in `@texuli/spec@0.8.0`; the other
additions of the wave are described with their tasks.)

- **The expression AST.** `$defs.expression` is the closed AST of
  `@texuli/core/expression`: the `numberFormula` and `condition` ops plus
  `str`, `bool`, `null`, `field`, `mod`, `neg`, `concat` and `call` (a
  function of the closed table), and the `ref` and `range` nodes reserved
  for dialects (the planned sheets formulas; refused in forms). Structural
  shape only: which members each op needs, the function table and arity,
  1,000 nodes and depth 32 are the runtime parser's.
- **Forms.** The agent-emittable `schema-form` catalog id takes a required
  `schema` prop whose property schema is `{ "$ref": "#/$defs/formSchema" }`
  (`SPEC_PROP_REFS` gains `formSchema`), with `$defs.formField` (15 closed
  types; named `format`s; `validator` names; no `pattern` member),
  `formOption`, `formSection`, `formStep`, `formWhen` (`show`, `require`,
  `enable` expressions), `formVisibility`, `formLink`, `formMessages` and
  `formRule` (cross-field expressions). Members per type, ranges, unique
  names, links through the URL policy and the conditions' field references
  belong to `@texuli/forms/model`, which `validateDraft` runs through the
  host's `checkForm`.
- **Fixtures.** The `form-registration` golden (three steps, sections,
  conditions, a cross-field rule) and the `form-pattern`,
  `form-field-type`, `form-format` and `form-expression-op` invalid
  fixtures. The Kotlin twin decodes the shape and applies the list caps;
  painting forms natively is planned (a visible placeholder).

## Spec 0.9.0: a catalog projection refresh (T-gaps-87-95)

PLAN_011; additive, so the `0.8.0 → 0.9.0` migration stamps `spec` only.
The Protoyard gap fixes G87–G95 changed agent catalog manifests (the button
pending note and the gap props that reach the manifests), which moved the
catalog hash in `catalog/components.json` and with it the spec digest. The
envelope shape, the `$defs` and the diagnostic codes are unchanged; the
`spec` enum gains `0.9.0`, and every committed golden and invalid fixture
is stamped `0.9.0`. Spec 0.9.0 ships in `@texuli/spec@0.9.0` (digest
`497df4d3b0c67d53483163ebd9bd73733b52caf5f8e2966478f1cf860e6f9d9d`; the
cartesian charts' `xKind` and `locale`, G97, reached the projection too).

## Spec 0.10.0: the design-system document (T-ds-spec)

PLAN_011, ADR-021; additive, so the `0.9.0 → 0.10.0` migration stamps
`spec` only. It adds `schemas/design-system.schema.json` (format
`texuli/design-system`, `formatVersion` 1), its TypeScript and Kotlin
projections (`generated/typescript/design-system.ts`,
`generated/kotlin/.../DesignSystem.kt`), the `fixtures/design-systems/`
documents, and `$defs.designSystemReference` in the blueprint schema
(`{ ref }` or `{ inline }`), which the envelope does not carry yet. The
`spec` enum gains `0.10.0`, and every committed golden and invalid fixture
is stamped `0.10.0`. The schema is generated: edit the vocabulary table,
then run `pnpm exec tsx packages/spec/scripts/design-system-schema.ts` and
the spec generator (`tests/design-system.test.ts` fails on drift). The
Kotlin generator turns hyphenated wire names into camelCase properties
(`height-md` → `heightMd`) for the component keys; the wire name is
unchanged. Rules and API: [design-system.md](design-system.md). Spec 0.10.0
is in development on `release/0.10.0` (digest
`4831b17eba9c64ff5e0ba80281502aac1af69a86ee8f89aa6c301f4057680530`); it ships only with
`@texuli/spec@0.10.0`.

## Named slots and conditions

A node may carry `slot` (audit G04: the parent's named slot, a string such as
`hero`) and `when` (audit G07: the blocks `Condition` AST that shows the node
when true). Both match what `@texuli/catalog` renders.

## Spec 0.3.0: state, bindings, actions, events and workflows

ADR-008 moves interaction into the contract while keeping blueprints data
only: every set below is closed, unknown fields are refused, and nothing is
evaluated. The dialect has no unions, so each sum type is one closed record
with an enum discriminator (`op`, `type`) and the per-variant rules live in
`validate.ts` (mirrored by the Kotlin validator).

**State and flow** (envelope `state`, `flow`; code `state`). At most 64
variables named `^[a-z][A-Za-z0-9_]{0,31}$`. Types: `boolean` (default
`false`), `number` (`min` ≤ `max` required, default `min`), `enum` (1–32
distinct values of 1–64 characters, default the first), `string`
(`maxLength` 1–1000, default 200; default `""`), `list` (`maxItems` 0–500,
default 500; items are `{ id, ...fields }` with a unique item key
`^[A-Za-z0-9._:-]{1,64}$` and at most 16 scalar fields; string fields
follow `listText`, below), `workflow` (an
`initial` graph that must pass the workflow rules, checked only when the
host supplies the workflow schema and validator; otherwise `state`). A
`source` (host data
name such as `tickets.open`) makes a scalar variable host-bound: read-only
to the blueprint; lists and workflows take no `source`. A `flow` has 1–16
distinct views, an `initial` view and at most 64 transitions
`{ from (a view or *), to, on, when? }`; the `when` guard is the node
condition AST. A refused declaration stays declared, so its uses are not
also reported.

**Bindings** (code `binding`, `unknown-state`). A prop value
`{"$state": name}` reads a declared variable; its declared initial value
(the first paint) must fit the prop's kind, enum and property schema.
`{"$data": name}` reads host data: read-only, and only as a whole
top-level prop of kind string, number, boolean or enum. A binding has
exactly one key. Inside an array or object prop, `$state` bindings may sit
at any depth (each must be declared, and must fit its schema position when
the prop has a property schema); `$data` may not. Node `bind`
(`{ prop: {"$state": name} }`) is a two-way binding: the prop must be in
the component's `bindable` list, not also set in `props`, and the variable
must be writable and fit. A `when` condition's `var` operands read declared
number and boolean variables (booleans as 1/0), as the player does; their
names are not checked.

**Events and actions** (codes `unknown-event`, `action`). Node `on` maps an
event to 1–8 actions run in order. Events are the closed vocabulary
`press`, `change`, `select`, `submit`, `dismiss`, `move`, and each key must
be one the component lists in `events`. Actions (`op`), with the fields
each takes (anything else is refused):

| `op` | Fields | Rules |
| --- | --- | --- |
| `setState` | `state`, one of `value` or `fromEvent: "value"` | A writable scalar variable; `value` must fit it; `fromEvent` only on `change` or `select` |
| `toggleState` | `state` | A writable boolean |
| `moveItem` | `from`, `item`, `to?`, `index?` (0–499) | Writable lists |
| `flowGo` | `event` | A declared flow with a transition on `event`; the guard is evaluated at run time |
| `emit` | `intent`, `values?` | A host intent; at most 32 values, each a boolean, a finite number, a string of at most 2,048 or a `$state` binding of a scalar variable |
| `submit` | none | Only inside an `action-form` (what `form-submit` does today) |

**`moveItem` semantics** (normative; the reducer lives in the runtime): if
item `k` is not in `from`, or is locked in the source, refuse with no
change. Otherwise remove it from `from` and insert it into `to` (default
`from`) at `clamp(index ?? len, 0, len)`; refuse if the target would exceed
its `maxItems`. With `pull: "clone"`, insert a copy with id `<id>-<n>`, `n`
the smallest number ≥ 2 not in use; refuse if that id would exceed 64
characters.

**Drag as data.** `reorder` is not a node field: it is a container prop
whose catalog prop has `schema: { "$ref": "#/$defs/reorder" }`:
`{ bind, axis?, group?, accepts?, locked?, pull?, disabled? }`. Its items
are the bound list (`bind` must be `$state` of a writable list); a drop or
keyboard move runs `moveItem`. Containers sharing a group exchange items
when `accepts` allows; `pull` is `move`, `clone` or `none`.

**Property schemas** (catalog `prop.schema`, array and object props only).
A dialect subset (`type`, `properties`, `required`, `additionalProperties`,
`items`, `enum`, string, number and array bounds; no `pattern`, for regex
parity across targets). Objects are closed unless `additionalProperties`
gives a map. `$ref` names one of `binding`, `reorder`, `action`,
`eventMap`, `condition`, `document` (from 0.7.0), `formSchema` (from 0.8.0)
(blueprint `$defs`) or `workflowGraph` (the workflow root). A value that does not match reports its first issue as
`prop-type`; a `workflowGraph` prop validated without the workflow schema
or the workflow validator fails closed with `prop-type`.

**Workflow graphs** (`schemas/workflow.schema.json`, `validateWorkflowGraph`
from `@texuli/spec/workflow`, code `workflow` after a clean schema pass). A graph declares closed
`nodeTypes` (1–64; each with up to 16 typed ports and 32 fields), nodes
(≤ 500), edges (≤ 2,000), optional groups (≤ 64), a `cycles` policy
(`allow`, the default, or `forbid`) and a viewport. Labels are 1–200
characters with no control characters and no bidirectional overrides or
isolates. The rules, linear in nodes plus edges: unique ids (node types;
ports and fields within a type; nodes; edges; groups); every node's type
and group declared; node `data` keys are declared fields with a value of
the field kind (string ≤ `maxLength`, default 2,000, no control or bidi
characters except tab and newline; finite number; boolean; enum member)
and required fields present; edges go from an existing node's declared
`out` port to an existing node's declared `in` port, with equal `kind`
when both declare one; a port without `multiple` takes one edge; no two
edges join the same ports; and `cycles: "forbid"` means acyclic (a
self-loop counts). `@texuli/workflows/model` is the editor's runtime
model; this schema is the interchange contract.

**The state surface** (codes `action`, `binding`, `state`;
`src/surface.ts`). So that a blueprint that validates always paints, the
validator refuses exactly what `@texuli/player` refuses at paint time, with
the player's messages and its codes mapped onto the closed set
(`action-binding` → `action`, `control-binding` and `host-binding` →
`binding`, `flow-binding` → `state`):

- `form-field` and `form-submit` sit inside an `action-form`; forms never
  nest; a form's `action` and a field's `name` match the intent pattern;
  field names are unique in a form; a field writes a declared variable of
  its type (`kind: "number"` a number, others a string).
- `control-toggle`, `control-choice`, `control-slider` and `control-filter`
  name a declared `boolean`, `enum`, `number` or `string` variable.
- `flow-view` names a declared view and `flow-action` an event some
  transition handles; neither appears without a `flow`.
- No control or field writes a host-bound variable (one with a `source`).

An envelope with `state` or `flow` has declarations (empty with only a
flow); without either, every control, field and flow node is refused.
`packages/player/tests/surface-parity.test.ts` proves the two agree on a
corpus that exercises every player code.

**List item text** (`SPEC_PATTERNS.listText`, code `state`). String fields
of list items refuse C0 and C1 controls (tab and newline included),
bidirectional overrides and isolates (U+202A–202E, U+2066–2069) and the
invisible formatting characters U+061C, U+180E, U+200B, U+200E, U+200F,
U+2060–2064 and U+FEFF, so a draggable item never hides or reorders its
text. ZWNJ and ZWJ (U+200C, U+200D) stay allowed: Persian and Indic
scripts and emoji sequences need them. The catalog and the player's list
parsing apply the same pattern.

**The Kotlin twin.** `native/texuli-spec` mirrors every rule above in the
TypeScript order (`SpecValidator.kt`, `PropSchemaValidator.kt`,
`WorkflowValidator.kt`, `Contract.kt`, `Surface.kt`), and the conformance module checks
that every invalid blueprint and workflow fixture is refused with the same
codes on both targets. Known differences, all on input that is refused on
both targets: the generated decoders stop at the first shape error, so
Kotlin reports one `schema` diagnostic where TypeScript may list several,
and skips the semantic checks a malformed value would also have failed;
outside workflow graphs Kotlin does not check the schema's patterns, and
reports out-of-range state limits (`values`, `maxLength`, `maxItems`) as
`state` rather than `schema`. The TypeScript workflow validator is an opt-in subpath for
bundle size; Kotlin always links `WorkflowValidator.kt`, so its validator
has no fail-closed mode for a missing workflow validator (the conformance
harness supplies it on the TypeScript side, so fixtures compare equal).

## Not yet

- Behavior contracts, token roles and the token-to-Compose generator (B1
  steps 2 and 5).
- Making the spec authoritative for the web packages (B1 step 3 cutover);
  today the catalog manifests are the bootstrap input.
- Compiling the Kotlin, and the native runtime (B2).
- A full type for `when`. The dialect has no unions, so `condition` and
  `numberFormula` are closed records whose `op` is an enum and whose operands
  are typed (except `value`, which is a number for `num` and a formula for
  `round` and `clamp`). Which operands each `op` needs, and the formula
  limits, are checked by the runtime parser in `@texuli/blocks/formula`.
