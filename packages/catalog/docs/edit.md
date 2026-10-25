# Blueprint edit operations

**Package:** `@texuli/catalog`  
**Import:** `@texuli/catalog/edit`  
**Tests:** `packages/catalog/tests/edit.test.ts`, `packages/catalog/tests/edit-history.test.ts`

## Goal

A framework-free, closed set of edit operations for a blueprint tree (a
`CatalogTreeInput`). The website builder
(`apps/website/src/components/builder/`) shares it today; server-side hosts
and the planned agent service are its intended consumers: an op is plain
JSON, so it can be stored, sent as a patch and replayed. Every op returns
the exact inverse op, which gives undo, and
`createEditHistory` adds undo and redo, coalescing and a commit gate.

No DOM, no Svelte and no Node APIs.

## Addressing: `NodePath`

A node is addressed by the child indexes from the root:

| Path | Node |
| --- | --- |
| `[]` | the root |
| `[0]` | `root.children[0]` |
| `[0, 2]` | `root.children[0].children[2]` |

Paths are positions, not ids, so a path is only meaningful against the tree
it was computed on. `getNode(tree, path)` returns the node or `undefined`.

## The op set

The examples apply to this tree:

```json
{
  "id": "layout-doc",
  "props": { "title": "Week 42" },
  "children": [
    { "id": "blocks-text", "props": { "block": { "type": "heading", "level": 2, "text": "Highlights" } } },
    { "id": "blocks-text", "props": { "block": { "type": "text", "markdown": "Shipped on time." } } }
  ]
}
```

| Op | Example | Inverse it returns |
| --- | --- | --- |
| `insert`: add `node` as child `index` of `parent` (`index` may equal the child count, to append) | `{ "op": "insert", "parent": [], "index": 2, "node": { "id": "blocks-text", "props": { "block": { "type": "text", "markdown": "Next week: billing." } } } }` | `{ "op": "remove", "path": [2] }` |
| `remove`: delete the subtree at `path`; never the root | `{ "op": "remove", "path": [1] }` | `{ "op": "insert", "parent": [], "index": 1, "node": <the removed node> }` |
| `move`: remove the subtree at `path`, then insert it at `parent` / `index`, both addressed in the tree **after** the removal, so a node can never move into its own subtree | `{ "op": "move", "path": [1], "parent": [], "index": 0 }` | `{ "op": "move", "path": [0], "parent": [], "index": 1 }` |
| `setProp`: set one prop to a plain JSON value | `{ "op": "setProp", "path": [], "name": "title", "value": "Week 43" }` | `{ "op": "setProp", "path": [], "name": "title", "value": "Week 42" }` (or `unsetProp` when the prop was absent, or `replace` when the node had no `props` bag) |
| `unsetProp`: remove one prop; a no-op when it is absent | `{ "op": "unsetProp", "path": [], "name": "title" }` | `{ "op": "setProp", "path": [], "name": "title", "value": "Week 42" }` |
| `replace`: replace the subtree at `path` (`[]` replaces the root) | `{ "op": "replace", "path": [0], "node": { "id": "blocks-text", "props": { "block": { "type": "heading", "level": 2, "text": "Summary" } } } }` | `{ "op": "replace", "path": [0], "node": <the old node> }` |
| `replaceAll`: replace the whole tree (a JSON commit, a template, a full agent turn) | `{ "op": "replaceAll", "tree": { "id": "layout-page", "props": { "title": "New" } } }` | `{ "op": "replaceAll", "tree": <the old tree> }` |

### Ops are untrusted input

`applyEditOps` re-checks every op with `parseEditOp` before applying it, so
an op from an agent or a stored log is never trusted:
- unknown op kinds and extra fields are refused (`invalid-op`);
- paths are arrays of non-negative safe integers, at most
  `MAX_PATH_LENGTH` (64) long;
- prop names match `^[A-Za-z][A-Za-z0-9_-]{0,63}$`, so `__proto__` and
  similar names cannot be set;
- nodes carry only `id`, `props`, `children`, a string `slot` and a plain-JSON
  `when` (`invalid-node`); slot names and condition syntax are checked when
  the result is validated;
