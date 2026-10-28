// @vitest-environment node
import { describe, expect, expectTypeOf, it } from 'vitest';
import {
  type DeckDiagnostic,
  formatDiagnostic,
  type Infer,
  type JsonValue,
  MAX_DIAGNOSTICS,
  SCHEMA_CODES,
  type Schema,
  t,
  toJsonPath,
  toJsonSchema,
  toPointer,
  validate,
} from '../src/schema/index.ts';

const codes = (issues: readonly DeckDiagnostic[]): string[] => issues.map((issue) => issue.code);
const where = (issues: readonly DeckDiagnostic[]): string[] =>
  issues.map((issue) => `${issue.code} ${issue.jsonPath}`);

/** Validate and return only the issues (errors and warnings). */
const issuesOf = (schema: Schema, input: unknown): DeckDiagnostic[] =>
  validate(schema, input).issues;

describe('diagnostics', () => {
  it('formats JSON paths and RFC 6901 pointers for every kind of segment', () => {
    const cases: [readonly (string | number)[], string, string][] = [
      [[], '$', ''],
      [['slides', 2, 'props', 'title'], '$.slides[2].props.title', '/slides/2/props/title'],
      [['a/b', 'c~d'], "$['a/b']['c~d']", '/a~1b/c~0d'],
      [["it's", 'x y', '$ok_1'], "$['it\\'s']['x y'].$ok_1", "/it's/x y/$ok_1"],
      [['9lives'], "$['9lives']", '/9lives'],
    ];
    for (const [path, jsonPath, pointer] of cases) {
      expect(toJsonPath(path)).toBe(jsonPath);
      expect(toPointer(path)).toBe(pointer);
    }
  });

  it('formats one line with code, path, source and fix', () => {
    const [issue] = issuesOf(t.object({ title: t.string() }), { title: 't', colour: 1 });
    expect(issue).toBeDefined();
    expect(formatDiagnostic(issue as DeckDiagnostic)).toBe(
      'error unknown-key at $.colour: Unknown key "colour". Fix: Remove it, or use one of: "title".'
    );
    expect(
      formatDiagnostic({ ...(issue as DeckDiagnostic), source: { line: 3, column: 5 } })
    ).toContain('at $.colour (3:5):');
  });

  it('keeps the kit codes stable and kebab-case', () => {
    for (const code of Object.values(SCHEMA_CODES)) expect(code).toMatch(/^[a-z]+(-[a-z]+)*$/);
    expect(Object.isFrozen(SCHEMA_CODES)).toBe(true);
  });
});

describe('string', () => {
  it('counts lengths in code points, after trimming', () => {
    const schema = t.string({ min: 2, max: 3 });
    const cases: [unknown, string[]][] = [
      ['ab', []],
      ['abc', []],
      ['😀😀😀', []], // 6 UTF-16 units, 3 code points
      ['a', ['too-short']],
      ['abcd', ['too-long']],
      ['😀😀😀😀', ['too-long']],
      ['x'.repeat(10_000_000), ['too-long']], // refused without counting
      [3, ['invalid-type']],
      [null, ['invalid-type']],
    ];
    for (const [input, expected] of cases) expect(codes(issuesOf(schema, input))).toEqual(expected);
  });

  it('trims as a reported normalization and checks the trimmed value', () => {
    const schema = t.object({ title: t.string({ trim: true, min: 1, max: 5 }) });
    const ok = validate(schema, { title: '  hello  ' });
    expect(ok.ok && ok.value).toEqual({ title: 'hello' });
    expect(ok.normalized).toEqual([
      { kind: 'trim', path: ['title'], jsonPath: '$.title', pointer: '/title' },
    ]);
    expect(validate(schema, { title: 'hello' }).normalized).toEqual([]);
    expect(codes(issuesOf(schema, { title: '   ' }))).toEqual(['too-short']);
    // Untrimmed strings keep their whitespace.
    const raw = validate(t.string({ max: 3 }), ' a ');
    expect(raw.ok && raw.value).toBe(' a ');
  });

  it('applies patterns, reserved values and text safety', () => {
    const slug = t.string({ pattern: /^[a-z0-9][a-z0-9-]{0,63}$/, not: ['free', 'custom'] });
    expect(codes(issuesOf(slug, 'title-hero'))).toEqual([]);
    expect(codes(issuesOf(slug, 'Title'))).toEqual(['pattern']);
    expect(codes(issuesOf(slug, 'free'))).toEqual(['reserved']);

    const line = t.string({ text: 'line' });
    const block = t.string({ text: 'multiline' });
    const cases: [string, boolean, boolean][] = [
      ['plain text', true, true],
      ['two\nlines', false, true],
      ['tab\there', false, true],
      ['crlf\r\n', false, true],
      ['bell\u0007', false, false],
      ['del\u007f', false, false],
      ['c1\u0085', false, false],
      ['rlo‮', false, false],
      ['isolate⁦', false, false],
      ['sep ', false, true],
      ['emoji 😀 ok', true, true],
    ];
    for (const [input, lineOk, blockOk] of cases) {
      expect(validate(line, input).ok, JSON.stringify(input)).toBe(lineOk);
      expect(validate(block, input).ok, JSON.stringify(input)).toBe(blockOk);
    }
    expect(issuesOf(line, 'a‮b')[0]?.message).toBe(
      'Character U+202E at index 1 is not allowed here.'
    );
  });
});

