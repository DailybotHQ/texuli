/**
 * What a fragment looks like at a step (Protoyard's `fragmentPhase`, as four
 * named phases):
 *
 * - `hidden`: not shown yet (an entering fragment before its step);
 * - `visible`: shown, effect not applied (or an entrance that has played);
 * - `active`: shown with its effect applied (grown, shrunk, highlighted,
 *   struck through);
 * - `gone`: shown once, now removed (`out` from its step, `in-then-out`
 *   after its step).
 *
 * Hidden and gone fragments keep their layout space and leave the
 * accessibility tree; that is the stage's job.
 */
import type { FragmentEffect } from '../shared.ts';
import type { SlideFragment } from './slide-steps.ts';

export const FRAGMENT_PHASES = ['hidden', 'visible', 'active', 'gone'] as const;
export type FragmentPhase = (typeof FRAGMENT_PHASES)[number];

/** The step to evaluate: non-finite or negative is the initial state. */
function at(current: number): number {
  return Number.isFinite(current) ? Math.max(0, Math.trunc(current)) : 0;
}

/**
 * The phase of a fragment at `current` (0 = initial state). Steps past the
 * slide's count behave like its last step.
 */
export function fragmentPhase(
  fragment: { step: number; effect: FragmentEffect },
  current: number
): FragmentPhase {
  const now = at(current);
  const reached = now >= fragment.step;
  switch (fragment.effect) {
    case 'in':
    case 'fade-up':
      return reached ? 'visible' : 'hidden';
    case 'out':
      return reached ? 'gone' : 'visible';
    case 'in-then-out':
      return now < fragment.step ? 'hidden' : now === fragment.step ? 'visible' : 'gone';
    case 'grow':
    case 'shrink':
    case 'highlight':
    case 'strike':
      return reached ? 'active' : 'visible';
  }
}

/** Whether a phase is rendered (`visible` or `active`). */
export function isPhaseShown(phase: FragmentPhase): boolean {
  return phase === 'visible' || phase === 'active';
}

/**
 * The code highlight shown at `current` for the code block (or props code
 * object) at `ownerPath`: the latest highlight whose step was reached, or
 * `null` before the first one.
 */
export function activeCodeHighlight(
  fragments: readonly SlideFragment[],
  ownerPath: readonly (string | number)[],
  current: number
): string | null {
  const key = JSON.stringify(ownerPath);
  const now = at(current);
  let shown: string | null = null;
  for (const fragment of fragments) {
    if (fragment.kind !== 'highlight' || fragment.lines === undefined) continue;
    if (JSON.stringify(fragment.path.slice(0, -2)) !== key) continue;
    if (fragment.step <= now) shown = fragment.lines;
  }
  return shown;
}
