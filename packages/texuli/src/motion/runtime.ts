/**
 * The styled components' motion runtime (ADR-013), loaded on demand by
 * `seam.ts`: every animation plays through `@texuli/core/motion`, so reduced
 * motion and level `none` commit the end state at once (no frames), `subtle`
 * drops travel and scale and shortens durations, nothing runs on the server,
 * and no inline style outlives an animation (`fill: "none"`).
 *
 * Every preset maps to fixed keyframes and every duration to a theme token
 * (`--tx-motion-fast`, `-base`, `-slow`); nothing a caller passes reaches a
 * keyframe as text.
 */

import {
  animate,
  createFlip,
  type FlipController,
  type FlipEnter,
  flipTransform,
  type MotionRun,
} from '@texuli/core/motion';
import { MOTION_DURATIONS, MOTION_EASINGS } from '@texuli/tokens/motion';
import type { MotionDurationName, MotionLevel, MotionPreset } from './contract.ts';

/** What one animation plays at (the provider's settings plus the component's duration step). */
export interface PlaySettings {
  readonly level: MotionLevel;
  readonly reducedMotion: boolean | undefined;
  readonly duration: MotionDurationName;
}

/** Travel of `rise`, in px (the player's value). */
export const MOTION_TRAVEL = 8;

/** A sheet's attached edge: its slide comes from there, the whole way. */
export type MotionEdge = 'left' | 'right' | 'top' | 'bottom';

/** Read a CSS time (`150ms`, `0.2s`); `null` when it is not one. */
export function parseCssTime(value: string): number | null {
  const match = /^\s*(\d+(?:\.\d+)?)(ms|s)\s*$/.exec(value);
  if (!match) return null;
  const amount = Number(match[1]);
  return match[2] === 's' ? amount * 1000 : amount;
}

/** The theme's duration for a token step (`--tx-motion-<step>`), else the token default. */
export function tokenDuration(element: Element, step: MotionDurationName): number {
  let raw = '';
  try {
    raw =
      element.ownerDocument?.defaultView
        ?.getComputedStyle(element)
        .getPropertyValue(`--tx-motion-${step}`) ?? '';
  } catch {
    raw = '';
  }
  return parseCssTime(raw) ?? MOTION_DURATIONS[step];
}

function isRtl(element: Element): boolean {
  try {
    return element.ownerDocument?.defaultView?.getComputedStyle(element).direction === 'rtl';
  } catch {
    return false;
  }
}

/**
 * The enter keyframes of a preset (an exit plays them reversed). Logical:
 * `slide-start` comes from the inline start (the right in right-to-left
 * text). With an `edge`, a slide comes from that edge the whole way (sheets).
 */
export function presetKeyframes(
  preset: MotionPreset,
  rtl = false,
  edge?: MotionEdge,
  /** The element's own resting transform (a drawer's snap point), where an edge slide ends. */
  rest = ''
): Keyframe[] {
  if (edge && (preset === 'slide-start' || preset === 'slide-end' || preset === 'rise')) {
    const from =
      edge === 'left'
        ? 'translateX(-100%)'
        : edge === 'right'
          ? 'translateX(100%)'
          : edge === 'top'
            ? 'translateY(-100%)'
            : 'translateY(100%)';
    return [{ transform: from }, { transform: rest || 'none' }];
  }
  const sign = rtl ? -1 : 1;
  switch (preset) {
    case 'rise':
      return [
        { opacity: 0, transform: `translateY(${MOTION_TRAVEL}px)` },
        { opacity: 1, transform: 'none' },
      ];
    case 'scale':
      return [
        { opacity: 0, transform: 'scale(0.96)' },
        { opacity: 1, transform: 'none' },
      ];
    case 'slide-start':
      return [
        { opacity: 0, transform: `translateX(${-sign * MOTION_TRAVEL * 2}px)` },
        { opacity: 1, transform: 'none' },
      ];
    case 'slide-end':
      return [
        { opacity: 0, transform: `translateX(${sign * MOTION_TRAVEL * 2}px)` },
        { opacity: 1, transform: 'none' },
      ];
    default:
      return [{ opacity: 0 }, { opacity: 1 }];
  }
}

/** Play an enter (`preset` in) or an exit (`preset` reversed) on one element. */
export function playPresence(
  node: Element,
  kind: 'enter' | 'exit',
  preset: MotionPreset,
  settings: PlaySettings,
  edge?: MotionEdge
): MotionRun {
  const resting = edge && node instanceof HTMLElement ? node.style.transform : '';
  const frames = presetKeyframes(preset, isRtl(node), edge, resting);
  return animate(node, kind === 'enter' ? frames : frames.reverse(), {
    duration: tokenDuration(node, settings.duration),
    easing: kind === 'enter' ? MOTION_EASINGS.enter : MOTION_EASINGS.exit,
    level: settings.level,
    ...(settings.reducedMotion === undefined ? {} : { reducedMotion: settings.reducedMotion }),
  });
}

