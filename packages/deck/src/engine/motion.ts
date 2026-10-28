/**
 * Pure transition resolution metadata. Rendering is owned by the stage.
 *
 * Precedence: slide override → deck style → `fade`. The motion ceiling
 * (`full` | `subtle` | `none`) shortens or drops motion; the viewer's
 * reduced-motion preference only lowers it. Durations never exceed 400 ms.
 *
 * Self-contained: does not import `@texuli/deck/model` (import-guard).
 */

export const DECK_TRANSITIONS = ['none', 'fade', 'fade-up', 'slide', 'zoom', 'morph'] as const;
export type DeckTransition = (typeof DECK_TRANSITIONS)[number];

export const MOTION_LEVELS = ['full', 'subtle', 'none'] as const;
export type DeckMotion = (typeof MOTION_LEVELS)[number];

export const MAX_MOTION_MS = 400;
export const REDUCED_FADE_MS = 150;
export const SUBTLE_SCALE = 0.6;
export const DEFAULT_TRANSITION: DeckTransition = 'fade';
export const DEFAULT_MOTION: DeckMotion = 'full';

export const TRANSITION_MS: Readonly<Record<DeckTransition, number>> = Object.freeze({
  none: 0,
  fade: 300,
  'fade-up': 300,
  slide: 400,
  zoom: 350,
  morph: 400,
});

export type TransitionReason =
  | 'motion-none'
  | 'reduced-motion'
  | 'subtle'
  | 'slide-override'
  | 'deck-default'
  | 'engine-default';

export interface ResolvedTransition {
  name: DeckTransition;
  requested: DeckTransition;
  durationMs: number;
  motion: DeckMotion;
  reason: TransitionReason;
}

export interface ResolveTransitionInput {
  slide?: { transition?: unknown; id?: unknown } | null;
  style?: { transition?: unknown; motion?: unknown } | null;
  /** Ceiling; defaults to `style.motion`, then `full`. */
  motion?: DeckMotion;
  reducedMotion?: boolean;
}

export function isDeckTransition(value: unknown): value is DeckTransition {
  return typeof value === 'string' && (DECK_TRANSITIONS as readonly string[]).includes(value);
}

export function isMotionLevel(value: unknown): value is DeckMotion {
  return typeof value === 'string' && (MOTION_LEVELS as readonly string[]).includes(value);
}

function clampMs(ms: number): number {
  return Math.max(0, Math.min(MAX_MOTION_MS, Math.round(ms)));
}

/** Effective motion ceiling, lowered (never raised) by reduced motion. */
export function effectiveMotion(input: ResolveTransitionInput = {}): DeckMotion {
  const level = isMotionLevel(input.motion)
    ? input.motion
    : isMotionLevel(input.style?.motion)
      ? input.style.motion
      : DEFAULT_MOTION;
  if (level === 'none') return 'none';
  return input.reducedMotion ? 'subtle' : level;
}

/**
 * Resolve the transition into a slide from the slide override, the deck
 * default and the motion level.
 */
export function resolveDeckTransition(input: ResolveTransitionInput = {}): ResolvedTransition {
  const own = input.slide?.transition;
  const deckTransition = input.style?.transition;
  const requested = isDeckTransition(own)
    ? own
    : isDeckTransition(deckTransition)
      ? deckTransition
      : DEFAULT_TRANSITION;
  const source: TransitionReason = isDeckTransition(own)
    ? 'slide-override'
    : isDeckTransition(deckTransition)
      ? 'deck-default'
      : 'engine-default';
  const motion = effectiveMotion(input);

  if (motion === 'none' || requested === 'none') {
    return {
      name: 'none',
      requested,
      durationMs: 0,
      motion,
      reason: motion === 'none' ? 'motion-none' : source,
    };
  }
  if (input.reducedMotion) {
    return {
      name: 'fade',
      requested,
      durationMs: REDUCED_FADE_MS,
      motion,
      reason: 'reduced-motion',
    };
  }
  if (motion === 'subtle') {
    const name = requested === 'zoom' ? 'fade' : requested;
    return {
      name,
      requested,
      durationMs: clampMs(TRANSITION_MS[name] * SUBTLE_SCALE),
      motion,
      reason: 'subtle',
    };
  }
  return {
    name: requested,
    requested,
    durationMs: clampMs(TRANSITION_MS[requested]),
    motion,
    reason: source,
  };
}

/**
 * Morph/auto-animate pairing metadata for the stage: pairs of slide ids that
 * share a `morph` transition on the destination. The stage matches elements
 * by `data-tx-deck-morph-id` (or equivalent); this only reports the pair.
 */
export interface MorphPair {
  fromSlideId: string;
  toSlideId: string;
}

export function morphPairsFor(
  slides: readonly { id: string; transition?: unknown }[],
  style?: { transition?: unknown } | null
): readonly MorphPair[] {
  const pairs: MorphPair[] = [];
  for (let i = 1; i < slides.length; i += 1) {
    const to = slides[i];
    const from = slides[i - 1];
    if (!to || !from) continue;
    const resolved = resolveDeckTransition({ slide: to, style });
    if (resolved.name === 'morph') {
      pairs.push({ fromSlideId: from.id, toSlideId: to.id });
    }
  }
  return pairs;
}
