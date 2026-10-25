import type { CatalogTreeInput, RenderTier } from '@texuli/catalog/render/renderer';

/** One pre-registered interface task of the agent golden set. */
export interface GoldenTask {
  /** Stable id: `g<NN>-<kebab-name>`. */
  id: string;
  title: string;
  /** The prompt a model receives. Fictional content only. */
  brief: string;
  /** Who authors the tree. The golden set is agent content: `untrusted`. */
  tier: RenderTier;
  /** Component ids the interface needs (the scorer's coverage check). */
  mustInclude: readonly string[];
  /**
   * `dontUseWhen` lines the brief deliberately baits (it mentions navigation,
   * sign-in or a purchase the interface must leave to the host app). Each is
   * an exact manifest line with a detector in `guidance.ts`.
   */
  traps: readonly string[];
  /** A reference tree that passes every check. */
  reference: CatalogTreeInput;
}

/** The checks the scorer runs, in order. */
export const GOLDEN_CHECKS = [
  'schema',
  'dontUseWhen',
  'sinks',
  'grammar',
  'axe',
  'coverage',
] as const;
export type GoldenCheckId = (typeof GOLDEN_CHECKS)[number];

/**
 * `skipped` when a check cannot run: axe without a DOM runner or after a
 * schema failure, grammar when nothing rendered, sinks and guidance when the
 * output is not a tree. A skipped check never counts as passed.
 */
export type GoldenCheckStatus = 'pass' | 'fail' | 'skipped';

export interface GoldenCheckResult {
  check: GoldenCheckId;
  status: GoldenCheckStatus;
  /** Why it failed (stable, human-readable lines). Empty on pass. */
  issues: readonly string[];
}

export interface GoldenScore {
  taskId: string;
  /** True when no check failed (a skipped check does not fail). */
  passed: boolean;
  /** Passed checks over checks that ran. */
  score: number;
  checks: readonly GoldenCheckResult[];
}

/** What the axe runner reports: one entry per violated rule. */
export interface GoldenAxeViolation {
  id: string;
  impact?: string | null;
  nodes: number;
  /** First offending node's markup, for the report. */
  sample?: string;
}

/** Runs axe on a painted document and returns its violations. */
export type GoldenAxeRunner = (root: Document) => Promise<readonly GoldenAxeViolation[]>;
