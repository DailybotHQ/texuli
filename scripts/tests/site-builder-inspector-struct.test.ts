import { flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, it } from 'vitest';
import {
  fieldFamily,
  unsupportedReason,
} from '../../apps/website/src/components/builder/inspector/coverage.ts';
import JsonField from '../../apps/website/src/components/builder/inspector/json/JsonField.svelte';
import {
  jsonIssues,
  parseJsonDraft,
  propExamples,
  schemaCheck,
} from '../../apps/website/src/components/builder/inspector/json/model.ts';
import { stringRule } from '../../apps/website/src/components/builder/inspector/string/model.ts';
import StringField from '../../apps/website/src/components/builder/inspector/string/StringField.svelte';
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
import { inspectorFields } from '../../apps/website/src/components/builder/model.ts';

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

const manifestOf = (id: string) => {
  const manifest = BUILDER_MANIFESTS.find((candidate) => candidate.id === id);
  if (!manifest) throw new Error(`${id} missing`);
  return manifest;
};
const propOn = (id: string, name: string) => {
  const prop = manifestOf(id).props.find((candidate) => candidate.name === name);
  if (!prop) throw new Error(`${id}.${name} missing`);
  return prop;
};

describe('JSON props checked against the component schemas (PLAN_005 task 5)', () => {
  it('checks every content block family the inspector edits as JSON with that family’s own check', () => {
    for (const manifest of BUILDER_MANIFESTS.filter((m) => m.id.startsWith('blocks-'))) {
      const block = manifest.props.find((prop) => prop.name === 'block');
      if (!block) continue;
      const family = fieldFamily(manifest.id, block);
      if (family !== 'json') {
        // Text and media blocks have structured editors instead.
        expect(['text-block', 'media-block']).toContain(family);
        continue;
      }
      const check = schemaCheck(manifest.id, 'block');
      expect(check, manifest.id).toBeDefined();
      // The manifest's own example passes; a block of another family does not.
      const examples = propExamples(manifest, 'block');
      expect(examples.length, manifest.id).toBeGreaterThan(0);
      for (const example of examples) {
        expect(jsonIssues(block, example.value, check), `${manifest.id} ${example.title}`).toEqual(
          []
        );
      }
      const foreign = jsonIssues(block, { type: 'heading', level: 2, text: 'Elsewhere' }, check);
      expect(foreign.length, manifest.id).toBeGreaterThan(0);
    }
  });

  it('names where a block goes wrong', () => {
    const block = propOn('blocks-code', 'block');
    const issues = jsonIssues(
      block,
      { type: 'code', code: 42 },
      schemaCheck('blocks-code', 'block')
    );
    expect(issues.length).toBeGreaterThan(0);
    expect(issues.some((issue) => issue.at.startsWith('$'))).toBe(true);
  });

  it('validates compositions at the untrusted tier, so an unsafe image source is reported', () => {
    const composition = propOn('media-composition-svg', 'composition');
    const check = schemaCheck('media-composition-svg', 'composition');
    expect(check?.source).toContain('untrusted');
    const valid = { version: 1, width: 320, height: 180, layers: [] };
    expect(jsonIssues(composition, valid, check)).toEqual([]);
    const safe = {
      ...valid,
      layers: [
        {
          id: 'a',
          type: 'image',
          frame: { x: 0, y: 0, width: 100, height: 80 },
          src: '/assets/fictional.webp',
          alt: 'Fictional image',
        },
      ],
    };
    expect(jsonIssues(composition, safe, check)).toEqual([]);
    const unsafe = {
      ...valid,
      layers: [
        {
          id: 'a',
          type: 'image',
          frame: { x: 0, y: 0, width: 100, height: 80 },
          src: 'javascript:alert(1)',
          alt: 'Fictional image',
        },
      ],
    };
    const issues = jsonIssues(composition, unsafe, check);
    expect(
      issues.map((issue) => issue.at),
      JSON.stringify(issues)
    ).toContain('$.layers[0].src');
    expect(jsonIssues(composition, { version: 2 }, check)[0]?.at).toBe('$.version');
  });

  it('falls back to the renderer’s kind rule where no schema is published, and parses drafts', () => {
    const labels = propOn('blocks-code', 'labels');
    expect(schemaCheck('blocks-code', 'labels')).toBeUndefined();
    expect(jsonIssues(labels, { copy: 'Copy code' })).toEqual([]);
    expect(jsonIssues(labels, ['not', 'an', 'object'])[0]?.message).toContain('refused at paint');
    expect(parseJsonDraft('{"a":1}')).toEqual({ ok: true, value: { a: 1 } });
    expect(parseJsonDraft('   ')).toEqual({ ok: true, value: undefined });
    expect(parseJsonDraft('{a:1}').ok).toBe(false);
  });
});

