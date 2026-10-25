import { type GoldenScoreOptions, scoreGoldenTree } from './score.ts';
import { GOLDEN_TASKS } from './tasks.ts';
import { GOLDEN_CHECKS, type GoldenCheckId, type GoldenScore, type GoldenTask } from './types.ts';

/**
 * Model runs are report-only: a run is scored and summarized, and nothing
 * here throws or fails a build on a model's output. The reference trees are
 * the gate (`packages/tools/tests/golden.test.ts`).
 */

export interface GoldenRunReport {
  /** One score per golden task, in task order (a missing output scores as empty). */
  scores: readonly GoldenScore[];
  /** Task ids the run had no output for. */
  missing: readonly string[];
  /** Output keys that name no golden task (ignored). */
  unknown: readonly string[];
  /** Per check: how many tasks passed it, and how many ran it. */
  checks: Readonly<Record<GoldenCheckId, { passed: number; ran: number }>>;
  /** Tasks that passed every check that ran. */
  passed: number;
  total: number;
}

export async function scoreGoldenRun(
  outputs: unknown,
  options: GoldenScoreOptions & { tasks?: readonly GoldenTask[] } = {}
): Promise<GoldenRunReport> {
  const tasks = options.tasks ?? GOLDEN_TASKS;
  const record =
    outputs && typeof outputs === 'object' && !Array.isArray(outputs)
      ? (outputs as Record<string, unknown>)
      : {};
  const ids = new Set(tasks.map((task) => task.id));
  const scores: GoldenScore[] = [];
  for (const task of tasks) scores.push(await scoreGoldenTree(task, record[task.id], options));
  const checks = Object.fromEntries(
    GOLDEN_CHECKS.map((id) => {
      const rows = scores.map((score) => score.checks.find((check) => check.check === id));
      return [
        id,
        {
          passed: rows.filter((row) => row?.status === 'pass').length,
          ran: rows.filter((row) => row && row.status !== 'skipped').length,
        },
      ];
    })
  ) as GoldenRunReport['checks'];
  return {
    scores,
    missing: tasks.filter((task) => !(task.id in record)).map((task) => task.id),
    unknown: Object.keys(record).filter((key) => !ids.has(key)),
    checks,
    passed: scores.filter((score) => score.passed).length,
    total: tasks.length,
  };
}

/** A Markdown summary of a run: totals, per-check pass counts, then failures. */
export function formatGoldenReport(report: GoldenRunReport): string {
  const lines = [
    '# Golden set run (report only)',
    '',
    `**${report.passed} of ${report.total}** tasks passed every check that ran.`,
    '',
    '| Check | Passed | Ran |',
    '| --- | ---: | ---: |',
    ...GOLDEN_CHECKS.map(
      (id) => `| ${id} | ${report.checks[id].passed} | ${report.checks[id].ran} |`
    ),
  ];
  if (report.missing.length) lines.push('', `Missing outputs: ${report.missing.join(', ')}`);
  if (report.unknown.length) lines.push('', `Ignored keys: ${report.unknown.join(', ')}`);
  const missing = new Set(report.missing);
  const failed = report.scores.filter((score) => !score.passed && !missing.has(score.taskId));
  if (failed.length) {
    lines.push('', '## Failures');
    for (const score of failed) {
      lines.push('', `### ${score.taskId}`);
      for (const check of score.checks) {
        if (check.status !== 'fail') continue;
        for (const issue of check.issues.slice(0, 8)) lines.push(`- ${check.check}: ${issue}`);
        if (check.issues.length > 8)
          lines.push(`- ${check.check}: … ${check.issues.length - 8} more`);
      }
    }
  }
  return `${lines.join('\n')}\n`;
}
