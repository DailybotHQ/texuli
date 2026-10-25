/**
 * Static evidence shown on every component page (build-time only).
 * Values come from the latest committed gates / docs — never fetched at runtime.
 */

export type BehaviorStatus = 'checked' | 'n/a';

export type AxeStatus = 'pass' | 'pending' | 'n/a' | 'documented';

export interface EvidenceBehavior {
  /** Behavior scenario name under tests/behavior/scenarios, when any. */
  scenario?: string;
  status: BehaviorStatus;
  /** How many behavior checks the scenario's spec defines. */
  checks?: number;
  note?: string;
}

export interface EvidenceSize {
  /** `pnpm size` entry id, e.g. `texuli/button` or `@texuli/primitives/dialog`. */
  entry: string;
  /** Gzip budget in bytes from texuli.budgets.json (exact or pattern). */
  gzipBudget?: number;
  /** Optional measured gzip from a committed quality doc (bytes). */
  gzipMeasured?: number;
  note?: string;
}

export interface EvidenceAxe {
  status: AxeStatus;
  /** Named suites or docs that cover this surface. */
  suites: readonly string[];
  note?: string;
}

export interface EvidenceBrowsers {
  /** Playwright project names used in this monorepo. */
  projects: readonly string[];
  note?: string;
}

/** Full evidence card for one component id. */
export interface ComponentEvidence {
  id: string;
  behavior: EvidenceBehavior;
  size: EvidenceSize;
  axe: EvidenceAxe;
  browsers: EvidenceBrowsers;
  /** ISO date the snapshot was authored (honest “latest committed”). */
  asOf: string;
}

export const DEFAULT_BROWSER_PROJECTS = ['chromium', 'webkit', 'mobile'] as const;

export const EVIDENCE_AS_OF = '2026-10-23';
