# @texuli/catalog

The agent catalog of [Texuli](https://texuli.com), an MIT-licensed Svelte 5
component library by Dailybot, Inc. (*Small pieces. Infinite
possibilities.*). It describes which Texuli components an agent may use and
with which props. It validates what the agent writes, and ships the
sink-free renderer that turns untrusted agent trees into safe render trees.
Agent output is treated as hostile data: it is parsed, bounded and checked
against closed schemas, and it never reaches an HTML sink.

Use it to validate agent output on a server, in an edge worker or in the
browser, or to build your own painter. To paint validated blueprints in
Svelte, use [`@texuli/player`](https://www.npmjs.com/package/@texuli/player),
which is built on this package.

> **Status: 0.x release.** Texuli is in development. The packages are
> published to npm as `0.11.0`, a pre-1.0 release (1.0.0 will be the first
> stable release). Under 0.x, a new minor (`0.12.0`) may contain breaking
> changes, so pin the exact version or use `^0.11.0`, which accepts only 0.11.x.

> **New in `0.4.0`.** The `chat`, `composition`, `data`, `state` and
> `workflows` manifest groups (158 catalog ids, 66 of them agent-emittable;
> 133 ids in `0.3.0`), spec 0.3.0 interaction (`bind`, `on`, closed actions,
> `reorder`), the state surface checks and the validation of deck model v2
> trees below ship in `0.4.0`; the `0.3.0` release predates them.

## Install

```bash
npm install @texuli/catalog svelte
```

Svelte 5 (`^5.57.2`) is a peer dependency. The validation entries are
runtime-neutral (no DOM and no Node APIs) and ship no CSS. Only
`@texuli/catalog/build/node`, which discovers and writes catalog files,
needs Node.

## Quick start

Build a catalog from the authored manifests, then validate an agent's draft
against it:

```ts
import { buildCatalog } from '@texuli/catalog/build';
import { CONTENT_MANIFESTS } from '@texuli/catalog/manifests/content';
import { LAYOUTS_MANIFESTS } from '@texuli/catalog/manifests/layouts';
import { renderCatalogFromBuild } from '@texuli/catalog/render/renderer';
import { validateDraft } from '@texuli/catalog/validate';

const build = await buildCatalog([
  { name: 'content', manifests: CONTENT_MANIFESTS },
  { name: 'layouts', manifests: LAYOUTS_MANIFESTS },
]);
const catalog = renderCatalogFromBuild(build.catalog);

// Agent output, as JSON text or data. The tier defaults to `untrusted`.
const result = validateDraft(agentOutput, { catalog });

if (result.ok) {
  paint(result.roots); // the sink-free render tree
} else {
  console.log(result.diagnostics); // check, code, severity, path, message
}
```

A draft such as `{"id":"layout-page","props":{"title":"<img src=x onerror=…>"}}`
fails with `sink` and `html-string` diagnostics. To check every `blocks-*`
node with its own family's parser as well, pass a `checkBlock` built with
`createFamilyBlockCheck` from `@texuli/catalog/validate/blocks` (see
[validate.md](https://github.com/DailybotHQ/texuli/blob/main/packages/catalog/docs/validate.md)).

## What's inside

The root entry, `@texuli/catalog`, re-exports the build, manifests, frame,
grammar and renderer APIs. Import subpaths to keep bundles narrow.

**Validate and render**

| Subpath | What it does |
| --- | --- |
| `@texuli/catalog/validate` | `validateDraft`: the single validation entry for untrusted blueprint JSON, plus `scanSinks` and `draftCommitGate` |
| `@texuli/catalog/validate/blocks` | `createFamilyBlockCheck`: checks each `blocks-*` node with its family's parser |
| `@texuli/catalog/render/renderer` | `renderCatalogTree`: the sink-free render tree, with named slots and conditional regions |
| `@texuli/catalog/render/limits` | Depth, node, byte, branching and root limits, checked before rendering |
| `@texuli/catalog/render/grammar` | `checkCompositionGrammar`: heading outline, landmarks and composition rules for agent trees |
| `@texuli/catalog/render/richtext` | The sink-free rich-text renderer |
| `@texuli/catalog/render/conditions` | `formulaConditions`: the runtime that evaluates `when` conditions |
| `@texuli/catalog/render/frame` | The artifact frame: a required visible label and badge, and intents the host must confirm |
| `@texuli/catalog/render/hostile` | A corpus of hostile inputs with their expected outcomes, for your own tests |

**Catalog and manifests**

| Subpath | What it does |
| --- | --- |
| `@texuli/catalog/manifest` | The manifest format: `defineCatalogManifest`, `validateCatalogManifest` |
| `@texuli/catalog/manifests/content` | Authored manifests for content blocks, charts and media |
| `@texuli/catalog/manifests/display` | Authored manifests for display and feedback components |
| `@texuli/catalog/manifests/forms` | Authored manifests for form components |
| `@texuli/catalog/manifests/layouts` | Authored manifests for layouts, decks and app shells |
| `@texuli/catalog/manifests/overlays` | Authored manifests for overlays and navigation chrome (app tier) |
| `@texuli/catalog/manifests/composition` | New in `0.4.0`: composition layouts (`layout-stack`, `layout-row`, `layout-split`, `layout-tile`) |
| `@texuli/catalog/manifests/data` | New in `0.4.0`: data views as JSON (grid, tree, board, calendar, timeline, map, files), with their `bind` props and `on` events; `0.5.0` adds the cohort table, notification inbox and filter builder; `0.8.0` adds `data-dashboard` and `data-dashboard-widget` |
| `@texuli/catalog/manifests/chat` | New in `0.4.0`: chat display ids (thread and messages; the composer stays host chrome) |
| `@texuli/catalog/manifests/state` | New in `0.4.0`: state and action surfaces (controls, forms, flow views and actions, sortable lists, host regions) |
| `@texuli/catalog/manifests/workflows` | New in `0.4.0`: `workflow-graph`, validated against the spec workflow schema |
| `@texuli/catalog/manifests/documents` | New in `0.7.0`: `document`, a Texuli document as data (spec 0.7.0) |
| `@texuli/catalog/manifests/schema-forms` | New in `0.8.0`: `schema-form`, a form as data (spec 0.8.0), painted by `@texuli/forms` through the player's `formHost` |
| `@texuli/catalog/manifests/sheets` | New in `0.8.0`: `spreadsheet`, a sheet as data (spec 0.8.0; not `sheet`, which is the texuli `Sheet` drawer), painted by `@texuli/sheets` through the player's `sheetHost` |
| `@texuli/catalog/manifests/all` | In development, not released: every manifest group as one static, edge-safe list (`ALL_MANIFEST_GROUPS`, no file system), with the same catalog hash as `build/node` discovery; used by `@texuli/tools/ops` and the agent service |
| `@texuli/catalog/build` | `buildCatalog`: a content-addressed catalog (`catalog-<sha256>.json`) |
| `@texuli/catalog/build/node` | Node only: discover the manifest groups (source or published files) and write the content-addressed catalog file |

**Blueprints**

| Subpath | What it does |
| --- | --- |
| `@texuli/catalog/envelope` | The versioned blueprint envelope: catalog binding, lifecycle status and provenance |
| `@texuli/catalog/edit` | Typed edit operations, undo and redo, and the canonical blueprint digest |
| `@texuli/catalog/player` | The framework-free document player core that `@texuli/player` wraps |

## Key guarantees

- **Untrusted by default.** The host picks the tier, never the draft.
  Agents may emit only ids whose manifest marks them `agentEmittable`; app
  chrome stays developer-authored.
- **No HTML sinks.** HTML strings, executable strings, `class`, `style`,
  `innerHTML`, `srcdoc` and `on…` keys are refused or stripped. Prototype
  keys (`__proto__`, `constructor`, `prototype`) are refused anywhere.
- **URL policy.** Links, image sources and media sources pass the
  `@texuli/core` URL policy for the host's tier.
- **Bounded.** Text input is size-capped before `JSON.parse`. Trees are
  limited by default to depth 16, 512 nodes, 256 KiB, 64 children per node
  and 32 roots; prop values nested deeper than 128 levels are refused.
- **Closed vocabulary.** Unknown ids and ids not allowed at the tier become
  visible placeholders; props that fail their schema are dropped.
- **Never throws.** `validateDraft` fails closed with diagnostics, including
  an `internal-error` diagnostic for anything unexpected.
- **Interaction as data (new in `0.4.0`).** Spec 0.3.0 bindings, `bind`, `on`
  and the closed actions are checked against each component's declared
  `events` and `bindable` props; nothing is evaluated. For an envelope, the
  state surface rules refuse exactly what `@texuli/player` would refuse at
  paint time, and list item text refuses control, bidirectional and
  invisible formatting characters.

## New in 0.8.0

Ships in `0.8.0`; the `0.7.0` release predates it:

- Spec `0.8.0` forms (ADR-015): the agent-emittable `schema-form` id
  (`@texuli/catalog/manifests/schema-forms`) whose `schema` is a closed form
  schema: typed fields, sections and steps, conditions and cross-field
  rules as expressions, named formats and host validator names, never a
  pattern or code. `validateDraft` checks it with the host's `checkForm`
  (`checkFormDraft` from `@texuli/forms/model`) at the draft's tier;
  without it every form is refused (`form-unchecked`)
  ([validate](https://github.com/DailybotHQ/texuli/blob/main/packages/catalog/docs/validate.md)).
- Spec `0.8.0` sheets (ADR-015): the agent-emittable `spreadsheet` id
  (`@texuli/catalog/manifests/sheets`) whose `sheet` holds tabs of cells
  and formulas in the closed sheet grammar. `validateDraft` checks it with
  the host's `checkSheet` (`checkSheetDraft` from `@texuli/sheets/model`,
  which parses every formula) under the `sheets` check; without it every
  spreadsheet is refused (`sheet-unchecked`).
- Spec `0.8.0` dashboards: `data-dashboard` and `data-dashboard-widget` in
  `@texuli/catalog/manifests/data`, with composition rules the `render`
  check enforces (`dashboard-child`, `dashboard-parent`,
  `dashboard-widgets`, `dashboard-widget-id`).

## New in 0.7.0

Ships in `0.7.0`; the `0.6.0` release predates it:

- Spec `0.7.0` documents (ADR-011): the agent-emittable `document` id
  (`@texuli/catalog/manifests/documents`) whose `doc` is a Texuli document.
  `validateDraft` checks it with the host's `checkDocument` at the draft's
  tier, then its wrapped blocks and component embeds as catalog nodes at the
  same tier; without `checkDocument` it refuses every document
  (`document-unchecked`). `document` is a frame root
  ([validate](https://github.com/DailybotHQ/texuli/blob/main/packages/catalog/docs/validate.md)).
- The `patchDocument` edit op: a bounded RFC 6902 patch for a document
  node's `doc`, addressed by path or node key, applied by the host's patcher
  with an exact inverse
  ([edit](https://github.com/DailybotHQ/texuli/blob/main/packages/catalog/docs/edit.md)).
- Spec `0.7.0` node keys: an optional `key` (unique in the tree) on every
  node, carried on the draft and the render tree; malformed or repeated keys
  are refused, and `validateStreamNode` refuses a key already admitted.

## New in 0.6.0

Ships in `0.6.0`; the `0.5.0` release predates it:

- Spec `0.6.0` motion: node `motion` and the envelope `motion.level` are
  checked against the closed vocabulary; CSS, keyframes, milliseconds and
  unknown names are refused (`invalid-motion`), and the renderer drops the
  motion and keeps the node
  ([envelope](https://github.com/DailybotHQ/texuli/blob/main/packages/catalog/docs/envelope.md)).
- `validateStreamNode` in `@texuli/catalog/validate`: the node-level checks
  of `validateDraft` for one streamed node's chain, so a host paints only
  what the full draft would accept
  ([validate](https://github.com/DailybotHQ/texuli/blob/main/packages/catalog/docs/validate.md)).

## Documentation

- Website: [texuli.com](https://texuli.com), the
  [agents overview](https://texuli.com/agents-page/) and the
  [playground](https://texuli.com/playground/)
- Draft validation: [validate.md](https://github.com/DailybotHQ/texuli/blob/main/packages/catalog/docs/validate.md)
- Renderer, slots and conditions: [render-renderer.md](https://github.com/DailybotHQ/texuli/blob/main/packages/catalog/docs/render-renderer.md)
- Tree limits: [render-limits.md](https://github.com/DailybotHQ/texuli/blob/main/packages/catalog/docs/render-limits.md)
- Composition grammar: [render-grammar.md](https://github.com/DailybotHQ/texuli/blob/main/packages/catalog/docs/render-grammar.md)
- Artifact frame: [render-frame.md](https://github.com/DailybotHQ/texuli/blob/main/packages/catalog/docs/render-frame.md)
- Envelope: [envelope.md](https://github.com/DailybotHQ/texuli/blob/main/packages/catalog/docs/envelope.md) · Catalog build: [catalog-build.md](https://github.com/DailybotHQ/texuli/blob/main/packages/catalog/docs/catalog-build.md) · Edits: [edit.md](https://github.com/DailybotHQ/texuli/blob/main/packages/catalog/docs/edit.md)
- Every contract: [packages/catalog/docs](https://github.com/DailybotHQ/texuli/tree/main/packages/catalog/docs)
- Security model: [SECURITY.md](https://github.com/DailybotHQ/texuli/blob/main/docs/SECURITY.md)

## Related packages

- [`@texuli/player`](https://www.npmjs.com/package/@texuli/player): paints validated blueprints in Svelte.
- [`@texuli/tools`](https://www.npmjs.com/package/@texuli/tools): llms.txt generation, the A2UI adapter and custom elements over this catalog.
- [`@texuli/core`](https://www.npmjs.com/package/@texuli/core): the URL policy used at every tier.

## Contributing

Source, issues and contribution guidelines live at
[github.com/DailybotHQ/texuli](https://github.com/DailybotHQ/texuli). Report
bugs at [github.com/DailybotHQ/texuli/issues](https://github.com/DailybotHQ/texuli/issues).

## License

MIT © Dailybot, Inc. Powered by [Dailybot](https://www.dailybot.com?utm_source=dailybotopensource&utm_medium=texuli-catalog).
