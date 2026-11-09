/** Locked-mode runtime checks: catalog ownership plus token-backed rendering and axe. */
import { type DsMapAllowManifest, type DsMapReport, mapDesignSystemTree } from './map.ts';
import {
  type DsCheckPage,
  type DsRenderOptions,
  type RenderDesignSystemCheckOptions,
  renderIssues,
  runDsRenderChecks,
  withDsCheckPage,
} from './render.ts';
import { issueCodes } from './static.ts';
import {
  DS_CHECK_GLOBAL,
  type DsCheckIssue,
  type DsCheckReport,
  type DsCheckRun,
  type DsRenderRun,
} from './types.ts';

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

/** A mapping with nothing to report: the page was a conformance sheet, not a prototype. */
const NOT_MAPPED: DsMapReport = { ok: true, codes: [], errors: [] };

/**
 * Map the page's ds-check scope in the browser (the host's `map`, i.e.
 * {@link checkLockedRenderTree} on the live DOM) against the locked allow set.
 */
export async function mapLockedRenderPage(
  page: DsCheckPage,
  allowManifest: DsMapAllowManifest = {},
  options: { timeoutMs?: number } = {}
): Promise<DsMapReport> {
  await page.waitForFunction((name) => name in globalThis, DS_CHECK_GLOBAL, {
    timeout: options.timeoutMs ?? 60_000,
  });
  return page.evaluate(
    ([name, allow]) => {
      const host = (
        globalThis as unknown as Record<
          string,
          { map?(input: { allow?: unknown }): DsMapReport } | undefined
        >
      )[name];
      if (!host?.map) throw new Error('The page has no ds-check host with map().');
      return host.map(allow === undefined ? {} : { allow });
    },
    [DS_CHECK_GLOBAL, allowManifest.allow] as const
  );
}

export interface LockedRenderCheckResult {
  /** The ds check report with the locked render findings merged in, and `render` set. */
  readonly report: DsCheckReport;
  readonly locked: LockedRenderReport;
  /**
   * Whether the page was mapped against the allow set: only a page you serve
   * (`url`, your prototype). The conformance sheet paints every catalog
   * component by design, so it is not mapped.
   */
  readonly mapped: boolean;
}

/**
 * The locked render check behind `ds check --locked --render` and
 * `ds validate --locked --render`: open the sheet or `url` like
 * {@link renderDesignSystemCheck}, map a `url` page against the allow set,
 * then run {@link runLockedRenderChecks} (chart, map and canvas marks exempt
 * from the per-pixel literal check, see {@link DS_LOCKED_RENDER_EXEMPT_IDS}).
 */
export async function renderLockedDesignSystemCheck(
  report: DsCheckReport,
  allowManifest: DsMapAllowManifest | undefined,
  options: RenderDesignSystemCheckOptions = {}
): Promise<LockedRenderCheckResult> {
  const mapped = options.url !== undefined;
  return withDsCheckPage(options, async (page, { url, axe }) => {
    const mapping = mapped ? await mapLockedRenderPage(page, allowManifest, options) : NOT_MAPPED;
    const locked = await runLockedRenderChecks(page, report.runs, mapping, { ...options, axe });
    const errors = [...report.errors, ...locked.errors];
    return {
      report: {
        ...report,
        ok: report.ok && locked.ok,
        codes: issueCodes(errors),
        errors,
        render: { ok: locked.ok, url, runs: locked.runs },
      },
      locked,
      mapped,
    };
  });
}
