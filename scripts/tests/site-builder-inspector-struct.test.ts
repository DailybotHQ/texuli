import { describe, expect, it } from 'vitest';
import {
  editList,
  isPlainObject,
  issuesAt,
  matchVariant,
  nextUniqueItem,
  type Path,
  readContainer,
  resolve,
  sampleValue,
  showRaw,
  unknownKeys,
  validate,
  variantLabel,
  withKey,
} from '../../apps/website/src/components/builder/inspector/struct/model.ts';
import {
  chartStructSchema,
  chartSchemaDefinitions as defs,
} from '../../apps/website/src/components/builder/inspector/struct/sources.ts';
import { BUILDER_MANIFESTS } from '../../apps/website/src/components/builder/manifest.ts';

type Schema = Parameters<typeof validate>[0];

/** Every object or array prop the builder edits that has a chart sub-field schema. */
const STRUCT_PROPS = BUILDER_MANIFESTS.flatMap((manifest) =>
  manifest.props
    .filter((prop) => prop.kind === 'object' || prop.kind === 'array')
    .flatMap((prop) => {
      const struct = chartStructSchema(manifest.id, prop.name);
      return struct ? [{ id: manifest.id, name: prop.name, schema: struct.schema }] : [];
    })
);

/** A sample with every optional field filled and two list items, to mutate everywhere. */
function fullSample(schema: Schema, depth = 0): unknown {
  const node = resolve(schema, defs);
  if (depth > 3) return sampleValue(node, defs);
  switch (node.kind) {
    case 'object': {
      const out: Record<string, unknown> = {};
      for (const field of node.properties) out[field.name] = fullSample(field, depth + 1);
      return out;
    }
    case 'array': {
      const max = node.constraints?.maxItems ?? 2;
      const list: unknown[] = [];
      for (let index = 0; index < Math.min(2, max); index += 1) {
        list.push(
          nextUniqueItem(list, fullSample(node.items, depth + 1), node.constraints?.uniqueBy)
        );
      }
      return list;
    }
    case 'record':
      return { first: fullSample(node.values, depth + 1) };
    case 'nullable':
      return fullSample(node.value, depth + 1);
    case 'union':
      return fullSample(node.variants[0] as Schema, depth + 1);
    case 'tuple':
      return node.items.map((item) => fullSample(item, depth + 1));
    default:
      return sampleValue(node, defs);
  }
}

/** Replace the value at `path` (immutably). */
function setPath(value: unknown, path: Path, next: unknown): unknown {
  if (path.length === 0) return next;
  const [head, ...rest] = path;
  if (Array.isArray(value)) {
    return value.map((item, index) => (index === head ? setPath(item, rest, next) : item));
  }
  const base = isPlainObject(value) ? value : {};
  return withKey(base, String(head), setPath(base[String(head)], rest, next));
}

interface Mutation {
  path: Path;
  value: unknown;
  label: string;
}

/** Every targeted break of a sample: unknown keys, missing required, wrong leaf types, list limits. */
function mutations(schema: Schema, value: unknown, path: Path = [], depth = 0): Mutation[] {
  const node = resolve(schema, defs);
  if (depth > 3) return [];
  const out: Mutation[] = [];
  switch (node.kind) {
    case 'object': {
      if (!isPlainObject(value)) return out;
      if (!node.additionalProperties) {
        out.push({ path: [...path, 'zzUnknown'], value: 1, label: 'unknown key' });
      }
      for (const field of node.properties) {
        if (field.required)
          out.push({ path: [...path, field.name], value: undefined, label: 'missing' });
        out.push(...mutations(field, value[field.name], [...path, field.name], depth + 1));
      }
      return out;
    }
    case 'array': {
      if (!Array.isArray(value)) return out;
      value.forEach((item, index) => {
        out.push(...mutations(node.items, item, [...path, index], depth + 1));
      });
      return out;
    }
    case 'record': {
      if (!isPlainObject(value)) return out;
      for (const [key, item] of Object.entries(value)) {
        out.push(...mutations(node.values, item, [...path, key], depth + 1));
      }
      return out;
    }
    case 'nullable':
      return mutations(node.value, value, path, depth);
    case 'string':
      return [{ path, value: 42, label: 'number for text' }];
    case 'number':
      return [{ path, value: 'x', label: 'text for number' }];
    case 'boolean':
      return [{ path, value: 'yes', label: 'text for boolean' }];
    case 'enum':
      return [{ path, value: '__nope__', label: 'outside enum' }];
    default:
      return out;
  }
}

