/**
 * Block shapes for agents (T-agent-evals, INV-agent-first): what each block
 * type a `blocks-*` component renders looks like, learned from the
 * validator rather than written by hand.
 *
 * The block families validate with hand-written parsers, not schema
 * objects, so there is no schema to re-export. Instead:
 * - the types are the validator's own list (`BLOCK_FAMILY_TYPES`);
 * - the examples are `BLOCK_CATALOG` from `@texuli/blocks/core`, plus, for
 *   the families it has no entry for yet, the fixtures below, keeping only
 *   those that pass the family check and the untrusted sink scan (so every
 *   served example validates in a blueprint); a test holds every type to at
 *   least one;
 * - the shape merges the examples' structure, and a field is required only
 *   when the validator refuses the example without it (asked, not assumed);
 * - an object whose keys are ids declared elsewhere in the block (a table
 *   row keyed by column ids) is shown as a record.
 * The validator stays authoritative: a shape names what the examples and
 * the validator agree on, and `limits` carries the caps.
 */
import { BLOCK_CATALOG } from '@texuli/blocks/core';
import { BLOCK_FAMILY_TYPES } from '@texuli/catalog/render/renderer';
import { scanSinks } from '@texuli/catalog/validate';
import { rawFamilyCheck } from '../internal/family-check.ts';
import { BLOCK_TYPES } from './block-shapes-loader.ts';

/** Authoring notes for one block type. */
export interface BlockTypeInfo {
  type: string;
  /** The `blocks-*` catalog component that renders it. */
  component: string;
  label: string;
  useWhen: readonly string[];
  dontUseWhen: readonly string[];
  limits: readonly string[];
  a11y?: string;
  /** Instances that pass blueprint validation at the untrusted tier, smallest first. */
  examples: readonly Record<string, unknown>[];
  /** Instances the family parser accepts (the shape's source when `examples` is empty). */
  familyExamples: readonly Record<string, unknown>[];
  /** False when no instance passes blueprint validation at the untrusted tier today. */
  usableInBlueprint: boolean;
  /** Why an instance the family parser accepts is refused in a blueprint (the sink scan). */
  notes: readonly string[];
  /** Where the notes come from: the blocks package's catalog, or the fixtures here. */
  source: 'block-catalog' | 'tools-fixture';
}

type Fixture = Pick<BlockTypeInfo, 'type' | 'label' | 'useWhen'> & {
  examples: readonly Record<string, unknown>[];
};

/**
 * Valid examples for the block types `BLOCK_CATALOG` does not describe yet
 * (diagram, embed, interactive and map families), from the families' own
 * test fixtures. Remove an entry when the blocks catalog gains the type.
 */
