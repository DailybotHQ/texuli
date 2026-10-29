/**
 * The canvas schema on the `@texuli/deck/schema` kit: one data description
 * drives validation (every issue at once, bounded work, never a throw) and
 * the JSON Schema export (`schemas/canvas.schema.json` in spec 0.8.0).
 * Untrusted by default: closed vocabularies, no control or bidi characters
 * in text, the caps of `CANVAS_LIMITS`, unique ids, connectors that name
 * existing shapes, and image refs that look like URLs must pass the URL
 * policy at the tier.
 */
import { type HrefTrust, safeImageSrc } from '@texuli/core/url-policy';
import {
  createDiagnostic,
  type DeckDiagnostic,
  type JsonSchema,
  type RefineContext,
  type Schema,
  t,
  toJsonSchema,
  validate,
} from '@texuli/deck/schema';
import {
  CANVAS_ALIGNS,
  CANVAS_ANCHORS,
  CANVAS_CAPS,
  CANVAS_COLORS,
  CANVAS_DASHES,
  CANVAS_FONT_SIZES,
  CANVAS_FORMAT,
  CANVAS_FORMAT_VERSION,
  CANVAS_ID_PATTERN,
  CANVAS_LANG_PATTERN,
  CANVAS_REF_PATTERN,
  CANVAS_ROUTINGS,
  CANVAS_LIMITS as L,
} from './limits.ts';
import type { CanvasDocument, CanvasShape } from './types.ts';

/** The canvas's own diagnostic codes, besides the schema kit's. */
export const CANVAS_CODES = Object.freeze({
  unsupportedFormat: 'unsupported-format',
  unsupportedVersion: 'unsupported-version',
  unknownShape: 'unknown-shape',
  duplicateId: 'duplicate-id',
  unknownEndpoint: 'unknown-endpoint',
  tooManyShapes: 'too-many-shapes',
  tooManyPoints: 'too-many-points',
  tooMuchText: 'too-much-text',
  unsafeUrl: 'unsafe-url',
  invalidInput: 'invalid-input',
} as const);

export type CanvasCode = (typeof CANVAS_CODES)[keyof typeof CANVAS_CODES];

const C = CANVAS_CODES;

/** Ids the sync binding uses for its own nodes. */
export const RESERVED_IDS: readonly string[] = Object.freeze(['root', 'trash', 'tx:connectors']);

const asTuple = <T extends string>(values: readonly T[]) => values as unknown as [T, ...T[]];

