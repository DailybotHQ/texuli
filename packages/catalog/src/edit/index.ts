/**
 * `@texuli/catalog/edit` — the framework-free edit-operation core for
 * blueprint trees: a closed, serializable op set (also the agent service's
 * patch vocabulary), undo and redo with listener hooks, and the canonical
 * digest hosts compare before activation.
 */

export { blueprintDigest, canonicalBlueprintJson } from './digest.ts';
export {
  createEditHistory,
  DEFAULT_HISTORY_LIMIT,
  type EditEntry,
  type EditEvent,
  type EditHistory,
  type EditHistoryOptions,
  type HistoryApplyResult,
} from './history.ts';
export { applyEditOp, applyEditOps, getNode } from './ops.ts';
export {
  isPlainJson,
  isPropName,
  isTreeNode,
  MAX_BATCH_OPS,
  MAX_PATH_LENGTH,
  type ParseOpResult,
  type ParseOpsResult,
  parseEditOp,
  parseEditOps,
} from './parse.ts';
export type {
  EditError,
  EditErrorCode,
  EditOp,
  EditOpKind,
  EditResult,
  EditValidation,
  NodePath,
} from './types.ts';
