import { measureCatalogTree } from './measure.ts';
import {
  DEFAULT_TREE_LIMITS,
  type LimitDiagnostic,
  type TreeLimits,
  type TreeLimitValidation,
  type TreeMetrics,
} from './types.ts';

function resolveLimits(partial?: Partial<TreeLimits>): TreeLimits {
  const merged: TreeLimits = {
    ...DEFAULT_TREE_LIMITS,
    ...partial,
  };
  // Floor at 0; non-finite → default.
  const clamp = (value: number, fallback: number): number => {
    if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
    return Math.max(0, Math.floor(value));
  };
  return {
    maxDepth: clamp(merged.maxDepth, DEFAULT_TREE_LIMITS.maxDepth),
    maxNodes: clamp(merged.maxNodes, DEFAULT_TREE_LIMITS.maxNodes),
    maxBytes: clamp(merged.maxBytes, DEFAULT_TREE_LIMITS.maxBytes),
    maxBranching: clamp(merged.maxBranching, DEFAULT_TREE_LIMITS.maxBranching),
    maxRoots: clamp(merged.maxRoots, DEFAULT_TREE_LIMITS.maxRoots),
    maxRenderMs: clamp(merged.maxRenderMs, DEFAULT_TREE_LIMITS.maxRenderMs),
  };
}

function pushLimit(
  diagnostics: LimitDiagnostic[],
  code: LimitDiagnostic['code'],
  path: string,
  message: string,
  limit: number,
  observed: number
): void {
  diagnostics.push({ code, path, message, limit, observed });
}

/**
 * Validate depth, nodes, bytes, branching and roots **before** rendering.
 * Does not enforce wall-clock time (see {@link checkRenderTime}).
 */
export function validateCatalogTreeLimits(
  input: unknown,
  partialLimits?: Partial<TreeLimits>
): TreeLimitValidation {
  const limits = resolveLimits(partialLimits);
  const { metrics, diagnostics: measureDiagnostics } = measureCatalogTree(
    input,
    // Allow measuring slightly past maxNodes so the diagnostic can report the true count,
    // but still hard-cap to avoid hangs (10× default max or at least 10k).
    Math.max(limits.maxNodes * 10, 10_000)
  );

  const diagnostics: LimitDiagnostic[] = [...measureDiagnostics];

  if (metrics.roots > limits.maxRoots) {
    pushLimit(
      diagnostics,
      'roots-exceeded',
      '',
      `Tree has ${metrics.roots} roots; limit is ${limits.maxRoots}.`,
      limits.maxRoots,
      metrics.roots
    );
  }
  if (metrics.depth > limits.maxDepth) {
    pushLimit(
      diagnostics,
      'depth-exceeded',
      '',
      `Tree depth ${metrics.depth} exceeds limit ${limits.maxDepth}.`,
      limits.maxDepth,
      metrics.depth
    );
  }
  if (metrics.nodes > limits.maxNodes) {
    pushLimit(
      diagnostics,
      'nodes-exceeded',
      '',
      `Tree has ${metrics.nodes} nodes; limit is ${limits.maxNodes}.`,
      limits.maxNodes,
      metrics.nodes
    );
  }
  if (metrics.bytes > limits.maxBytes) {
    pushLimit(
      diagnostics,
      'bytes-exceeded',
      '',
      `Tree snapshot is ${metrics.bytes} bytes; limit is ${limits.maxBytes}.`,
      limits.maxBytes,
      metrics.bytes
    );
  }
  if (metrics.branching > limits.maxBranching) {
    pushLimit(
      diagnostics,
      'branching-exceeded',
      '',
      `Max children on one node is ${metrics.branching}; limit is ${limits.maxBranching}.`,
      limits.maxBranching,
      metrics.branching
    );
  }

  // Structural invalid-tree notes do not fail the budget by themselves when
  // counts are within limits — the renderer still diagnoses node shape.
  const budgetCodes = new Set([
    'roots-exceeded',
    'depth-exceeded',
    'value-depth-exceeded',
    'value-cycle',
    'nodes-exceeded',
    'bytes-exceeded',
    'branching-exceeded',
  ]);
  const ok = !diagnostics.some((d) => budgetCodes.has(d.code));

  return {
    ok,
    metrics: metrics as TreeMetrics,
    limits,
    diagnostics: Object.freeze(diagnostics),
  };
}

/**
 * Optional wall-clock check. Call only from perf-gated paths.
 */
export function checkRenderTime(renderMs: number, limits: TreeLimits): LimitDiagnostic | null {
  if (renderMs <= limits.maxRenderMs) return null;
  return {
    code: 'time-exceeded',
    path: '',
    message: `Render took ${renderMs}ms; limit is ${limits.maxRenderMs}ms.`,
    limit: limits.maxRenderMs,
    observed: renderMs,
  };
}

export { resolveLimits };
