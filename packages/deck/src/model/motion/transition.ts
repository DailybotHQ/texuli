/**
 * Slide transitions and fragment motion under a motion level (ported from
 * Protoyard's `motion/transition.ts`, plus v1's `fade-up` transition).
 *
 * - The deck's `style.motion` (`full` | `subtle` | `none`) is the ceiling;
 *   an explicit `motion` option replaces it.
 * - The viewer's reduced-motion preference only lowers it, never raises it:
 *   with it, every transition is `none` or a short fade, and moving
 *   fragments become plain fades.
 * - Durations are opacity and transform only and never exceed
 *   `MAX_MOTION_MS`.
 *
 * Inputs are structural plain objects; unknown values fall through to the
 * next source (slide → deck → `fade`) instead of throwing.
 */
import { DECK_TRANSITIONS, type DeckTransition, type FragmentEffect } from '../shared.ts';

export const MOTION_LEVELS = ['full', 'subtle', 'none'] as const;
export type MotionLevel = (typeof MOTION_LEVELS)[number];

export const MAX_MOTION_MS = 400;
/** A reduced-motion fade: short enough to read as a cut, long enough not to flash. */
export const REDUCED_FADE_MS = 150;
/** Subtle motion runs at this share of the full duration. */
export const SUBTLE_SCALE = 0.6;
/** A fragment's full-motion duration. */
export const FRAGMENT_MS = 300;
export const DEFAULT_TRANSITION: DeckTransition = 'fade';
export const DEFAULT_MOTION: MotionLevel = 'full';

/** Full-motion transition durations, in milliseconds. */
export const TRANSITION_MS: Readonly<Record<DeckTransition, number>> = Object.freeze({
  none: 0,
  fade: 300,
  'fade-up': 300,
  slide: 400,
  zoom: 350,
  morph: 400,
});

/** The slide fields the resolver reads. */
export interface TransitionSlide {
  id?: unknown;
  transition?: unknown;
}

/** The deck fields the resolver reads. */
export interface TransitionDeck {
  style?: { transition?: unknown; motion?: unknown } | null;
  slides?: readonly TransitionSlide[];
}

export interface MotionOptions {
  /** The motion ceiling; defaults to `deck.style.motion`, then `full`. */
  motion?: MotionLevel;
  /** The viewer's preference (`prefers-reduced-motion` or a host toggle). */
  reducedMotion?: boolean;
}

export interface SlideTransitionInput extends MotionOptions {
  slide?: TransitionSlide | null;
  deck?: TransitionDeck | null;
}

export type TransitionReason =
  | 'motion-none'
  | 'reduced-motion'
  | 'subtle'
  | 'slide-override'
  | 'deck-default'
  | 'engine-default';

export interface ResolvedTransition {
  /** The transition to play. */
  name: DeckTransition;
  durationMs: number;
  /** What the author asked for before the motion level applied. */
  requested: DeckTransition;
  /** The level after the viewer's preference was applied. */
  motion: MotionLevel;
  /** Why the result is what it is, for DevTools and tests. */
  reason: TransitionReason;
}

export function isDeckTransition(value: unknown): value is DeckTransition {
  return typeof value === 'string' && (DECK_TRANSITIONS as readonly string[]).includes(value);
}

export function isMotionLevel(value: unknown): value is MotionLevel {
  return typeof value === 'string' && (MOTION_LEVELS as readonly string[]).includes(value);
}

/** The requested level (option, then deck style, then `full`), lowered by reduced motion. */
export function effectiveMotion(
  options: MotionOptions & { deck?: TransitionDeck | null } = {}
): MotionLevel {
  const style = options.deck?.style;
  const level = isMotionLevel(options.motion)
    ? options.motion
    : isMotionLevel(style?.motion)
      ? style.motion
      : DEFAULT_MOTION;
  if (level === 'none') return 'none';
  return options.reducedMotion ? 'subtle' : level;
}

function clampMs(ms: number): number {
  return Math.max(0, Math.min(MAX_MOTION_MS, Math.round(ms)));
}

/** The transition into `slide`: slide override → deck default → `fade`, under the motion level. */
export function resolveSlideTransition(input: SlideTransitionInput = {}): ResolvedTransition {
  const own = input.slide?.transition;
  const deckDefault = input.deck?.style?.transition;
  const [requested, source]: [DeckTransition, TransitionReason] = isDeckTransition(own)
    ? [own, 'slide-override']
    : isDeckTransition(deckDefault)
      ? [deckDefault, 'deck-default']
      : [DEFAULT_TRANSITION, 'engine-default'];
  const motion = effectiveMotion(input);

  if (motion === 'none' || requested === 'none') {
    return {
      name: 'none',
      durationMs: 0,
      requested,
      motion,
      reason: motion === 'none' ? 'motion-none' : source,
    };
  }
  if (input.reducedMotion) {
    return {
      name: 'fade',
      durationMs: REDUCED_FADE_MS,
      requested,
      motion,
      reason: 'reduced-motion',
    };
  }
  if (motion === 'subtle') {
    // Subtle keeps direction (slide, fade-up, morph) but drops scaling and shortens everything.
    const name: DeckTransition = requested === 'zoom' ? 'fade' : requested;
    return {
      name,
      durationMs: clampMs(TRANSITION_MS[name] * SUBTLE_SCALE),
      requested,
      motion,
      reason: 'subtle',
    };
  }
  return {
    name: requested,
    durationMs: clampMs(TRANSITION_MS[requested]),
    requested,
    motion,
    reason: source,
  };
}

export interface DeckSlideTransition {
  index: number;
  slideId?: string;
  transition: ResolvedTransition;
}

/** The transition into every slide of a deck, in order. */
export function resolveDeckTransitions(
  deck: TransitionDeck,
  options: MotionOptions = {}
): DeckSlideTransition[] {
  const slides = Array.isArray(deck?.slides) ? deck.slides : [];
  return slides.map((slide, index) => ({
    index,
    ...(typeof slide?.id === 'string' ? { slideId: slide.id } : {}),
    transition: resolveSlideTransition({ ...options, slide, deck }),
  }));
}

export type FragmentMotionReason = 'motion-none' | 'reduced-motion' | 'subtle' | 'full';

export interface ResolvedFragmentMotion {
  /**
   * The effect to animate. Moving effects (`fade-up`, `grow`, `shrink`)
   * become `in` under `none` and reduced motion; the fragment's phase still
   * comes from its own effect (`fragmentPhase`).
   */
  effect: FragmentEffect;
  durationMs: number;
  motion: MotionLevel;
  reason: FragmentMotionReason;
}

const MOVING: ReadonlySet<FragmentEffect> = new Set<FragmentEffect>(['fade-up', 'grow', 'shrink']);

export interface FragmentMotionOptions extends MotionOptions {
  deck?: TransitionDeck | null;
}

/** How a fragment animates under the motion level. */
export function resolveFragmentMotion(
  effect: FragmentEffect,
  options: FragmentMotionOptions = {}
): ResolvedFragmentMotion {
  const motion = effectiveMotion(options);
  const still: FragmentEffect = MOVING.has(effect) ? 'in' : effect;
  if (motion === 'none') return { effect: still, durationMs: 0, motion, reason: 'motion-none' };
  if (options.reducedMotion) {
    return { effect: still, durationMs: REDUCED_FADE_MS, motion, reason: 'reduced-motion' };
  }
  if (motion === 'subtle') {
    return { effect, durationMs: clampMs(FRAGMENT_MS * SUBTLE_SCALE), motion, reason: 'subtle' };
  }
  return { effect, durationMs: clampMs(FRAGMENT_MS), motion, reason: 'full' };
}
