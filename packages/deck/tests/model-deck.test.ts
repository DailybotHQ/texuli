// @vitest-environment node
import { describe, expect, it } from 'vitest';
import * as root from '../src/index.ts';
import {
  BLOCK_JSON_LIMITS,
  DECK_CATALOG_LAYOUT_IDS,
  DECK_CODES,
  DECK_LAYOUTS,
  DECK_MODEL_LIMITS,
  DECK_SLIDE_LAYOUTS,
  deckJsonSchema,
  isDeckCode,
  parseDeck,
  resolveDeckTransition,
  resolveSlideTransition,
  SLIDE_MASTERS,
  stripStepFields,
} from '../src/model/index.ts';
import { type DeckDiagnostic, JSON_SCHEMA_DIALECT } from '../src/schema/index.ts';

type Json = Record<string, unknown>;

const text = (length: number) => 'x'.repeat(length);

/** A deck with one slide of every catalog layout plus free, component and custom slides. */
function everyKindDeck(): Json {
  const slides: Json[] = DECK_CATALOG_LAYOUT_IDS.map((id) => ({
    id: `s-${id}`,
    layout: id,
    props: structuredClone(DECK_LAYOUTS[id].sample),
  }));
  slides.push(
    {
      id: 'free',
      layout: 'free',
      master: 'two-column',
      title: 'Free slide',
      notes: 'Line one.\nLine two.',
      blocks: [
        { type: 'heading', level: 2, text: 'Hello', id: 'hello' },
        { type: 'list', step: 1, reveal: 'fade', items: [{ text: 'a' }, { text: 'b' }] },
        {
          type: 'columns',
          columns: [[{ type: 'text', markdown: 'Left', step: 3, fragment: 'grow' }], []],
        },
        { type: 'component', component: 'charts-bar', props: { title: 'Bars' }, height: 'md' },
      ],
    },
    {
      id: 'whole',
      layout: 'component',
      component: { component: 'data-grid', props: { rows: [] } },
    },
    {
      id: 'host',
      layout: 'custom',
      props: { component: 'pricing-calc', data: { tier: 'pro' } },
      steps: ['One', 'Two'],
    }
  );
  return {
    formatVersion: 2,
    meta: {
      title: 'Every kind',
      locale: 'en-GB',
      dir: 'ltr',
      author: 'Example Co.',
      date: '2026-10-27',
    },
    style: { theme: 'graphite', aspect: '9:16', transition: 'fade-up' },
    navigation: { start: 'free', loop: true, autoSlideMs: 5000 },
    outline: {
      title: 'Outline',
      sections: [
        { id: 'layouts', slideIds: slides.slice(0, 20).map((s) => s.id as string) },
        { id: 'kinds', slideIds: ['free', 'whole', 'host'], stack: true },
      ],
    },
    slides,
  };
}

function minimal(slides: Json[] = [{ id: 'one', layout: 'quote', props: { quote: 'Hi.' } }]): Json {
  return { formatVersion: 2, meta: { title: 'Deck' }, slides };
}

const codes = (issues: readonly DeckDiagnostic[]) => issues.map((issue) => issue.code);
const at = (issues: readonly DeckDiagnostic[], code: string) =>
  issues.filter((issue) => issue.code === code).map((issue) => issue.pointer);

