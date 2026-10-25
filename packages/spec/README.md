# @texuli/spec

The schema-first blueprint contract (spec/Compose design, plan B1): the
platform-neutral source of truth for blueprint structure, the catalog
vocabulary, capability tiers and diagnostics. TypeScript and Kotlin are
deterministic projections generated from it, and a conformance harness keeps
everything from drifting.

**Status: in development, not published.** Layer 0, no dependencies,
framework-free. Kotlin is generated as committed text by this package's
TypeScript generator; no Kotlin toolchain runs here, and nothing is compiled
or published to Maven.

The package tarball build compiles `generated/typescript/` into the matching
`dist/generated/typescript/` location. The source stays beside `src/` so the
spec generator and integrity manifest keep their established output paths;
the packer maps runtime and declaration imports to emitted `.js` and `.d.ts`
files there. Kotlin projections remain generated text and are not part of the
TypeScript package output.

## Layout

| Path | What it holds |
| --- | --- |
| `schemas/` | The normative JSON schemas: `blueprint` (envelope v1 and the node tree), `catalog`, `diagnostics`, `manifest` |
| `catalog/components.json` | The closed vocabulary, projected from the built catalog: id, label, summary, group, placement (`app`/`content`), emit tiers, capability and props |
| `catalog/capabilities.json` | Reviewed capability claims. Empty: no id is audited portable yet, so every capability is `unknown` (ADR-003) |
| `fixtures/golden/` | Blueprints that must validate: a report, a dashboard, a proactive deck and a report with a named slot and a `when` condition (fictional data) |
| `fixtures/invalid/` | Blueprints that must fail with exact diagnostic codes, one or more per code, including slot and condition cases (an undeclared or root `slot`, an unknown condition `op`, an extra condition field) |
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
  - `canonicalJson` and a synchronous `sha256`.
- `@texuli/spec/codegen`, build time: `buildSpec`, `projectCatalog`,
  `checkConformance`, `formatJson`.

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
  and limits are the shared validator's job.
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
  their codes, covering every diagnostic code;
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
Every generated file carries it in its stamp (`// Spec 0.2.0, digest …`).
The same normative files always give the same digest.

**The version follows the digest.** Every normative change changes the
digest, and a changed digest needs a new semantic version.
`tests/versioning.test.ts` fails when the digest moves without one. The
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
- **Blueprints:** a blueprint binds to an exact catalog hash today. The
  envelope field for a compatible spec range is **planned, not built**.
  Until it exists, a consumer checks the spec version it ships against the
  stamp of the spec it was built from.

Migrations between versions (deterministic blueprint transforms tested per
version pair) are **planned, not built**: nothing has needed one yet.


## Named slots and conditions

A node may carry `slot` (audit G04: the parent's named slot, a string such as
`hero`) and `when` (audit G07: the blocks `Condition` AST that shows the node
when true). Both match what `@texuli/catalog` renders.

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
