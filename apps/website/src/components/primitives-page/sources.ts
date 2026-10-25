/**
 * Build-time sources for the primitives reference: the behavior scenarios
 * and limits, and the size budgets, inlined by Vite when the site builds.
 */
import { type BehaviorEvidence, behaviorEvidence, parseOpenToFocusLimits } from './behavior.ts';

const SCENARIOS = import.meta.glob<string>('../../../../../tests/behavior/scenarios/*.spec.ts', {
  query: '?raw',
  import: 'default',
  eager: true,
});
const LIMITS = Object.values(
  import.meta.glob<string>('../../../../../tests/behavior/harness/limits.ts', {
    query: '?raw',
    import: 'default',
    eager: true,
  })
)[0];

const scenarioSource = (scenario: string): string | undefined =>
  Object.entries(SCENARIOS).find(([path]) => path.endsWith(`/scenarios/${scenario}.spec.ts`))?.[1];

/** The behavior evidence for one primitive. */
export function primitiveBehavior(id: string): BehaviorEvidence {
  return behaviorEvidence(id, scenarioSource(id));
}

const OPEN_TO_FOCUS = parseOpenToFocusLimits(LIMITS ?? '');

/** The open-to-focus p75 limit (ms) for a primitive: its measured entry, else the default. */
export function openToFocusLimit(id: string): number | undefined {
  return OPEN_TO_FOCUS.byPrimitive[id] ?? OPEN_TO_FOCUS.defaultMs;
}

type BudgetRow = { gzip?: number };
const BUDGETS_SOURCE = Object.values(
  import.meta.glob<string>('../../../../../texuli.budgets.json', {
    query: '?raw',
    import: 'default',
    eager: true,
  })
)[0];
const BUDGETS =
  (JSON.parse(BUDGETS_SOURCE ?? '{}') as { budgets?: Record<string, BudgetRow> }).budgets ?? {};

/** The gzip budget of `@texuli/primitives/<id>`: its exact entry, else the package pattern. */
export function primitiveBudget(id: string): number | undefined {
  return BUDGETS[`@texuli/primitives/${id}`]?.gzip ?? BUDGETS['@texuli/primitives/*']?.gzip;
}

/** Bytes as KiB with one decimal (`12.0 KiB`). */
export const kib = (bytes: number) => `${(bytes / 1024).toFixed(1)} KiB`;