describe('number, boolean, null, literal and enum', () => {
  it('checks finiteness, integers and ranges', () => {
    const cases: [Schema, unknown, string[]][] = [
      [t.number(), 1.5, []],
      [t.number(), Number.NaN, ['not-finite']],
      [t.number(), Number.POSITIVE_INFINITY, ['not-finite']],
      [t.number({ finite: false }), Number.POSITIVE_INFINITY, []],
      [t.number({ finite: false }), Number.NaN, ['not-finite']],
      [t.number(), '1', ['invalid-type']],
      [t.int({ min: 0, max: 359 }), 359, []],
      [t.int({ min: 0, max: 359 }), 360, ['out-of-range']],
      [t.int({ min: 0, max: 359 }), -1, ['out-of-range']],
      [t.int(), 1.5, ['not-integer']],
      [t.int({ max: 1 }), 2.5, ['not-integer', 'out-of-range']],
      [t.boolean(), false, []],
      [t.boolean(), 0, ['invalid-type']],
      [t.null(), null, []],
      [t.null(), undefined, ['invalid-type']],
      [t.literal(2), 2, []],
      [t.literal(2), 1, ['enum']],
      [t.literal(2, { code: 'unsupported-version' }), 3, ['unsupported-version']],
      [t.enum(['16:9', '4:3']), '4:3', []],
      [t.enum(['16:9', '4:3']), '21:9', ['enum']],
      [t.enum(['16:9', '4:3']), 169, ['enum']],
    ];
    for (const [schema, input, expected] of cases) {
      expect(codes(issuesOf(schema, input)), `${schema.kind} ${String(input)}`).toEqual(expected);
    }
    expect(issuesOf(t.enum(['a', 'b']), 'c')[0]?.fix).toBe('Use one of: "a", "b".');
  });
});

describe('array', () => {
  it('bounds items, validates each one and skips items past max', () => {
    const schema = t.array(t.string({ max: 3 }), { min: 1, max: 3 });
    expect(codes(issuesOf(schema, []))).toEqual(['too-few']);
    expect(where(issuesOf(schema, ['ok', 'long', 3]))).toEqual([
      'too-long $[1]',
      'invalid-type $[2]',
    ]);
    // Items past max are not validated (one too-many, bounded work).
    expect(where(issuesOf(schema, ['a', 'b', 'c', 7, 8, 9]))).toEqual(['too-many $']);
    expect(codes(issuesOf(schema, 'abc'))).toEqual(['invalid-type']);
    expect(codes(issuesOf(schema, { length: 1, 0: 'a' }))).toEqual(['invalid-type']);
  });

  it('returns a fresh copy', () => {
    const input = ['a', 'b'];
    const result = validate(t.array(t.string()), input);
    expect(result.ok && result.value).toEqual(input);
    expect(result.ok && result.value).not.toBe(input);
  });
});

describe('object', () => {
  const schema = t.object({
    id: t.string(),
    title: t.optional(t.string({ max: 10 })),
    hidden: t.optional(t.boolean(), { default: false }),
    tags: t.optional(t.array(t.string()), { default: ['a'] }),
  });

  it('reports every missing, unknown and invalid key at its path', () => {
    expect(where(issuesOf(schema, { title: 'way too long here', extra: 1, other: 2 }))).toEqual([
      'required $.id',
      'too-long $.title',
      'unknown-key $.extra',
      'unknown-key $.other',
    ]);
  });

  it('applies defaults as fresh copies and reports them', () => {
    const first = validate(schema, { id: 'x' });
    const second = validate(schema, { id: 'y', hidden: true, title: undefined });
    expect(first.ok && first.value).toEqual({ id: 'x', hidden: false, tags: ['a'] });
    expect(first.normalized.map((entry) => entry.pointer)).toEqual(['/hidden', '/tags']);
    expect(second.ok && second.value).toEqual({ id: 'y', hidden: true, tags: ['a'] });
    if (first.ok && second.ok) expect(first.value.tags).not.toBe(second.value.tags);
  });

  it('drops unknown keys when not strict and always refuses prototype keys', () => {
    const loose = t.object({ a: t.int() }, { strict: false });
    const parsed = validate(loose, { a: 1, b: 2 });
    expect(parsed.ok && parsed.value).toEqual({ a: 1 });
    const hostile = JSON.parse('{"a":1,"__proto__":{"polluted":true},"constructor":1}');
    expect(where(issuesOf(loose, hostile))).toEqual([
      'unsafe-key $.__proto__',
      'unsafe-key $.constructor',
    ]);
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });

  it('refuses arrays, class instances and non-objects', () => {
    for (const input of [[], new Date(), new Map(), 'x', null, 1]) {
      expect(codes(issuesOf(schema, input))).toEqual(['invalid-type']);
    }
    expect(validate(t.object({}), Object.create(null)).ok).toBe(true);
  });

  it('extends, picks and omits shapes', () => {
    const base = t.object({ a: t.int(), b: t.string() });
    const wide = t.extend(base, { c: t.boolean() });
    expect(Object.keys(wide.shape)).toEqual(['a', 'b', 'c']);
    expect(Object.keys(t.pick(wide, ['a', 'c']).shape)).toEqual(['a', 'c']);
    expect(Object.keys(t.omit(wide, ['b']).shape)).toEqual(['a', 'c']);
    expect(validate(t.omit(wide, ['b']), { a: 1, c: true }).ok).toBe(true);
  });
});

