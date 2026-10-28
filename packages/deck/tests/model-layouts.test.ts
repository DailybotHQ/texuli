// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  DECK_CATALOG_LAYOUT_IDS,
  DECK_LAYOUT_IDS,
  DECK_LAYOUTS,
  type DeckCatalogLayoutId,
  getDeckLayout,
  isCatalogLayoutId,
  isLayoutId,
  isSteppablePath,
  LAYOUT_PACING,
  layoutPropsSchema,
  layoutSteppablePaths,
  layoutsJsonSchema,
  steppablePattern,
  validateLayoutProps,
} from '../src/model/layouts/index.ts';
import type { PathSegment, Schema, SchemaNode } from '../src/schema/index.ts';

type Json = Record<string, unknown>;

const clone = (id: DeckCatalogLayoutId): Json => structuredClone(DECK_LAYOUTS[id].sample) as Json;

/** A copy of the layout sample with `value` set at `path` (`undefined` deletes). */
function withValue(id: DeckCatalogLayoutId, path: readonly PathSegment[], value: unknown): Json {
  const root = clone(id);
  let node = root as Record<PathSegment, unknown>;
  for (const segment of path.slice(0, -1)) node = node[segment] as Record<PathSegment, unknown>;
  const last = path[path.length - 1] as PathSegment;
  if (value === undefined) delete node[last];
  else node[last] = value;
  return root;
}

const text = (length: number) => 'x'.repeat(length);
const list = <T>(length: number, make: (index: number) => T): T[] =>
  Array.from({ length }, (_, index) => make(index));
const card = (i: number) => ({ heading: `Card ${i}`, body: 'Body text.' });
const row = (width: number) => (i: number) => ({
  label: `Row ${i}`,
  values: list(width, () => 'v'),
});
const media = (length: number) => `https://example.com/${text(length - 20)}`;
const nest = (depth: number): unknown => (depth === 0 ? 1 : { a: nest(depth - 1) });

const codesAt = (result: { issues: { code: string; jsonPath: string }[] }) =>
  result.issues.map((issue) => `${issue.code} ${issue.jsonPath}`);

