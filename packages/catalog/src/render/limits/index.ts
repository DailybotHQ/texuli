/**
 * `@texuli/catalog/render/limits` — whole-tree depth/nodes/bytes/branching
 * validation before sink-free rendering (T-render-limits).
 *
 * Wall-clock budgets run only when `TEXULI_PERF=1` or `enforceRenderTime: true`.
 */

export {
  canonicalTreeJson,
  type MeasureTreeResult,
  measureCatalogTree,
  utf8ByteLength,
} from './measure.ts';
export { renderCatalogTreeWithLimits } from './render.ts';
export {
  DEFAULT_TREE_LIMITS,
  type LimitDiagnostic,
  type LimitedRenderOptions,
  type LimitedRenderResult,
  type LimitIssueCode,
  type LimitRenderDiagnostic,
  type TreeLimits,
  type TreeLimitValidation,
  type TreeMetrics,
} from './types.ts';
export {
  checkRenderTime,
  resolveLimits,
  validateCatalogTreeLimits,
} from './validate.ts';
