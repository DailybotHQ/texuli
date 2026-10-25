import type { RenderDiagnostic, RenderOptions, RenderResult } from '../renderer/types.ts';

/**
 * Whole-tree limits checked **before** sink-free rendering (DoS / abuse guard).
 * Counts are inclusive of every catalog node in the input tree.
 */
export interface TreeLimits {
  /** Max depth from a root (root = 1). Default 16. */
  maxDepth: number;
  /** Max total nodes across all roots. Default 512. */
  maxNodes: number;
  /** Max UTF-8 byte size of a canonical JSON snapshot of the input. Default 256 KiB. */
  maxBytes: number;
  /** Max children on any single node (branching / nesting fan-out). Default 64. */
  maxBranching: number;
  /** Max top-level roots when the input is an array. Default 32. */
  maxRoots: number;
  /**
   * Max wall-clock ms for measure+render. Only enforced when
   * `process.env.TEXULI_PERF === '1'` (never in the default suite).
   * Default 100.
   */
  maxRenderMs: number;
}

export const DEFAULT_TREE_LIMITS: Readonly<TreeLimits> = Object.freeze({
  maxDepth: 16,
  maxNodes: 512,
  maxBytes: 256 * 1024,
  maxBranching: 64,
  maxRoots: 32,
  maxRenderMs: 100,
});

/** Measured shape of an untrusted catalog tree input. */
export interface TreeMetrics {
  /** Deepest node depth (root = 1). 0 if empty. */
  depth: number;
  /** Total nodes visited. */
  nodes: number;
  /** UTF-8 bytes of the canonical snapshot used for the byte budget. */
  bytes: number;
  /** Largest children array length on any node. */
  branching: number;
  /** Number of top-level roots. */
  roots: number;
}

export type LimitIssueCode =
  | 'depth-exceeded'
  | 'nodes-exceeded'
  | 'bytes-exceeded'
  | 'branching-exceeded'
  | 'roots-exceeded'
  | 'time-exceeded'
  | 'invalid-tree';

export interface LimitDiagnostic {
  code: LimitIssueCode;
  path: string;
  message: string;
  /** Limit that was hit, when applicable. */
  limit?: number;
  /** Observed value, when applicable. */
  observed?: number;
}

export interface TreeLimitValidation {
  ok: boolean;
  metrics: TreeMetrics;
  limits: TreeLimits;
  diagnostics: readonly LimitDiagnostic[];
}

export interface LimitedRenderOptions extends RenderOptions {
  /** Override default tree limits (partial). */
  limits?: Partial<TreeLimits>;
  /**
   * When true, also enforce `maxRenderMs` (wall clock).
   * Default: `process.env.TEXULI_PERF === '1'` only.
   */
  enforceRenderTime?: boolean;
}

export interface LimitedRenderResult extends RenderResult {
  /** Whether the tree passed limit validation (false → roots empty). */
  withinLimits: boolean;
  metrics: TreeMetrics;
  limits: TreeLimits;
  limitDiagnostics: readonly LimitDiagnostic[];
  /** Wall-clock ms for validate+render when measured; omitted otherwise. */
  renderMs?: number;
}

/** Limit diagnostics folded into the render diagnostic stream. */
export type LimitRenderDiagnostic = RenderDiagnostic & {
  code: RenderDiagnostic['code'] | LimitIssueCode;
};
