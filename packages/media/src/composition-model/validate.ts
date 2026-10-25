import { safeImageSrc } from '@texuli/core/url-policy';
import { parseMediaProvenance } from '../provenance.ts';
import type {
  Composition,
  CompositionBlendMode,
  CompositionFrame,
  CompositionIssue,
  CompositionLayer,
  CompositionMask,
  CompositionPaint,
  CompositionTransform,
  CompositionValidation,
  GradientStop,
  ValidateCompositionOptions,
} from './types.ts';

export const COMPOSITION_LIMITS = Object.freeze({
  maxLayers: 256,
  maxDimension: 8_192,
  maxDurationMs: 60_000,
  maxTextLength: 10_000,
  maxAltLength: 512,
  maxGradientStops: 32,
  maxSerializedBytes: 2_000_000,
  maxIssues: 64,
});

const ID_PATTERN = /^[a-z][a-z0-9-]{0,63}$/;
const HEX_COLOR_PATTERN = /^#(?:[\da-f]{3}|[\da-f]{4}|[\da-f]{6}|[\da-f]{8})$/i;
const BLEND_MODES = new Set<CompositionBlendMode>([
  'normal',
  'multiply',
  'screen',
  'overlay',
  'darken',
  'lighten',
  'color-dodge',
  'color-burn',
  'hard-light',
  'soft-light',
  'difference',
  'exclusion',
  'hue',
  'saturation',
  'color',
  'luminosity',
]);

type RecordValue = Record<string, unknown>;

