import type {
  Composition,
  CompositionIssue,
  CompositionLayer,
} from '../composition-model/types.ts';
import {
  addIssue,
  COMPOSITION_LIMITS,
  finiteNumber,
  hasOnlyKeys,
  isRecord,
  parseCompositionLayer,
  utf8ByteLength,
  validateComposition,
  validateMaskGraph,
} from '../composition-model/validate.ts';
import type {
  CompositionLayerV2,
  CompositionV2,
  CompositionV2Validation,
  GroupLayer,
  LayerTiming,
  ValidateCompositionV2Options,
} from './types.ts';

export const COMPOSITION_V2_LIMITS = Object.freeze({
  /** Groups and leaves together, across every level. */
  maxNodes: COMPOSITION_LIMITS.maxLayers,
  /** Group nesting depth (a top-level group is depth 1). */
  maxDepth: 8,
});

const ID_PATTERN = /^[a-z][a-z0-9-]{0,63}$/;

interface Window {
  startMs: number;
  endMs: number;
}

interface Context {
  trust: 'developer' | 'untrusted';
  durationMs: number | undefined;
  errors: CompositionIssue[];
  imageSourceChars: { value: number };
  nodes: number;
  ids: Map<string, string>;
  leaves: CompositionLayer[];
}

function parseTiming(
  value: unknown,
  path: string,
  context: Context
): LayerTiming | undefined | null {
  if (value === undefined) return undefined;
  const { errors, durationMs } = context;
  if (durationMs === undefined) {
    addIssue(errors, path, 'missing-field', 'Layer timing needs a composition durationMs.');
    return null;
  }
  if (!isRecord(value)) {
    addIssue(errors, path, 'invalid-value', 'Expected a timing object.');
    return null;
  }
  hasOnlyKeys(value, ['startMs', 'endMs'], path, errors);
  const startMs = finiteNumber(value.startMs, `${path}.startMs`, 0, durationMs - 1, errors, true);
  const endMs =
    value.endMs === undefined
      ? undefined
      : finiteNumber(value.endMs, `${path}.endMs`, 1, durationMs, errors, true);
  if (startMs === undefined || (value.endMs !== undefined && endMs === undefined)) return null;
  if (endMs !== undefined && endMs <= startMs) {
    addIssue(errors, `${path}.endMs`, 'invalid-value', 'endMs must be after startMs.');
    return null;
  }
  return { startMs, ...(endMs === undefined ? {} : { endMs }) };
}

function windowOf(timing: LayerTiming | undefined, parent: Window): Window {
  if (!timing) return parent;
  return {
    startMs: Math.max(parent.startMs, timing.startMs),
    endMs: Math.min(parent.endMs, timing.endMs ?? parent.endMs),
  };
}

function claimId(id: unknown, path: string, context: Context): id is string {
  if (typeof id !== 'string' || !ID_PATTERN.test(id)) {
    addIssue(
      context.errors,
      `${path}.id`,
      'invalid-value',
      'Layer ids must be lowercase kebab-case.'
    );
    return false;
  }
  if (context.ids.has(id)) {
    addIssue(
      context.errors,
      `${path}.id`,
      'duplicate-id',
      'Layer ids must be unique across groups.'
    );
    return false;
  }
  context.ids.set(id, path);
  return true;
}

function parseNode(
  value: unknown,
  path: string,
  depth: number,
  parent: Window,
  context: Context
): CompositionLayerV2 | undefined {
  context.nodes += 1;
  if (context.nodes > COMPOSITION_V2_LIMITS.maxNodes) {
    if (context.nodes === COMPOSITION_V2_LIMITS.maxNodes + 1) {
      addIssue(
        context.errors,
        path,
        'limit-exceeded',
        `A composition may have at most ${COMPOSITION_V2_LIMITS.maxNodes} layers and groups.`
      );
    }
    return undefined;
  }
  if (!isRecord(value)) {
    addIssue(context.errors, path, 'invalid-value', 'Expected a layer object.');
    return undefined;
  }
  const timing = parseTiming(value.timing, `${path}.timing`, context);
  const window = timing ? windowOf(timing, parent) : parent;
  if (timing && window.endMs <= window.startMs) {
    addIssue(
      context.errors,
      `${path}.timing`,
      'invalid-value',
      "The layer's time window never overlaps its group's window."
    );
  }
  if (value.type === 'group') return parseGroup(value, path, depth, window, timing, context);

  const leaf = parseCompositionLayer(
    value,
    path,
    context.trust,
    context.imageSourceChars,
    context.errors,
    ['timing']
  );
  if (!leaf || timing === null || !claimId(leaf.id, path, context)) return undefined;
  context.leaves.push(leaf);
  return timing ? { ...leaf, timing } : leaf;
}