const FIXTURES: readonly Fixture[] = [
  {
    type: 'flow',
    label: 'Flow diagram',
    useWhen: ['Show a short sequence of steps, optionally looping back.'],
    examples: [
      {
        type: 'flow',
        nodes: [
          { id: 'brief', label: 'Collect brief' },
          { id: 'design', label: 'Design screens', tone: 'info' },
          { id: 'ship', label: 'Ship prototype' },
        ],
        loopBack: true,
      },
    ],
  },
  {
    type: 'tree',
    label: 'Tree diagram',
    useWhen: ['Show a hierarchy such as an org chart.'],
    examples: [
      {
        type: 'tree',
        style: 'org',
        nodes: [
          { id: 'lead', parentId: null, label: 'Example lead' },
          { id: 'eng', parentId: 'lead', label: 'Engineering' },
          { id: 'des', parentId: 'lead', label: 'Design' },
        ],
      },
    ],
  },
  {
    type: 'board',
    label: 'Board diagram',
    useWhen: ['Show work items grouped in columns.'],
    examples: [
      {
        type: 'board',
        columns: [
          {
            id: 'todo',
            title: 'Todo',
            cards: [{ id: 'c1', title: 'Write brief', tone: 'warning' }],
          },
        ],
      },
    ],
  },
  {
    type: 'terminal',
    label: 'Terminal transcript',
    useWhen: ['Show commands and their output as static text.'],
    examples: [
      {
        type: 'terminal',
        lines: [
          { kind: 'prompt', text: 'pnpm build' },
          { kind: 'output', text: 'done' },
          { kind: 'comment', text: '# fictional' },
        ],
      },
    ],
  },
  {
    type: 'embed-app',
    label: 'Embedded app',
    useWhen: ['Embed a small declared app fed by plain data.'],
    examples: [
      {
        type: 'embed-app',
        title: 'Mini status',
        app: { kind: 'app', name: 'status', data: { status: 'Ready' } },
      },
    ],
  },
  {
    type: 'link-preview',
    label: 'Link preview',
    useWhen: ['Point to another page with a title and a short description.'],
    examples: [
      {
        type: 'link-preview',
        href: 'https://example.com/guide',
        title: 'Guide',
        description: 'Read the guide',
      },
    ],
  },
  {
    type: 'poll',
    label: 'Poll',
    useWhen: ['Ask one question with a few labeled options.'],
    examples: [
      {
        type: 'poll',
        id: 'q1',
        question: 'Which fictional harbor is busiest?',
        options: [
          { id: 'north', label: 'North Pier' },
          { id: 'south', label: 'South Basin' },
        ],
      },
    ],
  },
  {
    type: 'quiz',
    label: 'Quiz',
    useWhen: ['Check understanding with questions that have one correct option.'],
    examples: [
      {
        type: 'quiz',
        title: 'Harbor basics',
        questions: [
          {
            id: 'q1',
            prompt: 'What color is the fictional beacon?',
            options: [
              { id: 'red', label: 'Red' },
              { id: 'blue', label: 'Blue' },
            ],
            correctId: 'red',
            explanation: 'The beacon is red in the story.',
          },
        ],
      },
    ],
  },
  {
    type: 'calculator',
    label: 'Calculator',
    useWhen: ['Let a reader change a few numbers and see a computed result.'],
    examples: [
      {
        type: 'calculator',
        title: 'Trip cost',
        inputs: [
          { name: 'hours', label: 'Hours', default: 2, min: 0 },
          { name: 'rate', label: 'Rate (cents/hour)', default: 1500, min: 0 },
        ],
        formula: {
          op: 'mul',
          left: { op: 'var', name: 'hours' },
          right: { op: 'var', name: 'rate' },
        },
        unit: 'cents',
        outputLabel: 'Total',
      },
    ],
  },
  {
    type: 'checklist',
    label: 'Checklist',
    useWhen: ['List steps a reader can tick off locally.'],
    examples: [
      {
        type: 'checklist',
        title: 'Launch checklist',
        items: [
          { id: 'fuel', label: 'Check fuel' },
          { id: 'lines', label: 'Secure lines', done: true },
        ],
      },
    ],
  },
  {
    type: 'map',
    label: 'Map',
    useWhen: ['Place a few labeled points, and optionally a route, on a bundled basemap.'],
    examples: [
      {
        type: 'map',
        id: 'harbor-route',
        label: 'Delivery route across Port Meridian',
        title: 'Morning delivery route',
        basemap: 'port-meridian',
        points: [
          { id: 'depot', label: 'North Pier depot', lng: -18.6, lat: -30.4, tone: 'info' },
          { id: 'market', label: 'Meridian Center market', lng: -19.1, lat: -30.72 },
        ],
        route: ['depot', 'market'],
      },
    ],
  },
];

/** Every block type the validator accepts, with the component that renders it. */
export const BLOCK_TYPE_COMPONENTS: Readonly<Record<string, string>> = Object.freeze(
  Object.fromEntries(
    Object.entries(BLOCK_FAMILY_TYPES).flatMap(([component, types]) =>
      types.map((type) => [type, component])
    )
  )
);

export { BLOCK_TYPES };

/** The authoring notes for every block type the validator accepts, in its order. */
export function blockTypeInfos(): readonly BlockTypeInfo[] {
  return BLOCK_TYPES.map((type) => blockTypeInfo(type) as BlockTypeInfo);
}

