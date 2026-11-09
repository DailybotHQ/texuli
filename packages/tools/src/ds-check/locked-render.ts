/** Locked-mode runtime checks: catalog ownership plus token-backed rendering and axe. */
import { type DsMapAllowManifest, type DsMapReport, mapDesignSystemTree } from './map.ts';
import { type DsRenderOptions, renderIssues, runDsRenderChecks } from './render.ts';
import type { DsCheckIssue, DsCheckRun, DsRenderRun } from './types.ts';

export const DS_LOCKED_RENDER_EXEMPT_IDS = ['canvas', 'data-map', 'charts-*'] as const;

export interface LockedRenderOptions extends Omit<DsRenderOptions, 'axe'> {
  readonly axe?: DsRenderOptions['axe'];
}

export interface LockedRenderReport {
  readonly ok: boolean;
  readonly codes: string[];
  readonly errors: DsCheckIssue[];
  readonly mapping: DsMapReport;
  readonly runs: DsRenderRun[];
}

/** Map runtime controls through their nearest catalog root and the locked allow set. */
export function checkLockedRenderTree(
  root: ParentNode,
  allowManifest?: DsMapAllowManifest
): DsMapReport {
  return mapDesignSystemTree(root, { allowManifest });
}

export function isLockedVisualizationMark(
  component: string,
  element: string,
  property: string
): boolean {
  const visualization =
    component === 'canvas' || component === 'data-map' || component.startsWith('charts-');
  const geometry = /^(?:path|rect|circle|ellipse|line|polyline|polygon)(?:\.|\[|$)/.test(element);
  return visualization && geometry && (property === 'fill' || property === 'stroke');
}

/**
 * Run a locked document's render checks. Painted chart, map and canvas marks
 * are data visualization, so their fill/stroke is exempt; their HTML chrome,
 * text, controls, token contrast and axe findings remain in the report.
 * `mapping` is computed on the page's live scope by {@link checkLockedRenderTree}.
 */
export async function runLockedRenderChecks(
  page: Parameters<typeof runDsRenderChecks>[0],
  runs: readonly DsCheckRun[],
  mapping: DsMapReport,
  options: LockedRenderOptions = {}
): Promise<LockedRenderReport> {
  const rendered = await runDsRenderChecks(page, runs, options);
  const checked = rendered.map((run) => {
    const literals = run.literals.filter(
      (literal) => !isLockedVisualizationMark(literal.component, literal.element, literal.property)
    );
    const checkedRun: DsRenderRun = {
      ...run,
      literals,
      ok:
        run.axe.length === 0 &&
        literals.length === 0 &&
        run.pairs.every((pair) => pair.pass) &&
        run.components.length > 0,
    };
    return checkedRun;
  });
  const errors = [...mapping.errors, ...checked.flatMap((run) => renderIssues(run))];
  const codes = [...new Set(errors.map((error) => error.code))].sort();
  return {
    ok: mapping.ok && checked.every((run) => run.ok),
    codes,
    errors,
    mapping,
    runs: checked,
  };
}
