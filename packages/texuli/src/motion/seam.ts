/**
 * The static motion seam of the styled components (ADR-013): the motion prop
 * resolved against the component's defaults and the enclosing
 * `MotionProvider`, and the hooks the components hand their primitives. It is
 * small on purpose: the runtime (`runtime.ts`, on `@texuli/core/motion`) is
 * a separate chunk, loaded in the browser once a component that animates
 * mounts, so a page pays for it only when something can move.
 *
 * Rules every factory keeps:
 * - Nothing runs on the server, and nothing plays for content present on the
 *   first paint (hydration included): the end state is what renders.
 * - Reduced motion (the reader's, or the provider's override), level `none`
 *   and `motion={false}` commit the end state at once.
 * - Until the runtime has loaded, changes commit at once too (no flash of a
 *   late animation).
 */

import type { FlipController, FlipEnter, MotionRun } from '@texuli/core/motion';
import { getMotionSettings, type MotionSettings } from './context.ts';
import {
  type ComponentMotion,
  type MotionProp,
  type ResolvedComponentMotion,
  resolveComponentMotion,
} from './contract.ts';
import type { IndicatorShape, MotionEdge, PlaySettings } from './runtime.ts';

type Runtime = typeof import('./runtime.ts');

let loaded: Runtime | null = null;
let loading: Promise<Runtime | null> | null = null;

/** Load the runtime chunk (browser only); resolves `null` on the server or if it fails. */
export function loadMotionRuntime(): Promise<Runtime | null> {
  if (loaded) return Promise.resolve(loaded);
  if (typeof window === 'undefined') return Promise.resolve(null);
  loading ??= import('./runtime.ts').then(
    (module) => {
      loaded = module;
      return module;
    },
    () => {
      loading = null;
      return null;
    }
  );
  return loading;
}

/** The runtime if it has loaded, else `null` (the change commits at once). */
export function motionRuntime(): Runtime | null {
  return loaded;
}

/** An exit that keeps a closed part mounted (inert) until `finished` settles. */
export interface MotionHold {
  readonly finished: Promise<unknown>;
  cancel(): void;
}

/** The hooks an overlay primitive's `motionHooks` prop takes. */
export interface OverlayMotionHooks {
  /** After the part opens (never for one open on the first render). */
  enter?: (node: HTMLElement) => void;
  /** When it closes; a hold keeps it mounted until the exit ends. */
  exit?: (node: HTMLElement) => MotionHold | null | undefined;
}

interface MotionSource {
  /** The component's `motion` prop (read at play time, so it stays live). */
  motion: () => MotionProp | null | undefined;
  /** The component's defaults. */
  defaults: ComponentMotion;
  /** Settings to use instead of the enclosing provider's (tests, hosts). */
  settings?: MotionSettings;
}

function source(options: MotionSource) {
  const settings = options.settings ?? getMotionSettings();
  const resolved = (): ResolvedComponentMotion =>
    resolveComponentMotion(options.motion(), options.defaults);
  const play = (motion: ResolvedComponentMotion): PlaySettings => ({
    level: settings.level,
    reducedMotion: settings.reducedMotion,
    duration: motion.duration,
  });
  const off = (motion: ResolvedComponentMotion) =>
    settings.level === 'none' || settings.reducedMotion === true || !motion;
  // Warm the runtime once something here can animate (browser only).
  const first = resolved();
  if (!off(first) && (first.enter || first.exit || first.layout)) void loadMotionRuntime();
  return { settings, resolved, play, off };
}

/** Hold for a run that animates; `null` when it committed at once. */
function holdOf(run: MotionRun | null | undefined): MotionHold | null {
  if (!run || run.instantReason !== null) return null;
  return { finished: run.finished, cancel: () => run.cancel() };
}

/**
 * Enter and exit for an overlay part (dialog, sheet, popover, menu, tooltip,
 * hover card). `edge` names the edge a sheet is attached to: its slide then
 * comes from there.
 */
export function createOverlayMotion(
  options: MotionSource & { edge?: (node: HTMLElement) => MotionEdge | null }
): OverlayMotionHooks {
  const { resolved, play, off } = source(options);
  let running: MotionRun | null = null;
  const stop = () => {
    running?.cancel();
    running = null;
  };
  return {
    enter(node) {
      stop();
      const motion = resolved();
      const runtime = motionRuntime();
      if (!runtime || off(motion) || !motion.enter) return;
      running = runtime.playPresence(
        node,
        'enter',
        motion.enter,
        play(motion),
        options.edge?.(node) ?? undefined
      );
    },
    exit(node) {
      stop();
      const motion = resolved();
      const runtime = motionRuntime();
      if (!runtime || off(motion) || !motion.exit) return null;
      const run = runtime.playPresence(
        node,
        'exit',
        motion.exit,
        play(motion),
        options.edge?.(node) ?? undefined
      );
      running = run;
      return holdOf(run);
    },
  };
}