/**
 * Split examples into those a blueprint accepts (family check and the
 * untrusted sink scan) and those only the family parser accepts, with the
 * sink scan's reasons for the latter.
 */
function sortExamples(
  examples: readonly unknown[],
  component: string
): Pick<BlockTypeInfo, 'examples' | 'familyExamples' | 'usableInBlueprint' | 'notes'> {
  const family = examples.filter((example) => rawFamilyCheck(example, component).success) as Record<
    string,
    unknown
  >[];
  const served: Record<string, unknown>[] = [];
  const notes = new Set<string>();
  for (const example of family) {
    const findings = scanSinks({ id: component, props: { block: example } }, 'untrusted');
    if (findings.length === 0) served.push(example);
    for (const finding of findings)
      notes.add(
        `blueprint.validate refuses ${finding.message} at ${finding.path.replace(/^tree\.props\./u, '')} (draft sink scan).`
      );
  }
  return {
    examples: served,
    familyExamples: family,
    usableInBlueprint: served.length > 0,
    notes: [...notes],
  };
}

/** The authoring notes of one block type, or undefined when the validator does not accept it. */
export function blockTypeInfo(type: string): BlockTypeInfo | undefined {
  const component = BLOCK_TYPE_COMPONENTS[type];
  if (!component || !Object.hasOwn(BLOCK_TYPE_COMPONENTS, type)) return undefined;
  const entry = BLOCK_CATALOG.find((item) => item.type === type);
  if (entry)
    return {
      type,
      component,
      label: entry.label,
      useWhen: entry.useWhen,
      dontUseWhen: entry.dontUseWhen,
      limits: entry.limits,
      a11y: entry.a11y,
      ...sortExamples([entry.exampleMinimal, entry.exampleRich], component),
      source: 'block-catalog',
    };
  const fixture = FIXTURES.find((item) => item.type === type);
  if (!fixture) return undefined;
  return {
    type,
    component,
    label: fixture.label,
    useWhen: fixture.useWhen,
    dontUseWhen: [],
    limits: [],
    ...sortExamples(fixture.examples, component),
    source: 'tools-fixture',
  };
}

// ---------------------------------------------------------------------------
// Shapes
// ---------------------------------------------------------------------------

/** A block's structure as the examples and the validator describe it. */
export type BlockShape =
  | { kind: 'string' | 'number' | 'boolean' | 'null' }
  | { kind: 'const'; value: string }
  | { kind: 'array'; items: BlockShape | null }
  | { kind: 'object'; fields: Record<string, { shape: BlockShape; required: boolean }> }
  | { kind: 'record'; values: BlockShape }
  /** A nested block of any type (columns, tabs and other containers hold blocks). */
  | { kind: 'block' }
  | { kind: 'union'; options: BlockShape[] };

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** Every string value of an `id` field anywhere in a block. */
function declaredIds(value: unknown, into = new Set<string>()): Set<string> {
  if (Array.isArray(value)) for (const item of value) declaredIds(item, into);
  else if (isRecord(value))
    for (const [key, inner] of Object.entries(value)) {
      if (key === 'id' && typeof inner === 'string') into.add(inner);
      declaredIds(inner, into);
    }
  return into;
}

function sameShape(a: BlockShape, b: BlockShape): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

function union(options: BlockShape[]): BlockShape {
  const flat = options.flatMap((option) => (option.kind === 'union' ? option.options : [option]));
  const unique: BlockShape[] = [];
  for (const option of flat) {
    const same = unique.findIndex((item) => item.kind === option.kind && item.kind !== 'const');
    if (same >= 0) unique[same] = merge(unique[same] as BlockShape, option);
    else if (!unique.some((item) => sameShape(item, option))) unique.push(option);
  }
  return unique.length === 1 ? (unique[0] as BlockShape) : { kind: 'union', options: unique };
}

