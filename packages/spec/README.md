# @texuli/spec

The blueprint contract of [Texuli](https://texuli.com), an MIT-licensed
Svelte 5 component library by Dailybot, Inc. (*Small pieces. Infinite
possibilities.*). A **blueprint** is a JSON document, usually written by an
AI agent, that describes an interface as a tree of components from Texuli's
closed catalog. `@texuli/spec` is the platform-neutral source of truth for
that format: the generated TypeScript types, the closed component
vocabulary, a target-neutral blueprint validator and deterministic hashing.

Use it when you generate, store, diff or check blueprints, or build a
renderer for them. The same contract also generates the Kotlin models used
by Texuli's Kotlin Multiplatform twin. The package is framework-free: no
DOM, no Svelte, no Node APIs and no runtime dependencies.

> **Status: 0.x release.** Texuli is in development. The packages are
> published to npm as `0.9.0`, a pre-1.0 release (1.0.0 will be the first
> stable release). Under 0.x, a new minor (`0.10.0`) may contain breaking
> changes, so pin the exact version or use `^0.9.0`, which accepts only 0.9.x.

> **In development (`0.10.0`, not on npm).** The workspace is at **spec
> 0.10.0**: the design-system document (`schemas/design-system.schema.json`,
> format `texuli/design-system`) with its new `@texuli/spec/design-system`
> subpath, and the optional `designSystem` on the envelope and on a
> `document` (`$defs.designSystemReference`: `{ ref: "id@x.y.z" }` or
> `{ inline: <document> }`). Every `0.9.0` envelope migrates by stamping
> `spec`. It ships only with `@texuli/spec@0.10.0`.

> **New in `0.9.0`.** `@texuli/spec@0.9.0` carries **spec 0.9.0**, a
> stamp-only catalog projection refresh (the Button pending note and the
> cartesian charts' `xKind` and `locale`, from the Protoyard gaps G94 and
> G97): the envelope, the `$defs` and the diagnostic codes are unchanged,
> and every `0.8.0` envelope migrates by stamping `spec`.

> **New in `0.8.0`.** `@texuli/spec@0.8.0` carried **spec 0.8.0**, which adds
> data-source bindings (the `@texuli/spec/source` subpath), the
> agent-emittable `schema-form`, `canvas`, `spreadsheet`, `data-dashboard`
> and `data-dashboard-widget` ids with their closed shapes, the closed
> expression AST, and the pinned `schemas/canvas.schema.json`. Every
> `0.7.0` envelope migrates by stamping `spec`.

> **New in `0.7.0`.** `@texuli/spec@0.7.0` carries **spec 0.7.0**, which adds
> an optional node `key` (unique in the tree), the agent-emittable
> `document` id with its `$defs.document` shape, the `patchDocument` edit
> op with a bounded RFC 6902 patch, and the pinned
> `schemas/document.schema.json`. Every `0.6.0` envelope migrates by
> stamping `spec`.

> **New in `0.6.0`.** `@texuli/spec@0.6.0` carries **spec 0.6.0**: the
> closed motion vocabulary (`@texuli/spec/motion`, below), and the new
> `@texuli/spec/stream` subpath reads streamed blueprints. Every `0.5.0`
> envelope migrates by stamping `spec`.

> **New in `0.4.0`.** `@texuli/spec@0.4.0` carries **spec 0.4.0**: spec
> 0.3.0 (state, bindings, closed actions, `reorder`, workflow graphs), spec
> 0.4.0 (deck model v2 on `layout-deck` and `deck-slide`, below) and the
> `workflow`, `migrate` and `surface` subpaths described below.
> `@texuli/spec@0.3.0` carried spec 0.2.0 and only the root and `codegen`
> subpaths
> ([RELEASE](https://github.com/DailybotHQ/texuli/blob/main/docs/RELEASE.md)).

## Install

```bash
npm install @texuli/spec
```

```bash
pnpm add @texuli/spec
# or
yarn add @texuli/spec
```

No peer dependencies and no CSS. The package is ESM-only and ships
TypeScript declarations. The normative JSON documents (the blueprint
schema, the component catalog and the fixtures) live in the
[repository](https://github.com/DailybotHQ/texuli/tree/main/packages/spec);
they are not part of the npm package.

## Quick start

```ts
import {
  canonicalJson,
  type Schema,
  SPEC_COMPONENT_IDS,
  SPEC_VERSION,
  sha256,
  validateInstance,
} from '@texuli/spec';

SPEC_VERSION;                         // the spec version: '0.9.0' in @texuli/spec@0.9.0
SPEC_COMPONENT_IDS.includes('alert'); // true: the closed component vocabulary

// The dialect validator: a closed subset of JSON Schema 2020-12.
const schema: Schema = {
  type: 'object',
  properties: { title: { type: 'string', maxLength: 80 } },
  required: ['title'],
  additionalProperties: false,
};
validateInstance(schema, { title: 'Weekly report' }); // []
validateInstance(schema, { title: 42, extra: true });
// [{ code: 'type', path: '$.title', … }, { code: 'additional-property', path: '$.extra', … }]

// Deterministic serialization and hashing, identical in every runtime.
const digest = sha256(canonicalJson({ b: 1, a: [true, null] }));
```

To check a whole blueprint, pass the blueprint schema and catalog documents
from the repository's `packages/spec/schemas/blueprint.schema.json` and
`packages/spec/catalog/components.json`. Workflow graphs and migrations
are opt-in subpaths, so the root stays small: a host that renders workflow
graphs passes `schemas/workflow.schema.json` and `validateWorkflowGraph`
from `@texuli/spec/workflow` (without both, a `workflow` state variable or
a `workflowGraph` prop fails closed), and a host that reads older
envelopes runs `migrateBlueprint` from `@texuli/spec/migrate` first:

```ts
import { type Schema, type SpecCatalog, validateBlueprint } from '@texuli/spec';
import { migrateBlueprint } from '@texuli/spec/migrate';
import { validateWorkflowGraph } from '@texuli/spec/workflow';

const migrated = migrateBlueprint(blueprint); // 0.2.0 → … → 0.9.0 → 0.10.0 (in development); never throws
const result = validateBlueprint(migrated.blueprint, {
  blueprintSchema: blueprintSchemaJson as Schema,
  catalog: componentsJson as SpecCatalog,
  workflowSchema: workflowSchemaJson as Schema, // only for workflow graphs
  validateWorkflowGraph, // only for workflow graphs
});
if (!result.ok) {
  for (const d of result.diagnostics) console.warn(d.code, d.path, d.message);
}
for (const w of result.warnings ?? []) console.info(w.code, w.path); // `deprecated`
```

A node with an id outside the catalog fails with `unknown-id`. The other
codes are `schema`, `unknown-prop`, `prop-type`, `enum-value`,
`missing-required`, `extension-prop`, `catalog-mismatch`,
`unsupported-profile`, `unknown-slot`, and, from spec 0.3.0, `state` (a
refused state or flow declaration), `unknown-state` (a binding or action
names no declared variable), `binding` (a malformed, misplaced, read-only or
ill-fitting binding), `action` (an action with the wrong fields or target),
`unknown-event` (an `on` key the component does not fire) and `workflow` (a
workflow graph rule), from spec 0.7.0, `duplicate-key` (a node key used
twice in the tree), and, from spec 0.8.0, `source` (a malformed, misplaced or
ill-fitting data-source binding, or any binding when the host passes no
`sources`) and `unknown-source` (a source the host never registered).
Deprecated components and props add a `deprecated`
warning without failing.

## What's inside

| Subpath | Purpose | Headline exports |
| --- | --- | --- |
| `@texuli/spec` | Runtime: types, vocabulary, validation, hashing | `BlueprintEnvelope`, `SpecCatalog`, `SpecValidation`, `WorkflowGraph` and the other generated types; `SPEC_COMPONENT_IDS`, `SpecComponentProps`, `SPEC_CATALOG_HASH`, `SPEC_VERSION`; `validateBlueprint`, `validateTree`, `validateInstance`, `checkSchemaDocument`; the contract constants (`SPEC_ACTION_OPS`, `SPEC_EVENT_NAMES`, `SPEC_STATE_TYPES`, `SPEC_LIMITS`, `SPEC_PATTERNS`, `ACTION_FIELDS`); `canonicalJson`, `sha256` |
| `@texuli/spec/workflow` | Runtime, opt-in: workflow graph validation | `validateWorkflowGraph` (pass it in `SpecDocuments.validateWorkflowGraph`) |
| `@texuli/spec/migrate` | Runtime, opt-in: envelope migrations | `migrateBlueprint`, `SPEC_MIGRATIONS`, `UNDECLARED_SPEC_VERSION` |
| `@texuli/spec/surface` | Runtime: the state surface rules every validator shares (no imports) | `checkStateSurface`, `surfaceInputs`, `SPEC_CONTROL_STATE_TYPES`, `SURFACE_PLAYER_CODES`, `LIST_TEXT_PATTERN` |
| `@texuli/spec/motion` | Runtime (new in `0.6.0`, spec `0.6.0`): the closed motion vocabulary and its check, shared by the catalog and the player ([motion.md](https://github.com/DailybotHQ/texuli/blob/main/packages/spec/docs/motion.md)) | `SPEC_MOTION_PRESETS`, `SPEC_MOTION_DURATIONS`, `SPEC_MOTION_STAGGERS`, `SPEC_MOTION_LEVELS`, `checkNodeMotion`, `checkEnvelopeMotion` |
| `@texuli/spec/stream` | Runtime, opt-in (new in `0.6.0`): streamed blueprints ([stream.md](https://github.com/DailybotHQ/texuli/blob/main/packages/spec/docs/stream.md)) | `createJsonTokenizer`, `createBlueprintAssembler`, `createBlueprintStream`, `STREAM_NODE_ORDER` |
| `@texuli/spec/source` | Runtime (new in `0.8.0`, spec `0.8.0`): data-source bindings, shared by the spec validator, `@texuli/catalog` and the player ([source.md](https://github.com/DailybotHQ/texuli/blob/main/packages/spec/docs/source.md)) | `checkSourceBinding`, `isSourceBinding`, `SOURCE_BINDING_KEY`, `SPEC_SOURCE_LIMITS`, `SPEC_SOURCE_FILTER_OPERATORS`, `SpecSourceDescriptor` |
| `@texuli/spec/design-system` | Runtime, opt-in (in development for `0.10.0`, spec `0.10.0`; not on npm): the design-system document contract (ADR-021) ([design-system.md](https://github.com/DailybotHQ/texuli/blob/main/packages/spec/docs/design-system.md)) | `validateDesignSystem`, `validateDesignSystemPatch`, `applyDesignSystemPatch`, `migrateDesignSystem`, `checkDesignSystemReference`, `DesignSystem`, `DesignSystemPatch`, `DESIGN_SYSTEM_CODES`, `DESIGN_SYSTEM_LIMITS` |
| `@texuli/spec/codegen` | Build time: generation and conformance | `buildSpec`, `projectCatalog`, `checkConformance`, `checkCatalogContract`, `formatJson`, `nextSpecVersion`, `checkVersionHistory` |

## Key guarantees

- **Closed vocabulary.** Component ids, prop names, prop kinds and enum
  values are closed; anything outside the catalog is refused.
- **No platform props from data.** Web-only props (slots, events, `class`,
  `className`, `style` and the chart `renderer`) are marked as web
  extensions, left out of `SpecComponentProps`, and refused when a
  blueprint sets them.
- **Fails closed.** The portable profile is refused until a capability is
  audited portable, and a blueprint bound to another catalog hash is
  refused when you pass `catalogHash`.
- **Deterministic.** Canonical JSON sorts keys at every depth, and every
  generated file carries the spec version and digest with no timestamps.
- **Interaction as data, never code.** Spec 0.3.0 adds local state,
  bindings (`{"$state": name}`, read-only `{"$data": name}`), a closed
  action set (`setState`, `toggleState`, `moveItem`, `flowGo`, `emit`,
  `submit`) on a closed event vocabulary, drag as data (`reorder`) and
  workflow graphs (at most 500 nodes and 2,000 edges). Nothing in a
  blueprint is evaluated.
- **Decks as data.** Spec 0.4.0 (ADR-009) gives
  `layout-deck` and `deck-slide` optional deck model v2 props: the 9:16
  aspect, the `slide`, `zoom` and `morph` transitions, motion, navigation,
  outline, a slide `layout` with its `props`, `background`, step labels and
  component slides. The change is additive: every 0.3.0 envelope is a valid
  0.4.0 envelope, and the `0.3.0 → 0.4.0` migration only stamps `spec`. The
  deck model itself is validated by `@texuli/deck`, not by this package.
- **Motion as data (spec 0.6.0, new in `0.6.0`).** A node may declare `motion`
  (`enter` and `exit` presets `fade`, `rise`, `scale`, `slide-start` and
  `slide-end`; `layout`; `stagger` and `duration` in token steps) and the
  envelope a `motion.level` (`full`, `subtle`, `none`). Names map to the
  motion tokens: a blueprint never carries CSS, keyframes, milliseconds or
  code, and anything else is refused. The `0.5.0 → 0.6.0` migration only
  stamps `spec`.
- **Documents as data (spec 0.7.0, new in `0.7.0`).** A
  `document` node's `doc` must have the document shape (`$defs.document`);
  the document's own vocabulary and URL policy are checked by
  `@texuli/document` through `@texuli/catalog`'s `validateDraft`. Agents
  edit documents with `patchDocument` (at most 1,000 RFC 6902 operations),
  addressed by node `key`.
- **Streams parse, never guess.** `@texuli/spec/stream` (new in `0.6.0`)
  reads a blueprint split anywhere in linear time under a byte budget and a
  depth cap, reports a node only once its shell (everything but
  `children`) has closed, and refuses duplicate and prototype keys. It
  judges no rule: the catalog checks each node, and the complete draft
  goes through `validateDraft`.
- **Structure only.** This validator checks structure. URL policy, tree
  limits and rendering live in the runtime validator of
  [`@texuli/catalog`](https://www.npmjs.com/package/@texuli/catalog). The
  reducers that run the actions belong to the runtime
  ([`@texuli/player`](https://www.npmjs.com/package/@texuli/player)), which
  runs every 0.3.0 action from `0.4.0`).
- **A blueprint that validates paints.** The state surface rules
  (`@texuli/spec/surface`) refuse exactly what the player refuses at paint
  time: form fields and submits outside an `action-form`, nested forms,
  controls and fields that name no declared variable of their type, flow
  nodes without a matching view or event, and writers of a host-bound
  variable. The spec, `@texuli/catalog`'s `validateDraft` and the Kotlin
  twin run the same rules.
- **Data as a named source, never a request (spec 0.8.0, new in `0.8.0`).** A
  component's `sourceable` prop may read rows with
  `{"$source": name, "query": {...}, "map": {...}}`: an opaque name the host
  registered, and a closed query (projection, the `@texuli/data` grid filter
  model, sort, search, a page size). It is checked against the host's source
  descriptors (`SpecDocuments.sources`) and refused without them; nothing in
  it is a URL, SQL or code
  ([source.md](https://github.com/DailybotHQ/texuli/blob/main/packages/spec/docs/source.md)).
- **Forms as data, never patterns or code (spec 0.8.0, new in `0.8.0`).** The
  agent-emittable `schema-form` id carries a closed form schema
  (`$defs.formSchema`): fields of 15 closed types in sections or steps,
  named formats and host validator names (never a regular expression),
  and conditions and cross-field rules in the closed expression AST of
  `@texuli/core/expression` (`$defs.expression`, the `numberFormula` and
  `condition` shapes extended with strings, booleans, field references and
  calls to a closed function table). The schema checks the shape; the
  forms validator (`@texuli/forms/model`, `checkForm` in `validateDraft`)
  checks the rest at the host's tier. The Kotlin twin decodes the shape and
  its list caps and paints a placeholder (planned).
- **Dashboards as data (spec 0.8.0, new in `0.8.0`).** The agent-emittable
  `data-dashboard` id holds `data-dashboard-widget` children (`widgetId`,
  `title` and a `place` in grid units); widget content is ordinary catalog
  nodes, so its data comes only from host sources. The dashboard's `layout`
  (a bounded list of `{id, x, y, w, h}` grid units) is bindable and
  sourceable, so a state or a host source persists what people arrange. The
  schema bounds the grid units; `@texuli/catalog` checks the composition
  (widgets only directly in a dashboard, unique ids) on the web. The Kotlin
  twin decodes the props and paints a placeholder (planned).
- **Spreadsheets as data, formulas in a closed grammar (spec 0.8.0,
  new in `0.8.0`).** The agent-emittable `spreadsheet` id (not `sheet`, which
  is the texuli `Sheet` overlay) carries a sheet in its `sheet` prop
  (`$defs.sheet`, `$defs.sheetTab`): `format` `texuli-sheet`, 1 to 16 tabs
  of `{ id, name, rows, columns, cells }` with cells keyed by A1 address.
  The schema checks that envelope and its caps; the sheet validator
  (`@texuli/sheets/model`, `checkSheet` in `validateDraft`) parses every
  formula with the sheet grammar (no `INDIRECT`, `OFFSET` or `RAND`, a
  closed function set). The Kotlin twin decodes the envelope and its caps;
  painting it is planned.
- **List item text never hides or reorders itself.** String fields of list
  state items refuse control characters, bidirectional overrides and
  isolates, and invisible formatting characters (`SPEC_PATTERNS.listText`;
  ZWNJ and ZWJ stay allowed for scripts and emoji).

## Versioning

The spec has its own semantic version (`SPEC_VERSION`), separate from the
npm package version. The **spec digest** is the SHA-256 of the manifest
that pins every normative file (schemas, catalog and fixtures); any
normative change moves the digest and requires a new spec version.

| Change class | Examples | Before 1.0.0 | From 1.0.0 |
| --- | --- | --- | --- |
| patch | Descriptions, diagnostic wording, a fixture for behavior that already holds | patch | patch |
| minor | Optional fields, new catalog ids, new optional props, new diagnostic codes for data that was already refused | minor | minor |
| major | Removing or renaming ids, props or fields; changing a prop type; making something required | minor | major |

For TypeScript consumers, a patch leaves the generated types and
`SPEC_COMPONENT_IDS` unchanged; code that compiled against a minor release
keeps compiling, though new optional fields and ids can appear in data it
reads. Native (Kotlin) builds compile the generated models from the same
spec, and their decoders are closed: a blueprint that uses a field from a
newer spec fails to decode on an older native build with a `schema`
diagnostic instead of passing silently. A blueprint binds to an exact
catalog hash, and from 0.3.0 may declare the exact spec version it was
written for (`spec`; omitted means 0.2.0). `migrateBlueprint`
(`@texuli/spec/migrate`) brings an
envelope up to the current spec with pure, per-version steps
(`src/migrations/`: `0.2.0 → 0.3.0`, `0.3.0 → 0.4.0`, `0.4.0 → 0.5.0`,
`0.5.0 → 0.6.0`, `0.6.0 → 0.7.0`, `0.7.0 → 0.8.0`, `0.8.0 → 0.9.0` and
`0.9.0 → 0.10.0`, each of which only stamps `spec`); a compatible version
range is planned, not built. The workspace is at spec `0.10.0` (digest
`c6d6cb0753100f3807ecb6e03bcd3aca2e151bb13a654b99ec1595c5caf92b13`), which adds the
design-system document (PLAN_011 T-ds-spec) and the envelope's
`designSystem` (T-ds-blueprint); it is in development on
`release/0.10.0` and ships only with `@texuli/spec@0.10.0`, which is not on
npm yet. `@texuli/spec@0.9.0` carries spec `0.9.0` (digest
`497df4d3b0c67d53483163ebd9bd73733b52caf5f8e2966478f1cf860e6f9d9d`), an
additive catalog projection refresh (PLAN_011 T-gaps-87-95 and
T-gaps-96-98); `@texuli/spec@0.8.0` carried spec `0.8.0` (digest
`f6b6388280d247eb9c3106a925111f35b90d1ec3b59c23652542f06a9f103daf`), which
adds data-source bindings, forms, canvases, dashboards and spreadsheets;
`@texuli/spec@0.7.0` carried spec `0.7.0` (digest
`43e44fa9a198d337d686b4e2d86882a06a676ae1e1c1f02d023b3a525795a8b2`), which
adds node keys and documents; `@texuli/spec@0.6.0` carried spec `0.6.0` (digest
`37141b85b9ab9f02af849a62a9c97ba729d6c5c2705130290bcdf45b308ea4cc`), which
adds the closed motion vocabulary (ADR-012); `@texuli/spec@0.5.0` carried
spec `0.5.0`, which added the `data-cohort-table`,
`data-notification-inbox`, `data-filter-builder` and `time-field` catalog
ids, and `@texuli/spec@0.4.0` spec `0.4.0` (digest
`fac29f542b16ddb78ab401c508e5b8346f655991c56e25aa811f4931661a8cb3`). Every
pin is in `versions.json`.

The full rules (the digest, `versions.json` pins, regeneration and the
conformance harness) are in
[contract.md](https://github.com/DailybotHQ/texuli/blob/main/packages/spec/docs/contract.md).

## Documentation

- Website: [texuli.com](https://texuli.com), the
  [agents overview](https://texuli.com/agents-page/) and
  [web and native](https://texuli.com/web-and-native/)
- Schemas, catalog and fixtures:
  [packages/spec](https://github.com/DailybotHQ/texuli/tree/main/packages/spec)
- The contract in depth (the JSON Schema dialect, projections, conformance
  and versioning): [contract.md](https://github.com/DailybotHQ/texuli/blob/main/packages/spec/docs/contract.md)
- The motion vocabulary (spec 0.6.0):
  [motion.md](https://github.com/DailybotHQ/texuli/blob/main/packages/spec/docs/motion.md)
- Streamed blueprints (the incremental tokenizer, the canonical order and
  node shells; new in `0.6.0`): [stream.md](https://github.com/DailybotHQ/texuli/blob/main/packages/spec/docs/stream.md)
- Data-source bindings (spec 0.8.0; new in `0.8.0`):
  [source.md](https://github.com/DailybotHQ/texuli/blob/main/packages/spec/docs/source.md)
- The design-system document (spec 0.10.0; in development, not on npm):
  [design-system.md](https://github.com/DailybotHQ/texuli/blob/main/packages/spec/docs/design-system.md)
- The Kotlin Multiplatform twin that consumes the generated models:
  [native/README.md](https://github.com/DailybotHQ/texuli/blob/main/native/README.md)
- Architecture: [ARCHITECTURE.md](https://github.com/DailybotHQ/texuli/blob/main/docs/ARCHITECTURE.md)

## Related packages

- [`@texuli/catalog`](https://www.npmjs.com/package/@texuli/catalog): the agent catalog and the renderer with no HTML sinks.
- [`@texuli/player`](https://www.npmjs.com/package/@texuli/player): the Svelte paint runtime for validated blueprints.
- [`texuli`](https://www.npmjs.com/package/texuli): the styled Svelte 5 components blueprints are built from.

## Contributing

Source, issues and contribution guidelines live at
[github.com/DailybotHQ/texuli](https://github.com/DailybotHQ/texuli). Report
bugs at [github.com/DailybotHQ/texuli/issues](https://github.com/DailybotHQ/texuli/issues).

## License

MIT © Dailybot, Inc.

---

Powered by [Dailybot](https://www.dailybot.com?utm_source=dailybotopensource&utm_medium=texuli-spec).
