/**
 * `@texuli/tools/golden` (T-tool-golden): the agent golden set, 30
 * pre-registered interface tasks with reference trees, and an offline scorer.
 * A tree is checked for schema validity, `dontUseWhen` guidance, sinks,
 * composition grammar, axe on a real DOM paint, and task coverage. Model runs
 * are report-only (`scoreGoldenRun`, the `texuli-golden` CLI).
 */
export { type AxeLike, createAxeRunner, GOLDEN_AXE_OPTIONS } from './axe.ts';
export {
  CHART_TITLE_LEVELS,
  GOLDEN_FRAME_IDS,
  GOLDEN_GRAMMAR_ROLES,
  GOLDEN_MANIFESTS,
  goldenGrammarRoles,
  goldenManifest,
  goldenRenderCatalog,
} from './catalog.ts';
export { checkGuidance, GUIDANCE_DETECTORS, type GuidanceDetector } from './guidance.ts';
export { projectOutline } from './outline.ts';
export { type GoldenPaint, type GoldenPaintOptions, paintGoldenTree } from './paint.ts';
export { formatGoldenReport, type GoldenRunReport, scoreGoldenRun } from './report.ts';
export { type GoldenScoreOptions, scoreGoldenTree } from './score.ts';
export { checkSinks } from './sinks.ts';
export { GOLDEN_TASKS, goldenTask } from './tasks.ts';
export {
  GOLDEN_CHECKS,
  type GoldenAxeRunner,
  type GoldenAxeViolation,
  type GoldenCheckId,
  type GoldenCheckResult,
  type GoldenCheckStatus,
  type GoldenScore,
  type GoldenTask,
} from './types.ts';
