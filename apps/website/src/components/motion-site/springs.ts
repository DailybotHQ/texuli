/**
 * The three spring tokens as plot data for /motion-page/: each curve drawn
 * from the same `@texuli/core/motion` solver that precomputed the tokens'
 * `linear()` easings. Pure and deterministic, so the server renders the SVG
 * and the tests check it.
 */
import { dampingRatio, springSamples } from '@texuli/core/motion/spring';
import {
  MOTION_SPRING_NAMES,
  MOTION_SPRINGS,
  type MotionSpringName,
  motionSpringVars,
} from '@texuli/tokens/motion';

export const PLOT = Object.freeze({ width: 600, height: 280, top: 24, bottom: 36, left: 40 });
/** The highest position on the plot (springs may overshoot 1). */
export const PLOT_MAX = 1.25;
const SAMPLES = 60;

export interface SpringCurve {
  readonly name: MotionSpringName;
  readonly stiffness: number;
  readonly damping: number;
  readonly mass: number;
  readonly ratio: number;
  readonly durationMs: number;
  readonly peak: number;
  readonly path: string;
  readonly end: { readonly x: number; readonly y: number };
  readonly vars: { readonly easing: string; readonly duration: string };
}

const longest = Math.max(...MOTION_SPRING_NAMES.map((name) => MOTION_SPRINGS[name].durationMs));
const innerWidth = PLOT.width - PLOT.left - 16;
const innerHeight = PLOT.height - PLOT.top - PLOT.bottom;

/** The x of a time in ms and the y of a position, in plot units. */
export function plotX(ms: number): number {
  return Math.round((PLOT.left + (ms / longest) * innerWidth) * 10) / 10;
}
export function plotY(position: number): number {
  return Math.round((PLOT.top + innerHeight - (position / PLOT_MAX) * innerHeight) * 10) / 10;
}

export const SPRING_CURVES: readonly SpringCurve[] = MOTION_SPRING_NAMES.map((name) => {
  const token = MOTION_SPRINGS[name];
  const params = { stiffness: token.stiffness, damping: token.damping, mass: token.mass };
  const { points, durationMs } = springSamples(params, { samples: SAMPLES });
  const coords = points.map((position, index) => ({
    x: plotX((durationMs * index) / (points.length - 1)),
    y: plotY(position),
  }));
  const path = coords
    .map((point, index) => `${index === 0 ? 'M' : 'L'}${point.x} ${point.y}`)
    .join(' ');
  return {
    name,
    ...params,
    ratio: Math.round(dampingRatio(params) * 100) / 100,
    durationMs: token.durationMs,
    peak: Math.round(Math.max(...points) * 100) / 100,
    path,
    end: coords[coords.length - 1] ?? { x: PLOT.left, y: plotY(1) },
    vars: motionSpringVars(name),
  };
});

/** Grid lines: time every 200 ms and the rest position. */
export const TIME_TICKS: readonly number[] = Array.from(
  { length: Math.floor(longest / 200) + 1 },
  (_, index) => index * 200
);