describe('record', () => {
  it('bounds keys, checks key patterns and values', () => {
    const schema = t.record(t.int(), {
      key: t.string({ pattern: /^[a-z]+$/, max: 8 }),
      max: 3,
    });
    expect(validate(schema, { a: 1, b: 2 }).ok).toBe(true);
    expect(where(issuesOf(schema, { a: 1, B: 2, c: 'x' }))).toEqual([
      'pattern $.B',
      'invalid-type $.c',
    ]);
    expect(where(issuesOf(schema, { a: 1, b: 2, c: 3, d: 'x' }))).toEqual(['too-many $']);
    expect(where(issuesOf(schema, JSON.parse('{"__proto__":1}')))).toEqual([
      'unsafe-key $.__proto__',
    ]);
  });
});

describe('unions', () => {
  const background = t.union(
    [
      t.object({ kind: t.literal('solid'), token: t.optional(t.enum(['surface', 'accent'])) }),
      t.object({ kind: t.enum(['image', 'image-full']), src: t.string({ min: 1 }) }),
      t.object({ kind: t.literal('gradient'), angle: t.optional(t.int({ min: 0, max: 359 })) }),
    ],
    { discriminator: 'kind' }
  );

  it('picks the option by discriminator, including multi-value options', () => {
    expect(validate(background, { kind: 'solid' }).ok).toBe(true);
    expect(validate(background, { kind: 'image-full', src: 'a.png' }).ok).toBe(true);
    expect(where(issuesOf(background, { kind: 'image', src: '', extra: 1 }))).toEqual([
      'too-short $.src',
      'unknown-key $.extra',
    ]);
    expect(where(issuesOf(background, { kind: 'gradient', angle: 400 }))).toEqual([
      'out-of-range $.angle',
    ]);
  });

  it('reports one issue for an unknown or missing discriminator', () => {
    const unknown = issuesOf(background, { kind: 'plaid', src: 3 });
    expect(where(unknown)).toEqual(['unknown-kind $.kind']);
    expect(unknown[0]?.fix).toBe('Use one of: "solid", "image", "image-full", "gradient".');
    expect(where(issuesOf(background, {}))).toEqual(['required $.kind']);
    expect(codes(issuesOf(background, 'solid'))).toEqual(['invalid-type']);
    const slides = t.union(
      [t.object({ layout: t.literal('free') }), t.object({ layout: t.literal('custom') })],
      { discriminator: 'layout', code: 'unknown-layout' }
    );
    expect(codes(issuesOf(slides, { layout: 'nope' }))).toEqual(['unknown-layout']);
  });

  it('falls back to a string-discriminated option for open sets', () => {
    const slide = t.union(
      [
        t.object({ layout: t.literal('free'), blocks: t.array(t.string()) }),
        t.object({
          layout: t.string({ pattern: /^[a-z][a-z-]*$/, not: ['free', 'custom'] }),
          props: t.json(),
        }),
      ],
      { discriminator: 'layout', code: 'unknown-layout' }
    );
    expect(validate(slide, { layout: 'title-hero', props: { title: 'x' } }).ok).toBe(true);
    expect(where(issuesOf(slide, { layout: 'free', props: {} }))).toEqual([
      'required $.blocks',
      'unknown-key $.props',
    ]);
    expect(codes(issuesOf(slide, { layout: 'Bad!' }))).toEqual(['unknown-layout']);
  });

  it('reports the closest option of an undiscriminated union', () => {
    const cell = t.union([t.string({ trim: true, min: 1, max: 5 }), t.boolean(), t.null()]);
    expect(validate(cell, null).ok).toBe(true);
    const trimmed = validate(cell, ' ok ');
    expect(trimmed.ok && trimmed.value).toBe('ok');
    expect(trimmed.normalized).toHaveLength(1);
    expect(codes(issuesOf(cell, 'too long'))).toEqual(['too-long']);
    expect(issuesOf(cell, 3)[0]?.message).toBe(
      'Expected one of: string, boolean, null, received a number.'
    );
    const shapes = t.union([
      t.object({ a: t.int(), b: t.int() }),
      t.object({ a: t.int(), c: t.int() }),
    ]);
    expect(where(issuesOf(shapes, { a: 1, c: 'x' }))).toEqual(['invalid-type $.c']);
  });

  it('accepts nullable and optional values', () => {
    expect(validate(t.nullable(t.int()), null).ok).toBe(true);
    expect(codes(issuesOf(t.nullable(t.int()), 'x'))).toEqual(['invalid-type']);
    expect(validate(t.optional(t.int()), undefined).ok).toBe(true);
    const fallback = validate(t.optional(t.int(), { default: 7 }), undefined);
    expect(fallback.ok && fallback.value).toBe(7);
  });
});

