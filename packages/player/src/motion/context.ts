/**
 * The motion seam between the player and its painted nodes (spec 0.6.0,
 * ADR-013). Static and small: the animation runtime (`runtime.ts`, on
 * `@texuli/core/motion`) loads only once a painted node declares motion.
 *
 * Rules:
 * - Nothing plays on the server, and nothing for a node present at the
 *   player's first paint (hydration included): the server and the first
 *   paint show the end state. A node that appears later (after its painter
 *   loads, a `when` change, a flow view, a live update or a stream) plays
 *   its `enter`.
 * - The level is the host's, then the blueprint's (`motion.level`), then
 *   `full`; reduced motion (the reader's or the host's `motion="reduce"`)
 *   makes everything instant.
 * - A leaving node is kept, inert, only while its exit plays, and at most
 *   {@link EXIT_FALLBACK_MS} however the runtime behaves.
 */

import type { MotionLevel } from '@texuli/core/motion';
import type { BlueprintNodeMotion } from '@texuli/spec/motion';
import { getContext, setContext } from 'svelte';
import type { MotionHandle, MotionSettings } from './runtime.ts';

type Runtime = typeof import('./runtime.ts');

const MOTION = Symbol('tx-player-motion');

/** A leaving node goes after this even if its exit never reports (ms). */
export const EXIT_FALLBACK_MS = 1_200;

export const PLAYER_MOTION_LEVELS: readonly MotionLevel[] = Object.freeze([
  'full',
  'subtle',
  'none',
]);

const RANK: Readonly<Record<MotionLevel, number>> = { none: 0, subtle: 1, full: 2 };

const isLevel = (value: unknown): value is MotionLevel =>
  typeof value === 'string' && (PLAYER_MOTION_LEVELS as readonly string[]).includes(value);

/**
 * The level a player plays at: the host's, else the blueprint's, else
 * `full`; reduced motion gives `none`. (`resolveMotionLevel` in
 * `@texuli/core/motion` applies the same precedence; a test keeps them equal.)
 */
export function playerMotionLevel(input: {
  host?: unknown;
  document?: unknown;
  reducedMotion?: boolean;
}): MotionLevel {
  if (input.reducedMotion === true) return 'none';
  const chosen = isLevel(input.host) ? input.host : isLevel(input.document) ? input.document : null;
  return chosen ?? 'full';
}

/** The lower of two levels. */
export function lowerLevel(a: MotionLevel, b: MotionLevel): MotionLevel {
  return RANK[a] <= RANK[b] ? a : b;
}

export interface PlayerMotion {
  /** `true` once the player's first paint is on screen. */
  painted(): boolean;
  settings(): MotionSettings;
  /** The runtime if it is loaded (exit and layout need it at once). */
  runtime(): Runtime | null;
  load(): Promise<Runtime | null>;
  /** A node with `layout: true` takes part in the player's layout animation. */
  registerLayout(path: string, wrapper: Element): () => void;
  /** A leaving node finished (or skipped) its exit: the player may drop it. */
  exited(path: string): void;
  /** Play the exit of a leaving node; `null` when it goes at once. */
  playExit(wrapper: Element, motion: Readonly<BlueprintNodeMotion>): MotionHandle | null;
}

export interface PlayerMotionController extends PlayerMotion {
  markPainted(): void;
  /** Before a repaint: measure the layout nodes. */
  measure(): void;
  /** After a repaint: play the layout nodes from where they were. */
  play(): void;
  /** Warm the runtime (a plan declares motion). */
  preload(): void;
  dispose(): void;
}

export function createPlayerMotion(options: {
  settings: () => MotionSettings;
  /** Called when a leaving node may go (once per leave). */
  onExited: (path: string) => void;
  /** Injectable for tests. */
  importRuntime?: () => Promise<Runtime>;
}): PlayerMotionController {
  let painted = false;
  let disposed = false;
  let loaded: Runtime | null = null;
  let loading: Promise<Runtime | null> | null = null;
  let layout: ReturnType<Runtime['createLayoutMotion']> | null = null;
  const wrappers = new Map<string, Element>();
  const timers = new Map<string, ReturnType<typeof setTimeout>>();
  const importRuntime = options.importRuntime ?? (() => import('./runtime.ts'));

  function load(): Promise<Runtime | null> {
    if (loaded) return Promise.resolve(loaded);
    if (typeof window === 'undefined') return Promise.resolve(null);
    loading ??= importRuntime().then(
      (module) => {
        loaded = module;
        return module;
      },
      () => null
    );
    return loading;
  }

  function exited(path: string): void {
    const timer = timers.get(path);
    if (timer !== undefined) clearTimeout(timer);
    timers.delete(path);
    if (!disposed) options.onExited(path);
  }

  return {
    painted: () => painted,
    settings: options.settings,
    runtime: () => loaded,
    load,
    markPainted() {
      painted = true;
    },
    registerLayout(path, wrapper) {
      wrappers.set(path, wrapper);
      return () => {
        if (wrappers.get(path) === wrapper) wrappers.delete(path);
      };
    },
    exited,
    playExit(wrapper, motion) {
      const settings = options.settings();
      if (!loaded || !motion.exit || settings.level === 'none' || settings.reducedMotion) {
        return null;
      }
      const path = wrapper.getAttribute('data-tx-player-motion') ?? '';
      if (path && !timers.has(path)) {
        timers.set(
          path,
          setTimeout(() => exited(path), EXIT_FALLBACK_MS)
        );
      }
      return loaded.playExit(wrapper, motion, settings);
    },
    measure() {
      if (!loaded || wrappers.size === 0) return;
      layout ??= loaded.createLayoutMotion();
      layout.measure(wrappers, options.settings());
    },
    play() {
      layout?.play(wrappers);
    },
    preload() {
      void load();
    },
    dispose() {
      disposed = true;
      layout?.cancel();
      for (const timer of timers.values()) clearTimeout(timer);
      timers.clear();
      wrappers.clear();
    },
  };
}

export function setPlayerMotion(motion: PlayerMotion): void {
  setContext(MOTION, motion);
}

/** The enclosing player's motion, or `null` outside a player (nothing animates). */
export function getPlayerMotion(): PlayerMotion | null {
  return getContext<PlayerMotion | undefined>(MOTION) ?? null;
}
