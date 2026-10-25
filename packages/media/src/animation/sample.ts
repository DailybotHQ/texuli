import type {
  Composition,
  CompositionLayer,
  CompositionTransform,
} from '../composition-model/types.ts';
import { mixOklch } from './color.ts';
import { applyEasing, lerp } from './easing.ts';
import type {
  CompositionAnimation,
  LayerKeyframe,
  LayerTrack,
  SampleAnimationOptions,
} from './types.ts';

type Animatable = {
  opacity: number;
  translateX: number;
  translateY: number;
  scaleX: number;
  scaleY: number;
  rotateDeg: number;
  /** Solid colors; `undefined` keeps the layer's own paint (gradient or none). */
  fill?: string | undefined;
  stroke?: string | undefined;
};

function solidColor(paint: { kind: string; color?: string } | undefined): string | undefined {
  return typeof paint === 'object' && paint.kind === 'solid' ? paint.color : undefined;
}

function baseFromLayer(layer: CompositionLayer): Animatable {
  const t = layer.transform ?? {};
  return {
    opacity: layer.opacity ?? 1,
    translateX: t.translateX ?? 0,
    translateY: t.translateY ?? 0,
    scaleX: t.scaleX ?? 1,
    scaleY: t.scaleY ?? 1,
    rotateDeg: t.rotateDeg ?? 0,
    fill: solidColor(
      layer.type === 'shape' ? layer.fill : layer.type === 'text' ? layer.paint : undefined
    ),
    stroke: solidColor(layer.type === 'shape' ? layer.stroke : undefined),
  };
}

/**
 * Mixes two optional colors. Without a start color (a gradient or no paint),
 * the layer keeps its own paint until the keyframe that sets one.
 */
function mixColor(a: string | undefined, b: string | undefined, t: number): string | undefined {
  if (a === undefined) return t >= 1 ? b : undefined;
  if (b === undefined) return a;
  return a === b ? a : mixOklch(a, b, t);
}

function fillKeyframe(base: Animatable, kf: LayerKeyframe): Animatable {
  return {
    opacity: kf.opacity ?? base.opacity,
    translateX: kf.translateX ?? base.translateX,
    translateY: kf.translateY ?? base.translateY,
    scaleX: kf.scaleX ?? base.scaleX,
    scaleY: kf.scaleY ?? base.scaleY,
    rotateDeg: kf.rotateDeg ?? base.rotateDeg,
    fill: kf.fill ?? base.fill,
    stroke: kf.stroke ?? base.stroke,
  };
}

function sampleTrack(base: Animatable, track: LayerTrack, timeMs: number): Animatable {
  const frames = track.keyframes;
  if (frames.length === 0) return base;

  const absolute: Animatable[] = [];
  let cursor = base;
  for (const kf of frames) {
    cursor = fillKeyframe(cursor, kf);
    absolute.push(cursor);
  }

  const first = frames[0];
  const firstAbs = absolute[0];
  if (!first || !firstAbs) return base;
  if (timeMs <= first.timeMs) return firstAbs;

  const lastIndex = frames.length - 1;
  const last = frames[lastIndex];
  const lastAbs = absolute[lastIndex];
  if (!last || !lastAbs) return base;
  if (timeMs >= last.timeMs) return lastAbs;

  let i = 1;
  while (i < frames.length) {
    const candidate = frames[i];
    if (!candidate || candidate.timeMs >= timeMs) break;
    i += 1;
  }
  const prev = frames[i - 1];
  const next = frames[i];
  const a = absolute[i - 1];
  const b = absolute[i];
  if (!prev || !next || !a || !b) return base;

  const span = next.timeMs - prev.timeMs;
  const rawT = span <= 0 ? 1 : (timeMs - prev.timeMs) / span;
  const t = applyEasing(rawT, next.easing ?? 'linear');
  return {
    opacity: lerp(a.opacity, b.opacity, t),
    translateX: lerp(a.translateX, b.translateX, t),
    translateY: lerp(a.translateY, b.translateY, t),
    scaleX: lerp(a.scaleX, b.scaleX, t),
    scaleY: lerp(a.scaleY, b.scaleY, t),
    rotateDeg: lerp(a.rotateDeg, b.rotateDeg, t),
    fill: mixColor(a.fill, b.fill, t),
    stroke: mixColor(a.stroke, b.stroke, t),
  };
}

function applyAnimatable(layer: CompositionLayer, values: Animatable): CompositionLayer {
  const transform: CompositionTransform = {
    translateX: values.translateX,
    translateY: values.translateY,
    scaleX: values.scaleX,
    scaleY: values.scaleY,
    rotateDeg: values.rotateDeg,
  };
  const next = { ...layer, opacity: values.opacity, transform } as CompositionLayer;
  if (values.fill !== undefined) {
    if (next.type === 'shape') next.fill = { kind: 'solid', color: values.fill };
    else if (next.type === 'text') next.paint = { kind: 'solid', color: values.fill };
  }
  if (values.stroke !== undefined && next.type === 'shape') {
    next.stroke = { kind: 'solid', color: values.stroke };
  }
  return next;
}

function wrapTime(timeMs: number, durationMs: number, loop: boolean): number {
  if (durationMs <= 0) return 0;
  if (!loop) return Math.min(Math.max(0, timeMs), durationMs);
  const m = timeMs % durationMs;
  return m < 0 ? m + durationMs : m;
}

/**
 * Produce a composition snapshot at `timeMs` by interpolating layer tracks.
 * Does not re-validate; pass already-validated documents.
 */
export function sampleComposition(
  composition: Composition,
  animation: CompositionAnimation,
  timeMs: number,
  options: SampleAnimationOptions = {}
): Composition {
  const reduced = options.reducedMotion === true;
  const still = options.stillTimeMs ?? 0;
  const t = reduced
    ? wrapTime(still, animation.durationMs, false)
    : wrapTime(timeMs, animation.durationMs, animation.loop === true);

  const byId = new Map(animation.tracks.map((track) => [track.layerId, track]));

  const layers = composition.layers.map((layer) => {
    const track = byId.get(layer.id);
    if (!track) return layer;
    const values = sampleTrack(baseFromLayer(layer), track, t);
    return applyAnimatable(layer, values);
  });

  return {
    ...composition,
    layers,
  };
}