interface TreeNode {
  name: string;
  children: TreeNode[];
}
const Tree: Schema<TreeNode> = t.object({
  name: t.string({ max: 20 }),
  children: t.array(
    t.lazy(() => Tree, { name: 'Tree' }),
    { max: 10 }
  ),
});

const nest = (levels: number): TreeNode => {
  const root: TreeNode = { name: 'root', children: [] };
  let node = root;
  for (let i = 0; i < levels; i++) {
    const child: TreeNode = { name: `n${i}`, children: [] };
    node.children.push(child);
    node = child;
  }
  return root;
};

describe('lazy', () => {
  it('validates recursive shapes with nested paths', () => {
    const tree = nest(3);
    (tree.children[0] as TreeNode).children.push({ name: 3 as unknown as string, children: [] });
    expect(where(issuesOf(Tree, tree))).toEqual(['invalid-type $.children[0].children[1].name']);
  });

  it('caps recursion by depth instead of overflowing the stack', () => {
    const deep = issuesOf(Tree, nest(10_000));
    expect(codes(deep)).toEqual(['too-deep']);
    const capped = t.lazy(() => Tree, { maxDepth: 3 });
    const list: Schema = t.array(capped);
    expect(codes(issuesOf(list, [nest(1)]))).toEqual([]);
    const narrow: Schema<TreeNode> = t.object({
      name: t.string(),
      children: t.array(t.lazy(() => narrow, { maxDepth: 2 })),
    });
    expect(validate(narrow, nest(2)).ok).toBe(true);
    expect(codes(issuesOf(narrow, nest(3)))).toEqual(['too-deep']);
  });
});

describe('refine', () => {
  const slides = t.refine(t.array(t.object({ id: t.string() })), {
    code: 'duplicate-id',
    description: 'Slide ids are unique.',
    check(value, context) {
      const seen = new Set<string>();
      value.forEach((slide, index) => {
        if (seen.has(slide.id)) {
          context.issue({ message: `Duplicate id "${slide.id}".`, path: [index, 'id'] });
        }
        seen.add(slide.id);
      });
      if (value.length > 2) {
        context.issue({ code: 'many', message: 'Long deck.', severity: 'warning' });
      }
    },
  });

  it('raises coded issues at relative paths, and warnings keep ok', () => {
    expect(where(issuesOf(slides, [{ id: 'a' }, { id: 'a' }]))).toEqual(['duplicate-id $[1].id']);
    const warned = validate(slides, [{ id: 'a' }, { id: 'b' }, { id: 'c' }]);
    expect(warned.ok).toBe(true);
    expect(warned.issues.map((issue) => `${issue.severity} ${issue.code}`)).toEqual([
      'warning many',
    ]);
  });

  it('runs only when the inner schema passed, and survives a throwing check', () => {
    expect(where(issuesOf(slides, [{ id: 1 }, { id: 1 }]))).toEqual([
      'invalid-type $[0].id',
      'invalid-type $[1].id',
    ]);
    const broken = t.refine(t.int(), {
      code: 'broken',
      check() {
        throw new Error('boom');
      },
    });
    expect(codes(issuesOf(broken, 1))).toEqual(['broken']);
  });
});

describe('bounded json', () => {
  const props = t.json(); // Protoyard props limits: depth 4, 100 keys, 200 items, 2,000 chars

  it('accepts JSON data within the limits and copies it', () => {
    const value = { a: [1, 'two', true, null, { b: { c: 'deep' } }], n: -0.5 };
    const result = validate(props, value);
    expect(result.ok && result.value).toEqual(value);
    expect(result.ok && result.value).not.toBe(value);
  });

  it('refuses every limit at its path', () => {
    const cases: [unknown, string[]][] = [
      [{ a: { b: { c: { d: 1 } } } }, []],
      [{ a: { b: { c: { d: { e: 1 } } } } }, ['too-deep $.a.b.c.d']],
      [Object.fromEntries(Array.from({ length: 101 }, (_, i) => [`k${i}`, i])), ['too-many $']],
      [{ list: Array.from({ length: 201 }, () => 0) }, ['too-many $.list']],
      [{ s: 'x'.repeat(2_001) }, ['too-long $.s']],
      [{ ['k'.repeat(65)]: 1 }, [`too-long $.${'k'.repeat(65)}`]],
      [{ n: Number.NaN, i: Number.NEGATIVE_INFINITY }, ['not-finite $.n', 'not-finite $.i']],
      [
        { f: () => 1, u: undefined, d: new Date(0) },
        ['invalid-type $.f', 'invalid-type $.u', 'invalid-type $.d'],
      ],
      [
        JSON.parse('{"ok":1,"__proto__":{"x":1},"prototype":2}'),
        ['unsafe-key $.__proto__', 'unsafe-key $.prototype'],
      ],
    ];
    for (const [input, expected] of cases) expect(where(issuesOf(props, input))).toEqual(expected);
    expect(codes(issuesOf(t.json({ text: 'line' }), { a: 'x‮y' }))).toEqual(['unsafe-text']);
  });
});

