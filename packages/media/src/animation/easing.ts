import type { EasingName } from './types.ts';

/** Map unit progress `t` in [0, 1] through a named easing curve. */
export function applyEasing(t: number, name: EasingName = 'linear'): number {
  const x = t <= 0 ? 0 : t >= 1 ? 1 : t;
  switch (name) {
    case 'ease-in':
      return x * x;
    case 'ease-out': {
      const u = 1 - x;
      return 1 - u * u;
    }
    case 'ease-in-out':
      return x < 0.5 ? 2 * x * x : 1 - (-2 * x + 2) ** 2 / 2;
    default:
      return x;
  }
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}
