/**
 * @texuli/document/ops: typed operations addressed by persisted id, with
 * exact inverses; bounded RFC 6902 patches with inverse patches; and the op
 * log with undo and redo. Every result is validated (`untrusted` tier by
 * default) and every failure leaves the input untouched.
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