function build(trust: HrefTrust): Schema {
  const id = t.string({
    min: 1,
    max: L.id,
    pattern: CANVAS_ID_PATTERN,
    not: RESERVED_IDS,
    description:
      'A persisted id, unique among shapes and connectors (root, trash and tx:connectors are reserved).',
  });
  const coordinate = t.number({ min: -L.coordinate, max: L.coordinate });
  const size = t.number({ min: 0, max: L.size });
  const text = t.string({ max: L.text, text: 'multiline' });
  const color = t.enum(asTuple(CANVAS_COLORS));
  const paint = t.enum(asTuple([...CANVAS_COLORS, 'none'] as const));
  const paintSchema = t.object({
    fill: t.optional(paint),
    stroke: t.optional(paint),
    strokeWidth: t.optional(t.number({ min: 0.5, max: 16 })),
    dash: t.optional(t.enum(asTuple(CANVAS_DASHES))),
    opacity: t.optional(t.number({ min: 0.1, max: 1 })),
  });
  const point = t.array(coordinate, { min: 2, max: 2, description: '[x, y]' });
  const points = (min: number) =>
    t.array(point, {
      min,
      max: L.pathPoints,
      description: 'Points relative to the shape x and y.',
    });
  const boxed = {
    id,
    locked: t.optional(t.boolean()),
    x: coordinate,
    y: coordinate,
    width: size,
    height: size,
    rotation: t.optional(t.number({ min: -360, max: 360 })),
    paint: t.optional(paintSchema),
  };
  const ref = t.refine(t.string({ min: 1, max: L.ref, pattern: CANVAS_REF_PATTERN }), {
    code: C.unsafeUrl,
    description: `A host reference. When it is a URL, it passes safeImageSrc at the ${trust} tier.`,
    check(value, context) {
      if (/^[A-Za-z][A-Za-z0-9+.-]*:/.test(value) && safeImageSrc(value, trust) === undefined)
        context.issue({
          message: `The image ref is refused by the URL policy (${trust} tier).`,
          fix: 'Use a host asset id, or an https: URL.',
        });
    },
  });

  // The lazy node returns one union built below, so validation never rebuilds it.
  let union: Schema<CanvasShape> | undefined;
  const shape: Schema<CanvasShape> = t.lazy(() => union as Schema<CanvasShape>, {
    name: 'shape',
    maxDepth: L.depth + 1,
  }) as Schema<CanvasShape>;
  union = t.union(
    [
      t.object({
        ...boxed,
        type: t.literal('rect'),
        radius: t.optional(size),
        text: t.optional(text),
      }),
      t.object({ ...boxed, type: t.literal('ellipse'), text: t.optional(text) }),
      t.object({ ...boxed, type: t.literal('diamond'), text: t.optional(text) }),
      t.object({ ...boxed, type: t.literal('line'), points: points(2) }),
      t.object({ ...boxed, type: t.literal('arrow'), points: points(2) }),
      t.object({
        ...boxed,
        type: t.literal('path'),
        points: points(1),
        closed: t.optional(t.boolean()),
      }),
      t.object({
        ...boxed,
        type: t.literal('text'),
        text,
        fontSize: t.optional(t.enum(asTuple(CANVAS_FONT_SIZES))),
        align: t.optional(t.enum(asTuple(CANVAS_ALIGNS))),
      }),
      t.object({ ...boxed, type: t.literal('sticky'), text, color: t.optional(color) }),
      t.object({
        ...boxed,
        type: t.literal('image'),
        ref,
        alt: t.string({ min: 1, max: L.alt, text: 'line' }),
      }),
      t.object({
        ...boxed,
        type: t.literal('frame'),
        title: t.optional(t.string({ max: L.title, text: 'line' })),
        children: t.array(shape, { max: L.shapes }),
      }),
      t.object({
        id,
        locked: t.optional(t.boolean()),
        type: t.literal('group'),
        children: t.array(shape, { min: 1, max: L.shapes }),
      }),
    ],
    { discriminator: 'type', code: C.unknownShape }
  ) as Schema<CanvasShape>;

  const endpoint = t.union([
    t.object({ shape: id, anchor: t.optional(t.enum(asTuple(CANVAS_ANCHORS))) }),
    t.object({ x: coordinate, y: coordinate }),
  ]);
  const connector = t.object({
    id,
    from: endpoint,
    to: endpoint,
    routing: t.optional(t.enum(asTuple(CANVAS_ROUTINGS))),
    startCap: t.optional(t.enum(asTuple(CANVAS_CAPS))),
    endCap: t.optional(t.enum(asTuple(CANVAS_CAPS))),
    text: t.optional(t.string({ max: L.text, text: 'multiline' })),
    paint: t.optional(paintSchema),
  });

  const canvas = t.object({
    format: t.literal(CANVAS_FORMAT, { code: C.unsupportedFormat }),
    formatVersion: t.literal(CANVAS_FORMAT_VERSION, { code: C.unsupportedVersion }),
    meta: t.optional(
      t.object({
        title: t.optional(t.string({ max: L.title, text: 'line' })),
        locale: t.optional(t.string({ max: 35, pattern: CANVAS_LANG_PATTERN })),
        description: t.optional(t.string({ max: L.description, text: 'multiline' })),
      })
    ),
    grid: t.optional(t.number({ min: 1, max: 1_000 })),
    shapes: t.array(shape, { max: L.shapes }),
    connectors: t.array(connector, { max: L.connectors }),
  });

  return t.refine(canvas, {
    code: C.duplicateId,
    description:
      'Ids are unique among shapes and connectors; connector ends name existing shapes (not groups); at most 5,000 shapes, 200,000 points and 1,000,000 characters of text in total.',
    check(value, context) {
      checkCanvasRules(value as unknown as CanvasDocument, context);
    },
  });
}