describe('parseDeck: slide kinds', () => {
  it('accepts a deck with every slide kind, with steps per slide', () => {
    const result = parseDeck(everyKindDeck());
    expect(result.issues).toEqual([]);
    expect(result.ok).toBe(true);
    expect(result.deck?.slides).toHaveLength(23);
    expect(result.steps).toHaveLength(23);
    const free = result.steps[20];
    // list items at 1 and 2, the nested text at 3
    expect(free?.count).toBe(3);
    expect(result.steps[22]?.count).toBe(2); // custom: labels only
  });

  it('refuses every catalog layout with broken props, at the props path', () => {
    for (const id of DECK_CATALOG_LAYOUT_IDS) {
      const result = parseDeck(minimal([{ id: 'one', layout: id, props: { bogus: true } }]));
      expect(result.ok, id).toBe(false);
      expect(at(result.issues, 'unknown-key'), id).toContain('/slides/0/props/bogus');
    }
  });

  it('reports one unknown-layout issue for an unknown layout, listing the ids', () => {
    const result = parseDeck(minimal([{ id: 'one', layout: 'hero', props: {} }]));
    expect(codes(result.issues)).toEqual(['unknown-layout']);
    expect(result.issues[0]?.pointer).toBe('/slides/0/layout');
    for (const id of DECK_SLIDE_LAYOUTS) expect(result.issues[0]?.fix).toContain(id);
  });

  it('checks free slides: master, block count, block heads and component items', () => {
    const cases: [Json, string, string][] = [
      [{ master: 'hero', blocks: [{ type: 'text' }] }, 'enum', '/slides/0/master'],
      [{ blocks: [] }, 'too-few', '/slides/0/blocks'],
      [{ blocks: [{ type: 'Text' }] }, 'pattern', '/slides/0/blocks/0/type'],
      [{ blocks: [{ markdown: 'no type' }] }, 'required', '/slides/0/blocks/0/type'],
      [{ blocks: ['text'] }, 'invalid-block', '/slides/0/blocks/0'],
      [{ blocks: [{ type: 'text', id: 'Bad Id' }] }, 'pattern', '/slides/0/blocks/0/id'],
      [{ blocks: [{ type: 'text', step: 1001 }] }, 'out-of-range', '/slides/0/blocks/0/step'],
      [{ blocks: [{ type: 'text', fragment: 'spin' }] }, 'enum', '/slides/0/blocks/0/fragment'],
      [{ blocks: [{ type: 'text', tone: 'red' }] }, 'enum', '/slides/0/blocks/0/tone'],
      [
        { blocks: [{ type: 'grid', blocks: [{ type: 'text', step: -1 }] }] },
        'out-of-range',
        '/slides/0/blocks/0/blocks/0/step',
      ],
      [
        { blocks: [{ type: 'tabs', panels: [{ blocks: [{ type: 7 }] }] }] },
        'invalid-type',
        '/slides/0/blocks/0/panels/0/blocks/0/type',
      ],
      [
        { blocks: [{ type: 'component', component: 'charts-bar', props: {}, extra: 1 }] },
        'unknown-key',
        '/slides/0/blocks/0/extra',
      ],
      [
        { blocks: [{ type: 'component', component: 'charts-bar', props: [] }] },
        'invalid-type',
        '/slides/0/blocks/0/props',
      ],
      [
        { blocks: [{ type: 'component', component: 'charts-bar', props: {}, height: 'xl' }] },
        'enum',
        '/slides/0/blocks/0/height',
      ],
    ];
    for (const [fields, code, pointer] of cases) {
      const result = parseDeck(minimal([{ id: 'one', layout: 'free', ...fields }]));
      expect(result.ok, JSON.stringify(fields)).toBe(false);
      expect(at(result.issues, code), JSON.stringify(fields)).toContain(pointer);
    }
    for (const master of SLIDE_MASTERS) {
      expect(
        parseDeck(minimal([{ id: 'one', layout: 'free', master, blocks: [{ type: 'text' }] }])).ok
      ).toBe(true);
    }
  });

  it('accepts free blocks at the limit and refuses past it', () => {
    const blocks = (n: number) =>
      Array.from({ length: n }, () => ({ type: 'text', markdown: 'x' }));
    expect(parseDeck(minimal([{ id: 'one', layout: 'free', blocks: blocks(2000) }])).ok).toBe(true);
    const over = parseDeck(minimal([{ id: 'one', layout: 'free', blocks: blocks(2001) }]));
    expect(at(over.issues, 'too-many')).toContain('/slides/0/blocks');
    const deep = { type: 'grid', blocks: [] as unknown[] };
    let node = deep;
    for (let i = 0; i < BLOCK_JSON_LIMITS.depth; i++) {
      const child = { type: 'grid', blocks: [] as unknown[] };
      node.blocks.push(child);
      node = child;
    }
    expect(
      codes(parseDeck(minimal([{ id: 'one', layout: 'free', blocks: [deep] }])).issues)
    ).toContain('too-deep');
  });

  it('checks component and custom slides', () => {
    const bad = parseDeck(
      minimal([
        { id: 'a', layout: 'component', component: { component: 'Data Grid', props: {} } },
        { id: 'b', layout: 'component', component: { component: 'data-grid' } },
        { id: 'c', layout: 'custom', props: { data: {} } },
        { id: 'd', layout: 'custom', props: { component: 'calc', data: 'x' } },
      ])
    );
    expect(at(bad.issues, 'pattern')).toContain('/slides/0/component/component');
    expect(at(bad.issues, 'required')).toEqual([
      '/slides/1/component/props',
      '/slides/2/props/component',
    ]);
    expect(at(bad.issues, 'invalid-type')).toContain('/slides/3/props/data');
  });

  it('enforces the slide base fields and their limits', () => {
    const slide = (fields: Json) =>
      minimal([{ id: 'one', layout: 'quote', props: { quote: 'Q' }, ...fields }]);
    expect(parseDeck(slide({ notes: text(6000) })).ok).toBe(true);
    expect(at(parseDeck(slide({ notes: text(6001) })).issues, 'too-long')).toEqual([
      '/slides/0/notes',
    ]);
    expect(parseDeck(slide({ notes: 'a\nb\tc' })).ok).toBe(true);
    expect(at(parseDeck(slide({ notes: 'a‮b' })).issues, 'unsafe-text')).toEqual([
      '/slides/0/notes',
    ]);
    expect(at(parseDeck(slide({ title: text(201) })).issues, 'too-long')).toEqual([
      '/slides/0/title',
    ]);
    expect(at(parseDeck(slide({ title: 'a\nb' })).issues, 'unsafe-text')).toEqual([
      '/slides/0/title',
    ]);
    expect(parseDeck(slide({ steps: Array.from({ length: 32 }, () => 'go') })).ok).toBe(true);
    expect(
      at(parseDeck(slide({ steps: Array.from({ length: 33 }, () => 'go') })).issues, 'too-many')
    ).toEqual(['/slides/0/steps']);
    expect(at(parseDeck(slide({ steps: [text(81)] })).issues, 'too-long')).toEqual([
      '/slides/0/steps/0',
    ]);
    expect(at(parseDeck(slide({ transition: 'spin' })).issues, 'enum')).toEqual([
      '/slides/0/transition',
    ]);
    expect(at(parseDeck(slide({ background: 'neon' })).issues, 'unknown-background')).toEqual([
      '/slides/0/background',
    ]);
    expect(
      parseDeck(
        slide({ background: { kind: 'solid', color: '#123abc' }, theme: { kind: 'seed', seed: 7 } })
      ).ok
    ).toBe(true);
    expect(at(parseDeck(slide({ id: 'Bad' })).issues, 'pattern')).toEqual(['/slides/0/id']);
    expect(parseDeck(slide({ id: text(64) })).ok).toBe(true);
    expect(codes(parseDeck(slide({ id: text(65) })).issues)).toContain('too-long');
  });

  it('enforces meta, navigation, version and slide count limits', () => {
    const deck = (patch: Json) => ({ ...minimal(), ...patch });
    expect(at(parseDeck(deck({ formatVersion: 1 })).issues, 'unsupported-version')).toEqual([
      '/formatVersion',
    ]);
    expect(at(parseDeck(deck({ meta: { title: '   ' } })).issues, 'too-short')).toEqual([
      '/meta/title',
    ]);
    expect(parseDeck(deck({ meta: { title: text(200) } })).ok).toBe(true);
    expect(at(parseDeck(deck({ meta: { title: text(201) } })).issues, 'too-long')).toEqual([
      '/meta/title',
    ]);
    expect(
      at(parseDeck(deck({ meta: { title: 'T', locale: 'english!' } })).issues, 'pattern')
    ).toEqual(['/meta/locale']);
    expect(
      at(parseDeck(deck({ meta: { title: 'T', date: '2026-13-01' } })).issues, 'pattern')
    ).toEqual(['/meta/date']);
    expect(at(parseDeck(deck({ meta: { title: 'T', dir: 'up' } })).issues, 'enum')).toEqual([
      '/meta/dir',
    ]);
    for (const ms of [0, 1000, 600000]) {
      expect(parseDeck(deck({ navigation: { autoSlideMs: ms } })).ok, String(ms)).toBe(true);
    }
    for (const ms of [1, 999, 600001, 1.5]) {
      expect(parseDeck(deck({ navigation: { autoSlideMs: ms } })).ok, String(ms)).toBe(false);
    }
    const slides = (n: number) =>
      Array.from({ length: n }, (_, i) => ({
        id: `s${i}`,
        layout: 'quote',
        props: { quote: 'Q' },
      }));
    expect(parseDeck(minimal(slides(DECK_MODEL_LIMITS.slides))).ok).toBe(true);
    expect(at(parseDeck(minimal(slides(201))).issues, 'too-many')).toEqual(['/slides']);
    expect(at(parseDeck(minimal([])).issues, 'too-few')).toEqual(['/slides']);
    expect(codes(parseDeck('deck').issues)).toEqual(['invalid-type']);
  });
});

