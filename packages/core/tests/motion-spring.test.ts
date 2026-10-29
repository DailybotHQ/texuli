// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  DEFAULT_SPRING,
  dampingRatio,
  MAX_SPRING_MS,
  MAX_SPRING_SAMPLES,
  normalizeSpring,
  retargetVelocity,
  type SpringParams,
  springEasing,
  springKeyframes,
  springSamples,
  springSettle,
  springState,
} from '../src/motion/spring.ts';

/** RK4 integration of m·x'' = −k·(x − 1) − c·x', the reference for the closed forms. */
function integrate(p: SpringParams, ms: number, v0 = 0): { position: number; velocity: number } {
  const dt = 1 / 20000;
  let x = 0;
  let v = v0;
  const acc = (xx: number, vv: number) => (-p.stiffness * (xx - 1) - p.damping * vv) / p.mass;
  for (let t = 0; t < ms / 1000 - 1e-12; t += dt) {
    const k1x = v;
    const k1v = acc(x, v);
    const k2x = v + (dt / 2) * k1v;
    const k2v = acc(x + (dt / 2) * k1x, v + (dt / 2) * k1v);
    const k3x = v + (dt / 2) * k2v;
    const k3v = acc(x + (dt / 2) * k2x, v + (dt / 2) * k2v);
    const k4x = v + dt * k3v;
    const k4v = acc(x + dt * k3x, v + dt * k3v);
    x += (dt / 6) * (k1x + 2 * k2x + 2 * k3x + k4x);
    v += (dt / 6) * (k1v + 2 * k2v + 2 * k3v + k4v);
  }
  return { position: x, velocity: v };
}

const CASES: { name: string; spring: SpringParams; velocity: number }[] = [
  { name: 'underdamped', spring: { stiffness: 300, damping: 10, mass: 1 }, velocity: 0 },
  {
    name: 'underdamped with velocity',
    spring: { stiffness: 300, damping: 10, mass: 1 },
    velocity: 4,
  },
  { name: 'critical', spring: { stiffness: 100, damping: 20, mass: 1 }, velocity: -2 },
  { name: 'overdamped', spring: { stiffness: 100, damping: 60, mass: 2 }, velocity: 1 },
];

describe('spring solver', () => {
  it('matches a numeric integration in every damping case', () => {
    for (const { name, spring, velocity } of CASES) {
      const start = springState(spring, 0, { velocity });
      expect(start.position, name).toBeCloseTo(0, 9);
      expect(start.velocity, name).toBeCloseTo(velocity, 9);
      for (const ms of [16, 80, 250, 600]) {
        const exact = springState(spring, ms, { velocity });
        const reference = integrate(spring, ms, velocity);
        expect(exact.position, `${name} @${ms}`).toBeCloseTo(reference.position, 3);
        expect(exact.velocity, `${name} @${ms}`).toBeCloseTo(reference.velocity, 2);
      }
    }
    expect(dampingRatio({ stiffness: 100, damping: 20, mass: 1 })).toBeCloseTo(1, 9);
  });

  it('detects settling and pins sampled curves to 0 and 1', () => {
    const snappy = springSettle({ stiffness: 400, damping: 30, mass: 1 });
    expect(snappy.settled).toBe(true);
    expect(snappy.durationMs).toBeGreaterThan(100);
    expect(snappy.durationMs).toBeLessThan(MAX_SPRING_MS);
    const after = springState({ stiffness: 400, damping: 30, mass: 1 }, snappy.durationMs);
    expect(Math.abs(1 - after.position)).toBeLessThan(0.001);

    // An undamped spring never settles: capped at the maximum and snapped to 1.
    const undamped = springSamples({ stiffness: 200, damping: 0, mass: 1 });
    expect(undamped).toMatchObject({ settled: false, durationMs: MAX_SPRING_MS });
    expect(undamped.points[0]).toBe(0);
    expect(undamped.points.at(-1)).toBe(1);

    // An underdamped spring overshoots.
    const bouncy = springSamples({ stiffness: 300, damping: 10, mass: 1 }, { samples: 60 });
    expect(Math.max(...bouncy.points)).toBeGreaterThan(1);
  });

  it('builds linear() easings and keyframes with a sample cap', () => {
    const { easing, durationMs } = springEasing(DEFAULT_SPRING, { samples: 5 });
    expect(easing).toMatch(/^linear\(0, [\d., -]+, 1\)$/);
    expect(easing.split(',')).toHaveLength(5);
    expect(durationMs).toBeGreaterThan(0);

    for (const [samples, count] of [
      [1, 2],
      [Number.NaN, 40],
      [1e9, MAX_SPRING_SAMPLES],
      [-3, 2],
    ] as const) {
      expect(springSamples(DEFAULT_SPRING, { samples }).points, String(samples)).toHaveLength(
        count
      );
    }

    const frames = springKeyframes(
      DEFAULT_SPRING,
      (p) => ({ transform: `translateX(${p * 100}px)` }),
      {
        samples: 3,
      }
    );
    expect(frames.keyframes).toEqual([
      { transform: 'translateX(0px)', offset: 0 },
      expect.objectContaining({ offset: 0.5 }),
      { transform: 'translateX(100px)', offset: 1 },
    ]);
  });

  it('clamps hostile parameters and stays time-bounded', () => {
    expect(
      normalizeSpring({ stiffness: Number.NaN, damping: -5, mass: Number.POSITIVE_INFINITY })
    ).toEqual({
      stiffness: DEFAULT_SPRING.stiffness,
      damping: 0,
      mass: 1000,
    });
    expect(normalizeSpring(null)).toEqual(DEFAULT_SPRING);
    expect(normalizeSpring({ stiffness: 1e12, mass: 0 })).toEqual({
      stiffness: 10000,
      damping: 26,
      mass: 0.01,
    });

    const hostile: Partial<SpringParams>[] = [
      { stiffness: Number.NaN },
      { stiffness: 1e300, damping: 1e300, mass: 1e-300 },
      { stiffness: -1, damping: Number.NEGATIVE_INFINITY },
      { damping: 0 },
    ];
    const started = performance.now();
    for (let i = 0; i < 200; i++) {
      for (const spring of hostile) {
        const result = springEasing(spring, {
          velocity: i % 2 ? Number.NaN : 1e9,
          samples: 1e9,
          restDelta: -1,
          restSpeed: Number.NaN,
        });
        expect(result.durationMs).toBeLessThanOrEqual(MAX_SPRING_MS);
        expect(result.easing).not.toMatch(/NaN|Infinity/);
      }
    }
    expect(performance.now() - started).toBeLessThan(5000);
    expect(springState(DEFAULT_SPRING, Number.NaN).position).toBe(0);
    expect(springState(DEFAULT_SPRING, -100).position).toBe(0);
  });

  it('converts velocity for a retargeted spring', () => {
    expect(retargetVelocity(2, 100, 50)).toBe(4);
    for (const [v, a, b] of [
      [Number.NaN, 1, 1],
      [1, 1, 0],
      [1, Number.POSITIVE_INFINITY, 1],
    ] as const) {
      expect(retargetVelocity(v, a, b)).toBe(0);
    }
    expect(retargetVelocity(1e9, 1, 1)).toBe(1000);
  });
});