function merge(a: BlockShape, b: BlockShape): BlockShape {
  if (a.kind === 'object' && b.kind === 'object') {
    const fields: Record<string, { shape: BlockShape; required: boolean }> = {};
    for (const key of new Set([...Object.keys(a.fields), ...Object.keys(b.fields)])) {
      const left = a.fields[key];
      const right = b.fields[key];
      fields[key] =
        left && right
          ? { shape: merge(left.shape, right.shape), required: left.required && right.required }
          : { shape: (left ?? right)?.shape as BlockShape, required: false };
    }
    return { kind: 'object', fields };
  }
  if (a.kind === 'array' && b.kind === 'array') {
    const items = a.items && b.items ? merge(a.items, b.items) : (a.items ?? b.items);
    return { kind: 'array', items };
  }
  if (a.kind === 'record' && b.kind === 'record')
    return { kind: 'record', values: merge(a.values, b.values) };
  if (a.kind === 'const' && b.kind === 'const' && a.value === b.value) return a;
  if (a.kind === b.kind && a.kind !== 'const' && a.kind !== 'union') return a;
  return union([a, b]);
}

/** Set a path in a deep clone of `root` to "deleted" and return the clone. */
function without(root: unknown, path: readonly (string | number)[], key: string): unknown {
  const copy = structuredClone(root) as Record<string, unknown>;
  let node: unknown = copy;
  for (const segment of path) node = (node as Record<string | number, unknown>)[segment];
  delete (node as Record<string, unknown>)[key];
  return copy;
}

/** The shape of one valid example; `required` comes from asking the validator. */
function shapeOf(
  value: unknown,
  path: (string | number)[],
  example: Record<string, unknown>,
  component: string,
  ids: Set<string>
): BlockShape {
  if (value === null) return { kind: 'null' };
  if (typeof value === 'string')
    return path.length === 1 && path[0] === 'type' ? { kind: 'const', value } : { kind: 'string' };
  if (typeof value === 'number') return { kind: 'number' };
  if (typeof value === 'boolean') return { kind: 'boolean' };
  if (Array.isArray(value)) {
    const items = value.map((item, index) =>
      shapeOf(item, [...path, index], example, component, ids)
    );
    return {
      kind: 'array',
      items: items.length === 0 ? null : items.reduce((left, right) => merge(left, right)),
    };
  }
  const record = value as Record<string, unknown>;
  if (path.length > 0 && typeof record.type === 'string' && BLOCK_TYPES.includes(record.type))
    return { kind: 'block' };
  const keys = Object.keys(record);
  if (path.length > 0 && keys.length > 0 && keys.every((key) => ids.has(key) && key !== 'id')) {
    const values = keys.map((key) => shapeOf(record[key], [...path, key], example, component, ids));
    return { kind: 'record', values: union(values) };
  }
  const fields: Record<string, { shape: BlockShape; required: boolean }> = {};
  for (const key of keys) {
    const required =
      path.length === 0 && key === 'type'
        ? true
        : !rawFamilyCheck(without(example, path, key), component).success;
    fields[key] = {
      shape: shapeOf(record[key], [...path, key], example, component, ids),
      required,
    };
  }
  return { kind: 'object', fields };
}

const shapes = new Map<string, BlockShape>();

/** The merged shape of a block type, or undefined for a type the validator does not accept. */
export function blockShape(type: string): BlockShape | undefined {
  const cached = shapes.get(type);
  if (cached) return cached;
  const info = blockTypeInfo(type);
  if (!info) return undefined;
  const sources = info.examples.length > 0 ? info.examples : info.familyExamples;
  if (sources.length === 0) return undefined;
  const shape = sources
    .map((example) => shapeOf(example, [], example, info.component, declaredIds(example)))
    .reduce((left, right) => merge(left, right));
  shapes.set(type, shape);
  return shape;
}

const MAX_TEXT = 600;

