# Custom elements

**Package:** `@texuli/tools` · **Import:** `@texuli/tools/elements` · Added by T-tool-elements.

These are light-DOM custom elements, so a host that doesn't use Svelte (plain
HTML, React, Vue, a server template) can render **catalog trees** with the real
Texuli content components: blocks, charts and media.

```ts
import { defineTexuliElements } from '@texuli/tools/elements';

defineTexuliElements(); // <tx-catalog> and <tx-blocks-text>, <tx-charts-bar>, …
```

```html
<tx-catalog>
  <script type="application/json">
    [{ "id": "blocks-text", "props": { "block": { "type": "heading", "level": 2, "text": "Quarterly notes" } } }]
  </script>
</tx-catalog>

<tx-blocks-text props='{"block":{"type":"callout","tone":"info","title":"Heads up","body":"Backups run nightly."}}'></tx-blocks-text>
```

## Elements

| Element | Input | Output |
| --- | --- | --- |
| `<tx-catalog>` | `tree` property (one node or a list), a `tree` JSON attribute, or a child `<script type="application/json">` | One `<tx-{id}>` per component, in order. A node's children follow it in a `div[data-tx-element-children]`, because content components take no DOM children. |
| `<tx-{id}>` (one per content manifest: `blocks-text`, `charts-bar`, `media-image`, …) | `props` property or `props` JSON attribute | The Svelte component, mounted in the element's own light DOM (`div[data-tx-element-root]`) |

### State and events

- **`data-state`:**
  - On component elements: `loading`, `ready`, `invalid` or `error`, with `aria-busy` while loading.
  - On `<tx-catalog>`: `ready` or `over-limits`.
- **`tx-render`** (catalog): `{ diagnostics, rendered }`.
- **`tx-ready`** (component): the component mounted.
- **`tx-invalid`** (component): props were refused, or a block's own
  validation failed (the `oninvalid` callback becomes this event), or the
  component threw while mounting (`render-error`).
- **`.diagnostics`** on both: why nodes were dropped, replaced or refused.

## Safety

Trees are untrusted data.
- **Limits first:** `<tx-catalog>` checks the tree limits (depth, nodes,
  bytes, branching) and renders nothing over them.
- **The sink-free renderer:**
  - Unknown ids become a labelled placeholder (`p[role=note]`).
  - Ids not allowed at the tier are refused (`tier-denied`).
  - Schema failures and HTML strings drop the node.
  - `class`, `style`, `className` and event props are stripped.
- **Component elements too:** a `<tx-{id}>` used directly runs its props
  through the same renderer.
- **No markup from data:** elements are built with `createElement` and text
  with `textContent`. No `innerHTML`, `eval` or `new Function`; a test scans
  the module. JSON is read with `JSON.parse` only.
- **Tier:** set once by `defineTexuliElements({ tier })`, `untrusted` by
  default; a `tier` attribute in markup is ignored.
- **URLs:** the components keep their own URL policy. For example, a
  `javascript:` image source is never rendered.
- **Failures:** a component that throws while mounting shows its placeholder
  instead of breaking the page, and a failed lazy load can be retried on the
  next render.

## Options

`defineTexuliElements(options)` is safe to call more than once; tags that
already exist are kept.

| Option | Default | Meaning |
| --- | --- | --- |
| `loaders` | the content preset (`CONTENT_ELEMENT_LOADERS`) | id → lazy Svelte component. Each is its own dynamic import. |
| `catalog` | `contentRenderCatalog()` (the content manifests) | The render catalog trees are checked against |
| `tier` | `untrusted` | `developer` also allows ids that agents may not emit |
| `prefix` | `tx` | `acme` gives `<acme-catalog>` and `<acme-blocks-text>` |
| `registry`, `window` | `globalThis` | Define into another window |

Helpers: `elementTagFor(id, prefix)`, `parseJsonData(text)`,
`contentRenderSpecs()`, `ELEMENT_ID_PATTERN`.

## Styling

The elements use light DOM, so the Texuli CSS layers and theme tokens reach
the components exactly as in a Svelte app. Load the tokens CSS and a theme as
usual. The elements add no styles of their own; style `.tx-element-placeholder`
as needed.

## Size

The module's own code is **2.5 KiB** gzip (2,574 B on 2026-10-24; esbuild, minified, `svelte` and
`@texuli/*` external; `pnpm size` has no tools entries). Components load
lazily per id.

## Verified

- **Unit tests:** `pnpm vitest run packages/tools/tests/elements.test.ts` has
  6 grouped tests (happy-dom).
  - Tags, JSON parsing, and full preset coverage: every content manifest has a
    spec and a loader, and every loader resolves.
  - Idempotent definition, prefixes, and the tier (markup cannot raise it).
  - Light-DOM mounting, attribute and property props, re-rendering,
    unmounting on removal, invalid props, and block validation events.
  - `<tx-catalog>` from a script child, unknown ids, a hostile tree, the tree
    limits, a JSON attribute, and **every content manifest example rendering
    `ready`**.
  - A component throwing while mounting, a load failure, a retry after a
    failure, and the sink scan.
  - 7 deliberate code breaks each fail a test.
- **Real browsers:** a scratch Playwright smoke on Chromium, WebKit and
  Pixel 7 (lane N, not committed) imports the module into a plain page and
  renders a tree with text blocks, a bar chart, an unknown id and a hostile
  string. It checks light DOM, no injected `<script>` or style, axe with no
  violations on `tx-catalog`, and no page errors.

## Limits

- **Children:** content components take no DOM children, so a node's children
  render after it, not inside it.
- **Content only:** layout, form and overlay components are not part of the
  preset. A host can pass its own `loaders` and `catalog`.
- **No standalone bundle:** apps bundle the module themselves (Vite, esbuild);
  there is no prebuilt CDN file.
- **Firefox** was not checked.
