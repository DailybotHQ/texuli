/**
 * Motion preferences: the reduced-motion source and the motion-level
 * resolver (ADR-013). Framework-free; no module-scope browser access.
 */

import { REDUCED_MOTION_QUERY } from '../presence/presence.ts';

/** Motion levels shared with `@texuli/deck`: `subtle` shortens and drops travel, `none` is instant. */
export const MOTION_LEVELS = ['full', 'subtle', 'none'] as const;
export type MotionLevel = (typeof MOTION_LEVELS)[number];

/** `subtle` multiplies every duration and offset by this factor (the deck's value). */
export const SUBTLE_DURATION_SCALE = 0.6;
/** Longest duration or delay any motion texel plays, in milliseconds. */
export const MAX_MOTION_MS = 1000;
/** Duration of the opt-in `fade` reduced-motion policy (the deck stage's slide fade). */
export const REDUCED_FADE_MS = 150;

/** What reduced motion does: commit the end state at once (default), or keep an opacity-only fade. */
export type ReducedMotionPolicy = 'instant' | 'fade';

/** A live view of `prefers-reduced-motion` with a host override. */
export type ReducedMotionSource = {
  /** Current value: the override when set, else the media query, else the SSR default. */
  get: () => boolean;
  /** Called with the new value whenever it changes; returns an unsubscribe function. */
  subscribe: (listener: (reduced: boolean) => void) => () => void;
  /** Force reduced motion on or off; `null` returns to the media query. */
  setOverride: (value: boolean | null) => void;
  /** Stop listening to the media query and drop every listener. */
  dispose: () => void;
};

type MediaQueryLike = {
  readonly matches: boolean;
  addEventListener?: (type: 'change', listener: () => void) => void;
  removeEventListener?: (type: 'change', listener: () => void) => void;
  addListener?: (listener: () => void) => void;
  removeListener?: (listener: () => void) => void;
};

export type ReducedMotionSourceOptions = {
  /** Window to read `matchMedia` from. Omit on the server. */
  window?: Pick<Window, 'matchMedia'> | null;
  /** Initial host override (`null` or omitted reads the media query). */
  override?: boolean | null;
  /** Value without a window. Default `false` (texels do not run on the server anyway). */
  ssrDefault?: boolean;
};

/**
 * Create a reduced-motion source. It reads `(prefers-reduced-motion: reduce)`
 * from the given window, follows its `change` events, and lets the host
 * override it (a settings toggle, a test, a print view).
 */
export function createReducedMotionSource(
  options: ReducedMotionSourceOptions = {}
): ReducedMotionSource {
  const ssrDefault = options.ssrDefault === true;
  let override: boolean | null = typeof options.override === 'boolean' ? options.override : null;
  const listeners = new Set<(reduced: boolean) => void>();
  let query: MediaQueryLike | null = null;
  const win = options.window;
  if (win && typeof win.matchMedia === 'function') {
    try {
      query = win.matchMedia(REDUCED_MOTION_QUERY) as unknown as MediaQueryLike;
    } catch {
      query = null;
    }
  }

  let last = read();
  function read(): boolean {
    if (override !== null) return override;
    if (query) return query.matches === true;
    return ssrDefault;
  }
  function notify(): void {
    const next = read();
    if (next === last) return;
    last = next;
    for (const listener of [...listeners]) listener(next);
  }
  const onChange = (): void => notify();
  if (query?.addEventListener) query.addEventListener('change', onChange);
  else query?.addListener?.(onChange);

  return {
    get: read,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    setOverride(value) {
      override = typeof value === 'boolean' ? value : null;
      notify();
    },
    dispose() {
      if (query?.removeEventListener) query.removeEventListener('change', onChange);
      else query?.removeListener?.(onChange);
      query = null;
      listeners.clear();
    },
  };
}

/** Whether a value is one of {@link MOTION_LEVELS}. */
export function isMotionLevel(value: unknown): value is MotionLevel {
  return typeof value === 'string' && (MOTION_LEVELS as readonly string[]).includes(value);
}

const RANK: Readonly<Record<MotionLevel, number>> = { full: 2, subtle: 1, none: 0 };

/** The lower of two levels (`none` < `subtle` < `full`); invalid values are ignored. */
export function lowerMotionLevel(a: unknown, b: unknown): MotionLevel {
  const left = isMotionLevel(a) ? a : 'full';
  const right = isMotionLevel(b) ? b : 'full';
  return RANK[left] <= RANK[right] ? left : right;
}

export type MotionLevelInput = {
  /** The host's level (an app setting); wins over everything below it. */
  host?: unknown;
  /** The blueprint's or deck's level. */
  document?: unknown;
  /** The component default. */
  component?: unknown;
  /** The viewer's preference: can only lower the result. */
  viewer?: unknown;
  /** Reduced motion lowers the result to `none` (the texels commit the end state at once). */
  reducedMotion?: boolean;
};

/**
 * Resolve the motion level: host, then blueprint or deck, then the component
 * default, then `full`; the viewer's preference and reduced motion only lower
 * it. Invalid values are skipped.
 */
export function resolveMotionLevel(input: MotionLevelInput = {}): MotionLevel {
  const chosen = isMotionLevel(input.host)
    ? input.host
    : isMotionLevel(input.document)
      ? input.document
      : isMotionLevel(input.component)
        ? input.component
        : 'full';
  const level = lowerMotionLevel(chosen, input.viewer);
  return input.reducedMotion === true ? 'none' : level;
}

/**
 * Clamp a duration or delay to [0, {@link MAX_MOTION_MS}] and scale it for the
 * level: `subtle` × {@link SUBTLE_DURATION_SCALE}, `none` → 0. NaN and
 * negative values are 0; Infinity is the maximum.
 */
export function motionDuration(ms: unknown, level: MotionLevel = 'full'): number {
  if (typeof ms !== 'number' || Number.isNaN(ms) || ms <= 0 || level === 'none') return 0;
  const clamped = Math.min(MAX_MOTION_MS, ms);
  return Math.round(level === 'subtle' ? clamped * SUBTLE_DURATION_SCALE : clamped);
}