describe('all issues, paths and the cap', () => {
  const Deck = t.object({
    formatVersion: t.literal(2, { code: 'unsupported-version' }),
    meta: t.object({ title: t.string({ trim: true, min: 1, max: 200 }) }),
    slides: t.array(
      t.object({
        id: t.string({ pattern: /^[a-z0-9][a-z0-9-]{0,63}$/ }),
        props: t.object({ title: t.string({ max: 10 }), 'odd/key': t.optional(t.int()) }),
      }),
      { min: 1, max: 200 }
    ),
  });

  it('collects every issue with jsonPath and pointer, not just the first', () => {
    const issues = issuesOf(Deck, {
      formatVersion: 1,
      meta: { title: '  ' },
      slides: [
        { id: 'ok', props: { title: 'fine' } },
        { id: 'Bad Id', props: { title: 3 } },
        { id: 'three', props: { title: 'way too long title', 'odd/key': 'x', stray: true } },
      ],
    });
    expect(issues.map((issue) => [issue.code, issue.jsonPath, issue.pointer])).toEqual([
      ['unsupported-version', '$.formatVersion', '/formatVersion'],
      ['too-short', '$.meta.title', '/meta/title'],
      ['pattern', '$.slides[1].id', '/slides/1/id'],
      ['invalid-type', '$.slides[1].props.title', '/slides/1/props/title'],
      ['too-long', '$.slides[2].props.title', '/slides/2/props/title'],
      ['invalid-type', "$.slides[2].props['odd/key']", '/slides/2/props/odd~1key'],
      ['unknown-key', '$.slides[2].props.stray', '/slides/2/props/stray'],
    ]);
    expect(issues.every((issue) => issue.severity === 'error')).toBe(true);
    expect(issues[2]?.path).toEqual(['slides', 1, 'id']);
  });

  it('prefixes paths when validating a subtree', () => {
    const result = validate(t.object({ title: t.string() }), {}, { path: ['slides', 3, 'props'] });
    expect(result.issues[0]?.jsonPath).toBe('$.slides[3].props.title');
  });

  it(`caps diagnostics at ${MAX_DIAGNOSTICS} with truncated, and stays invalid`, () => {
    const input = Object.fromEntries(Array.from({ length: 1_000 }, (_, i) => [`k${i}`, i]));
    const result = validate(t.object({}), input);
    expect(result.ok).toBe(false);
    expect(result.issues).toHaveLength(MAX_DIAGNOSTICS);
    expect(result.truncated).toBe(true);
    expect(validate(t.object({}), {}).truncated).toBe(false);
    const few = validate(t.object({}), input, { maxIssues: 5 });
    expect([few.issues.length, few.truncated]).toEqual([5, true]);
  });
});