describe('parseDeck: cross-field rules', () => {
  const quote = (id: string, extra: Json = {}) => ({
    id,
    layout: 'quote',
    props: { quote: 'Q' },
    ...extra,
  });

  it('requires unique slide, section and block ids', () => {
    const result = parseDeck({
      ...minimal([
        quote('a'),
        quote('a'),
        { id: 'f1', layout: 'free', blocks: [{ type: 'text', id: 'dup' }] },
        {
          id: 'f2',
          layout: 'free',
          blocks: [
            { type: 'grid', blocks: [{ type: 'text', id: 'dup' }] },
            { type: 'component', id: 'dup', component: 'x', props: {} },
          ],
        },
      ]),
      outline: {
        sections: [
          { id: 'one', slideIds: ['a'] },
          { id: 'one', slideIds: ['f1'] },
        ],
      },
    });
    expect(at(result.issues, 'duplicate-id')).toEqual(['/slides/1/id', '/outline/sections/1/id']);
    expect(at(result.issues, 'duplicate-block-id')).toEqual([
      '/slides/3/blocks/0/blocks/0/id',
      '/slides/3/blocks/1/id',
    ]);
    expect(result.issues.find((issue) => issue.code === 'duplicate-block-id')?.slideId).toBe('f2');
  });

  it('checks sections: known slides, one section per slide, contiguous stacks', () => {
    const result = parseDeck({
      ...minimal([quote('a'), quote('b'), quote('c'), quote('d')]),
      outline: {
        sections: [
          { id: 'one', slideIds: ['a', 'ghost', 'a'] },
          { id: 'two', slideIds: ['a', 'b'] },
          { id: 'three', slideIds: ['b', 'd'], stack: true },
          { id: 'four', slideIds: ['c', 'd'], stack: true },
        ],
      },
    });
    expect(at(result.issues, 'unknown-slide')).toEqual(['/outline/sections/0/slideIds/1']);
    expect(at(result.issues, 'duplicate-id')).toEqual(['/outline/sections/0/slideIds/2']);
    expect(at(result.issues, 'section-overlap')).toEqual([
      '/outline/sections/1/slideIds/0',
      '/outline/sections/2/slideIds/0',
      '/outline/sections/3/slideIds/1',
    ]);
    expect(at(result.issues, 'stack-not-contiguous')).toEqual(['/outline/sections/2/slideIds']);
  });

  it('checks navigation.start and hidden slides', () => {
    const unknown = parseDeck({ ...minimal([quote('a')]), navigation: { start: 'ghost' } });
    expect(at(unknown.issues, 'unknown-slide')).toEqual(['/navigation/start']);
    const hidden = parseDeck({
      ...minimal([quote('a'), quote('b', { hidden: true })]),
      navigation: { start: 'b' },
    });
    expect(at(hidden.issues, 'start-hidden')).toEqual(['/navigation/start']);
    const all = parseDeck(minimal([quote('a', { hidden: true }), quote('b', { hidden: true })]));
    expect(at(all.issues, 'all-hidden')).toEqual(['/slides']);
    expect(parseDeck(minimal([quote('a'), quote('b', { hidden: true })])).ok).toBe(true);
  });

  it('runs the steps pass: dense renumbering, fragment conflicts, more than 32 steps', () => {
    const ok = parseDeck(
      minimal([
        {
          id: 'a',
          layout: 'free',
          blocks: [
            { type: 'text', step: 2 },
            { type: 'text', step: 9 },
          ],
        },
        {
          id: 'b',
          layout: 'process-steps',
          props: { steps: [{ title: 'A', step: 1 }, { title: 'B', step: 4 }, { title: 'C' }] },
        },
      ])
    );
    expect(ok.ok).toBe(true);
    expect(ok.steps.map((steps) => steps.count)).toEqual([2, 2]);
    const conflict = parseDeck(
      minimal([
        {
          id: 'a',
          layout: 'free',
          blocks: [{ type: 'text', step: 1, fragment: 'in', reveal: 'fade' }],
        },
      ])
    );
    expect(at(conflict.issues, 'fragment-conflict')).toEqual(['/slides/0/blocks/0/reveal']);
    const steps = (n: number) =>
      Array.from({ length: n }, (_, i) => ({ type: 'text', step: i + 1 }));
    expect(parseDeck(minimal([{ id: 'a', layout: 'free', blocks: steps(32) }])).ok).toBe(true);
    const over = parseDeck(minimal([{ id: 'a', layout: 'free', blocks: steps(33) }]));
    expect(at(over.issues, 'too-many-steps')).toEqual(['/slides/0/blocks/32']);
    expect(over.issues[0]?.slideId).toBe('a');
  });

  it('runs the host hooks with absolute paths and step fields removed', () => {
    const seen: [unknown, unknown[]][] = [];
    const result = parseDeck(
      minimal([
        {
          id: 'a',
          layout: 'free',
          blocks: [
            { type: 'text', step: 1, markdown: 'x', blocks: [{ type: 'text', reveal: 'grow' }] },
            { type: 'component', component: 'ghost', props: {} },
            { type: 'component', component: 'charts-bar', props: { bad: true } },
          ],
        },
        {
          id: 'b',
          layout: 'component',
          component: { component: 'charts-bar', props: { bad: true } },
        },
      ]),
      {
        knownComponents: ['charts-bar'],
        validateBlock(block, path) {
          seen.push([block, path]);
          return [
            {
              ...root.createDiagnostic('block-props', 'Markdown is not allowed here.', [
                ...path,
                'markdown',
              ]),
            },
          ];
        },
        validateComponent(component, path) {
          return component.props.bad
            ? [root.createDiagnostic('component-props', 'Bad prop.', [...path, 'props', 'bad'])]
            : undefined;
        },
      }
    );
    expect(seen).toEqual([
      [{ type: 'text', markdown: 'x', blocks: [{ type: 'text' }] }, ['slides', 0, 'blocks', 0]],
    ]);
    expect(at(result.issues, 'block-props')).toEqual(['/slides/0/blocks/0/markdown']);
    expect(at(result.issues, 'unknown-component')).toEqual(['/slides/0/blocks/1/component']);
    expect(at(result.issues, 'component-props')).toEqual([
      '/slides/0/blocks/2/props/bad',
      '/slides/1/component/props/bad',
    ]);
    expect(result.ok).toBe(false);
    const throwing = parseDeck(minimal([{ id: 'a', layout: 'free', blocks: [{ type: 'text' }] }]), {
      validateBlock() {
        throw new Error('boom');
      },
    });
    expect(at(throwing.issues, 'block-props')).toEqual(['/slides/0/blocks/0']);
  });

  it('stripStepFields removes step fields at every nesting level and keeps tone', () => {
    expect(
      stripStepFields({
        type: 'grid',
        step: 1,
        tone: 'info',
        columns: [[{ type: 'text', fragment: 'in' }]],
        panels: [{ blocks: [{ type: 'x', reveal: 'grow' }] }],
      })
    ).toEqual({
      type: 'grid',
      tone: 'info',
      columns: [[{ type: 'text' }]],
      panels: [{ blocks: [{ type: 'x' }] }],
    });
  });
});

