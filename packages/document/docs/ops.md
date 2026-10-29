# `@texuli/document/ops`

Typed operations addressed by persisted id, with exact inverses; bounded
RFC 6902 patches with inverse patches; and the op log with undo and redo.
The input is never mutated, a failure changes nothing, and every result is
validated (at the `untrusted` tier by default).

> **Status: in development.** Not on npm yet (first release planned for
> `0.7.0`).

## Operations

`DocumentOperation` (`DocumentOperationKind`, all listed in
`DOCUMENT_OPERATION_KINDS`):

| Operation | Effect |
| --- | --- |
| `insert-node` | Insert a node with its subtree at `index` of `parent`'s children (`null` is the top level) |
| `remove-node` | Remove a node and its subtree |
| `move-node` | Move a node; `index` counts after it left its old place, as in RFC 6902 `move`; a node never moves inside itself |
| `set-attrs` | Change attributes (`DocumentAttrs`; `null` removes an optional one); `NODE_ATTRS` lists what each node type allows |
| `insert-text`, `delete-text` | Edit a text block's text at UTF-16 offsets (a break counts 1; `\n` inserts a break) |
| `set-mark` | Add or remove a mark over a range |
| `replace-text` | Replace a range with inline content (every text inverse is one) |
| `set-meta` | Change metadata (`MetaChanges`; `null` removes an optional field) |
| `set-page` | Set or clear the page settings |

Parents only take what they can hold: lists take list items, columns take
columns, and block lists take blocks.

```ts
import { applyOperations } from '@texuli/document/ops';

const result = applyOperations(doc, [
  { op: 'insert-node', parent: null, index: 0, node: { id: 'p9', type: 'paragraph', content: [] } },
  { op: 'insert-text', id: 'p9', offset: 0, text: 'Hello' },
]);
if (result.ok) {
  const undone = applyOperations(result.document, result.inverse); // equals `doc`
}
```

- `applyOperations(doc, operations, options)` applies a transaction of up
  to `MAX_OPERATIONS` (10,000) and returns an `ApplyResult`: the new
  document, the `inverse` transaction (already in reverse order) and
  warnings, or the failing index and reason. `ApplyOptions.validate` sets
  the tier or skips validation with `false`.
- `applyOperation(doc, operation, options)` applies one.
- `sameDocument(a, b)` compares documents as data.

## Patches

Agents edit documents with bounded RFC 6902 patches (ADR-011); `test`
operations are encouraged.

- `applyDocumentPatch(doc, patch, options)` applies a `DocumentPatch` of up
  to `MAX_PATCH_OPERATIONS` (1,000) `DocumentPatchOperation`s and returns a
  `PatchResult`: the validated document and the `inverse` patch, or the
  failing index and reason. `PatchOptions.validate` works as above.
  The document is copied once, whatever the patch length.
- Prototype-related paths, malformed escapes and moves into a descendant
  are refused. `parsePointer` and `toPointer` convert RFC 6901 pointers.

## The op log

`createDocumentHistory(doc, options)` returns a `DocumentHistory`:
`apply(operations, { origin })`, `undo()`, `redo()`, `canUndo`,
`canRedo`, `document`, `log()`, `since(seq)` and `subscribe(listener)`.
Every applied transaction (edits, undos and redos alike) is appended as an
`OpLogEntry` (`seq`, `kind` as an `OpLogKind`, `operations`, `inverse`,
`origin`), so a host can persist, replay or forward it; undo applies the
recorded inverse as a new entry instead of rewinding the log.
`apply(operations, { undoable: false })` logs a `sync` entry that stays off
the undo and redo stacks: a synced editor applies remote changes this way,
and its undo is the replica's (`@texuli/document/collab`).
`DocumentHistoryOptions` sets the undo `limit` (200), the kept `logLimit`
(10,000) and `validate`.

## Plain data helpers

`cloneData` copies plain JSON data iteratively (shared references are
copied apart; more than `MAX_VALUES` containers, a cycle included, throws
`DataError`); `equalData` compares it.
