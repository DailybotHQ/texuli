# `@texuli/document/ops-core`

The operations, patches and op log of [`@texuli/document/ops`](ops.md)
without the deck model, so an editor that never holds an inline deck never
loads `@texuli/deck/model` (Protoyard G136). Its results are validated with
[`@texuli/document/schema-core`](schema-core.md).

> **Status: in development.** From `0.11.5` (pre-1.0).

```ts
import { applyOperations, createDocumentHistory } from '@texuli/document/ops-core';

const result = applyOperations(doc, operations); // inline decks are refused
const history = createDocumentHistory(doc, { validateDeck: myDeckCheck });
```

- `applyOperation`, `applyOperations`, `applyDocumentPatch` and
  `createDocumentHistory` behave as in `@texuli/document/ops`, except that a
  result holding an inline deck embed is refused (`invalid-deck`) unless
  `validateDeck` (a `DeckPayloadValidator`) is passed in `ApplyOptions`,
  `PatchOptions` or `DocumentHistoryOptions`. A deck embedded by `ref` is
  accepted. `validate: false` skips validation in both entries alike.
- `checkDeckPayload` from `@texuli/document/schema` is the full entry's
  validator.
- Everything else is re-exported unchanged: `cloneData`, `DataError`,
  `equalData`, `MAX_VALUES`, `DocumentHistory`, `OpLogEntry`, `OpLogKind`,
  `ApplyResult`, `DOCUMENT_OPERATION_KINDS`, `DocumentAttrs`,
  `DocumentOperation`, `DocumentOperationKind`, `MAX_OPERATIONS`,
  `MetaChanges`, `NODE_ATTRS`, `sameDocument`, `DocumentPatch`,
  `DocumentPatchOperation`, `MAX_PATCH_OPERATIONS`, `PatchResult`,
  `parsePointer` and `toPointer`.