describe('parseDeck: all issues at once', () => {
  it('collects structural and cross-field issues together, with slide ids', () => {
    const result = parseDeck({
      formatVersion: 2,
      meta: { title: '', colour: 'red' },
      style: { aspect: '21:9', transition: 'spin' },
      navigation: { start: 'ghost', loop: 'yes' },
      outline: { sections: [{ id: 'one', slideIds: ['a', 'nope'] }] },
      slides: [
        { id: 'a', layout: 'quote', props: { quote: '' } },
        { id: 'a', layout: 'title-hero', props: { title: text(101) } },
        {
          id: 'b',
          layout: 'free',
          blocks: [{ type: 'text', step: 1, fragment: 'in', reveal: 'fade' }],
        },
        { id: 'c', layout: 'nope' },
      ],
    });
    expect(result.ok).toBe(false);
    expect(new Set(codes(result.issues))).toEqual(
      new Set([
        'too-short',
        'unknown-key',
        'enum',
        'invalid-type',
        'too-long',
        'unknown-layout',
        'duplicate-id',
        'unknown-slide',
        'fragment-conflict',
      ])
    );
    expect(result.steps).toHaveLength(4);
    expect(result.issues.find((issue) => issue.pointer === '/slides/1/props/title')?.slideId).toBe(
      'a'
    );
    for (const issue of result.issues) {
      expect(issue.jsonPath.startsWith('$')).toBe(true);
      expect(isDeckCode(issue.code), issue.code).toBe(true);
    }
  });

  it('caps the issue list at 200 and sets truncated', () => {
    const slides = Array.from({ length: 150 }, () => ({
      id: 'Bad Id',
      layout: 'quote',
      props: { quote: '' },
    }));
    const result = parseDeck(minimal(slides));
    expect(result.issues).toHaveLength(200);
    expect(result.truncated).toBe(true);
    expect(parseDeck(minimal(slides), { maxIssues: 5 }).issues).toHaveLength(5);
  });

  it('never throws on exotic input', () => {
    const getter = { formatVersion: 2, meta: { title: 'T' } };
    Object.defineProperty(getter, 'slides', {
      enumerable: true,
      get: () => {
        throw new Error('no');
      },
    });
    const cyclic: Json = { formatVersion: 2, meta: { title: 'T' }, slides: [] };
    (cyclic.slides as unknown[]).push({ id: 'a', layout: 'free', blocks: [cyclic] });
    for (const input of [undefined, null, 1, [], new Map(), getter, cyclic, Object.create(null)]) {
      const result = parseDeck(input);
      expect(result.ok).toBe(false);
      expect(result.issues.length).toBeGreaterThan(0);
    }
  });
});