describe('structured props in the builder manifests', () => {
  it('finds a chart sub-field schema for 44 object and array props', () => {
    expect(STRUCT_PROPS).toHaveLength(44);
  });

  it('accepts the generated sample of every schema, minimal and full', () => {
    for (const { id, name, schema } of STRUCT_PROPS) {
      expect(validate(schema, sampleValue(schema, defs), defs), `${id}.${name} minimal`).toEqual(
        []
      );
      expect(validate(schema, fullSample(schema), defs), `${id}.${name} full`).toEqual([]);
    }
  });

  it('flags every targeted break at exactly the broken path', () => {
    let checked = 0;
    for (const { id, name, schema } of STRUCT_PROPS) {
      const sample = fullSample(schema);
      for (const mutation of mutations(schema, sample)) {
        const broken = setPath(sample, mutation.path, mutation.value);
        const issues = validate(schema, broken, defs);
        expect(
          issuesAt(issues, mutation.path).length,
          `${id}.${name} ${mutation.label} at ${mutation.path.join('.')}`
        ).toBeGreaterThan(0);
        checked += 1;
      }
    }
    expect(checked).toBeGreaterThan(300);
  });

  it('enforces list limits and unique keys', () => {
    for (const { id, name, schema } of STRUCT_PROPS) {
      const node = resolve(schema, defs);
      if (node.kind !== 'array') continue;
      const one = sampleValue(node.items, defs);
      const c = node.constraints;
      if (c?.maxItems !== undefined) {
        const over: unknown[] = [];
        for (let index = 0; index <= c.maxItems; index += 1) {
          over.push(nextUniqueItem(over, one, c.uniqueBy));
        }
        expect(issuesAt(validate(node, over, defs), []).length, `${id}.${name} over max`).toBe(1);
      }
      if (c?.uniqueBy && isPlainObject(one)) {
        const twins = [one, one];
        expect(
          issuesAt(validate(node, twins, defs), [1, c.uniqueBy]).length,
          `${id}.${name} dup`
        ).toBe(1);
      }
    }
  });

  it('refuses the wrong container type at the top', () => {
    for (const { id, name, schema } of STRUCT_PROPS) {
      const node = resolve(schema, defs);
      const wrong = node.kind === 'array' ? {} : [];
      expect(issuesAt(validate(schema, wrong, defs), []).length, `${id}.${name}`).toBe(1);
      expect(issuesAt(validate(schema, 'text', defs), []).length).toBe(1);
    }
  });
});

describe('unions, unknown keys and edits', () => {
  it('names and matches union variants by their tags', () => {
    const format = chartStructSchema('charts-gauge', 'format');
    if (!format) throw new Error('charts-gauge.format schema missing');
    const node = resolve(format.schema, defs);
    expect(node.kind).toBe('union');
    if (node.kind !== 'union') return;
    expect(node.variants.map((variant, index) => variantLabel(variant, index))).toEqual([
      'number',
      'date',
    ]);
    expect(matchVariant(node.variants, { type: 'date' }, defs)).toBe(1);
    expect(matchVariant(node.variants, { type: 'number', style: 'percent' }, defs)).toBe(0);
    expect(matchVariant(node.variants, { type: 'weird' }, defs)).toBe(-1);
    expect(
      issuesAt(validate(node, { type: 'number', style: 'loud' }, defs), ['style'])
    ).toHaveLength(1);
  });

  it('lists unknown keys and removes keys immutably', () => {
    const data = chartStructSchema('charts-pie', 'data');
    if (!data) throw new Error('charts-pie.data schema missing');
    const item = resolve(data.schema, defs);
    if (item.kind !== 'array') throw new Error('expected an array');
    const slice = { id: 'a', label: 'A', value: 1, color: 'red' };
    expect(unknownKeys(item.items, slice)).toEqual(['color']);
    const cleaned = withKey(slice, 'color', undefined);
    expect(cleaned).toEqual({ id: 'a', label: 'A', value: 1 });
    expect(slice).toHaveProperty('color');
  });

  it('edits lists within bounds and leaves out-of-range edits alone', () => {
    const list = ['a', 'b', 'c'];
    expect(editList(list, { action: 'move', index: 0, step: 1 })).toEqual(['b', 'a', 'c']);
    expect(editList(list, { action: 'move', index: 0, step: -1 })).toEqual(list);
    expect(editList(list, { action: 'remove', index: 1 })).toEqual(['a', 'c']);
    expect(editList(list, { action: 'set', index: 5, value: 'z' })).toEqual(list);
    expect(editList(list, { action: 'add', value: 'd' })).toEqual(['a', 'b', 'c', 'd']);
    expect(list).toEqual(['a', 'b', 'c']);
    expect(nextUniqueItem([{ id: 'item-2' }], { id: 'x' }, 'id')).toEqual({ id: 'item-3' });
  });

  it('caps recursive trees', () => {
    const root = chartStructSchema('charts-treemap', 'root');
    if (!root) throw new Error('charts-treemap.root schema missing');
    let deep: Record<string, unknown> = { id: 'leaf', value: 1 };
    for (let level = 0; level < 20; level += 1) deep = { id: `n${level}`, children: [deep] };
    expect(
      validate(root.schema, deep, defs).some((issue) => issue.message.includes('levels deep'))
    ).toBe(true);
  });
});

describe('the renderer verdict on the whole prop', () => {
  it('reads unset, kept and refused exactly as sanitizeProps does', () => {
    const manifest = BUILDER_MANIFESTS.find((entry) => entry.id === 'charts-pie');
    const data = manifest?.props.find((prop) => prop.name === 'data');
    const labels = manifest?.props.find((prop) => prop.name === 'labels');
    if (!data || !labels) throw new Error('charts-pie props missing');
    expect(readContainer(data, undefined)).toEqual({ state: 'unset' });
    expect(readContainer(data, [])).toEqual({ state: 'set' });
    // Sub-field breaks are the schema's to flag; the renderer keeps the list.
    expect(readContainer(data, [{ id: 1, color: 'red' }])).toEqual({ state: 'set' });
    for (const wrong of ['oops', {}, 3, null]) {
      expect(readContainer(data, wrong).state, showRaw(wrong)).toBe('invalid');
    }
    for (const wrong of [[], 'oops', null]) {
      expect(readContainer(labels, wrong).state, showRaw(wrong)).toBe('invalid');
    }
    expect(readContainer(labels, {}).state).toBe('set');
  });
});
