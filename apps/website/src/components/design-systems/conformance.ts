/**
 * The /design-systems/ conformance table (PLAN_011 T-site-0100): a plain
 * summary of a `texuli ds check` report (`checkDesignSystem` from
 * `@texuli/tools/ds-check`, the static half the CLI runs). Every number the
 * page prints comes from here, and here only from the compiler's report, so
 * the page cannot claim a pair or a target the compiler did not check.
 * Pure and framework-free: the page, the unit test and the e2e spec share it.
 */
import type { DsCheckReport, DsCheckRun } from '@texuli/tools/ds-check';

export type ConformanceMode = 'light' | 'dark';
type PairKind = 'text' | 'ui' | 'focus';

/** One mode of one run: how many pairs the compiler checked and how many passed. */
export interface ModeConformance {
  mode: ConformanceMode;
  passed: number;
  total: number;
  byKind: Record<PairKind, { passed: number; total: number }>;
  /** The text pair closest to its requirement (the tightest margin). */
  tightest: { foreground: string; background: string; ratio: number; required: number } | null;
}

/** One compiled run: the base document or one variant. */
export interface RunConformance {
  /** `null` for the base document. */
  variant: string | null;
  ok: boolean;
  /** The contrast target the run was held to. */
  contrast: 'AA' | 'AAA' | null;
  targetMin: number | null;
  modes: ModeConformance[];
  targets: { passed: number; total: number };
  adjustments: number;
}

export interface BrandConformance {
  ok: boolean;
  codes: string[];
  runs: RunConformance[];
}

const KINDS: readonly PairKind[] = ['text', 'ui', 'focus'];
const MODES: readonly ConformanceMode[] = ['light', 'dark'];

function modeOf(run: DsCheckRun, mode: ConformanceMode): ModeConformance | null {
  const pairs = run.contrast[mode];
  if (!pairs) return null;
  const byKind = Object.fromEntries(
    KINDS.map((kind) => {
      const of = pairs.filter((pair) => pair.kind === kind);
      return [kind, { passed: of.filter((pair) => pair.pass).length, total: of.length }];
    })
  ) as ModeConformance['byKind'];
  let tightest: ModeConformance['tightest'] = null;
  for (const pair of pairs) {
    if (pair.kind !== 'text') continue;
    if (!tightest || pair.ratio / pair.required < tightest.ratio / tightest.required) {
      tightest = {
        foreground: pair.foreground,
        background: pair.background,
        ratio: pair.ratio,
        required: pair.required,
      };
    }
  }
  return {
    mode,
    passed: pairs.filter((pair) => pair.pass).length,
    total: pairs.length,
    byKind,
    tightest,
  };
}

/** The summary of one `texuli ds check` report. */
export function summarizeConformance(report: DsCheckReport): BrandConformance {
  return {
    ok: report.ok,
    codes: [...report.codes],
    runs: report.runs.map((run) => ({
      variant: run.variant,
      ok: run.ok,
      contrast: run.compiled?.accessibility.contrast ?? null,
      targetMin: run.compiled?.accessibility.targetMin ?? null,
      modes: MODES.map((mode) => modeOf(run, mode)).filter(
        (entry): entry is ModeConformance => entry !== null
      ),
      targets: {
        passed: run.targets.filter((target) => target.pass).length,
        total: run.targets.length,
      },
      adjustments: run.adjustments.length,
    })),
  };
}

/** `74 of 74` — the cell text the page prints and the spec reads back. */
export function pairsLabel(mode: Pick<ModeConformance, 'passed' | 'total'>): string {
  return `${mode.passed} of ${mode.total}`;
}

/** `4.62:1 (needs 4.5:1)` for a tightest pair. */
export function ratioLabel(pair: { ratio: number; required: number }): string {
  return `${pair.ratio}:1 (needs ${pair.required}:1)`;
}