/** Enter or exit one element now (a toast); `null` when it committed at once. */
export function createPresenceMotion(options: MotionSource): {
  enter(node: Element): MotionHold | null;
  exit(node: Element): MotionHold | null;
} {
  const { resolved, play, off } = source(options);
  const run = (node: Element, kind: 'enter' | 'exit') => {
    const motion = resolved();
    const preset = kind === 'enter' ? motion.enter : motion.exit;
    const runtime = motionRuntime();
    if (!runtime || off(motion) || !preset) return null;
    return holdOf(runtime.playPresence(node, kind, preset, play(motion)));
  };
  return { enter: (node) => run(node, 'enter'), exit: (node) => run(node, 'exit') };
}

/**
 * Layout animation for one keyed list (FLIP): call `measure()` before the
 * DOM changes (`$effect.pre`) and `play()` after (`$effect`). The first pair
 * (the mount) only records that the list is on screen, so nothing animates
 * on hydration. Inserted items enter with `enter` (default a fade).
 */
export function createListMotion(
  options: MotionSource & {
    items: () => Iterable<readonly [string, Element]>;
    enter?: FlipEnter | (() => FlipEnter);
  }
): { measure(): void; play(): void; cancel(): void } {
  const { resolved, play, off } = source(options);
  let mounted = false;
  let flip: FlipController | null = null;
  return {
    measure() {
      if (!mounted) return;
      const motion = resolved();
      const runtime = motionRuntime();
      if (!runtime || off(motion) || !motion.layout) {
        flip?.cancel();
        flip = null;
        return;
      }
      const items = [...options.items()];
      flip?.cancel();
      const enter = typeof options.enter === 'function' ? options.enter() : options.enter;
      flip = runtime.createLayoutFlip(items[0]?.[1] ?? null, play(motion), enter ?? 'fade');
      flip.measure(items);
    },
    play() {
      if (!mounted) {
        mounted = true;
        return;
      }
      const current = flip;
      flip = null;
      current?.play(options.items());
    },
    cancel() {
      flip?.cancel();
      flip = null;
    },
  };
}

/** The tabs indicator glide (`layout`): from the old active trigger to the new one. */
export function createIndicatorMotion(options: MotionSource): {
  glide(list: HTMLElement, from: Element, to: Element, shape: IndicatorShape): MotionRun | null;
} {
  const { resolved, play, off } = source(options);
  return {
    glide(list, from, to, shape) {
      const motion = resolved();
      const runtime = motionRuntime();
      if (!runtime || off(motion) || !motion.layout || from === to) return null;
      return runtime.playIndicator(list, from, to, {
        shape,
        ghostClass: 'tx-tabs__indicator',
        glideAttribute: 'data-tx-tabs-gliding',
        settings: play(motion),
      });
    },
  };
}

/** Accordion panels: animate the block size open and closed (`layout`). */
export function createSizeMotion(options: MotionSource): OverlayMotionHooks {
  const { resolved, play, off } = source(options);
  let running: MotionRun | null = null;
  const size = (node: HTMLElement) => node.getBoundingClientRect().height;
  return {
    enter(node) {
      running?.cancel();
      running = null;
      const motion = resolved();
      const runtime = motionRuntime();
      if (!runtime || off(motion) || !motion.layout) return;
      running = runtime.playBlockSize(node, 0, node.scrollHeight, play(motion));
    },
    exit(node) {
      const from = size(node);
      running?.cancel();
      running = null;
      const motion = resolved();
      const runtime = motionRuntime();
      if (!runtime || off(motion) || !motion.layout) return null;
      const run = runtime.playBlockSize(node, from, 0, play(motion));
      running = run;
      return holdOf(run);
    },
  };
}

/** The edge a sheet is attached to, from its resolved `data-side` (`center`: none). */
export function sheetEdge(node: HTMLElement): MotionEdge | null {
  const side = node.getAttribute('data-side');
  return side === 'left' || side === 'right' || side === 'top' || side === 'bottom' ? side : null;
}
