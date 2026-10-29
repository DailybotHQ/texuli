/**
 * What each name of the spec 0.6.0 motion vocabulary plays as (ADR-013),
 * loaded with the runtime only. Every name maps to a token: durations to
 * the theme's `--tx-motion-*` steps, easings to the motion easing tokens,
 * travel to a fixed small distance. Nothing from a blueprint reaches a
 * keyframe as text.
 */

import type { BlueprintMotionDuration, BlueprintMotionPreset } from '@texuli/spec/motion';

/** The duration token defaults (`@texuli/tokens/motion`); a theme's values win at play time. */
export const PLAYER_MOTION_DURATIONS: Readonly<Record<BlueprintMotionDuration, number>> =
  Object.freeze({ fast: 150, base: 200, slow: 300 });

/** The easing token defaults (`@texuli/tokens/motion`): `enter` decelerates, `exit` accelerates. */
export const PLAYER_MOTION_EASINGS = Object.freeze({
  standard: 'cubic-bezier(0.4, 0, 0.2, 1)',
  enter: 'cubic-bezier(0, 0, 0.2, 1)',
  exit: 'cubic-bezier(0.4, 0, 1, 1)',
});

/** Travel for `rise` and the slides, in px. */
export const PLAYER_MOTION_TRAVEL = 8;

/** Element children of one wrapper that animate; past it the rest commit at once. */
export const PLAYER_MOTION_MAX_TARGETS = 8;

/**
 * The enter keyframes of a preset (the exit plays them reversed). Logical:
 * `slide-start` comes from the inline start, so from the right in
 * right-to-left text.
 */
export function presetKeyframes(
  preset: BlueprintMotionPreset,
  direction: 'ltr' | 'rtl' = 'ltr'
): Keyframe[] {
  const sign = direction === 'rtl' ? -1 : 1;
  switch (preset) {
    case 'rise':
      return [
        { opacity: 0, transform: `translateY(${PLAYER_MOTION_TRAVEL}px)` },
        { opacity: 1, transform: 'none' },
      ];
    case 'scale':
      return [
        { opacity: 0, transform: 'scale(0.96)' },
        { opacity: 1, transform: 'none' },
      ];
    case 'slide-start':
      return [
        { opacity: 0, transform: `translateX(${-sign * PLAYER_MOTION_TRAVEL * 2}px)` },
        { opacity: 1, transform: 'none' },
      ];
    case 'slide-end':
      return [
        { opacity: 0, transform: `translateX(${sign * PLAYER_MOTION_TRAVEL * 2}px)` },
        { opacity: 1, transform: 'none' },
      ];
    default:
      return [{ opacity: 0 }, { opacity: 1 }];
  }
}

/** The exit keyframes: the enter ones reversed. */
export function exitKeyframes(
  preset: BlueprintMotionPreset,
  direction: 'ltr' | 'rtl' = 'ltr'
): Keyframe[] {
  return presetKeyframes(preset, direction).reverse();
}

/** Read a CSS time (`150ms`, `0.2s`) from a custom property; `null` when it is not one. */
export function parseCssTime(value: string): number | null {
  const match = /^\s*(\d+(?:\.\d+)?)(ms|s)\s*$/.exec(value);
  if (!match) return null;
  const amount = Number(match[1]);
  return match[2] === 's' ? amount * 1000 : amount;
}
