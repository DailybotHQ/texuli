/**
 * Spring: a pure damped harmonic oscillator solver (ADR-013).
 *
 * Framework-free and DOM-free. The solver moves a normalized progress from 0
 * to 1 with the closed form for every damping case (under, critical and over
 * damped), finds when the spring settles, samples it into keyframe offsets or
 * a CSS `linear()` easing, and reports position and velocity at any time so an
 * interrupted animation can be retargeted without a velocity jump.
 *
 * Hostile inputs are clamped: stiffness, damping, mass, velocity and sample
 * counts have fixed ranges, NaN falls back to the defaults, and the settle
 * search never evaluates more than `MAX_SPRING_MS + 1` points.
 */

/** Physical spring parameters (unitless, like the CSS-in-JS spring convention). */
export type SpringParams = {
  /** Spring constant `k`. Clamped to [1, 10000]. */
  readonly stiffness: number;
  /** Damping coefficient `c`. Clamped to [0, 1000]. */
  readonly damping: number;
  /** Mass `m`. Clamped to [0.01, 1000]. */
  readonly mass: number;
};

/** Options shared by the solver helpers. */
export type SpringSolveOptions = {
  /**
   * Initial velocity in progress units per second (1 = the whole distance per
   * second). Clamped to [-1000, 1000]. Default 0.
   */
  velocity?: number;
  /** Settled when |1 − progress| is below this. Default 0.001. */
  restDelta?: number;
  /** Settled when |velocity| (progress per second) is below this. Default 0.01. */
  restSpeed?: number;
};

/** Position and velocity of the spring at one time. */
export type SpringState = {
  /** Normalized progress (0 at rest start, 1 at the target; may overshoot). */
  readonly position: number;
  /** Progress units per second. */
  readonly velocity: number;
};

/** Settle result. */
export type SpringSettle = {
  /** Milliseconds until the spring stays within rest thresholds, at most `MAX_SPRING_MS`. */
  readonly durationMs: number;
  /** False when the spring was still moving at `MAX_SPRING_MS` (the last frame snaps to 1). */
  readonly settled: boolean;
};

/** Sampled spring curve. */
export type SpringSamples = SpringSettle & {
  /** Progress values at evenly spaced times from 0 to `durationMs`; first 0, last 1. */
  readonly points: readonly number[];
};

/** Longest spring (and any Texuli motion) duration, in milliseconds. */
export const MAX_SPRING_MS = 1000;
/** Default sample count for keyframes and `linear()` easings. */
export const DEFAULT_SPRING_SAMPLES = 40;
/** Largest sample count accepted (keeps `linear()` strings short). */
export const MAX_SPRING_SAMPLES = 120;
/** Spring used when parameters are missing or not finite. */
export const DEFAULT_SPRING: SpringParams = Object.freeze({
  stiffness: 170,
  damping: 26,
  mass: 1,
});

function clamp(value: number, min: number, max: number, fallback: number): number {
  if (typeof value !== 'number' || Number.isNaN(value)) return fallback;
  return Math.min(max, Math.max(min, value));
}

/** Clamp spring parameters into the supported ranges; NaN takes the default. */
export function normalizeSpring(params: Partial<SpringParams> | null | undefined): SpringParams {
  const p = params ?? {};
  return {
    stiffness: clamp(p.stiffness ?? DEFAULT_SPRING.stiffness, 1, 10000, DEFAULT_SPRING.stiffness),
    damping: clamp(p.damping ?? DEFAULT_SPRING.damping, 0, 1000, DEFAULT_SPRING.damping),
    mass: clamp(p.mass ?? DEFAULT_SPRING.mass, 0.01, 1000, DEFAULT_SPRING.mass),
  };
}

/** Damping ratio ζ = c / (2√(k·m)); below 1 overshoots, 1 is critical. */
export function dampingRatio(params: Partial<SpringParams>): number {
  const { stiffness, damping, mass } = normalizeSpring(params);
  return damping / (2 * Math.sqrt(stiffness * mass));
}

type Solution = (seconds: number) => SpringState;

function solver(params: Partial<SpringParams>, velocity: number): Solution {
  const { stiffness, damping, mass } = normalizeSpring(params);
  const v0 = clamp(velocity, -1000, 1000, 0);
  const w0 = Math.sqrt(stiffness / mass);
  const zeta = damping / (2 * Math.sqrt(stiffness * mass));
  // Displacement y = position − 1, so y(0) = −1 and y'(0) = v0.
  const a = -1;

  if (Math.abs(zeta - 1) < 1e-6) {
    const b = v0 + w0 * a;
    return (t) => {
      const e = Math.exp(-w0 * t);
      return { position: 1 + (a + b * t) * e, velocity: e * (b - w0 * (a + b * t)) };
    };
  }

  if (zeta < 1) {
    const wd = w0 * Math.sqrt(1 - zeta * zeta);
    const decay = zeta * w0;
    const b = (v0 + decay * a) / wd;
    return (t) => {
      const e = Math.exp(-decay * t);
      const cos = Math.cos(wd * t);
      const sin = Math.sin(wd * t);
      return {
        position: 1 + e * (a * cos + b * sin),
        velocity: e * ((-decay * a + wd * b) * cos + (-decay * b - wd * a) * sin),
      };
    };
  }

  const root = Math.sqrt(zeta * zeta - 1);
  const r1 = -w0 * (zeta - root);
  const r2 = -w0 * (zeta + root);
  const c2 = (v0 - r1 * a) / (r2 - r1);
  const c1 = a - c2;
  return (t) => {
    const e1 = Math.exp(r1 * t);
    const e2 = Math.exp(r2 * t);
    return { position: 1 + c1 * e1 + c2 * e2, velocity: r1 * c1 * e1 + r2 * c2 * e2 };
  };
}