- prop values must be plain JSON: no functions, class instances, `NaN` or
  `Infinity`, `undefined` or cycles (`invalid-value`; use `unsetProp` to
  remove);
- `parseEditOps` takes a patch (an array) of at most `MAX_BATCH_OPS` (256).

Addressing errors are `path-not-found`, `index-out-of-range` and `root-op`
(removing or moving the root). A failing op in a batch names its
`opIndex`.

## Guarantees

- **All or none.** `applyEditOps(tree, ops)` applies ops in order. If any op
  fails, nothing changes and the error names the failing op.
- **Copy-on-write.** The input tree is never mutated. Only the nodes along
  the edited path are copied; every other subtree is shared by reference.
- **Exact inverse.** A successful result carries `inverse`: the ops, in the
  order to apply them, that restore the input tree exactly.
- **`changed`.** `false` when the ops left the tree as it was (for example,
  `unsetProp` of an absent prop). Setting a prop to its current value still
  counts as a change.
- **Shape only.** Ops check shape and addressing. Catalog ids, tiers,
  limits and grammar are the commit gate's job.

## History: undo, redo and coalescing

```ts
import { createEditHistory } from '@texuli/catalog/edit';

const history = createEditHistory(tree, { limit: 200 });
history.apply({ op: 'setProp', path: [], name: 'title', value: 'Week 43' });
history.undo();
history.redo();
const stop = history.subscribe((event) => send(event.ops)); // replayable ops
```

- `apply(ops, { coalesceKey })` commits one step through the commit gate.
  Consecutive applies with the same `coalesceKey` merge into one step, so a
  field typed letter by letter undoes in one go. A step that was undone never
  merges with the next apply.
- A new apply drops the redo stack. An apply that changes nothing is not a
  step and emits nothing.
- `undo()` and `redo()` restore the stored trees (they do not re-run the
  gate) and return `false` when there is nothing to do.
- `limit` (default `DEFAULT_HISTORY_LIMIT`, 200) caps the undo steps; the
  oldest steps are dropped. `clear()` drops every step and keeps the tree.
- Listeners get `{ type, ops, tree }`, where `ops` take the previous tree to
  `tree` in that direction (the inverse ops on undo), so a host can replay
  them on another copy.

## The commit gate

`apply` runs the gate on the result and refuses it with `validation-failed`
(and the gate's diagnostics) when it fails; the tree is unchanged.

- **Default:** the tree limits (`validateCatalogTreeLimits`). It does not
  know catalog ids: an insert of an unknown id passes it.
- **Full validation:** hosts that edit agent or user drafts pass
  `draftCommitGate` from [`@texuli/catalog/validate`](./validate.md), which
  runs the whole `validateDraft` (ids, tiers, prop schemas, block family,
  grammar, root rule) on every edit:

```ts
import { createEditHistory } from '@texuli/catalog/edit';
import { draftCommitGate } from '@texuli/catalog/validate';

const history = createEditHistory(tree, { validate: draftCommitGate({ catalog }) });
```

## Digest

- `canonicalBlueprintJson(tree)` is the catalog build's canonical JSON:
  keys sorted at every depth, no whitespace, `undefined` dropped. It throws
  on values JSON cannot carry exactly, such as `NaN`.
- `blueprintDigest(tree)` resolves to the lowercase hex SHA-256 of that
  JSON (Web Crypto, so it is async). Two trees with the same data have the
  same digest whatever their key order, so export, import and export
  round-trip byte for byte, and a host can check that what the owner
  reviewed is what gets activated.

## Limits today

- **One root.** The edit model holds a single root node (v1). An array of
  roots is refused (`replaceAll` with an array is `invalid-node`), even
  though `validateDraft` can check fragments.
- **Positional paths.** Nodes have no stable ids yet, so concurrent editors
  must rebase paths themselves. The shipped blueprint envelope (ADR-004)
  does not lift this: its provenance records ops, not node ids, and stable
  node ids stay open there too ([envelope](./envelope.md#not-yet)).
- **No merge.** There is no conflict resolution or operational transform.
