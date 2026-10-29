# Catalog renderer core

**Package:** `@texuli/catalog`  
**Import:** `@texuli/catalog/render/renderer`  
**Tests:** `packages/catalog/tests/render-renderer.test.ts` (renderer, block family ids, tier semantics), `packages/catalog/tests/render-slots-conditions.test.ts`

## Goal

Turn an untrusted **catalog tree** (component ids + props + children) into a
**sink-free render tree** the host can map to real Texuli components.

| Input condition | Result |
| --- | --- |
| Unknown component id | **Placeholder** with a visible label |
| Id not allowed for the emit tier | **Placeholder** (`tier-denied`) |
| Schema failure (type, required, HTML string) | **Node dropped** |
| `blocks-*` node whose `block.type` belongs to another family | **Node dropped** (`block-family-mismatch`) |
| `inline-text` node with children (it is a leaf) | Children dropped (`invalid-node`); the text node stays |
| `class` / `style` / `className` / HTML sink props | **Stripped** (never forwarded) |
| Slot / event props from the tree | **Refused** |
| A child's `slot` that is not a `slot` prop of its parent | **Node dropped** (`invalid-slot`) |
| `slot` on a root node | Ignored, node kept (`invalid-slot`) |
| `when` that is not a valid condition, or no condition runtime | **Node dropped** (`invalid-condition`) |
| Valid `when` that is false or unknown | Node hidden, no diagnostic; its subtree was still checked |
| `when` on a root node | Ignored, node kept (`invalid-condition`) |
| `motion` outside the spec 0.6.0 vocabulary (CSS, keyframes, milliseconds, unknown names) | Motion dropped, node kept (`invalid-motion`) |
| Valid `motion` | A frozen copy on the render node (`RenderNode.motion`), passed to the paint plan |

## Named slots (audit G04)

Props of kind `slot` stay refused in `props`. A child fills a named slot by
naming it in its own `slot` field instead, as in HTML:

```json
{
  "id": "layout-marketing",
  "children": [
    { "id": "blocks-text", "slot": "hero", "props": { "block": { "type": "heading", "level": 1, "text": "Harbor Notes" } } },
    { "id": "blocks-text", "slot": "footer", "props": { "block": { "type": "text", "markdown": "A fictional team." } } }
  ]
}
```

- The slot must be a `slot` prop of the parent's manifest; `children` (or no
  `slot`) is the default slot. Anything else drops the child, with the
  parent's slot names in the diagnostic.
- The rendered child (component or placeholder) carries `slot`; the host
  routes it to that snippet. A default-slot child has no `slot` field.
- Slotted children stay in `children`, so tree limits, tiers, sink scans and
  grammar checks cover them like any child.

## Conditional regions (audit G07)

A node's `when` is the closed `Condition` AST of `@texuli/blocks/formula`
(comparisons, `and`, `or`, `not` over numbers and named variables; no string
syntax, nothing executable). The renderer needs an injected runtime and the
host's inputs:

```ts
import { formulaConditions } from '@texuli/catalog/render/conditions';

renderCatalogTree(tree, {
  catalog,
  tier: 'untrusted',
  conditions: formulaConditions,
  conditionInputs: { total: 42 },
});
```

```json
{ "id": "blocks-text", "when": { "op": "gt", "left": { "op": "var", "name": "total" }, "right": { "op": "num", "value": 0 } }, "props": { "block": { "type": "text", "markdown": "Totals are above zero." } } }
```

- `true` shows the node. `false` or unknown (a missing, `null` or
  non-finite input) hides it, after its subtree was still rendered, so its
  diagnostics stand.
- The runtime is injected, like `checkBlock`, so the renderer, `validate` and
  `player` entries do not bundle the formula parser. Without it, a `when`
  fails closed: the node is dropped with `invalid-condition`.
- Inputs are numbers only: a host maps its state (booleans to `1` and `0`).
  `validateDraft`, `createPlayer` (and its `update`) and artifact frames
  forward `conditions` and `conditionInputs`.

Each `blocks-*` id renders only its own family's block types
(`BLOCK_FAMILY_TYPES`, held equal to the `*_BLOCK_TYPES` lists in
`@texuli/blocks` by `render-renderer.test.ts`). A `cta` block under
`blocks-text` passes the block schema but would paint the text family's inert
"invalid" notice, so the renderer drops it with a diagnostic that names the
right id (`blocks-structure`). `blockFamilyIdFor(type)` answers which id
renders a type.

No HTML strings, no `{@html}`, no DOM. Tree depth / nodes / bytes / branching limits: `@texuli/catalog/render/limits`
(see [render-limits.md](./render-limits.md)).

## Usage

```ts
import { buildCatalog } from '@texuli/catalog/build';
import {
  renderCatalogFromBuild,
  renderCatalogTree,
} from '@texuli/catalog/render/renderer';

const { catalog } = await buildCatalog(groups);
const view = renderCatalogFromBuild(catalog);

const { roots, diagnostics } = renderCatalogTree(
  {
    id: 'card',
    props: { variant: 'elevated' },
    children: [{ id: 'not-a-real-id', props: {} }],
  },
  { catalog: view, tier: 'untrusted' }
);

// roots[0] may be a component; unknown child is a placeholder.
```

### Tiers

- **`untrusted`** (default): only Tier U ids (`isTierU` / content emit list).
- **`developer`**: with `renderCatalogFromBuild`, the build's developer tier:
  every `agentEmittable` component (normative, roadmap decision D5). App
  chrome such as `dialog` is `tier-denied` unless the host opts in with
  `renderCatalogFromBuild(catalog, { developer: 'all' })`.
  This host-selected tier is independent of the envelope's declared `tier`,
  which validation ignores as producer-controlled metadata.
- `renderCatalogFromSpecs` is for explicit test specs. It permits every listed
  id at the developer tier regardless of `emit`; use `renderCatalogFromBuild`
  for the normative D5 policy over real manifests. For untrusted rendering,
  specs with an `emit` list use its Tier U membership; otherwise
  `agentEmittable: true` is required.
- **Fails closed.** Only the exact string `'developer'` is the developer
  tier. Any other value (`'Untrusted'`, `'admin'`, an empty string, a value
  read from config) is `untrusted`, in the renderer, `validateDraft`, the
  player and artifact frames. `resolveTier(value)` is the shared rule.

### Host mapping

```ts
for (const node of roots) {
  if (node.kind === 'placeholder') {
    // Render a labelled empty state: node.label
    continue;
  }
  // node.id + node.props + node.children → real component
}
```

## Security

See `docs/SECURITY.md`: no HTML sinks, no `style`/`class` passthrough, URL
policy remains on the host when binding `href`/`src` props.
