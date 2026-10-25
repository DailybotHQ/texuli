import { renderCatalogTree } from '../renderer/render.ts';
import type { RenderDiagnostic } from '../renderer/types.ts';
import type { LimitDiagnostic, LimitedRenderOptions, LimitedRenderResult } from './types.ts';
import { checkRenderTime, resolveLimits, validateCatalogTreeLimits } from './validate.ts';

function shouldEnforceRenderTime(explicit?: boolean): boolean {
  if (explicit === true) return true;
  if (explicit === false) return false;
  return typeof process !== 'undefined' && process.env?.TEXULI_PERF === '1';
}

function toRenderDiagnostics(limitDiagnostics: readonly LimitDiagnostic[]): RenderDiagnostic[] {
  return limitDiagnostics.map((d) => ({
    code: 'invalid-node' as const,
    path: d.path || '0',
    message: `[limit:${d.code}] ${d.message}`,
  }));
}

/**
 * Validate whole-tree limits, then render only when the tree is within budget.
 *
 * On limit failure: returns empty `roots`, `withinLimits: false`, and both
 * limit + render-shaped diagnostics. The sink-free renderer is not invoked.
 *
 * Wall-clock `maxRenderMs` is enforced only when `enforceRenderTime` is true
 * or `process.env.TEXULI_PERF === '1'` (never in the default unit suite).
 */
export function renderCatalogTreeWithLimits(
  input: unknown,
  options: LimitedRenderOptions
): LimitedRenderResult {
  const limits = resolveLimits(options.limits);
  const started =
    shouldEnforceRenderTime(options.enforceRenderTime) && typeof performance !== 'undefined'
      ? performance.now()
      : null;

  const validation = validateCatalogTreeLimits(input, limits);

  if (!validation.ok) {
    return {
      roots: Object.freeze([]),
      diagnostics: Object.freeze(toRenderDiagnostics(validation.diagnostics)),
      withinLimits: false,
      metrics: validation.metrics,
      limits: validation.limits,
      limitDiagnostics: validation.diagnostics,
    };
  }

  const rendered = renderCatalogTree(input, {
    catalog: options.catalog,
    tier: options.tier,
    maxChildren: options.maxChildren ?? limits.maxBranching,
    conditions: options.conditions,
    conditionInputs: options.conditionInputs,
  });

  const limitDiagnostics: LimitDiagnostic[] = [...validation.diagnostics];
  let renderMs: number | undefined;

  if (started !== null) {
    renderMs = Math.max(0, Math.round(performance.now() - started));
    const timeIssue = checkRenderTime(renderMs, limits);
    if (timeIssue) {
      limitDiagnostics.push(timeIssue);
      return {
        roots: Object.freeze([]),
        diagnostics: Object.freeze([...toRenderDiagnostics([timeIssue]), ...rendered.diagnostics]),
        withinLimits: false,
        metrics: validation.metrics,
        limits,
        limitDiagnostics: Object.freeze(limitDiagnostics),
        renderMs,
      };
    }
  }

  return {
    roots: rendered.roots,
    diagnostics: rendered.diagnostics,
    withinLimits: true,
    metrics: validation.metrics,
    limits,
    limitDiagnostics: Object.freeze(limitDiagnostics),
    ...(renderMs !== undefined ? { renderMs } : {}),
  };
}
