/**
 * The stage's motion on the shared runtime (`@texuli/core/motion`, ADR-013),
 * loaded as its own chunk (`loadStageMotion` in `motion-capture.ts`).
 * `@texuli/deck` resolves what to play as data (the transition name and its
 * duration, already lowered by the deck's `full` / `subtle` / `none` level and
 * the viewer's reduced motion); this module plays it:
 *
 * - **View Transitions:** the snapshot animations take their timing from the
 *   runtime's plan (`resolveMotion`), so the clamp and the reduced-motion
 *   policy are the shared ones.
 * - **CSS fallback** (no View Transitions): the incoming slide enters through
 *   `animate`, not CSS keyframes.
 * - **Fragments** (deck v2 phases, `data-tx-deck-fragment`): a step change
 *   animates each changed fragment from the style it had to the style its new
 *   phase gives it (CSS holds only the end states).
 *
 * Reduced motion: a slide change keeps the deck's shipped 150 ms
 * opacity-only fade (the `fade` reduced-motion policy, ADR-013); fragments and
 * level `none` commit at once. Nothing runs on the server, and every
 * animation uses `fill: "none"`, so no inline style outlives it.
 */

import { animate, type MotionLevel, type MotionRun, resolveMotion } from '@texuli/core/motion';
import type { ResolvedTransition } from '@texuli/deck/engine';
import {
  DECK_FRAGMENT_ATTRIBUTE,
  DECK_TRANSITION_EASING,
  FRAGMENT_PROPERTIES,
  type FragmentSnapshot,
  fragmentStyle,
  fragmentTargets,
} from './motion-capture.ts';
import type { DeckTransitionDirection } from './transition.ts';

/** How long a fragment takes to change phase at level `full` (as Protoyard; `subtle` scales it). */
export const DECK_FRAGMENT_MS = 500;

/** Slide keyframes for the incoming (`new`) and outgoing (`old`) slide. */
export type SlideKeyframes = { old: Keyframe[]; new: Keyframe[] };

/** The timing of one snapshot animation, or `null` when it commits at once. */
export function snapshotPlan(
  probe: Element | null | undefined,
  keyframes: Keyframe[],
  resolved: Pick<ResolvedTransition, 'durationMs'>,
  reducedMotion: boolean
): { keyframes: Keyframe[]; duration: number; easing: string } | null {
  const plan = resolveMotion(probe, keyframes, {
    duration: resolved.durationMs,
    easing: DECK_TRANSITION_EASING,
    reducedMotion,
    reducedMotionPolicy: 'fade',
  });
  if (plan.instant) return null;
  return {
    keyframes: plan.keyframes as Keyframe[],
    duration: plan.duration,
    easing: plan.easing,
  };
}

/**
 * CSS fallback: the incoming slide enters through the runtime. `frames` are
 * the transition's keyframes (`transitionKeyframes`).
 */
export function playSlideEnter(
  slide: Element | null | undefined,
  frames: SlideKeyframes,
  resolved: Pick<ResolvedTransition, 'name' | 'durationMs'>,
  reducedMotion: boolean
): MotionRun | null {
  if (!slide || resolved.name === 'none' || resolved.durationMs <= 0) return null;
  return animate(slide, frames.new, {
    duration: resolved.durationMs,
    easing: DECK_TRANSITION_EASING,
    reducedMotion,
    reducedMotionPolicy: 'fade',
  });
}

const camel = (property: string) =>
  property.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());

/**
 * Animate every fragment whose phase changed from its captured style to its
 * new one. Hidden phases keep `visibility: visible` while they fade out.
 */
export function playFragments(
  root: Element | null | undefined,
  before: FragmentSnapshot,
  options: { level: MotionLevel; reducedMotion: boolean }
): MotionRun[] {
  if (!root || before.size === 0) return [];
  const runs: MotionRun[] = [];
  for (const fragment of root.querySelectorAll(`[${DECK_FRAGMENT_ATTRIBUTE}]`)) {
    const phase = fragment.getAttribute(DECK_FRAGMENT_ATTRIBUTE) ?? '';
    for (const target of fragmentTargets(fragment)) {
      const previous = before.get(target);
      if (!previous || previous.phase === phase) continue;
      const now = fragmentStyle(target);
      if (!now) continue;
      const from: Keyframe = { visibility: 'visible' };
      const to: Keyframe = { visibility: 'visible' };
      let changed = false;
      for (const property of FRAGMENT_PROPERTIES) {
        const was = previous.style[property] ?? '';
        const is = now[property] ?? '';
        if (was === is || was === '' || is === '') continue;
        from[camel(property)] = previous.style[property];
        to[camel(property)] = now[property];
        changed = true;
      }
      if (!changed) continue;
      runs.push(
        animate(target, [from, to], {
          duration: DECK_FRAGMENT_MS,
          easing: 'ease-out',
          level: options.level,
          reducedMotion: options.reducedMotion,
        })
      );
    }
  }
  return runs;
}

export type { DeckTransitionDirection };
