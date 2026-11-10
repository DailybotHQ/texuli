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

/** The route (path and query of `url`, no origin or fragment) and viewport of a render page. */
export function renderWhere(
  url: string,
  page: Pick<DsCheckPage, 'viewportSize'>
): { route?: string; viewport?: string } {
  let route: string | undefined;
  try {
    const parsed = new URL(url);
    route = `${parsed.pathname}${parsed.search}`.slice(0, 512);
  } catch {
    route = undefined;
  }
  let size: { width: number; height: number } | null | undefined;
  try {
    size = page.viewportSize?.();
  } catch {
    size = undefined;
  }
  const viewport =
    size && Number.isFinite(size.width) && Number.isFinite(size.height)
      ? `${Math.round(size.width)}x${Math.round(size.height)}`
      : undefined;
  return { ...(route ? { route } : {}), ...(viewport ? { viewport } : {}) };
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
  // The whole manifest reaches host.map: `allow` and `composed` (library composes, host
  // extensions), so the page is mapped exactly as mapDesignSystemTree maps it (0.17.2).
  const input: { allow?: unknown; composed?: unknown } = {};
  if (allowManifest.allow !== undefined) input.allow = allowManifest.allow;
  if (allowManifest.composed !== undefined) input.composed = allowManifest.composed;
  return page.evaluate(
    ([name, manifest]) => {
      const host = (
        globalThis as unknown as Record<
          string,
          { map?(input: { allow?: unknown; composed?: unknown }): DsMapReport } | undefined
        >
      )[name];
      if (!host?.map) throw new Error('The page has no ds-check host with map().');
      return host.map(manifest);
    },
    [DS_CHECK_GLOBAL, input] as const
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

/** The longest scope kept on a finding (the baseline key caps every field at 512). */
const MAX_SCOPE = 512;

/**
 * A host-chosen scope as kept on findings: a string, cut at 512 characters, with control
 * characters refused (`undefined`). Empty means no scope.
 */
export function dsFindingScope(value: unknown): string | undefined {
  if (typeof value !== 'string' || value.length === 0) return undefined;
  // biome-ignore lint/suspicious/noControlCharactersInRegex: refuses control characters.
  if (/[\u0000-\u001f\u007f]/.test(value)) return undefined;
  return value.slice(0, MAX_SCOPE);
}

export interface LockedRenderCheckOptions extends RenderDesignSystemCheckOptions {
  /**
   * A host-chosen scope, such as a prototype id, set on every locked render finding
   * (0.17.4), so one run that checks several prototypes keeps the same selector on the same
   * route of two prototypes apart in a baseline.
   */
  scope?: string;
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
  options: LockedRenderCheckOptions = {}
): Promise<LockedRenderCheckResult> {
  const mapped = options.url !== undefined;
  return withDsCheckPage(options, async (page, { url, axe }) => {
    const mapping = mapped ? await mapLockedRenderPage(page, allowManifest, options) : NOT_MAPPED;
    const checked = await runLockedRenderChecks(page, report.runs, mapping, { ...options, axe });
    // Every render finding names the route and viewport it was found on, and the host's
    // scope when one is set, so baselines keep findings of different routes, viewports,
    // modes and scopes apart (0.17.3, 0.17.4).
    const scope = dsFindingScope(options.scope);
    const where = { ...renderWhere(url, page), ...(scope ? { scope } : {}) };
    const locked: LockedRenderReport = {
      ...checked,
      errors: checked.errors.map((issue) => ({ ...issue, ...where })),
    };
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