function parseGroup(
  value: Record<string, unknown>,
  path: string,
  depth: number,
  window: Window,
  timing: LayerTiming | undefined | null,
  context: Context
): GroupLayer | undefined {
  const { errors } = context;
  hasOnlyKeys(value, ['id', 'type', 'children', 'offset', 'opacity', 'timing'], path, errors);
  const idOk = claimId(value.id, path, context);
  if (depth > COMPOSITION_V2_LIMITS.maxDepth) {
    addIssue(
      errors,
      path,
      'limit-exceeded',
      `Groups may nest at most ${COMPOSITION_V2_LIMITS.maxDepth} levels.`
    );
    return undefined;
  }
  let offset: { x: number; y: number } | undefined;
  if (value.offset !== undefined) {
    if (!isRecord(value.offset)) {
      addIssue(errors, `${path}.offset`, 'invalid-value', 'Expected an offset object.');
    } else {
      hasOnlyKeys(value.offset, ['x', 'y'], `${path}.offset`, errors);
      const x = finiteNumber(value.offset.x, `${path}.offset.x`, -32_768, 32_768, errors);
      const y = finiteNumber(value.offset.y, `${path}.offset.y`, -32_768, 32_768, errors);
      if (x !== undefined && y !== undefined) offset = { x, y };
    }
  }
  const opacity =
    value.opacity === undefined
      ? undefined
      : finiteNumber(value.opacity, `${path}.opacity`, 0, 1, errors);
  if (!Array.isArray(value.children) || value.children.length === 0) {
    addIssue(errors, `${path}.children`, 'invalid-value', 'A group needs at least one layer.');
    return undefined;
  }
  const children: CompositionLayerV2[] = [];
  value.children.forEach((child, index) => {
    const parsed = parseNode(child, `${path}.children[${index}]`, depth + 1, window, context);
    if (parsed) children.push(parsed);
  });
  if (
    !idOk ||
    timing === null ||
    children.length !== value.children.length ||
    (value.offset !== undefined && offset === undefined) ||
    (value.opacity !== undefined && opacity === undefined)
  ) {
    return undefined;
  }
  return {
    id: value.id as string,
    type: 'group',
    children,
    ...(offset === undefined ? {} : { offset }),
    ...(opacity === undefined ? {} : { opacity }),
    ...(timing === undefined ? {} : { timing }),
  };
}

/**
 * Parse untrusted composition v2 data, or a v1 composition (upgraded with
 * {@link upgradeComposition}), into a fresh, bounded model. Leaves are checked
 * exactly like v1 layers, image sources included; groups, timing, unique ids
 * across groups, nesting depth and node count are checked on top. Masks may
 * only reference leaves. Never throws.
 */
export function validateCompositionV2(
  input: unknown,
  options: ValidateCompositionV2Options = {}
): CompositionV2Validation {
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
    // A v1 document is checked by the unchanged v1 validator: no groups or timing.
    if (input.version === 1) {
      const v1 = validateComposition(input, { trust });
      return v1.ok ? { ok: true, composition: upgradeComposition(v1.composition) } : v1;
    }
    hasOnlyKeys(input, ['version', 'width', 'height', 'durationMs', 'layers'], '', errors);
    if (input.version !== 2) {
      addIssue(errors, 'version', 'invalid-value', 'Composition version must be 1 or 2.');
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
            1,
            COMPOSITION_LIMITS.maxDurationMs,
            errors,
            true
          );
    if (!Array.isArray(input.layers)) {
      addIssue(errors, 'layers', 'invalid-value', 'Expected a layer array.');
      return { ok: false, errors };
    }
    const context: Context = {
      trust,
      durationMs,
      errors,
      imageSourceChars: { value: 0 },
      nodes: 0,
      ids: new Map(),
      leaves: [],
    };
    const root: Window = { startMs: 0, endMs: durationMs ?? Number.POSITIVE_INFINITY };
    const layers: CompositionLayerV2[] = [];
    input.layers.forEach((layer, index) => {
      const parsed = parseNode(layer, `layers[${index}]`, 1, root, context);
      if (parsed) layers.push(parsed);
    });
    if (
      width === undefined ||
      height === undefined ||
      input.version !== 2 ||
      (input.durationMs !== undefined && durationMs === undefined) ||
      layers.length !== input.layers.length ||
      errors.length > 0
    ) {
      return { ok: false, errors };
    }
    // Masks reference leaves by id across groups; a group is never a mask.
    validateMaskGraph(context.leaves, errors);
    if (errors.length > 0) return { ok: false, errors };
    const composition: CompositionV2 = {
      version: 2,
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

/** A validated v1 composition as v2: same layers, no groups or timing. */
export function upgradeComposition(composition: Composition): CompositionV2 {
  return {
    version: 2,
    width: composition.width,
    height: composition.height,
    ...(composition.durationMs === undefined || composition.durationMs === 0
      ? {}
      : { durationMs: composition.durationMs }),
    layers: composition.layers,
  };
}