describe('hostile input never throws and stays bounded', () => {
  const schema = t.object({
    title: t.optional(t.string({ max: 50 })),
    items: t.optional(t.array(t.object({ name: t.string() }, { strict: false }), { max: 100 })),
    data: t.optional(t.json()),
    map: t.optional(t.record(t.int(), { max: 10 })),
    tree: t.optional(Tree),
  });

  const cyclic: Record<string, unknown> = { title: 'x' };
  cyclic.data = { self: cyclic };
  const cyclicTree: Record<string, unknown> = { name: 'loop', children: [] };
  (cyclicTree.children as unknown[]).push(cyclicTree);
  const getter = {
    get title(): string {
      throw new Error('getter');
    },
  };
  const proxy = new Proxy(
    {},
    {
      get() {
        throw new Error('get');
      },
      ownKeys() {
        throw new Error('ownKeys');
      },
      getOwnPropertyDescriptor() {
        throw new Error('descriptor');
      },
      getPrototypeOf() {
        return Object.prototype;
      },
    }
  );
  const revocable = Proxy.revocable({}, {});
  revocable.revoke();
  const arrayGetter = [1];
  Object.defineProperty(arrayGetter, 0, {
    get() {
      throw new Error('index');
    },
  });
  let deep: unknown = 'leaf';
  for (let i = 0; i < 10_000; i++) deep = { next: deep };
  let deepArray: unknown = [];
  for (let i = 0; i < 10_000; i++) deepArray = [deepArray];

  const corpus: [string, unknown, string][] = [
    ['cyclic json', cyclic, 'cycle'],
    ['cyclic lazy tree', { tree: cyclicTree }, 'cycle'],
    ['throwing getter', getter, 'invalid-input'],
    ['throwing proxy', proxy, 'invalid-input'],
    ['revoked proxy', revocable.proxy, 'invalid-type'],
    ['proxy in json', { data: { p: proxy } }, 'invalid-input'],
    ['array index getter', { items: arrayGetter }, 'invalid-input'],
    ['getter in json', { data: [getter] }, 'invalid-input'],
    ['prototype keys', JSON.parse('{"__proto__":{"admin":true}}'), 'unsafe-key'],
    ['10k-deep json', { data: deep }, 'too-deep'],
    ['10k-deep arrays', { data: deepArray }, 'too-deep'],
    ['10k-deep tree', { tree: nest(10_000) }, 'too-deep'],
    ['huge array', { items: new Array(10_000_000) }, 'too-many'],
    ['huge json array', { data: new Array(10_000_000) }, 'too-many'],
    ['symbol', Symbol('x'), 'invalid-type'],
    ['bigint', { title: 10n }, 'invalid-type'],
    ['function', () => 1, 'invalid-type'],
  ];

  it('reports each hostile shape with a diagnostic', () => {
    for (const [name, input, code] of corpus) {
      const started = performance.now();
      let result: ReturnType<typeof validate> | undefined;
      expect(() => {
        result = validate(schema, input);
      }, name).not.toThrow();
      expect(result?.ok, name).toBe(false);
      expect(codes(result?.issues ?? []), name).toContain(code);
      expect(result?.issues.length ?? 0, name).toBeLessThanOrEqual(MAX_DIAGNOSTICS);
      expect(performance.now() - started, name).toBeLessThan(1_000);
    }
    expect(({} as Record<string, unknown>).admin).toBeUndefined();
  });

  it('stops at the node budget on wide shared structures', () => {
    const leaf = Object.fromEntries(Array.from({ length: 100 }, (_, i) => [`k${i}`, i]));
    const level = (child: unknown): unknown =>
      Object.fromEntries(Array.from({ length: 100 }, (_, i) => [`k${i}`, child]));
    const wide = level(level(level(leaf))); // 10^8 leaves through shared references
    const started = performance.now();
    const result = validate(t.json(), wide, { maxNodes: 50_000 });
    expect(codes(result.issues)).toContain('too-large');
    expect(performance.now() - started).toBeLessThan(1_000);
  });

  it('survives a random corpus of exotic values against every combinator', () => {
    const exotic: unknown[] = [
      undefined,
      null,
      0,
      -0,
      Number.NaN,
      '',
      '‮',
      [],
      {},
      [undefined],
      Object.create(null),
      new Proxy([], {}),
      proxy,
      revocable.proxy,
      getter,
      cyclic,
      cyclicTree,
      deep,
      new Uint8Array(4),
      Promise.resolve(),
      new Error('x'),
    ];
    const schemas: Schema[] = [
      schema,
      Tree,
      t.json(),
      t.union([t.string(), t.object({ a: t.int() })]),
      t.union([t.object({ k: t.literal('a') }), t.object({ k: t.literal('b') })], {
        discriminator: 'k',
      }),
      t.record(t.json()),
      t.nullable(t.array(t.json())),
    ];
    for (const target of schemas) {
      for (const value of exotic) {
        expect(() => validate(target, value)).not.toThrow();
        expect(() =>
          validate(target, { a: value, k: value, name: value, children: [value] })
        ).not.toThrow();
      }
    }
  });
});

describe('performance', () => {
  it('validates 200 slides × 50 nodes well under 50 ms', () => {
    const Block = t.object({
      id: t.string({ pattern: /^[a-z0-9-]+$/, max: 64 }),
      kind: t.enum(['text', 'image', 'list']),
      text: t.optional(t.string({ trim: true, max: 2_000, text: 'multiline' })),
      step: t.optional(t.int({ min: 0, max: 1_000 })),
    });
    const Slide = t.object({
      id: t.string({ pattern: /^[a-z0-9-]+$/, max: 64 }),
      title: t.string({ trim: true, max: 200, text: 'line' }),
      blocks: t.array(Block, { max: 2_000 }),
    });
    const DeckSchema = t.object({ slides: t.array(Slide, { min: 1, max: 200 }) });
    const deck = {
      slides: Array.from({ length: 200 }, (_, s) => ({
        id: `slide-${s}`,
        title: ` Slide ${s} `,
        blocks: Array.from({ length: 50 }, (_, b) => ({
          id: `b-${s}-${b}`,
          kind: 'text',
          text: `Block ${b} of slide ${s}, with some ordinary text.`,
          step: b % 4,
        })),
      })),
    };
    expect(validate(DeckSchema, deck).ok).toBe(true);
    let best = Number.POSITIVE_INFINITY;
    for (let run = 0; run < 7; run++) {
      const started = performance.now();
      validate(DeckSchema, deck);
      best = Math.min(best, performance.now() - started);
    }
    expect(best).toBeLessThan(50);
  });
});