describe('deck model: JSON Schema, codes and the root aggregate', () => {
  it('exports a 2020-12 document with a $defs entry per layout', () => {
    const schema = deckJsonSchema({ $id: 'https://example.com/deck.schema.json' });
    expect(schema.$schema).toBe(JSON_SCHEMA_DIALECT);
    expect(schema.$id).toBe('https://example.com/deck.schema.json');
    const defs = schema.$defs as Record<string, Json>;
    for (const id of DECK_CATALOG_LAYOUT_IDS) expect(defs[id], id).toBeDefined();
    const props = schema.properties as Record<string, Json>;
    expect(props.formatVersion).toEqual(expect.objectContaining({ const: 2 }));
    const slides = props.slides as Json;
    expect(slides).toEqual(expect.objectContaining({ minItems: 1, maxItems: 200 }));
    expect(((slides.items as Json).oneOf as unknown[]).length).toBe(23);
    expect(schema.required).toEqual(['formatVersion', 'meta', 'slides']);
    expect(JSON.parse(JSON.stringify(schema))).toEqual(schema);
  });

  it('documents every code the model reports with a severity and meaning', () => {
    for (const [code, info] of Object.entries(DECK_CODES)) {
      expect(code).toMatch(/^[a-z]+(?:-[a-z]+)*$/);
      expect(['error', 'warning']).toContain(info.severity);
      expect(info.meaning.length).toBeGreaterThan(10);
    }
    for (const code of [
      'fragment-conflict',
      'too-many-steps',
      'step-unrevealed',
      'unknown-layout',
      'layout-props',
      'unknown-background',
      'solid-conflict',
      'media-kind',
      'invalid-json',
      'too-large',
      'too-deep',
      'too-many',
      'unsafe-key',
      'invalid-deck',
      'migrated',
    ]) {
      expect(isDeckCode(code), code).toBe(true);
    }
    expect(isDeckCode('__proto__')).toBe(false);
  });

  it('re-exports the model and the schema kit from the root', () => {
    expect(root.parseDeck).toBe(parseDeck);
    expect(typeof root.loadUntrustedDeck).toBe('function');
    expect(typeof root.migrateDeck).toBe('function');
    expect(typeof root.validate).toBe('function');
    expect(typeof root.t.object).toBe('function');
  });

  it('resolves transitions through one resolver (style delegates to motion)', () => {
    for (const transition of ['none', 'fade', 'fade-up', 'slide', 'zoom', 'morph'] as const) {
      for (const motion of ['full', 'subtle', 'none'] as const) {
        for (const reducedMotion of [false, true]) {
          const motionResult = resolveSlideTransition({
            slide: { transition },
            motion,
            reducedMotion,
          });
          expect(resolveDeckTransition(transition, motion, reducedMotion)).toEqual({
            name: motionResult.name,
            durationMs: motionResult.durationMs,
          });
        }
      }
    }
  });
});

describe('parseDeck: performance', () => {
  it('parses a 200-slide deck in under 100 ms', () => {
    const slides = Array.from({ length: 200 }, (_, i) => {
      const id = DECK_CATALOG_LAYOUT_IDS[
        i % DECK_CATALOG_LAYOUT_IDS.length
      ] as (typeof DECK_CATALOG_LAYOUT_IDS)[number];
      return i % 4 === 3
        ? {
            id: `s${i}`,
            layout: 'free',
            notes: text(500),
            blocks: Array.from({ length: 10 }, (_, b) => ({
              type: 'text',
              markdown: `Block ${b}`,
              step: b,
            })),
          }
        : { id: `s${i}`, layout: id, props: structuredClone(DECK_LAYOUTS[id].sample) };
    });
    const deck = minimal(slides);
    parseDeck(deck); // warm up
    const start = performance.now();
    const result = parseDeck(deck);
    const elapsed = performance.now() - start;
    expect(result.ok).toBe(true);
    expect(elapsed).toBeLessThan(100);
  });
});