/** The whole-canvas rules: linear in the canvas (iterative walk, one id map). */
function checkCanvasRules(doc: CanvasDocument, context: RefineContext): void {
  const ids = new Map<string, string>();
  let shapes = 0;
  let points = 0;
  let text = 0;
  const stack: { list: CanvasShape[]; path: (string | number)[] }[] = [
    { list: doc.shapes, path: ['shapes'] },
  ];
  while (stack.length > 0) {
    const { list, path } = stack.pop() as { list: CanvasShape[]; path: (string | number)[] };
    for (let index = 0; index < list.length; index += 1) {
      const shape = list[index] as CanvasShape;
      const at = [...path, index];
      shapes += 1;
      if (ids.has(shape.id))
        context.issue({ message: `The id "${shape.id}" is used twice.`, path: [...at, 'id'] });
      ids.set(shape.id, shape.type);
      if ('points' in shape) points += shape.points.length;
      if ('text' in shape && typeof shape.text === 'string') text += shape.text.length;
      if (shape.type === 'frame' || shape.type === 'group')
        stack.push({ list: shape.children, path: [...at, 'children'] });
    }
  }
  if (shapes > L.shapes)
    context.issue({
      code: C.tooManyShapes,
      message: `The canvas holds ${shapes} shapes; at most ${L.shapes}.`,
      path: ['shapes'],
    });
  if (points > L.totalPoints)
    context.issue({
      code: C.tooManyPoints,
      message: `The canvas holds ${points} points; at most ${L.totalPoints}.`,
      path: ['shapes'],
    });
  for (const [index, connector] of doc.connectors.entries()) {
    if (ids.has(connector.id))
      context.issue({
        message: `The id "${connector.id}" is used twice.`,
        path: ['connectors', index, 'id'],
      });
    ids.set(connector.id, 'connector');
    if (typeof connector.text === 'string') text += connector.text.length;
  }
  for (const [index, connector] of doc.connectors.entries()) {
    for (const end of ['from', 'to'] as const) {
      const endpoint = connector[end];
      if (!('shape' in endpoint)) continue;
      const kind = ids.get(endpoint.shape);
      if (kind === undefined || kind === 'connector' || kind === 'group')
        context.issue({
          code: C.unknownEndpoint,
          message: `The connector end "${end}" names no shape it can attach to ("${endpoint.shape}").`,
          path: ['connectors', index, end, 'shape'],
        });
    }
  }
  if (text > L.totalText)
    context.issue({
      code: C.tooMuchText,
      message: `The canvas holds ${text} characters of text; at most ${L.totalText}.`,
      path: [],
    });
}

const schemas = new Map<HrefTrust, Schema>();

/** The canvas schema at a URL tier (built once per tier). */
export function canvasSchema(trust: HrefTrust = 'untrusted'): Schema {
  let schema = schemas.get(trust);
  if (!schema) {
    schema = build(trust);
    schemas.set(trust, schema);
  }
  return schema;
}

export type CanvasDiagnostic = DeckDiagnostic;

export interface ValidateCanvasOptions {
  /** URL tier for image refs that are URLs. Default `untrusted`. */
  trust?: HrefTrust;
  /** Diagnostics kept (default 200). */
  maxIssues?: number;
}

export type CanvasValidation =
  | { ok: true; canvas: CanvasDocument; issues: CanvasDiagnostic[]; truncated: boolean }
  | { ok: false; canvas?: undefined; issues: CanvasDiagnostic[]; truncated: boolean };

/** Values the validator visits at most. */
const MAX_NODES = 2_000_000;

/** Validate a canvas: every issue at once, a fresh copy when valid, never a throw. */
export function validateCanvas(
  input: unknown,
  options: ValidateCanvasOptions = {}
): CanvasValidation {
  const result = validate(canvasSchema(options.trust), input, {
    maxIssues: options.maxIssues,
    maxNodes: MAX_NODES,
    maxDepth: 64,
  });
  if (result.ok)
    return {
      ok: true,
      canvas: result.value as CanvasDocument,
      issues: result.issues,
      truncated: result.truncated,
    };
  return { ok: false, issues: result.issues, truncated: result.truncated };
}

/** True when `input` is a valid canvas at the tier. */
export function isCanvas(
  input: unknown,
  options: ValidateCanvasOptions = {}
): input is CanvasDocument {
  return validateCanvas(input, { ...options, maxIssues: 1 }).ok;
}

export interface LoadCanvasOptions extends ValidateCanvasOptions {
  /** JSON text read before parsing (default `CANVAS_LIMITS.bytes`). */
  maxBytes?: number;
}

function single(message: string, fix: string): CanvasValidation {
  return {
    ok: false,
    issues: [createDiagnostic(C.invalidInput, message, [], { fix })],
    truncated: false,
  };
}

/**
 * Load a canvas from somewhere untrusted (a file, a share link, an agent):
 * JSON text is size-checked before `JSON.parse`, then validated at the tier
 * (`untrusted` by default).
 */
export function loadUntrustedCanvas(
  input: unknown,
  options: LoadCanvasOptions = {}
): CanvasValidation {
  const maxBytes = options.maxBytes ?? L.bytes;
  let value = input;
  if (typeof input === 'string') {
    if (input.length > maxBytes)
      return single(`The canvas is larger than ${maxBytes} bytes.`, 'Split the canvas.');
    try {
      value = JSON.parse(input);
    } catch {
      return single('The canvas is not valid JSON.', 'Pass JSON text or plain JSON data.');
    }
  }
  return validateCanvas(value, options);
}

/** The JSON Schema 2020-12 of the canvas format (untrusted tier), pinned by spec 0.8.0. */
export function canvasJsonSchema(): JsonSchema {
  return toJsonSchema(canvasSchema('untrusted'), {
    $id: 'https://texuli.com/schemas/canvas.schema.json',
    title: 'Texuli canvas',
    description:
      'A Texuli infinite canvas, format version 1: shapes, frames, groups and connectors.',
  });
}
