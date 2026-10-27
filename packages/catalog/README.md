# @texuli/catalog

**Layer L6: the agent catalog.** Authored component manifests, the blueprint
envelope, the content-addressed catalog build, draft validation and the
sink-free renderer that turns untrusted agent trees into safe render trees.
Published to npm as `0.1.0-next.2` under the `next` dist-tag (CI publishes
with provenance; `latest` stays reserved for 1.0.0). The workspace package
itself stays `"private": true`.

## What exists today

Every area below is implemented, exported and tested. One subpath per area;
each links its contract doc in `docs/`.

| Area | Subpath | What it does | Doc |
| --- | --- | --- | --- |
| Manifest format | `@texuli/catalog/manifest` | The authored-manifest schema and its build-time validator | this README |
| Authored manifests | `@texuli/catalog/manifests/{content,display,forms,layouts,overlays}` | The authored manifests in five groups (133 entries), including the `inline-text` node that gives slot-only components such as `button` their text (audit G03) | [manifests-display](docs/manifests-display.md), [manifests-layouts](docs/manifests-layouts.md) |
| Envelope | `@texuli/catalog/envelope` | The blueprint envelope | [envelope](docs/envelope.md) |
| Catalog build | `@texuli/catalog/build` and `build/node` | Content-addressed build; the Node entry writes one `catalog-<sha256>.json` into the output directory | [catalog-build](docs/catalog-build.md) |
| Draft validation | `@texuli/catalog/validate` | Validate a draft before it is rendered | [validate](docs/validate.md) |
| Block family checks | `@texuli/catalog/validate/blocks` | `createFamilyBlockCheck`: runs each `blocks-*` node through its own family's parser, given the engines | [validate](docs/validate.md#block-families-texulicatalogvalidateblocks) |
| Edit operations | `@texuli/catalog/edit` | Typed blueprint edit operations | [edit](docs/edit.md) |
| Document player | `@texuli/catalog/player` | The document player core | [player](docs/player.md) |
| Renderer | `@texuli/catalog/render/renderer` | The sink-free render tree an untrusted catalog tree becomes, including named slots (`slot`, audit G04) and conditional regions (`when`, audit G07) | [render-renderer](docs/render-renderer.md) |
| Conditions | `@texuli/catalog/render/conditions` | `formulaConditions`, the injected runtime that checks and evaluates `when` with the blocks `Condition` AST | [render-renderer](docs/render-renderer.md#conditional-regions-audit-g07) |
| Composition grammar | `@texuli/catalog/render/grammar` | The composition grammar for agent trees | [render-grammar](docs/render-grammar.md) |
| Artifact frame | `@texuli/catalog/render/frame` | The artifact frame | [render-frame](docs/render-frame.md) |
| Rich text | `@texuli/catalog/render/richtext` | The sink-free rich-text renderer | [render-richtext](docs/render-richtext.md) |
| Tree limits | `@texuli/catalog/render/limits` | Depth and size limits for agent trees | [render-limits](docs/render-limits.md) |
| Hostile corpus | `@texuli/catalog/render/hostile` | The hostile-input corpus and expected outcomes | [render-hostile](docs/render-hostile.md) |

Agents may emit only ids whose manifest marks them `agentEmittable`, at the
`content` tier; `app` chrome stays developer-authored. The build computes the
content address over the whole catalog and emits **one** catalog file
(`catalog-<sha256>.json`); there are no per-component generated files.

## Manifest format (build-time)

The format and its validator live in `src/manifest/`; the authored manifests
themselves live in `src/manifests/<group>/`. They are validated **only at
build / CI time** — the renderer must not import this module, and there is no
schema library on the render path.

| Field | Role |
| --- | --- |
| `id` | Closed kebab-case component id |
| `package` | `texuli` or `@texuli/<name>` |
| `label` / `summary` | Display name and one-line summary |
| `tier` | `app` (chrome) or `content` (blocks / media / charts) |
| `agentEmittable` | Agents may emit this id (**default `false`**) |
| `schemaVersion` | Optional manifest-schema version declaration (must be `1`; stripped before the build content-addresses) |
| `useWhen` / `dontUseWhen` | Authoring guidance (must stay disjoint) |
| `a11y` | Keyboard, name, contrast, RTL, motion notes |
| `props` | Public prop schemas (`kind`, `enumValues`, optional `trust`) |
| `examples` | Props-only samples (required when `agentEmittable`) |
| `related` | Optional related component ids |

```ts
import {
  defineCatalogManifest,
  validateCatalogManifest,
} from '@texuli/catalog/manifest';

const result = validateCatalogManifest(rawJson);
if (!result.valid) {
  // result.diagnostics: code, jsonPath, message, hint
}

const manifest = defineCatalogManifest(rawJson); // throws CatalogManifestError if invalid
```

Incomplete or contradictory entries fail validation (missing fields, bad ids,
enum without values, example props not in the schema, `agentEmittable` without
examples or useWhen, duplicate ids in a list).

### Schema version and digest stability

The authored-manifest schema is versioned by `MANIFEST_SCHEMA_VERSION`
(currently `1`, exported from `@texuli/catalog/manifest`). A manifest may
declare `"schemaVersion": 1`; omitting it means the same. Any other value
fails validation with a `schema-version` diagnostic, so a future schema
change fails loudly instead of misreading old data. The field is authoring
metadata: `buildCatalog` strips it before content-addressing, so a catalog
built from manifests that declare it is byte-identical — same
`catalog-<sha256>.json` name, same digest — to one built without it. The
built file's own envelope version (`CATALOG_FORMAT` / `CATALOG_VERSION` in
`src/build/build.ts`) is independent of the manifest schema version.
Understanding schemas other than version 1 is planned; no bump exists today.

## Testing

```bash
pnpm vitest run packages/catalog          # 28 test files (incl. the golden fixture suite)
pnpm --filter @texuli/catalog typecheck   # svelte-aware typecheck
npx biome check packages/catalog          # lint + format
```