describe('props the inspector does not offer, with the reason', () => {
  it('leaves out chart props the catalog types as text but the chart reads as another kind', () => {
    const hidden = BUILDER_MANIFESTS.flatMap((manifest) =>
      inspectorFields(manifest.props)
        .filter((prop) => unsupportedReason(manifest.id, prop))
        .map((prop) => `${manifest.id}.${prop.name}`)
    );
    expect(hidden).toContain('charts-line.interactive');
    expect(hidden).toContain('charts-line.fullDomain');
    expect(hidden).toContain('charts-line.annotations');
    expect(hidden).toContain('charts-pie.innerRatio');
    expect(hidden).toContain('charts-cartesian.interactive');
    expect(hidden).toHaveLength(36);
    expect(unsupportedReason('charts-line', propOn('charts-line', 'interactive'))).toBe(
      'The catalog accepts only text here, but the LineChart chart reads a true or false value, so no blueprint value works yet.'
    );
    // Text the chart really reads as text stays editable.
    expect(unsupportedReason('charts-line', propOn('charts-line', 'title'))).toBeUndefined();
    expect(unsupportedReason('media-image', propOn('media-image', 'alt'))).toBeUndefined();
  });
});

describe('the text and JSON field components', () => {
  let app: ReturnType<typeof mount> | undefined;
  afterEach(() => {
    if (app) unmount(app);
    app = undefined;
    document.body.replaceChildren();
  });
  const host = () => {
    const target = document.createElement('div');
    document.body.append(target);
    return target;
  };

  it('a text field shows the player rule and flags a value it would ignore', () => {
    const target = host();
    const changes: unknown[] = [];
    app = mount(StringField, {
      target,
      props: {
        prop: propOn('layout-grid', 'gap') as never,
        value: '1 rem',
        rule: stringRule('layout-grid', 'gap'),
        onchange: (next: unknown) => changes.push(next),
      },
    });
    flushSync();
    const input = target.querySelector('input');
    expect(target.textContent).toContain('player grid layout');
    expect(target.querySelector('[data-severity="warning"]')?.textContent).toContain(
      'ignores this gap'
    );
    if (!input) throw new Error('no input');
    input.value = '';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    expect(changes).toEqual([undefined]);
  });

  it('a JSON field reports parse errors without saving, saves on blur, and seeds from an example', () => {
    const target = host();
    const changes: unknown[] = [];
    const block = propOn('blocks-code', 'block');
    app = mount(JsonField, {
      target,
      props: {
        prop: block,
        value: undefined,
        check: schemaCheck('blocks-code', 'block'),
        examples: propExamples(manifestOf('blocks-code'), 'block'),
        onchange: (next: unknown) => changes.push(next),
      },
    });
    flushSync();
    const textarea = target.querySelector('textarea');
    if (!textarea) throw new Error('no textarea');
    textarea.value = '{"type": "code",';
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
    flushSync();
    expect(target.querySelector('[data-json-issues]')?.textContent).toContain('Not valid JSON');
    textarea.dispatchEvent(new FocusEvent('blur'));
    expect(changes).toEqual([]);
    textarea.value = '{"type": "code", "code": 42}';
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
    flushSync();
    expect(target.querySelector('[data-json-issues] li')).not.toBeNull();
    textarea.dispatchEvent(new FocusEvent('blur'));
    expect(changes).toEqual([{ type: 'code', code: 42 }]);
    const example = [...target.querySelectorAll('button')].find((button) =>
      button.textContent?.startsWith('Use example')
    );
    example?.click();
    expect(changes[1]).toEqual({ type: 'code', code: 'n = 1' });
  });
});
