/**
 * The static half of the stage's motion (ADR-013): reading fragments before
 * a step change, and loading the runtime half (`motion.ts`, on
 * `@texuli/core/motion`) as its own chunk, so the stage entry stays small.
 * The stage preloads it on mount; every animation it plays happens after an
 * interaction, past a `tick()`, so it awaits the loaded module.
 */

import type { MotionLevel } from '@texuli/core/motion';

/** The easing every slide change plays with. */
export const DECK_TRANSITION_EASING = 'cubic-bezier(0.2, 0, 0, 1)';

/** The attribute that carries a v2 fragment's phase. */
export const DECK_FRAGMENT_ATTRIBUTE = 'data-tx-deck-fragment';

/** A box-less fragment wrapper: its children carry the motion. */
const BOXLESS_CLASS = 'tx-deck-stage__fragment';

/** Properties a fragment's phase changes (`styles.css`). */
export const FRAGMENT_PROPERTIES = ['opacity', 'translate', 'scale', 'background-color'] as const;

/** At most this many fragment elements animate per step; the rest commit at once. */
export const DECK_FRAGMENT_LIMIT = 64;

/** One fragment element's style before a step change. */
export type FragmentSnapshot = Map<Element, { phase: string; style: Record<string, string> }>;

export function fragmentTargets(fragment: Element): Element[] {
  return fragment.classList.contains(BOXLESS_CLASS) ? Array.from(fragment.children) : [fragment];
}

export function fragmentStyle(element: Element): Record<string, string> | null {
  const view = element.ownerDocument?.defaultView;
  if (!view) return null;
  const computed = view.getComputedStyle(element);
  const out: Record<string, string> = {};
  for (const property of FRAGMENT_PROPERTIES) out[property] = computed.getPropertyValue(property);
  return out;
}

/** Read every fragment's phase and style (call before the step change reaches the DOM). */
export function captureFragments(root: Element | null | undefined): FragmentSnapshot {
  const snapshot: FragmentSnapshot = new Map();
  if (!root) return snapshot;
  for (const fragment of root.querySelectorAll(`[${DECK_FRAGMENT_ATTRIBUTE}]`)) {
    const phase = fragment.getAttribute(DECK_FRAGMENT_ATTRIBUTE) ?? '';
    for (const target of fragmentTargets(fragment)) {
      if (snapshot.size >= DECK_FRAGMENT_LIMIT) return snapshot;
      const style = fragmentStyle(target);
      if (style) snapshot.set(target, { phase, style });
    }
  }
  return snapshot;
}

/** The level the stage plays fragments at: the deck's resolved motion. */
export function stageMotionLevel(motion: string | undefined): MotionLevel {
  return motion === 'none' || motion === 'subtle' ? motion : 'full';
}

type StageMotion = typeof import('./motion.ts');
let loading: Promise<StageMotion | null> | null = null;

/** Load the runtime half (browser only); `null` on the server or if it fails. */
export function loadStageMotion(): Promise<StageMotion | null> {
  if (typeof window === 'undefined') return Promise.resolve(null);
  loading ??= import('./motion.ts').catch(() => {
    loading = null;
    return null;
  });
  return loading;
}