describe('the layout catalog', () => {
  it('lists the 20 props layouts plus free, frozen, with complete copy', () => {
    expect(DECK_CATALOG_LAYOUT_IDS).toHaveLength(20);
    expect(DECK_LAYOUT_IDS).toEqual([...DECK_CATALOG_LAYOUT_IDS, 'free']);
    expect(Object.keys(DECK_LAYOUTS)).toEqual(DECK_LAYOUT_IDS);
    expect(Object.isFrozen(DECK_LAYOUTS)).toBe(true);
    expect(Object.isFrozen(DECK_LAYOUT_IDS)).toBe(true);
    for (const id of DECK_LAYOUT_IDS) {
      const entry = DECK_LAYOUTS[id];
      expect(entry.id).toBe(id);
      expect(Object.isFrozen(entry), id).toBe(true);
      expect(Object.isFrozen(entry.limits.summary), id).toBe(true);
      for (const field of [entry.label, entry.description])
        expect(field.length, id).toBeGreaterThan(0);
      for (const field of [entry.useWhen, entry.dontUseWhen, entry.pacing, entry.limits.summary]) {
        expect(field.length, id).toBeGreaterThan(0);
      }
      for (const pace of entry.pacing) expect(LAYOUT_PACING).toContain(pace);
      expect(getDeckLayout(id)).toBe(entry);
    }
    expect(() => {
      (DECK_LAYOUTS['title-hero'].sample as Json).title = 'changed';
    }).toThrow(TypeError);
  });

  it('validates every sample, which uses fictional example.com data only', () => {
    for (const id of DECK_CATALOG_LAYOUT_IDS) {
      const result = validateLayoutProps(id, DECK_LAYOUTS[id].sample);
      expect(codesAt(result), id).toEqual([]);
      expect(result.ok, id).toBe(true);
      for (const url of JSON.stringify(DECK_LAYOUTS[id].sample).match(/https?:\/\/[^/"]+/g) ?? []) {
        expect(url, id).toBe('https://example.com');
      }
    }
  });

  it('describes free as a blocks slide kind with no props, sample or steppable paths', () => {
    expect(DECK_LAYOUTS.free).toMatchObject({ kind: 'blocks', props: null, sample: null });
    expect(layoutSteppablePaths('free')).toEqual([]);
    expect(layoutPropsSchema('free')).toBeUndefined();
    const result = validateLayoutProps('free', {}, { path: ['slides', 0, 'props'] });
    expect(codesAt(result)).toEqual(['layout-props $.slides[0].props']);
  });

  it('tells layout ids apart without reaching the prototype', () => {
    for (const id of DECK_LAYOUT_IDS) expect(isLayoutId(id), id).toBe(true);
    expect(isCatalogLayoutId('free')).toBe(false);
    for (const id of ['constructor', '__proto__', 'toString', 'component', 'custom', '', 1, null]) {
      expect(isLayoutId(id), String(id)).toBe(false);
      expect(getDeckLayout(id), String(id)).toBeUndefined();
      expect(layoutPropsSchema(id), String(id)).toBeUndefined();
      expect(layoutSteppablePaths(id), String(id)).toEqual([]);
    }
  });
});

describe('validateLayoutProps', () => {
  it('reports unknown layouts at the sibling layout key, with the id list as the fix', () => {
    for (const id of ['not-a-layout', 'constructor', '__proto__', 42]) {
      const result = validateLayoutProps(id, {}, { path: ['slides', 2, 'props'] });
      expect(result.ok).toBe(false);
      expect(codesAt(result)).toEqual(['unknown-layout $.slides[2].layout']);
      expect(result.issues[0]?.fix).toContain('title-hero');
    }
    const custom = validateLayoutProps('nope', {}, { path: ['x'], layoutPath: ['y'] });
    expect(codesAt(custom)).toEqual(['unknown-layout $.y']);
  });

  it('prefixes every issue with the given path and trims single-line text', () => {
    const result = validateLayoutProps(
      'quote',
      { quote: '  Hello  ', cite: '', extra: 1 },
      { path: ['slides', 1, 'props'] }
    );
    expect(codesAt(result)).toEqual([
      'too-short $.slides[1].props.cite',
      'unknown-key $.slides[1].props.extra',
    ]);
    const ok = validateLayoutProps('quote', { quote: '  Hello  ' });
    expect(ok.ok && ok.value.quote).toBe('Hello');
  });

  it('keeps every limit: the value at the limit passes, one past it fails', () => {
    type Case = [DeckCatalogLayoutId, PathSegment[], unknown, unknown, string];
    const cases: Case[] = [
      ['title-hero', ['title'], text(100), text(101), 'too-long'],
      ['title-hero', ['title'], 'x', '   ', 'too-short'],
      ['title-hero', ['subtitle'], text(160), text(161), 'too-long'],
      ['title-hero', ['meta'], text(160), text(161), 'too-long'],
      ['section-divider', ['title'], text(120), text(121), 'too-long'],
      ['section-divider', ['eyebrow'], text(80), text(81), 'too-long'],
      ['two-column-split', ['title'], text(120), text(121), 'too-long'],
      ['two-column-split', ['left', 'body'], text(600), text(601), 'too-long'],
      ['two-column-split', ['right', 'heading'], text(80), text(81), 'too-long'],
      ['three-column-cards', ['cards'], list(3, card), list(4, card), 'too-many'],
      ['three-column-cards', ['cards'], list(3, card), list(2, card), 'too-few'],
      ['three-column-cards', ['cards', 0, 'heading'], text(80), text(81), 'too-long'],
      ['three-column-cards', ['cards', 1, 'body'], text(280), text(281), 'too-long'],
      ['three-column-cards', ['cards', 2, 'icon'], text(40), text(41), 'too-long'],
      ['image-left', ['body'], text(600), text(601), 'too-long'],
      ['image-left', ['heading'], text(80), text(81), 'too-long'],
      ['image-left', ['image', 'alt'], text(300), text(301), 'too-long'],
      ['image-left', ['image', 'src'], media(512), media(513), 'too-long'],
      ['image-left', ['image', 'src'], 'media/a.png', 'javascript:alert(1)', 'pattern'],
      ['image-right', ['image', 'width'], 4096, 4097, 'out-of-range'],
      ['image-right', ['image', 'height'], 1, 0, 'out-of-range'],
      ['image-right', ['image', 'width'], 640, 640.5, 'not-integer'],
      ['image-centered', ['caption'], text(200), text(201), 'too-long'],
      ['image-full-bleed', ['caption'], text(200), text(201), 'too-long'],
      ['image-full-bleed', ['credit'], text(160), text(161), 'too-long'],
      ['image-full-bleed', ['overlay'], 'light', 'blur', 'enum'],
      ['quote', ['quote'], text(280), text(281), 'too-long'],
      ['quote', ['cite'], text(120), text(121), 'too-long'],
      ['code-with-callout', ['code', 'lang'], text(24), text(25), 'too-long'],
      ['code-with-callout', ['code', 'source'], text(8000), text(8001), 'too-long'],
      [
        'code-with-callout',
        ['code', 'highlights'],
        list(16, () => '1'),
        list(17, () => '1'),
        'too-many',
      ],
      ['code-with-callout', ['code', 'highlights', 0], text(32), text(33), 'too-long'],
      ['code-with-callout', ['bullets'], list(6, () => 'b'), list(7, () => 'b'), 'too-many'],
      ['code-with-callout', ['bullets'], ['b'], [], 'too-few'],
      ['code-with-callout', ['bullets', 0], text(200), text(201), 'too-long'],
      ['big-stat', ['number'], text(32), text(33), 'too-long'],
      ['big-stat', ['label'], text(200), text(201), 'too-long'],
      ['big-stat', ['context'], text(200), text(201), 'too-long'],
      ['big-stat', ['source'], text(160), text(161), 'too-long'],
      ['comparison-table', ['rows'], list(5, row(2)), list(6, row(2)), 'too-many'],
      ['comparison-table', ['rows'], list(3, row(2)), list(2, row(2)), 'too-few'],
      ['comparison-table', ['rows', 0, 'label'], text(80), text(81), 'too-long'],
      ['comparison-table', ['rows', 0, 'values', 0], text(80), text(81), 'too-long'],
      ['comparison-table', ['columns', 0], text(40), text(41), 'too-long'],
      [
        'process-steps',
        ['steps'],
        list(5, (i) => ({ title: `S${i}` })),
        list(6, (i) => ({ title: `S${i}` })),
        'too-many',
      ],
      [
        'process-steps',
        ['steps'],
        list(3, (i) => ({ title: `S${i}` })),
        list(2, (i) => ({ title: `S${i}` })),
        'too-few',
      ],
      ['process-steps', ['steps', 0, 'title'], text(80), text(81), 'too-long'],
      ['process-steps', ['steps', 0, 'body'], text(200), text(201), 'too-long'],
      [
        'timeline',
        ['events'],
        list(8, (i) => ({ time: `${i}`, text: 'e' })),
        list(9, (i) => ({ time: `${i}`, text: 'e' })),
        'too-many',
      ],
      [
        'timeline',
        ['events'],
        list(4, (i) => ({ time: `${i}`, text: 'e' })),
        list(3, (i) => ({ time: `${i}`, text: 'e' })),
        'too-few',
      ],
      ['timeline', ['events', 0, 'time'], text(40), text(41), 'too-long'],
      ['timeline', ['events', 0, 'text'], text(200), text(201), 'too-long'],
      [
        'team-avatars',
        ['people'],
        list(8, (i) => ({ name: `P${i}` })),
        list(9, (i) => ({ name: `P${i}` })),
        'too-many',
      ],
      ['team-avatars', ['people'], list(1, (i) => ({ name: `P${i}` })), [], 'too-few'],
      ['team-avatars', ['people', 0, 'name'], text(80), text(81), 'too-long'],
      ['team-avatars', ['people', 0, 'role'], text(80), text(81), 'too-long'],
      ['team-avatars', ['people', 0, 'avatar'], text(64), text(65), 'too-long'],
      ['closing-cta', ['title'], text(120), text(121), 'too-long'],
      ['closing-cta', ['text'], text(280), text(281), 'too-long'],
      ['closing-cta', ['footnote'], text(160), text(161), 'too-long'],
      ['closing-cta', ['cta', 'label'], text(60), text(61), 'too-long'],
      ['closing-cta', ['cta', 'href'], media(512), media(513), 'too-long'],
      ['closing-cta', ['cta', 'href'], 'mailto:team@example.com', 'javascript:alert(1)', 'pattern'],
      ['video-centered', ['caption'], text(200), text(201), 'too-long'],
      ['video-centered', ['video', 'label'], text(160), text(161), 'too-long'],
      ['video-left', ['body'], text(600), text(601), 'too-long'],
      ['video-right', ['video', 'src'], media(512), media(513), 'too-long'],
      ['chart', ['title'], text(120), text(121), 'too-long'],
      ['chart', ['height'], 'lg', 'xl', 'enum'],
      ['chart', ['spec', 'extra'], nest(5), nest(6), 'too-deep'],
      [
        'chart',
        ['spec', 'series', 0, 'points'],
        list(400, (i) => ({ x: i, y: i })),
        list(401, (i) => ({ x: i, y: i })),
        'too-many',
      ],
      ['chart', ['spec', 'kind'], 'line', undefined, 'layout-props'],
      ['chart', ['spec', 'type'], undefined, 'chart', 'layout-props'],
    ];
    for (const [id, path, at, over, code] of cases) {
      const label = `${id} ${path.join('.')} ${code}`;
      const passing = validateLayoutProps(id, withValue(id, path, at));
      expect(codesAt(passing), label).toEqual([]);
      const failing = validateLayoutProps(id, withValue(id, path, over));
      expect(failing.ok, label).toBe(false);
      expect(
        failing.issues.map((issue) => issue.code),
        label
      ).toContain(code);
    }
  });

  it('refuses a missing required field on every layout', () => {
    const required: [DeckCatalogLayoutId, string][] = [
      ['title-hero', 'title'],
      ['two-column-split', 'left'],
      ['three-column-cards', 'cards'],
      ['image-centered', 'image'],
      ['quote', 'quote'],
      ['code-with-callout', 'bullets'],
      ['big-stat', 'number'],
      ['comparison-table', 'columns'],
      ['closing-cta', 'cta'],
      ['video-left', 'body'],
      ['chart', 'spec'],
    ];
    for (const [id, key] of required) {
      expect(codesAt(validateLayoutProps(id, withValue(id, [key], undefined))), id).toEqual([
        `required $.${key}`,
      ]);
    }
  });

  it('requires one value per column in every comparison row', () => {
    const narrow = withValue('comparison-table', ['rows', 1, 'values'], ['only', 'two']);
    narrow.columns = ['A', 'B', 'C'];
    narrow.rows = (narrow.rows as Json[]).map((r, i) =>
      i === 1 ? r : { ...r, values: ['x', true, null] }
    );
    expect(codesAt(validateLayoutProps('comparison-table', narrow))).toEqual([
      'layout-props $.rows[1].values',
    ]);
    const columns = withValue('comparison-table', ['columns'], ['A']);
    expect(codesAt(validateLayoutProps('comparison-table', columns))).toContain(
      'too-few $.columns'
    );
    const wide = withValue('comparison-table', ['columns'], ['A', 'B', 'C', 'D', 'E']);
    expect(codesAt(validateLayoutProps('comparison-table', wide))).toContain('too-many $.columns');
  });
});

/** Every object schema reachable from a layout's props, with its path pattern. */
function objectPatterns(schema: Schema): [string, boolean][] {
  const out: [string, boolean][] = [];
  const walk = (node: SchemaNode, path: string[]): void => {
    switch (node.kind) {
      case 'object':
        out.push([path.join('.'), Object.hasOwn(node.shape, 'step')]);
        for (const [key, child] of Object.entries(node.shape))
          walk(child as SchemaNode, [...path, key]);
        return;
      case 'array':
        walk(node.item as SchemaNode, [...path, '*']);
        return;
      case 'optional':
      case 'nullable':
      case 'refine':
        walk(node.inner as SchemaNode, path);
        return;
      case 'union':
        for (const option of node.options) walk(option as SchemaNode, path);
        return;
      case 'json':
        out.push([path.join('.'), true]); // the chart spec: step fields checked by its refinement
        return;
      default:
        return;
    }
  };
  walk(schema as SchemaNode, []);
  return out;
}

describe('step markers', () => {
  const marker = { step: 2, fragment: 'fade-up', tone: 'accent' };

  it('declares step fields on exactly the steppable paths of each layout', () => {
    for (const id of DECK_CATALOG_LAYOUT_IDS) {
      const patterns = objectPatterns(DECK_LAYOUTS[id].props);
      const withFields = patterns.filter(([, has]) => has).map(([pattern]) => pattern);
      expect(withFields.sort(), id).toEqual([...layoutSteppablePaths(id)].sort());
      for (const [pattern, has] of patterns) {
        expect(
          isSteppablePath(id, pattern === '' ? [] : pattern.split('.')),
          `${id} ${pattern}`
        ).toBe(has);
      }
    }
  });

  it('accepts a marker on every steppable path', () => {
    for (const id of DECK_CATALOG_LAYOUT_IDS) {
      for (const pattern of layoutSteppablePaths(id)) {
        const props = clone(id);
        const targets: Json[] = [];
        if (pattern === '') targets.push(props);
        else {
          const [key, star] = pattern.split('.') as [string, string | undefined];
          const value = props[key];
          if (star === '*') targets.push(...(value as Json[]));
          else targets.push(value as Json);
        }
        for (const target of targets) Object.assign(target, marker);
        const result = validateLayoutProps(id, props);
        expect(codesAt(result), `${id} ${pattern}`).toEqual([]);
        expect(result.ok && JSON.stringify(result.value).includes('"fade-up"'), id).toBe(true);
      }
    }
  });

  it('refuses markers where nothing reveals and malformed markers on steppable paths', () => {
    const outside: [DeckCatalogLayoutId, PathSegment[], string][] = [
      ['code-with-callout', ['bullets', 0], 'invalid-type $.bullets[0]'],
      ['code-with-callout', ['code', 'highlights', 0], 'invalid-type $.code.highlights[0]'],
      ['comparison-table', ['columns', 0], 'invalid-type $.columns[0]'],
      ['image-left', ['image', 'alt'], 'invalid-type $.image.alt'],
    ];
    for (const [id, path, expected] of outside) {
      const result = validateLayoutProps(id, withValue(id, path, { text: 'x', ...marker }));
      expect(codesAt(result), id).toEqual([expected]);
      expect(isSteppablePath(id, path), id).toBe(false);
    }
    const bad: [DeckCatalogLayoutId, PathSegment[], unknown, string][] = [
      ['quote', ['step'], -1, 'out-of-range $.step'],
      ['quote', ['step'], 1001, 'out-of-range $.step'],
      ['timeline', ['events', 0, 'fragment'], 'spin', 'enum $.events[0].fragment'],
      ['closing-cta', ['cta', 'tone'], 'pink', 'enum $.cta.tone'],
      ['chart', ['spec', 'step'], 'two', 'invalid-type $.spec.step'],
      ['chart', ['spec', 'reveal'], 'spin', 'enum $.spec.reveal'],
    ];
    for (const [id, path, value, expected] of bad) {
      expect(codesAt(validateLayoutProps(id, withValue(id, path, value))), id).toEqual([expected]);
    }
    expect(codesAt(validateLayoutProps('chart', withValue('chart', ['spec', 'step'], 3)))).toEqual(
      []
    );
  });

  it('matches path patterns the way the steps pass reads them', () => {
    expect(steppablePattern([])).toBe('');
    expect(steppablePattern(['cards', 2])).toBe('cards.*');
    expect(isSteppablePath('three-column-cards', ['cards', 0])).toBe(true);
    expect(isSteppablePath('three-column-cards', ['cards'])).toBe(false);
    expect(isSteppablePath('chart', ['spec', 'series', 0])).toBe(false);
    expect(isSteppablePath('unknown', [])).toBe(false);
  });
});

describe('hostile props', () => {
  it('refuses prototype keys, deep JSON, getters and cycles without throwing', () => {
    const proto = JSON.parse('{"quote":"Hi","__proto__":{"polluted":true}}') as unknown;
    const constructorKey = { quote: 'Hi', constructor: { prototype: {} } };
    const deepSpec = withValue('chart', ['spec', 'extra'], nest(200));
    const protoInSpec = withValue('chart', ['spec', 'props'], JSON.parse('{"__proto__":{"x":1}}'));
    const getter = Object.defineProperty({ quote: 'Hi' }, 'cite', {
      enumerable: true,
      get() {
        throw new Error('boom');
      },
    });
    const cycle: Json = { title: 'Loop', left: { body: 'a' } };
    cycle.right = cycle;
    const cases: [string, unknown][] = [
      ['quote', proto],
      ['quote', constructorKey],
      ['chart', deepSpec],
      ['chart', protoInSpec],
      ['quote', getter],
      ['two-column-split', cycle],
      ['quote', 'not an object'],
      ['quote', null],
      ['quote', [1, 2]],
      ['team-avatars', { people: list(100_000, () => ({ name: 'P' })) }],
    ];
    for (const [id, props] of cases) {
      let result: ReturnType<typeof validateLayoutProps> | undefined;
      expect(() => {
        result = validateLayoutProps(id, props);
      }, id).not.toThrow();
      expect(result?.ok, id).toBe(false);
      expect(result?.issues.length, id).toBeGreaterThan(0);
      expect(result?.issues.length ?? 0, id).toBeLessThanOrEqual(200);
    }
    expect(({} as Json).polluted).toBeUndefined();
  });

  it('refuses control and bidi-override characters in single-line text', () => {
    for (const value of ['line\nbreak', 'bidi\u202Eoverride', 'nul\u0000']) {
      expect(codesAt(validateLayoutProps('quote', { quote: value })), value).toEqual([
        'unsafe-text $.quote',
      ]);
    }
    const code = withValue('code-with-callout', ['code', 'source'], 'a\n\tb\n');
    expect(codesAt(validateLayoutProps('code-with-callout', code))).toEqual([]);
  });
});

describe('layoutsJsonSchema', () => {
  it('has a $def per props layout and a root that references each one', () => {
    const doc = layoutsJsonSchema();
    expect(doc.$schema).toBe('https://json-schema.org/draft/2020-12/schema');
    const defs = doc.$defs as Record<string, Record<string, unknown>>;
    for (const id of DECK_CATALOG_LAYOUT_IDS) {
      const def = defs[id];
      expect(def, id).toBeDefined();
      expect(def?.type, id).toBe('object');
      expect(def?.additionalProperties, id).toBe(false);
    }
    expect(defs.free).toBeUndefined();
    const refs = (doc.anyOf as { $ref: string }[]).map((option) => option.$ref);
    expect(refs).toEqual(DECK_CATALOG_LAYOUT_IDS.map((id) => `#/$defs/${id}`));
    const cards = defs['three-column-cards'] as {
      properties: { cards: { minItems: number; maxItems: number } };
      required: string[];
    };
    expect(cards.properties.cards).toMatchObject({ minItems: 3, maxItems: 3 });
    expect(cards.required).toEqual(['cards']);
    expect(String((defs['comparison-table'] as Json).description)).toContain('layout-props');
    expect(() => JSON.stringify(doc)).not.toThrow();
  });
});