describe('builders refuse malformed schemas', () => {
  it('throws at definition time, never at validation time', () => {
    const malformed: [string, () => unknown][] = [
      ['min > max', () => t.string({ min: 3, max: 2 })],
      ['negative', () => t.array(t.int(), { max: -1 })],
      ['flags', () => t.string({ pattern: /a/i })],
      ['bad default', () => t.optional(t.int(), { default: 'x' as unknown as number })],
      ['unsafe shape key', () => t.object(JSON.parse('{"__proto__":{}}'))],
      ['empty enum', () => t.enum([] as unknown as [string])],
      ['duplicate enum', () => t.enum(['a', 'a'])],
      [
        'shared discriminator',
        () =>
          t.union([t.object({ k: t.literal('a') }), t.object({ k: t.literal('a') })], {
            discriminator: 'k',
          }),
      ],
      ['no discriminator field', () => t.union([t.object({})], { discriminator: 'k' })],
      ['refine code', () => t.refine(t.int(), { code: 'Not Kebab', check() {} })],
    ];
    for (const [name, build] of malformed) expect(build, name).toThrow(TypeError);
  });

  it('produces frozen plain data', () => {
    const schema = t.object({ a: t.array(t.string({ not: ['x'] })) });
    expect(Object.isFrozen(schema)).toBe(true);
    expect(Object.isFrozen(schema.shape)).toBe(true);
    expect(Object.isFrozen(schema.shape.a.item.not)).toBe(true);
    expect(JSON.parse(JSON.stringify(schema))).toEqual({
      kind: 'object',
      shape: { a: { kind: 'array', item: { kind: 'string', not: ['x'] } } },
      strict: true,
    });
  });
});

describe('toJsonSchema', () => {
  it('emits JSON Schema 2020-12 for a representative deck schema', () => {
    const Background = t.union(
      [
        t.object({ kind: t.literal('solid') }),
        t.object({ kind: t.enum(['image', 'image-full']), src: t.string({ min: 1, max: 512 }) }),
      ],
      { discriminator: 'kind' }
    );
    const Slide = t.union(
      [
        t.object({ layout: t.literal('free'), blocks: t.array(t.json(), { min: 1, max: 2_000 }) }),
        t.object({ layout: t.string({ pattern: '^[a-z][a-z-]*$' }), props: t.json() }),
      ],
      { discriminator: 'layout' }
    );
    const Deck = t.refine(
      t.object({
        formatVersion: t.literal(2),
        title: t.string({ trim: true, min: 1, max: 200, text: 'line' }),
        aspect: t.optional(t.enum(['16:9', '4:3']), { default: '16:9' }),
        seed: t.optional(t.int({ min: 0, max: 0xffffffff })),
        cell: t.nullable(t.boolean()),
        background: t.optional(Background),
        slides: t.array(Slide, { min: 1, max: 200 }),
        labels: t.optional(
          t.record(t.string({ max: 80 }), { key: t.string({ max: 64 }), max: 32 })
        ),
        tree: t.optional(Tree),
      }),
      { code: 'duplicate-id', description: 'Slide ids are unique.', check() {} }
    );
    const schema = toJsonSchema(Deck, { $id: 'https://texuli.example/deck.json', title: 'Deck' });
    expect(schema.$schema).toBe('https://json-schema.org/draft/2020-12/schema');
    expect(schema.$id).toBe('https://texuli.example/deck.json');
    expect(schema.title).toBe('Deck');
    expect(schema.type).toBe('object');
    expect(schema.additionalProperties).toBe(false);
    expect(schema.required).toEqual(['formatVersion', 'title', 'cell', 'slides']);
    expect(schema.description).toBe('Slide ids are unique. (rule "duplicate-id")');
    const properties = schema.properties as Record<string, Record<string, unknown>>;
    expect(properties.formatVersion).toEqual({ const: 2 });
    expect(properties.title).toEqual({
      type: 'string',
      minLength: 1,
      maxLength: 200,
      pattern: '^[^\\u0000-\\u001F\\u007F-\\u009F\\u2028\\u2029\\u202A-\\u202E\\u2066-\\u2069]*$',
      description: 'Leading and trailing whitespace is trimmed before the length check.',
    });
    expect(properties.aspect).toEqual({ type: 'string', enum: ['16:9', '4:3'], default: '16:9' });
    expect(properties.seed).toEqual({ type: 'integer', minimum: 0, maximum: 4294967295 });
    expect(properties.cell).toEqual({ anyOf: [{ type: 'boolean' }, { type: 'null' }] });
    expect(properties.background).toEqual({
      oneOf: [
        {
          type: 'object',
          properties: { kind: { const: 'solid' } },
          required: ['kind'],
          additionalProperties: false,
        },
        {
          type: 'object',
          properties: {
            kind: { type: 'string', enum: ['image', 'image-full'] },
            src: { type: 'string', minLength: 1, maxLength: 512 },
          },
          required: ['kind', 'src'],
          additionalProperties: false,
        },
      ],
    });
    const slides = properties.slides as Record<string, unknown>;
    const slideOptions = (slides.items as { oneOf: Record<string, unknown>[] }).oneOf;
    expect([slides.minItems, slides.maxItems]).toEqual([1, 200]);
    expect((slideOptions[1] as { properties: Record<string, unknown> }).properties.layout).toEqual({
      type: 'string',
      pattern: '^[a-z][a-z-]*$',
      not: { enum: ['free'] },
    });
    expect(properties.labels).toEqual({
      type: 'object',
      propertyNames: {
        type: 'string',
        maxLength: 64,
        not: { enum: ['__proto__', 'constructor', 'prototype'] },
      },
      additionalProperties: { type: 'string', maxLength: 80 },
      maxProperties: 32,
    });
    // `Tree` is an object inlined here; its lazy self-reference becomes a $defs entry.
    expect(properties.tree).toMatchObject({
      type: 'object',
      properties: { children: { items: { $ref: '#/$defs/Tree' } } },
    });
    const defs = schema.$defs as Record<string, Record<string, unknown>>;
    expect(defs.Tree).toMatchObject({
      type: 'object',
      properties: { children: { type: 'array', items: { $ref: '#/$defs/Tree' }, maxItems: 10 } },
    });
    const json = defs.Json_d4_k100_i200_s2000_n64_4 as { anyOf: Record<string, unknown>[] };
    expect(json.anyOf).toHaveLength(6);
    expect(json.anyOf[0]).toEqual({ type: 'string', maxLength: 2000 });
    expect(json.anyOf[5]).toEqual({
      type: 'object',
      maxProperties: 100,
      propertyNames: { maxLength: 64, not: { enum: ['__proto__', 'constructor', 'prototype'] } },
      additionalProperties: { $ref: '#/$defs/Json_d4_k100_i200_s2000_n64_3' },
    });
    expect((defs.Json_d4_k100_i200_s2000_n64_0 as { anyOf: unknown[] }).anyOf).toHaveLength(4);
    // The document is plain JSON.
    expect(JSON.parse(JSON.stringify(schema))).toEqual(schema);
  });

  it('uses anyOf for undiscriminated unions', () => {
    expect(toJsonSchema(t.union([t.string(), t.int()]))).toEqual({
      $schema: 'https://json-schema.org/draft/2020-12/schema',
      anyOf: [{ type: 'string' }, { type: 'integer' }],
    });
  });
});