/** The compact TypeScript-like text of a shape, e.g. `{ id: string, label: string }[]`. */
export function shapeText(shape: BlockShape | null, depth = 0): string {
  if (shape === null) return 'unknown';
  switch (shape.kind) {
    case 'const':
      return `'${shape.value}'`;
    case 'array': {
      const inner = shapeText(shape.items, depth);
      return shape.items?.kind === 'union' ? `(${inner})[]` : `${inner}[]`;
    }
    case 'record':
      return `{ [id]: ${shapeText(shape.values, depth + 1)} }`;
    case 'block':
      return 'Block';
    case 'union':
      return shape.options.map((option) => shapeText(option, depth)).join(' | ');
    case 'object': {
      if (depth > 3) return '{ … }';
      const fields = Object.entries(shape.fields).map(
        ([key, field]) => `${key}${field.required ? '' : '?'}: ${shapeText(field.shape, depth + 1)}`
      );
      const text = `{ ${fields.join(', ')} }`;
      return text.length > MAX_TEXT ? `${text.slice(0, MAX_TEXT - 3)}… }` : text;
    }
    default:
      return shape.kind;
  }
}

/** The JSON Schema (2020-12 keywords) a shape describes. Derived, not the validator itself. */
export function shapeSchema(shape: BlockShape | null): Record<string, unknown> {
  if (shape === null) return {};
  switch (shape.kind) {
    case 'const':
      return { const: shape.value };
    case 'array':
      return { type: 'array', ...(shape.items ? { items: shapeSchema(shape.items) } : {}) };
    case 'block':
      return {
        type: 'object',
        required: ['type'],
        $comment: 'A nested block of any type: read block.schema for its type.',
      };
    case 'record':
      return {
        type: 'object',
        additionalProperties: shapeSchema(shape.values),
        $comment: 'Keys are ids declared elsewhere in the block (for example the column ids).',
      };
    case 'union': {
      const simple = shape.options.every((option) =>
        ['string', 'number', 'boolean', 'null'].includes(option.kind)
      );
      return simple
        ? { type: shape.options.map((option) => option.kind) }
        : { anyOf: shape.options.map(shapeSchema) };
    }
    case 'object': {
      const required = Object.entries(shape.fields)
        .filter(([, field]) => field.required)
        .map(([key]) => key);
      return {
        type: 'object',
        properties: Object.fromEntries(
          Object.entries(shape.fields).map(([key, field]) => [key, shapeSchema(field.shape)])
        ),
        ...(required.length > 0 ? { required } : {}),
      };
    }
    default:
      return { type: shape.kind };
  }
}

/** The deepest known shape along `path` (indices step into arrays), with how far it got. */
export function shapeAt(
  type: string,
  path: readonly (string | number)[]
): { shape: BlockShape; path: (string | number)[] } | undefined {
  let shape = blockShape(type);
  if (!shape) return undefined;
  const reached: (string | number)[] = [];
  for (const segment of path) {
    let next: BlockShape | null | undefined;
    if (typeof segment === 'number' && shape.kind === 'array') next = shape.items;
    else if (typeof segment === 'string' && shape.kind === 'object')
      next = shape.fields[segment]?.shape;
    else if (shape.kind === 'record') next = shape.values;
    if (!next) break;
    shape = next;
    reached.push(segment);
  }
  return { shape, path: reached };
}

/**
 * The sentence a `block-schema` failure gains: the shape expected at the
 * failing path (or the types the component renders), and where to read more.
 */
export function expectedAt(
  block: unknown,
  component: string,
  path: readonly (string | number)[]
): string | undefined {
  const types = BLOCK_FAMILY_TYPES[component];
  if (!types || !Object.hasOwn(BLOCK_FAMILY_TYPES, component)) return undefined;
  const type = isRecord(block) ? block.type : undefined;
  if (
    typeof type !== 'string' ||
    !types.includes(type) ||
    (path.length === 1 && path[0] === 'type')
  )
    return `Expected type to be one of ${types.map((item) => `'${item}'`).join(' | ')} (block.list lists every type).`;
  const found = shapeAt(type, path);
  if (!found) return undefined;
  const where =
    found.path.length === path.length
      ? ''
      : ` at ${found.path.length === 0 ? 'the block' : found.path.join('.')}`;
  const text = shapeText(found.shape);
  const nested = text === 'Block' ? ', any block type (block.list)' : '';
  return `Expected shape${where}: ${text}${nested}. Read block.schema with type "${type}" for the full shape and examples.`;
}
