/**
 * @texuli/document/ops-core: the operations, patches and op log of
 * `@texuli/document/ops` validated without the deck model (G136): a result
 * holding an inline deck is refused (`invalid-deck`) unless `validateDeck` is
 * passed. Everything else is checked exactly as in `@texuli/document/ops`.
 */
export { cloneData, DataError, equalData, MAX_VALUES } from './clone.ts';
export {
  createDocumentHistory,
  type DocumentHistory,
  type DocumentHistoryOptions,
  type OpLogEntry,
  type OpLogKind,
} from './history.ts';
export {
  type ApplyOptions,
  type ApplyResult,
  applyOperation,
  applyOperations,
  DOCUMENT_OPERATION_KINDS,
  type DocumentAttrs,
  type DocumentOperation,
  type DocumentOperationKind,
  MAX_OPERATIONS,
  type MetaChanges,
  NODE_ATTRS,
  sameDocument,
} from './operations.ts';
export {
  applyDocumentPatch,
  type DocumentPatch,
  type DocumentPatchOperation,
  MAX_PATCH_OPERATIONS,
  type PatchOptions,
  type PatchResult,
  parsePointer,
  toPointer,
} from './patch.ts';
