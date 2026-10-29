/**
 * The player's motion runtime: plays a node's checked spec 0.6.0 motion
 * through `@texuli/core/motion` (ADR-013). Loaded on demand by
 * `context.ts`, only when a painted node declares motion.
 *
 * Every texel commits the end state at once under reduced motion, at level
 * `none`, on the server and without the Web Animations API, and leaves no
 * lasting inline style (`fill: "none"`).
 */

import {
  animate,
  createFlip,
  type FlipController,
  type MotionLevel,
  type MotionOutcome,
  type MotionRun,
} from '@texuli/core/motion';
import type { BlueprintMotionDuration, BlueprintNodeMotion } from '@texuli/spec/motion';
import {
  exitKeyframes,
  PLAYER_MOTION_DURATIONS,
  PLAYER_MOTION_EASINGS,
  PLAYER_MOTION_MAX_TARGETS,
  parseCssTime,
  presetKeyframes,
} from './keyframes.ts';

/** What every animation of one player plays at. */
export interface MotionSettings {
  level: MotionLevel;
  reducedMotion: boolean;
}

/** The elements a wrapper animates: its element children (the wrapper has no box). */
function targetsOf(wrapper: Element): HTMLElement[] {
  const out: HTMLElement[] = [];
  for (const child of Array.from(wrapper.children)) {
    if (out.length >= PLAYER_MOTION_MAX_TARGETS) break;
    if (child instanceof HTMLElement) out.push(child);
  }
  return out;
}

function directionOf(element: Element): 'ltr' | 'rtl' {
  const view = element.ownerDocument?.defaultView;
  return view?.getComputedStyle(element).direction === 'rtl' ? 'rtl' : 'ltr';
}

/** The theme's duration for a token step (`--tx-motion-<step>`), else the token default. */
export function tokenDuration(element: Element, step: BlueprintMotionDuration = 'base'): number {
  const view = element.ownerDocument?.defaultView;
  const raw = view?.getComputedStyle(element).getPropertyValue(`--tx-motion-${step}`) ?? '';
  const parsed = parseCssTime(raw);
  return parsed ?? PLAYER_MOTION_DURATIONS[step] ?? PLAYER_MOTION_DURATIONS.base;
}

function settle(runs: readonly MotionRun[]): Promise<MotionOutcome> {
  if (runs.length === 0) return Promise.resolve('instant');
  return Promise.all(runs.map((run) => run.finished)).then((outcomes) =>
    outcomes.every((outcome) => outcome === 'instant') ? 'instant' : (outcomes[0] ?? 'finished')
  );
}

/** A group of runs that cancel and settle together. */
export interface MotionHandle {
  finished: Promise<MotionOutcome>;
  cancel(): void;
}

function handleOf(runs: readonly MotionRun[]): MotionHandle {
  return {
    finished: settle(runs),
    cancel: () => {
      for (const run of runs) run.cancel();
    },
  };
}

/** Play a node's `enter` preset on the wrapper's element children. */
export function playEnter(
  wrapper: Element,
  motion: Readonly<BlueprintNodeMotion>,
  settings: MotionSettings,
  delay = 0
): MotionHandle {
  if (!motion.enter) return handleOf([]);
  const targets = targetsOf(wrapper);
  const duration = tokenDuration(wrapper, motion.duration);
  const runs = targets.map((target) =>
    animate(target, presetKeyframes(motion.enter ?? 'fade', directionOf(target)), {
      duration,
      delay,
      easing: PLAYER_MOTION_EASINGS.enter,
      level: settings.level,
      reducedMotion: settings.reducedMotion,
    })
  );
  return handleOf(runs);
}

/** Play a node's `exit` preset; resolves when the node may go. */
export function playExit(
  wrapper: Element,
  motion: Readonly<BlueprintNodeMotion>,
  settings: MotionSettings
): MotionHandle {
  if (!motion.exit) return handleOf([]);
  const targets = targetsOf(wrapper);
  const duration = tokenDuration(wrapper, motion.duration);
  const runs = targets.map((target) =>
    animate(target, exitKeyframes(motion.exit ?? 'fade', directionOf(target)), {
      duration,
      easing: PLAYER_MOTION_EASINGS.exit,
      level: settings.level,
      reducedMotion: settings.reducedMotion,
    })
  );
  return handleOf(runs);
}

/** Layout (FLIP) items: the first element child of each registered wrapper. */
function itemsOf(wrappers: ReadonlyMap<string, Element>): [string, HTMLElement][] {
  const items: [string, HTMLElement][] = [];
  for (const [path, wrapper] of wrappers) {
    const target = targetsOf(wrapper)[0];
    if (target?.isConnected) items.push([path, target]);
  }
  return items;
}

/**
 * Layout animation for one player: `measure` before a repaint, `play`
 * after it. Only nodes with `layout: true` take part; inserted ones are
 * left to their own enter.
 */
export function createLayoutMotion(): {
  measure(wrappers: ReadonlyMap<string, Element>, settings: MotionSettings): void;
  play(wrappers: ReadonlyMap<string, Element>): void;
  cancel(): void;
} {
  let flip: FlipController | null = null;
  return {
    measure(wrappers, settings) {
      flip?.cancel();
      const items = itemsOf(wrappers);
      if (items.length === 0 || settings.level === 'none' || settings.reducedMotion) {
        flip = null;
        return;
      }
      const first = items[0]?.[1];
      flip = createFlip({
        duration: first ? tokenDuration(first) : PLAYER_MOTION_DURATIONS.base,
        easing: PLAYER_MOTION_EASINGS.standard,
        level: settings.level,
        reducedMotion: settings.reducedMotion,
        enter: false,
      });
      flip.measure(items);
    },
    play(wrappers) {
      if (!flip) return;
      flip.play(itemsOf(wrappers));
    },
    cancel() {
      flip?.cancel();
      flip = null;
    },
  };
}
