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
> published to npm as `0.3.0`, a pre-1.0 release (1.0.0 will be the first
> stable release). Under 0.x, a new minor (`0.4.0`) may contain breaking
> changes, so pin the exact version or use `^0.3.0`, which accepts only 0.3.x.

> **Unreleased in this README.** `@texuli/spec@0.3.0` on npm carries **spec
> 0.2.0** and only the root and `codegen` subpaths. The repository is at
> **spec 0.4.0**: spec 0.3.0 (state, bindings, closed actions, `reorder`,
> workflow graphs), spec 0.4.0 (deck model v2 on `layout-deck` and
> `deck-slide`, below) and the `workflow`, `migrate` and `surface` subpaths
> described below are in the repository only, and reach npm with the next
> owner-approved release
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

SPEC_VERSION;                         // the spec version: '0.4.0' in the repository
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

const migrated = migrateBlueprint(blueprint); // 0.2.0 → 0.3.0 → 0.4.0; never throws
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
workflow graph rule). Deprecated components and props add a `deprecated`
warning without failing.

## What's inside

| Subpath | Purpose | Headline exports |
| --- | --- | --- |
| `@texuli/spec` | Runtime: types, vocabulary, validation, hashing | `BlueprintEnvelope`, `SpecCatalog`, `SpecValidation`, `WorkflowGraph` and the other generated types; `SPEC_COMPONENT_IDS`, `SpecComponentProps`, `SPEC_CATALOG_HASH`, `SPEC_VERSION`; `validateBlueprint`, `validateTree`, `validateInstance`, `checkSchemaDocument`; the contract constants (`SPEC_ACTION_OPS`, `SPEC_EVENT_NAMES`, `SPEC_STATE_TYPES`, `SPEC_LIMITS`, `SPEC_PATTERNS`, `ACTION_FIELDS`); `canonicalJson`, `sha256` |
| `@texuli/spec/workflow` | Runtime, opt-in: workflow graph validation | `validateWorkflowGraph` (pass it in `SpecDocuments.validateWorkflowGraph`) |
| `@texuli/spec/migrate` | Runtime, opt-in: envelope migrations | `migrateBlueprint`, `SPEC_MIGRATIONS`, `UNDECLARED_SPEC_VERSION` |
| `@texuli/spec/surface` | Runtime: the state surface rules every validator shares (no imports) | `checkStateSurface`, `surfaceInputs`, `SPEC_CONTROL_STATE_TYPES`, `SURFACE_PLAYER_CODES`, `LIST_TEXT_PATTERN` |
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
- **Decks as data.** Spec 0.4.0 (in the repository; ADR-009) gives
  `layout-deck` and `deck-slide` optional deck model v2 props: the 9:16
  aspect, the `slide`, `zoom` and `morph` transitions, motion, navigation,
  outline, a slide `layout` with its `props`, `background`, step labels and
  component slides. The change is additive: every 0.3.0 envelope is a valid
  0.4.0 envelope, and the `0.3.0 → 0.4.0` migration only stamps `spec`. The
  deck model itself is validated by `@texuli/deck`, not by this package.
- **Structure only.** This validator checks structure. URL policy, tree
  limits and rendering live in the runtime validator of
  [`@texuli/catalog`](https://www.npmjs.com/package/@texuli/catalog). The
  reducers that run the actions belong to the runtime
  ([`@texuli/player`](https://www.npmjs.com/package/@texuli/player)); in
  this repository it runs every 0.3.0 action).
- **A blueprint that validates paints.** The state surface rules
  (`@texuli/spec/surface`) refuse exactly what the player refuses at paint
  time: form fields and submits outside an `action-form`, nested forms,
  controls and fields that name no declared variable of their type, flow
  nodes without a matching view or event, and writers of a host-bound
  variable. The spec, `@texuli/catalog`'s `validateDraft` and the Kotlin
  twin run the same rules.
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
(`src/migrations/`: `0.2.0 → 0.3.0` and `0.3.0 → 0.4.0`, both of which only
stamp `spec`); a compatible version range is planned, not built. The
repository pins spec `0.4.0` to digest
`fac29f542b16ddb78ab401c508e5b8346f655991c56e25aa811f4931661a8cb3` in
`versions.json`.

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