/**
 * A FLIP controller for one list (reorders, inserts and removes): `measure`
 * before the DOM changes, `play` after. Inserted items fade (or `enter`).
 */
export function createLayoutFlip(
  sample: Element | null,
  settings: PlaySettings,
  enter: FlipEnter = 'fade'
): FlipController {
  return createFlip({
    duration: sample ? tokenDuration(sample, settings.duration) : MOTION_DURATIONS.base,
    easing: MOTION_EASINGS.standard,
    level: settings.level,
    ...(settings.reducedMotion === undefined ? {} : { reducedMotion: settings.reducedMotion }),
    enter,
  });
}

/** Where a tab indicator sits on its trigger. */
export type IndicatorShape = 'block-end' | 'inline-end' | 'fill';

type Box = { left: number; top: number; width: number; height: number };

function indicatorBox(trigger: Element, shape: IndicatorShape, bar: number): Box {
  const r = trigger.getBoundingClientRect();
  if (shape === 'fill') return { left: r.left, top: r.top, width: r.width, height: r.height };
  if (shape === 'block-end') {
    return { left: r.left, top: r.bottom - bar, width: r.width, height: bar };
  }
  const left = isRtl(trigger) ? r.left : r.right - bar;
  return { left, top: r.top, width: bar, height: r.height };
}

/**
 * Glide the tabs indicator from the old trigger to the new one: a temporary
 * `ghostClass` element, placed on the new indicator box inside `list`,
 * plays the inverted transform back to identity, then leaves. `list` carries
 * `glideAttribute` meanwhile (CSS hides the active trigger's own indicator).
 */
export function playIndicator(
  list: HTMLElement,
  from: Element,
  to: Element,
  options: {
    shape: IndicatorShape;
    ghostClass: string;
    glideAttribute: string;
    bar?: number;
    settings: PlaySettings;
  }
): MotionRun | null {
  const doc = list.ownerDocument;
  if (!doc || !from.isConnected || !to.isConnected) return null;
  const bar = options.bar ?? 2;
  const first = indicatorBox(from, options.shape, bar);
  const last = indicatorBox(to, options.shape, bar);
  const transform = flipTransform(first, last, true);
  if (!transform) return null;
  const listBox = list.getBoundingClientRect();
  const ghost = doc.createElement('span');
  ghost.className = options.ghostClass;
  ghost.setAttribute('aria-hidden', 'true');
  // CSSOM writes (never a style attribute): the box and a top-left origin for the inverted scale.
  ghost.style.position = 'absolute';
  ghost.style.left = `${last.left - listBox.left - list.clientLeft}px`;
  ghost.style.top = `${last.top - listBox.top - list.clientTop}px`;
  ghost.style.width = `${last.width}px`;
  ghost.style.height = `${last.height}px`;
  ghost.style.transformOrigin = '0 0';
  ghost.style.pointerEvents = 'none';
  list.prepend(ghost);
  const run = animate(ghost, [{ transform }, { transform: 'none' }], {
    duration: tokenDuration(list, options.settings.duration),
    easing: MOTION_EASINGS.emphasized,
    level: options.settings.level,
    ...(options.settings.reducedMotion === undefined
      ? {}
      : { reducedMotion: options.settings.reducedMotion }),
  });
  if (run.instantReason !== null) {
    ghost.remove();
    return run;
  }
  list.setAttribute(options.glideAttribute, '');
  void run.finished.then(() => {
    ghost.remove();
    if (!list.querySelector(`:scope > .${options.ghostClass}`)) {
      list.removeAttribute(options.glideAttribute);
    }
  });
  return run;
}

/** Animate a panel's block size between two heights (accordion open and close). */
export function playBlockSize(
  node: Element,
  from: number,
  to: number,
  settings: PlaySettings
): MotionRun {
  const clamp = (value: number) => (Number.isFinite(value) ? Math.max(0, Math.min(value, 1e5)) : 0);
  return animate(
    node,
    [
      { blockSize: `${clamp(from)}px`, overflow: 'hidden' },
      { blockSize: `${clamp(to)}px`, overflow: 'hidden' },
    ],
    {
      duration: tokenDuration(node, settings.duration),
      easing: MOTION_EASINGS.standard,
      level: settings.level,
      ...(settings.reducedMotion === undefined ? {} : { reducedMotion: settings.reducedMotion }),
    }
  );
}