export function isRecord(value: unknown): value is RecordValue {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

export function hasOnlyKeys(
  value: RecordValue,
  allowed: readonly string[],
  path: string,
  errors: CompositionIssue[]
): boolean {
  const allowedKeys = new Set(allowed);
  let valid = true;
  for (const key of Object.keys(value)) {
    if (!allowedKeys.has(key)) {
      const safeKey = /^[A-Za-z0-9_-]{1,64}$/.test(key) ? key : '<unknown>';
      addIssue(errors, path ? `${path}.${safeKey}` : safeKey, 'unknown-field', 'Unknown field.');
      valid = false;
    }
  }
  return valid;
}

export function addIssue(
  errors: CompositionIssue[],
  path: string,
  code: CompositionIssue['code'],
  message: string
): void {
  if (errors.length < COMPOSITION_LIMITS.maxIssues) errors.push({ path, code, message });
}

function requiredString(
  value: unknown,
  path: string,
  maxLength: number,
  errors: CompositionIssue[],
  allowEmpty = false
): string | undefined {
  if (typeof value !== 'string' || (!allowEmpty && value.trim() === '')) {
    addIssue(errors, path, 'invalid-value', 'Expected a non-empty string.');
    return undefined;
  }
  if (value.length > maxLength) {
    addIssue(errors, path, 'limit-exceeded', `String must be at most ${maxLength} characters.`);
    return undefined;
  }
  return value;
}

export function finiteNumber(
  value: unknown,
  path: string,
  min: number,
  max: number,
  errors: CompositionIssue[],
  integer = false
): number | undefined {
  if (
    typeof value !== 'number' ||
    !Number.isFinite(value) ||
    value < min ||
    value > max ||
    (integer && !Number.isInteger(value))
  ) {
    addIssue(
      errors,
      path,
      'invalid-value',
      `Expected a ${integer ? 'whole ' : ''}number from ${min} to ${max}.`
    );
    return undefined;
  }
  return value;
}

function parseFrame(
  value: unknown,
  path: string,
  errors: CompositionIssue[]
): CompositionFrame | undefined {
  if (!isRecord(value)) {
    addIssue(errors, path, 'invalid-value', 'Expected a frame object.');
    return undefined;
  }
  hasOnlyKeys(value, ['x', 'y', 'width', 'height'], path, errors);
  const x = finiteNumber(value.x, `${path}.x`, -32_768, 32_768, errors);
  const y = finiteNumber(value.y, `${path}.y`, -32_768, 32_768, errors);
  const width = finiteNumber(
    value.width,
    `${path}.width`,
    1,
    COMPOSITION_LIMITS.maxDimension,
    errors
  );
  const height = finiteNumber(
    value.height,
    `${path}.height`,
    1,
    COMPOSITION_LIMITS.maxDimension,
    errors
  );
  if (x === undefined || y === undefined || width === undefined || height === undefined)
    return undefined;
  return { x, y, width, height };
}

function parseTransform(
  value: unknown,
  path: string,
  errors: CompositionIssue[]
): CompositionTransform | undefined {
  if (value === undefined) return undefined;
  if (!isRecord(value)) {
    addIssue(errors, path, 'invalid-value', 'Expected a transform object.');
    return undefined;
  }
  hasOnlyKeys(value, ['translateX', 'translateY', 'scaleX', 'scaleY', 'rotateDeg'], path, errors);
  const result: CompositionTransform = {};
  for (const key of ['translateX', 'translateY'] as const) {
    if (value[key] !== undefined) {
      const number = finiteNumber(value[key], `${path}.${key}`, -32_768, 32_768, errors);
      if (number !== undefined) result[key] = number;
    }
  }
  for (const key of ['scaleX', 'scaleY'] as const) {
    if (value[key] !== undefined) {
      const number = finiteNumber(value[key], `${path}.${key}`, -16, 16, errors);
      if (number !== undefined) result[key] = number;
    }
  }
  if (value.rotateDeg !== undefined) {
    const rotateDeg = finiteNumber(value.rotateDeg, `${path}.rotateDeg`, -36_000, 36_000, errors);
    if (rotateDeg !== undefined) result.rotateDeg = rotateDeg;
  }
  return result;
}

function parseStops(
  value: unknown,
  path: string,
  errors: CompositionIssue[]
): GradientStop[] | undefined {
  if (
    !Array.isArray(value) ||
    value.length < 2 ||
    value.length > COMPOSITION_LIMITS.maxGradientStops
  ) {
    addIssue(
      errors,
      path,
      'limit-exceeded',
      `Expected 2 to ${COMPOSITION_LIMITS.maxGradientStops} gradient stops.`
    );
    return undefined;
  }
  const stops: GradientStop[] = [];
  let previousOffset = -1;
  value.forEach((stop, index) => {
    const stopPath = `${path}[${index}]`;
    if (!isRecord(stop)) {
      addIssue(errors, stopPath, 'invalid-value', 'Expected a gradient stop object.');
      return;
    }
    hasOnlyKeys(stop, ['offset', 'color'], stopPath, errors);
    const offset = finiteNumber(stop.offset, `${stopPath}.offset`, 0, 1, errors);
    const color = requiredString(stop.color, `${stopPath}.color`, 9, errors);
    if (color !== undefined && !HEX_COLOR_PATTERN.test(color)) {
      addIssue(errors, `${stopPath}.color`, 'invalid-value', 'Use a hexadecimal color.');
    }
    if (offset !== undefined && offset < previousOffset) {
      addIssue(
        errors,
        `${stopPath}.offset`,
        'invalid-value',
        'Gradient stops must be ordered by offset.'
      );
    }
    if (offset !== undefined && color !== undefined && HEX_COLOR_PATTERN.test(color)) {
      stops.push({ offset, color });
      previousOffset = offset;
    }
  });
  return stops.length === value.length ? stops : undefined;
}

function parsePaint(
  value: unknown,
  path: string,
  errors: CompositionIssue[]
): CompositionPaint | undefined {
  if (!isRecord(value)) {
    addIssue(errors, path, 'invalid-value', 'Expected a paint object.');
    return undefined;
  }
  if (value.kind === 'solid') {
    hasOnlyKeys(value, ['kind', 'color'], path, errors);
    const color = requiredString(value.color, `${path}.color`, 9, errors);
    if (color !== undefined && !HEX_COLOR_PATTERN.test(color)) {
      addIssue(errors, `${path}.color`, 'invalid-value', 'Use a hexadecimal color.');
    }
    return color !== undefined && HEX_COLOR_PATTERN.test(color)
      ? { kind: 'solid', color }
      : undefined;
  }
  if (value.kind === 'linear-gradient') {
    hasOnlyKeys(value, ['kind', 'angle', 'stops'], path, errors);
    const angle = finiteNumber(value.angle, `${path}.angle`, 0, 360, errors);
    const stops = parseStops(value.stops, `${path}.stops`, errors);
    return angle !== undefined && stops ? { kind: 'linear-gradient', angle, stops } : undefined;
  }
  if (value.kind === 'radial-gradient') {
    hasOnlyKeys(value, ['kind', 'center', 'radius', 'stops'], path, errors);
    const centerValue = value.center;
    let center: { x: number; y: number } | undefined;
    if (!isRecord(centerValue)) {
      addIssue(errors, `${path}.center`, 'invalid-value', 'Expected a normalized center point.');
    } else {
      hasOnlyKeys(centerValue, ['x', 'y'], `${path}.center`, errors);
      const x = finiteNumber(centerValue.x, `${path}.center.x`, 0, 1, errors);
      const y = finiteNumber(centerValue.y, `${path}.center.y`, 0, 1, errors);
      if (x !== undefined && y !== undefined) center = { x, y };
    }
    const radius = finiteNumber(value.radius, `${path}.radius`, 0, 1, errors);
    const stops = parseStops(value.stops, `${path}.stops`, errors);
    return center && radius !== undefined && stops
      ? { kind: 'radial-gradient', center, radius, stops }
      : undefined;
  }
  addIssue(errors, `${path}.kind`, 'invalid-value', 'Expected a supported paint kind.');
  return undefined;
}

function parseMask(
  value: unknown,
  path: string,
  errors: CompositionIssue[]
): CompositionMask | undefined {
  if (value === undefined) return undefined;
  if (!isRecord(value)) {
    addIssue(errors, path, 'invalid-value', 'Expected a mask reference.');
    return undefined;
  }
  hasOnlyKeys(value, ['layerId', 'mode', 'invert'], path, errors);
  const layerId = requiredString(value.layerId, `${path}.layerId`, 64, errors);
  if (layerId !== undefined && !ID_PATTERN.test(layerId)) {
    addIssue(
      errors,
      `${path}.layerId`,
      'invalid-value',
      'Mask layer ids must be lowercase kebab-case.'
    );
  }
  const mode = value.mode;
  if (mode !== 'alpha' && mode !== 'luminance') {
    addIssue(errors, `${path}.mode`, 'invalid-value', 'Mask mode must be alpha or luminance.');
  }
  if (value.invert !== undefined && typeof value.invert !== 'boolean') {
    addIssue(errors, `${path}.invert`, 'invalid-value', 'Expected a boolean.');
  }
  if (
    layerId === undefined ||
    !ID_PATTERN.test(layerId) ||
    (mode !== 'alpha' && mode !== 'luminance') ||
    (value.invert !== undefined && typeof value.invert !== 'boolean')
  ) {
    return undefined;
  }
  return { layerId, mode, ...(value.invert === undefined ? {} : { invert: value.invert }) };
}

/**
 * Parse one leaf layer at `path`. Composition v2 reuses this for its leaves,
 * passing its own extra keys (such as `timing`), which it parses itself.
 */
export function parseCompositionLayer(
  value: unknown,
  path: string,
  trust: 'developer' | 'untrusted',
  imageSourceChars: { value: number },
  errors: CompositionIssue[],
  extraKeys: readonly string[] = []
): CompositionLayer | undefined {
  if (!isRecord(value)) {
    addIssue(errors, path, 'invalid-value', 'Expected a layer object.');
    return undefined;
  }
  const commonKeys = ['id', 'type', 'frame', 'transform', 'opacity', 'blendMode', 'mask'];
  const type = value.type;
  const specificKeys =
    type === 'shape'
      ? ['shape', 'fill', 'stroke', 'strokeWidth']
      : type === 'text'
        ? ['text', 'paint', 'fontSize', 'fontWeight', 'align']
        : type === 'image'
          ? ['src', 'alt', 'fit', 'provenance']
          : [];
  hasOnlyKeys(value, [...commonKeys, ...specificKeys, ...extraKeys], path, errors);

  const id = requiredString(value.id, `${path}.id`, 64, errors);
  if (id !== undefined && !ID_PATTERN.test(id)) {
    addIssue(errors, `${path}.id`, 'invalid-value', 'Layer ids must be lowercase kebab-case.');
  }
  const frame = parseFrame(value.frame, `${path}.frame`, errors);
  const transform = parseTransform(value.transform, `${path}.transform`, errors);
  const opacity =
    value.opacity === undefined
      ? undefined
      : finiteNumber(value.opacity, `${path}.opacity`, 0, 1, errors);
  const blendMode = value.blendMode;
  if (blendMode !== undefined && !BLEND_MODES.has(blendMode as CompositionBlendMode)) {
    addIssue(errors, `${path}.blendMode`, 'invalid-value', 'Unsupported blend mode.');
  }
  const mask = parseMask(value.mask, `${path}.mask`, errors);
  if (
    id === undefined ||
    !ID_PATTERN.test(id) ||
    frame === undefined ||
    (value.transform !== undefined && transform === undefined) ||
    (value.opacity !== undefined && opacity === undefined) ||
    (blendMode !== undefined && !BLEND_MODES.has(blendMode as CompositionBlendMode)) ||
    (value.mask !== undefined && mask === undefined)
  ) {
    return undefined;
  }
  const base = {
    id,
    frame,
    ...(transform === undefined ? {} : { transform }),
    ...(opacity === undefined ? {} : { opacity }),
    ...(blendMode === undefined ? {} : { blendMode: blendMode as CompositionBlendMode }),
    ...(mask === undefined ? {} : { mask }),
  };

  if (type === 'shape') {
    const shape = value.shape;
    if (shape !== 'rectangle' && shape !== 'ellipse' && shape !== 'line') {
      addIssue(errors, `${path}.shape`, 'invalid-value', 'Expected rectangle, ellipse, or line.');
      return undefined;
    }
    const fill =
      value.fill === undefined ? undefined : parsePaint(value.fill, `${path}.fill`, errors);
    const stroke =
      value.stroke === undefined ? undefined : parsePaint(value.stroke, `${path}.stroke`, errors);
    const strokeWidth =
      value.strokeWidth === undefined
        ? undefined
        : finiteNumber(value.strokeWidth, `${path}.strokeWidth`, 0, 256, errors);
    if (
      (value.fill !== undefined && fill === undefined) ||
      (value.stroke !== undefined && stroke === undefined) ||
      (value.strokeWidth !== undefined && strokeWidth === undefined) ||
      (fill === undefined && stroke === undefined)
    ) {
      if (fill === undefined && stroke === undefined) {
        addIssue(errors, path, 'missing-field', 'A shape needs a fill or stroke.');
      }
      return undefined;
    }
    return {
      ...base,
      type,
      shape,
      ...(fill === undefined ? {} : { fill }),
      ...(stroke === undefined ? {} : { stroke }),
      ...(strokeWidth === undefined ? {} : { strokeWidth }),
    };
  }

  if (type === 'text') {
    const text = requiredString(
      value.text,
      `${path}.text`,
      COMPOSITION_LIMITS.maxTextLength,
      errors,
      true
    );
    const paint = parsePaint(value.paint, `${path}.paint`, errors);
    const fontSize = finiteNumber(value.fontSize, `${path}.fontSize`, 1, 512, errors);
    const fontWeight = value.fontWeight;
    if (
      fontWeight !== undefined &&
      (typeof fontWeight !== 'number' ||
        ![100, 200, 300, 400, 500, 600, 700, 800, 900].includes(fontWeight))
    ) {
      addIssue(
        errors,
        `${path}.fontWeight`,
        'invalid-value',
        'Expected a font weight from 100 to 900 in steps of 100.'
      );
    }
    const align = value.align;
    if (align !== undefined && align !== 'start' && align !== 'center' && align !== 'end') {
      addIssue(errors, `${path}.align`, 'invalid-value', 'Expected start, center, or end.');
    }
    if (
      text === undefined ||
      paint === undefined ||
      fontSize === undefined ||
      (fontWeight !== undefined &&
        (typeof fontWeight !== 'number' ||
          ![100, 200, 300, 400, 500, 600, 700, 800, 900].includes(fontWeight))) ||
      (align !== undefined && align !== 'start' && align !== 'center' && align !== 'end')
    ) {
      return undefined;
    }
    return {
      ...base,
      type,
      text,
      paint,
      fontSize,
      ...(fontWeight === undefined
        ? {}
        : { fontWeight: fontWeight as 100 | 200 | 300 | 400 | 500 | 600 | 700 | 800 | 900 }),
      ...(align === undefined ? {} : { align }),
    };
  }

  if (type === 'image') {
    const source = safeImageSrc(value.src, trust);
    if (source === undefined)
      addIssue(
        errors,
        `${path}.src`,
        'unsafe-source',
        'Image source is not allowed by the media URL policy.'
      );
    if (source !== undefined) {
      imageSourceChars.value += source.length;
      if (imageSourceChars.value > COMPOSITION_LIMITS.maxSerializedBytes) {
        addIssue(
          errors,
          `${path}.src`,
          'limit-exceeded',
          'Combined image source strings exceed the composition size limit.'
        );
      }
    }
    const alt = requiredString(
      value.alt,
      `${path}.alt`,
      COMPOSITION_LIMITS.maxAltLength,
      errors,
      true
    );
    const fit = value.fit;
    if (fit !== undefined && fit !== 'contain' && fit !== 'cover' && fit !== 'fill') {
      addIssue(errors, `${path}.fit`, 'invalid-value', 'Expected contain, cover, or fill.');
    }
    const provenance =
      value.provenance === undefined ? undefined : parseMediaProvenance(value.provenance);
    if (value.provenance !== undefined && provenance === undefined) {
      addIssue(errors, `${path}.provenance`, 'invalid-value', 'Expected valid media provenance.');
    }
    if (
      source === undefined ||
      alt === undefined ||
      (fit !== undefined && fit !== 'contain' && fit !== 'cover' && fit !== 'fill') ||
      (value.provenance !== undefined && provenance === undefined)
    ) {
      return undefined;
    }
    return {
      ...base,
      type,
      src: source,
      alt,
      ...(fit === undefined ? {} : { fit }),
      ...(provenance === undefined ? {} : { provenance }),
    };
  }

  addIssue(errors, `${path}.type`, 'invalid-value', 'Expected shape, text, or image.');
  return undefined;
}

export function validateMaskGraph(
  layers: readonly CompositionLayer[],
  errors: CompositionIssue[]
): void {
  const byId = new Map(layers.map((layer) => [layer.id, layer]));
  const state = new Map<string, 'visiting' | 'done'>();
  for (const layer of layers) {
    if (!layer.mask) continue;
    if (!byId.has(layer.mask.layerId)) {
      addIssue(
        errors,
        `layers.${layer.id}.mask.layerId`,
        'missing-mask',
        'Mask must refer to an existing layer.'
      );
    } else if (layer.mask.layerId === layer.id) {
      addIssue(
        errors,
        `layers.${layer.id}.mask.layerId`,
        'mask-cycle',
        'A layer cannot mask itself.'
      );
    }
  }
  const visit = (id: string): void => {
    if (state.get(id) === 'done' || errors.length >= COMPOSITION_LIMITS.maxIssues) return;
    if (state.get(id) === 'visiting') {
      addIssue(
        errors,
        `layers.${id}.mask.layerId`,
        'mask-cycle',
        'Mask references must not form a cycle.'
      );
      return;
    }
    state.set(id, 'visiting');
    const layer = byId.get(id);
    const next = layer?.mask?.layerId;
    if (next && byId.has(next)) visit(next);
    state.set(id, 'done');
  };
  for (const layer of layers) visit(layer.id);
}

export function utf8ByteLength(value: string): number {
  return new TextEncoder().encode(value).byteLength;
}

/**
 * Parse untrusted composition data into a fresh, bounded model. Unknown keys,
 * executable CSS values and unsafe image URLs are rejected. The default URL
 * trust is `untrusted`.
 */
export function validateComposition(
  input: unknown,
  options: ValidateCompositionOptions = {}
): CompositionValidation {
  const errors: CompositionIssue[] = [];
  try {
    const trust = options.trust ?? 'untrusted';
    if (trust !== 'developer' && trust !== 'untrusted') {
      addIssue(errors, 'trust', 'invalid-value', 'Trust must be developer or untrusted.');
      return { ok: false, errors };
    }
    if (!isRecord(input)) {
      addIssue(errors, '', 'invalid-input', 'Expected a plain composition object.');
      return { ok: false, errors };
    }
    hasOnlyKeys(input, ['version', 'width', 'height', 'durationMs', 'layers'], '', errors);
    if (input.version !== 1) {
      addIssue(errors, 'version', 'invalid-value', 'Composition version must be 1.');
    }
    const width = finiteNumber(
      input.width,
      'width',
      1,
      COMPOSITION_LIMITS.maxDimension,
      errors,
      true
    );
    const height = finiteNumber(
      input.height,
      'height',
      1,
      COMPOSITION_LIMITS.maxDimension,
      errors,
      true
    );
    const durationMs =
      input.durationMs === undefined
        ? undefined
        : finiteNumber(
            input.durationMs,
            'durationMs',
            0,
            COMPOSITION_LIMITS.maxDurationMs,
            errors,
            true
          );
    const rawLayers = input.layers;
    if (!Array.isArray(rawLayers)) {
      addIssue(errors, 'layers', 'invalid-value', 'Expected a layer array.');
      return { ok: false, errors };
    }
    if (rawLayers.length > COMPOSITION_LIMITS.maxLayers) {
      addIssue(
        errors,
        'layers',
        'limit-exceeded',
        `A composition may have at most ${COMPOSITION_LIMITS.maxLayers} layers.`
      );
      return { ok: false, errors };
    }
    const layers: CompositionLayer[] = [];
    const imageSourceChars = { value: 0 };
    rawLayers.forEach((layer, index) => {
      const parsed = parseCompositionLayer(
        layer,
        `layers[${index}]`,
        trust,
        imageSourceChars,
        errors
      );
      if (parsed) layers.push(parsed);
    });
    const seenIds = new Set<string>();
    for (const [index, layer] of layers.entries()) {
      if (seenIds.has(layer.id))
        addIssue(errors, `layers[${index}].id`, 'duplicate-id', 'Layer ids must be unique.');
      seenIds.add(layer.id);
    }
    if (
      width === undefined ||
      height === undefined ||
      input.version !== 1 ||
      (input.durationMs !== undefined && durationMs === undefined) ||
      layers.length !== rawLayers.length
    ) {
      return { ok: false, errors };
    }
    validateMaskGraph(layers, errors);
    if (errors.length > 0) return { ok: false, errors };

    const composition: Composition = {
      version: 1,
      width,
      height,
      ...(durationMs === undefined ? {} : { durationMs }),
      layers,
    };
    if (utf8ByteLength(JSON.stringify(composition)) > COMPOSITION_LIMITS.maxSerializedBytes) {
      addIssue(
        errors,
        '',
        'limit-exceeded',
        `Composition JSON must be at most ${COMPOSITION_LIMITS.maxSerializedBytes} bytes.`
      );
      return { ok: false, errors };
    }
    return { ok: true, composition };
  } catch {
    addIssue(errors, '', 'invalid-input', 'Composition data could not be safely inspected.');
    return { ok: false, errors };
  }
}
