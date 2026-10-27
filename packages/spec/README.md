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

> **Status: preview.** Texuli is in development. The packages are published
> to npm as prereleases under the `next` dist-tag, and there is no stable
> release yet, so install with `@next`. APIs may still change between
> previews.

## Install

```bash
npm install @texuli/spec@next
```

```bash
pnpm add @texuli/spec@next
# or
yarn add @texuli/spec@next
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

SPEC_VERSION;                         // the spec version, e.g. '0.2.0'
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
`packages/spec/catalog/components.json`:

```ts
import { type Schema, type SpecCatalog, validateBlueprint } from '@texuli/spec';

const result = validateBlueprint(blueprint, {
  blueprintSchema: blueprintSchemaJson as Schema,
  catalog: componentsJson as SpecCatalog,
});
if (!result.ok) {
  for (const d of result.diagnostics) console.warn(d.code, d.path, d.message);
}
```

A node with an id outside the catalog fails with `unknown-id`; other codes
include `schema`, `unknown-prop`, `prop-type`, `enum-value`,
`missing-required`, `extension-prop`, `catalog-mismatch`,
`unsupported-profile` and `unknown-slot`.

## What's inside

| Subpath | Purpose | Headline exports |
| --- | --- | --- |
| `@texuli/spec` | Runtime: types, vocabulary, validation, hashing | `BlueprintEnvelope`, `SpecCatalog`, `SpecValidation` and the other generated types; `SPEC_COMPONENT_IDS`, `SpecComponentProps`, `SPEC_CATALOG_HASH`, `SPEC_VERSION`; `validateBlueprint`, `validateTree`, `validateInstance`, `checkSchemaDocument`; `canonicalJson`, `sha256` |
| `@texuli/spec/codegen` | Build time: generation and conformance | `buildSpec`, `projectCatalog`, `checkConformance`, `formatJson`, `nextSpecVersion`, `checkVersionHistory` |

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
- **Structure only.** This validator checks structure. URL policy, tree
  limits and rendering live in the runtime validator of
  [`@texuli/catalog`](https://www.npmjs.com/package/@texuli/catalog).

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
catalog hash today; an envelope field for a compatible spec range, and
migrations between versions, are planned and not built.

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
