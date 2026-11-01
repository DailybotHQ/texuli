/**
 * @texuli/document/ops: typed operations addressed by persisted id, with
 * exact inverses; bounded RFC 6902 patches with inverse patches; and the op
 * log with undo and redo. Every result is validated (`untrusted` tier by
 * default, inline decks through `checkDeckPayload`) and every failure leaves
 * the input untouched. `@texuli/document/ops-core` is the same without the
 * deck model.
 */
import type { TexuliDocument } from '../model/types.ts';
import { checkDeckPayload } from '../schema/deck-check.ts';
import {
  createDocumentHistory as createHistoryCore,
  type DocumentHistory,
  type DocumentHistoryOptions,
} from './history.ts';
import {
  type ApplyOptions,
  type ApplyResult,
  applyOperations as applyCore,
  applyOperation as applyOneCore,
  type DocumentOperation,
} from './operations.ts';
import {
  type DocumentPatchOperation,
  type PatchOptions,
  type PatchResult,
  applyDocumentPatch as patchCore,
} from './patch.ts';

export { cloneData, DataError, equalData, MAX_VALUES } from './clone.ts';
export type { DocumentHistory, DocumentHistoryOptions, OpLogEntry, OpLogKind } from './history.ts';
export {
  type ApplyOptions,
  type ApplyResult,
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
  type DocumentPatch,
  type DocumentPatchOperation,
  MAX_PATCH_OPERATIONS,
  type PatchOptions,
  type PatchResult,
  parsePointer,
  toPointer,
} from './patch.ts';

/**
 * Apply a transaction of operations. On success the result is a new
 * document (the input is never mutated) with the inverse transaction; on
 * failure nothing changes and the failing index and reason are reported.
 */
export function applyOperations(
  doc: TexuliDocument,
  operations: readonly DocumentOperation[],
  options: ApplyOptions = {}
): ApplyResult {
  return applyCore(doc, operations, { validateDeck: checkDeckPayload, ...options });
}

/** Apply one operation (a transaction of one). */
export function applyOperation(
  doc: TexuliDocument,
  operation: DocumentOperation,
  options: ApplyOptions = {}
): ApplyResult {
  return applyOneCore(doc, operation, { validateDeck: checkDeckPayload, ...options });
}

/** Apply a bounded RFC 6902 patch to a document, with its inverse patch. */
export function applyDocumentPatch(
  doc: TexuliDocument,
  patch: readonly DocumentPatchOperation[],
  options: PatchOptions = {}
): PatchResult {
  return patchCore(doc, patch, { validateDeck: checkDeckPayload, ...options });
}

/** The op log with undo and redo over a document. */
export function createDocumentHistory(
  initial: TexuliDocument,
  options: DocumentHistoryOptions = {}
): DocumentHistory {
  return createHistoryCore(initial, { validateDeck: checkDeckPayload, ...options });
}