/** Position and velocity `ms` milliseconds after release (closed form, O(1)). */
export function springState(
  params: Partial<SpringParams>,
  ms: number,
  options: SpringSolveOptions = {}
): SpringState {
  const t = clamp(ms, 0, Number.MAX_SAFE_INTEGER, 0) / 1000;
  return solver(params, options.velocity ?? 0)(t);
}

/**
 * When the spring comes to rest: the first millisecond after which every
 * sampled millisecond stays inside the rest thresholds. Bounded: at most
 * `MAX_SPRING_MS + 1` closed-form evaluations.
 */
export function springSettle(
  params: Partial<SpringParams>,
  options: SpringSolveOptions = {}
): SpringSettle {
  const solve = solver(params, options.velocity ?? 0);
  const restDelta = clamp(options.restDelta ?? 0.001, 1e-6, 0.5, 0.001);
  const restSpeed = clamp(options.restSpeed ?? 0.01, 1e-6, 100, 0.01);
  let lastMoving = -1;
  for (let ms = 0; ms <= MAX_SPRING_MS; ms++) {
    const s = solve(ms / 1000);
    if (Math.abs(1 - s.position) >= restDelta || Math.abs(s.velocity) >= restSpeed) {
      lastMoving = ms;
    }
  }
  if (lastMoving >= MAX_SPRING_MS) return { durationMs: MAX_SPRING_MS, settled: false };
  return { durationMs: lastMoving + 1, settled: true };
}

function sampleCount(samples: number | undefined): number {
  return Math.round(
    clamp(samples ?? DEFAULT_SPRING_SAMPLES, 2, MAX_SPRING_SAMPLES, DEFAULT_SPRING_SAMPLES)
  );
}

/**
 * Sample the spring at evenly spaced times across its settle duration. The
 * first point is the start position (0) and the last is pinned to 1, so a
 * spring cut at `MAX_SPRING_MS` lands exactly on its target.
 */
export function springSamples(
  params: Partial<SpringParams>,
  options: SpringSolveOptions & { samples?: number } = {}
): SpringSamples {
  const settle = springSettle(params, options);
  const count = sampleCount(options.samples);
  const solve = solver(params, options.velocity ?? 0);
  const points: number[] = [];
  for (let i = 0; i < count; i++) {
    const t = (settle.durationMs * i) / (count - 1) / 1000;
    points.push(i === count - 1 ? 1 : round(solve(t).position));
  }
  points[0] = 0;
  return { ...settle, points };
}

function round(value: number): number {
  const r = Math.round(value * 10000) / 10000;
  return Object.is(r, -0) ? 0 : r;
}

/**
 * A CSS `linear()` easing that traces the spring, with its duration. Points
 * are evenly spaced, so no stop percentages are needed.
 *
 * @example
 * const { easing, durationMs } = springEasing({ stiffness: 400, damping: 30, mass: 1 });
 * element.animate(keyframes, { duration: durationMs, easing });
 */
export function springEasing(
  params: Partial<SpringParams>,
  options: SpringSolveOptions & { samples?: number } = {}
): SpringSettle & { readonly easing: string } {
  const { points, durationMs, settled } = springSamples(params, options);
  return { easing: `linear(${points.join(', ')})`, durationMs, settled };
}

/**
 * Keyframes for any property: `build(progress)` maps a spring position to a
 * keyframe (for example a transform). Offsets are evenly spaced.
 */
export function springKeyframes(
  params: Partial<SpringParams>,
  build: (progress: number) => Keyframe,
  options: SpringSolveOptions & { samples?: number } = {}
): SpringSettle & { readonly keyframes: Keyframe[] } {
  const { points, durationMs, settled } = springSamples(params, options);
  const last = points.length - 1;
  const keyframes = points.map((p, i) => ({ ...build(p), offset: i / last }));
  return { keyframes, durationMs, settled };
}

/**
 * Velocity for a retargeted spring: a velocity measured in the old segment's
 * progress units, converted to the new segment (`newSpan` / `oldSpan` are the
 * distances in any shared unit). Zero or non-finite spans give 0.
 */
export function retargetVelocity(velocity: number, oldSpan: number, newSpan: number): number {
  if (!Number.isFinite(velocity) || !Number.isFinite(oldSpan) || !Number.isFinite(newSpan))
    return 0;
  if (newSpan === 0) return 0;
  return clamp((velocity * oldSpan) / newSpan, -1000, 1000, 0);
}
