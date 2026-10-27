# A2UI adapter (experimental)

**Package:** `@texuli/tools` · **Import:** `@texuli/tools/a2ui`

Converts a catalog tree (`CatalogTreeInput` from
`@texuli/catalog/render/renderer`) into
[A2UI](https://a2ui.org) v0.9 server-to-client messages, and converts those
messages back into a catalog tree. It works on plain data only: there is no
DOM, no network and no rendering.

> **Experimental.** The adapter targets the A2UI **v0.9** message shapes. The
> plan names v0.9.1, but the upstream schema read for this task
> (`https://a2ui.org/specification/v0_9/server_to_client.json`) declares
> `"version": "v0.9"` and no patch version, so that is the value written and
> accepted. The schema below is a hand-written subset of the upstream files,
> not a copy of them.

```ts
import { a2uiToCatalogTree, catalogTreeToA2ui } from '@texuli/tools/a2ui';
import { renderCatalogFromBuild, renderCatalogTree } from '@texuli/catalog/render/renderer';

const out = catalogTreeToA2ui(tree, { surfaceId: 'report', catalogId: 'catalog-<sha256>.json' });
if (out.ok) send(out.messages); // [createSurface, updateComponents]

const back = a2uiToCatalogTree(JSON.parse(text), { catalogId: 'catalog-<sha256>.json' });
if (back.ok) renderCatalogTree(back.roots, { catalog: renderCatalogFromBuild(catalog), tier: 'untrusted' });
```

## Mapping

| Catalog tree | A2UI v0.9 |
| --- | --- |
| A node's `id` (component id, such as `card`) | `component` |
| The node's position | `id`: the root is `root`, the rest are `n1`, `n2`… in the order they are visited (deterministic) |
| `props` | Flattened beside `id` and `component` |
| `children` | `children`: an array of child ids |
| Zero or several roots | A `root` component of type `texuli-roots` whose children are the roots |

- **Reading:** a single `child` id is read as one child.
- **Empty props:** `props: {}` and no `props` give the same component, so `props: {}` comes back as no `props`. Every other tree round-trips exactly, and the tests check this.

## Rules

**Both directions.** Props carry literal JSON only. The conversion fails, and returns `{ ok: false, diagnostics }` with a code and a JSONPath for each problem, when it meets:
- prototype keys `__proto__`, `constructor` or `prototype` at any depth (`unsafe-key`);
- non-JSON values such as `NaN`, `Date` or functions (`not-json`);
- a top-level prop value that is an A2UI data binding (`{ path }`) or function call (`{ call }`) (`binding`).

Copied values are cloned, never shared with the input.

**Tree → A2UI** also refuses:
- the prop names `id`, `component`, `children` and `child` (`reserved-prop`);
- a node with no kebab-case `id`, or one named `texuli-roots` (`invalid-node`).

Its output is checked against the schema before it is returned.

**A2UI → tree** handles the input this way:
- **Schema first:** every message is checked against the schema (`schema`).
- **One surface:** it reads one surface (`surfaceId`, by default the first one named) and ignores messages for other surfaces.
- **Messages in order:**
  - `updateComponents` adds components or replaces them by id;
  - `deleteSurface` clears them;
  - `updateDataModel` is ignored, because catalog trees have no data model.
- **Surface errors (`surface`):**
  - a second `createSurface` before a `deleteSurface`;
  - a `catalogId` different from the expected `catalogId` option.
- **Building the tree** starts from `root` and refuses:
  - a missing root or child (`missing-root`, `missing-child`);
  - cycles (`cycle`);
  - a component used twice (`shared-child`);
  - data-bound child templates (`template-children`);
  - both `children` and `child` on one component, or `texuli-roots` below the root (`invalid-node`).
- **Unreachable components** are left out and listed in `unused`.
- **Limits:**
  - `maxComponents` (default 1000) bounds messages, components and child lists before the schema walks them;
  - `maxDepth` (default 64) bounds nesting;
  - diagnostics stop at 50.

**What the adapter does not decide.** Whether an id exists, which tier may emit it, and whether props match the component's schema are the renderer's job. Always pass the result to `renderCatalogTree`: unknown ids become placeholders, and `class`, `style` and HTML strings are dropped there.

## The schema

`A2UI_MESSAGE_SCHEMA` is JSON Schema 2020-12. It covers:
- the four messages (`createSurface`, `updateComponents`, `updateDataModel`, `deleteSurface`), each with `version: "v0.9"` and `additionalProperties: false`;
- `ChildList`;
- a component of `id` plus a kebab-case catalog `component`, with props beside them.

Upstream leaves the component shape to each catalog. A basic-catalog name such as `Text` therefore fails here, because this adapter maps Texuli catalog trees only.

`checkJsonSchema` reads only these keywords: `$ref`, `type`, `const`, `enum`, `required`, `properties`, `additionalProperties`, `items`, `minItems`, `minLength`, `pattern`, `oneOf` and `anyOf`. It ignores the rest, so it is not a general JSON Schema validator.

## Tests

`pnpm vitest run packages/tools/tests/a2ui.test.ts` (6 grouped tests, Node). Fixtures are in `packages/tools/tests/fixtures/a2ui/`. The tests cover:
- the fixture tree and payload converting into each other exactly, with schema-valid output;
- round trips, streamed updates, `deleteSurface` and other surfaces;
- every invalid fixture failing the schema;
- broken trees, bindings, templates and prototype pollution;
- the limits;
- the full path from an A2UI payload through `renderCatalogTree`, where tiers and HTML rules still apply.

## Limits

- **Experimental:** this has not been tested against an A2UI client or the upstream validator.
- **Data binding:** no data model, bindings, function calls, actions, checks or child templates.
- **Messages:** `theme` and `sendDataModel` on `createSurface` are accepted but not used, and there are no client-to-server messages.