describe('Infer', () => {
  it('derives TypeScript types from schema values', () => {
    const Style = t.object({
      aspect: t.optional(t.enum(['16:9', '4:3']), { default: '16:9' }),
      theme: t.optional(t.string()),
      seed: t.nullable(t.int()),
    });
    const Background = t.union(
      [
        t.object({ kind: t.literal('solid'), token: t.optional(t.enum(['surface'])) }),
        t.object({ kind: t.enum(['image', 'image-full']), src: t.string() }),
      ],
      { discriminator: 'kind' }
    );
    const Deck = t.object({
      formatVersion: t.literal(2),
      style: Style,
      background: t.optional(Background),
      slides: t.array(t.object({ id: t.string(), hidden: t.optional(t.boolean()) })),
      labels: t.record(t.string()),
      props: t.json(),
      tree: Tree,
    });
    type Deck = Infer<typeof Deck>;
    expectTypeOf<Deck['formatVersion']>().toEqualTypeOf<2>();
    expectTypeOf<Deck['style']>().toEqualTypeOf<{
      aspect: '16:9' | '4:3';
      theme?: string;
      seed: number | null;
    }>();
    expectTypeOf<Deck['background']>().toEqualTypeOf<
      | { kind: 'solid'; token?: 'surface' }
      | { kind: 'image' | 'image-full'; src: string }
      | undefined
    >();
    expectTypeOf<Deck['slides']>().toEqualTypeOf<{ id: string; hidden?: boolean }[]>();
    expectTypeOf<Deck['labels']>().toEqualTypeOf<Record<string, string>>();
    expectTypeOf<Deck['props']>().toEqualTypeOf<JsonValue>();
    expectTypeOf<Deck['tree']>().toEqualTypeOf<TreeNode>();
    expectTypeOf<Infer<ReturnType<typeof t.refine<typeof Style>>>>().toEqualTypeOf<
      Infer<typeof Style>
    >();

    const result = validate(Deck, {});
    if (result.ok) expectTypeOf(result.value).toEqualTypeOf<Deck>();
    expect(result.ok).toBe(false);
  });
});
