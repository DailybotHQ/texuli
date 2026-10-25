import type { Composition, CompositionIssue } from '../composition-model/types.ts';
import { isHexColor } from './color.ts';
import {
  ANIMATION_LIMITS,
  type AnimationValidation,
  type CompositionAnimation,
  EASING_NAMES,
  type EasingName,
  type LayerKeyframe,
  type LayerTrack,
  type ValidateAnimationOptions,
} from './types.ts';

function addIssue(
  errors: CompositionIssue[],
  path: string,
  code: CompositionIssue['code'],
  message: string
): void {
  if (errors.length < ANIMATION_LIMITS.maxIssues) {
    errors.push({ path, code, message });
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function finiteNumber(
  value: unknown,
  path: string,
  min: number,
  max: number,
  errors: CompositionIssue[]
): number | undefined {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) {
    addIssue(errors, path, 'invalid-value', `Expected a number from ${min} to ${max}.`);
    return undefined;
  }
  return value;
}

function parseKeyframe(
  value: unknown,
  path: string,
  durationMs: number,
  errors: CompositionIssue[]
): LayerKeyframe | undefined {
  if (!isRecord(value)) {
    addIssue(errors, path, 'invalid-value', 'Expected a keyframe object.');
    return undefined;
  }
  const timeMs = finiteNumber(value.timeMs, `${path}.timeMs`, 0, durationMs, errors);
  if (timeMs === undefined) return undefined;

  const keyframe: LayerKeyframe = { timeMs };

  if (value.opacity !== undefined) {
    const opacity = finiteNumber(value.opacity, `${path}.opacity`, 0, 1, errors);
    if (opacity !== undefined) keyframe.opacity = opacity;
  }
  for (const key of ['translateX', 'translateY'] as const) {
    if (value[key] !== undefined) {
      const n = finiteNumber(value[key], `${path}.${key}`, -32_768, 32_768, errors);
      if (n !== undefined) keyframe[key] = n;
    }
  }
  for (const key of ['scaleX', 'scaleY'] as const) {
    if (value[key] !== undefined) {
      const n = finiteNumber(value[key], `${path}.${key}`, -16, 16, errors);
      if (n !== undefined) keyframe[key] = n;
    }
  }
  if (value.rotateDeg !== undefined) {
    const rotateDeg = finiteNumber(value.rotateDeg, `${path}.rotateDeg`, -36_000, 36_000, errors);
    if (rotateDeg !== undefined) keyframe.rotateDeg = rotateDeg;
  }
  for (const key of ['fill', 'stroke'] as const) {
    if (value[key] === undefined) continue;
    if (isHexColor(value[key])) keyframe[key] = value[key];
    else addIssue(errors, `${path}.${key}`, 'invalid-value', 'Use a hexadecimal color.');
  }
  if (value.easing !== undefined) {
    if (
      typeof value.easing === 'string' &&
      (EASING_NAMES as readonly string[]).includes(value.easing)
    ) {
      keyframe.easing = value.easing as EasingName;
    } else {
      addIssue(errors, `${path}.easing`, 'invalid-value', 'Unknown easing name.');
    }
  }

  // Reject hostile CSS/script-shaped fields without echoing them.
  for (const key of Object.keys(value)) {
    if (
      ![
        'timeMs',
        'opacity',
        'translateX',
        'translateY',
        'scaleX',
        'scaleY',
        'rotateDeg',
        'fill',
        'stroke',
        'easing',
      ].includes(key)
    ) {
      addIssue(errors, path, 'unknown-field', 'Unknown keyframe field.');
    }
  }

  return keyframe;
}

function parseTrack(
  value: unknown,
  path: string,
  durationMs: number,
  layers: Map<string, Composition['layers'][number]> | null,
  errors: CompositionIssue[]
): LayerTrack | undefined {
  if (!isRecord(value)) {
    addIssue(errors, path, 'invalid-value', 'Expected a track object.');
    return undefined;
  }
  if (typeof value.layerId !== 'string' || !/^[a-z][a-z0-9-]{0,63}$/.test(value.layerId)) {
    addIssue(errors, `${path}.layerId`, 'invalid-value', 'Expected a layer id.');
    return undefined;
  }
  const layer = layers?.get(value.layerId);
  if (layers && !layer) {
    addIssue(errors, `${path}.layerId`, 'missing-field', 'Layer id is not in the composition.');
  }
  if (!Array.isArray(value.keyframes) || value.keyframes.length === 0) {
    addIssue(errors, `${path}.keyframes`, 'invalid-value', 'Expected a non-empty keyframes array.');
    return undefined;
  }
  if (value.keyframes.length > ANIMATION_LIMITS.maxKeyframesPerTrack) {
    addIssue(errors, `${path}.keyframes`, 'limit-exceeded', 'Too many keyframes on one track.');
    return undefined;
  }

  const keyframes: LayerKeyframe[] = [];
  let lastTime = -1;
  for (let i = 0; i < value.keyframes.length; i++) {
    const kf = parseKeyframe(value.keyframes[i], `${path}.keyframes[${i}]`, durationMs, errors);
    if (!kf) continue;
    if (kf.timeMs < lastTime) {
      addIssue(
        errors,
        `${path}.keyframes[${i}].timeMs`,
        'invalid-value',
        'Keyframes must be sorted by time.'
      );
    }
    lastTime = kf.timeMs;
    // Colors animate only what the layer can paint: shape fill and stroke, text paint.
    if (kf.fill !== undefined && layer?.type === 'image') {
      addIssue(errors, `${path}.keyframes[${i}].fill`, 'invalid-value', 'Images have no fill.');
    }
    if (kf.stroke !== undefined && layer && layer.type !== 'shape') {
      addIssue(
        errors,
        `${path}.keyframes[${i}].stroke`,
        'invalid-value',
        'Only shapes have a stroke.'
      );
    }
    keyframes.push(kf);
  }
  if (keyframes.length === 0) return undefined;
  return { layerId: value.layerId, keyframes };
}

/**
 * Validate a composition animation document. Optionally requires every track
 * `layerId` to exist on the given composition.
 */
export function validateAnimation(
  input: unknown,
  options: ValidateAnimationOptions = {}
): AnimationValidation {
  const errors: CompositionIssue[] = [];
  if (!isRecord(input)) {
    return {
      ok: false,
      errors: [{ path: '', code: 'invalid-input', message: 'Animation must be an object.' }],
    };
  }
  if (input.version !== 1) {
    addIssue(errors, 'version', 'invalid-value', 'Only animation version 1 is supported.');
  }
  const durationMs = finiteNumber(
    input.durationMs,
    'durationMs',
    1,
    ANIMATION_LIMITS.maxDurationMs,
    errors
  );
  if (durationMs === undefined) {
    return { ok: false, errors };
  }

  let loop = false;
  if (input.loop !== undefined) {
    if (typeof input.loop !== 'boolean') {
      addIssue(errors, 'loop', 'invalid-value', 'Expected a boolean.');
    } else loop = input.loop;
  }

  if (!Array.isArray(input.tracks)) {
    addIssue(errors, 'tracks', 'invalid-value', 'Expected a tracks array.');
    return { ok: false, errors };
  }
  if (input.tracks.length === 0) {
    addIssue(errors, 'tracks', 'invalid-value', 'Expected at least one track.');
  }
  if (input.tracks.length > ANIMATION_LIMITS.maxTracks) {
    addIssue(errors, 'tracks', 'limit-exceeded', 'Too many tracks.');
  }

  const layers =
    options.composition !== undefined
      ? new Map(options.composition.layers.map((layer) => [layer.id, layer]))
      : null;

  const tracks: LayerTrack[] = [];
  const seen = new Set<string>();
  for (let i = 0; i < input.tracks.length; i++) {
    const track = parseTrack(input.tracks[i], `tracks[${i}]`, durationMs, layers, errors);
    if (!track) continue;
    if (seen.has(track.layerId)) {
      addIssue(
        errors,
        `tracks[${i}].layerId`,
        'duplicate-id',
        'Duplicate track for the same layer.'
      );
    }
    seen.add(track.layerId);
    tracks.push(track);
  }

  if (errors.length > 0) return { ok: false, errors };

  const animation: CompositionAnimation = {
    version: 1,
    durationMs,
    tracks,
  };
  if (loop) animation.loop = true;
  return { ok: true, animation };
}
