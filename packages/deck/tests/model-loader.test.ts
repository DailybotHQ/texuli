// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  copyPlainData,
  DEFAULT_UNTRUSTED_DECK_LIMITS,
  jsonErrorOffset,
  lineColumn,
  loadUntrustedDeck,
  stripHiddenCharacters,
  utf8Length,
} from '../src/model/index.ts';
import type { DeckDiagnostic } from '../src/schema/index.ts';

type Json = Record<string, unknown>;

const deck = (
  slides: unknown[] = [{ id: 'one', layout: 'quote', props: { quote: 'Hello.' } }]
): Json => ({
  formatVersion: 2,
  meta: { title: 'Loader deck' },
  slides,
});

const codes = (issues: readonly DeckDiagnostic[]) => issues.map((issue) => issue.code);

describe('loadUntrustedDeck: valid input', () => {
  it('loads JSON text and plain data into a fresh validated copy', () => {
    const data = deck();
    for (const input of [JSON.stringify(data), data]) {
      const result = loadUntrustedDeck(input);
      expect(result.ok).toBe(true);
      expect(result.from).toBe('v2');
      expect(result.issues).toEqual([]);
      expect(result.deck).toEqual(data);
      expect(result.deck).not.toBe(data);
      expect(result.steps).toHaveLength(1);
    }
  });

  it('passes the parse options through (host hooks)', () => {
    const result = loadUntrustedDeck(
      deck([
        { id: 'a', layout: 'free', blocks: [{ type: 'component', component: 'ghost', props: {} }] },
      ]),
      {
        knownComponents: ['charts-bar'],
      }
    );
    expect(codes(result.issues)).toEqual(['unknown-component']);
  });
});

describe('loadUntrustedDeck: hostile corpus', () => {
  it('refuses JSON text over 1 MiB before parsing it', () => {
    const big = JSON.stringify(
      deck([
        {
          id: 'one',
          layout: 'free',
          notes: 'x',
          blocks: [{ type: 'text', markdown: 'é'.repeat(600_000) }],
        },
      ])
    );
    expect(utf8Length(big)).toBeGreaterThan(DEFAULT_UNTRUSTED_DECK_LIMITS.maxBytes);
    const result = loadUntrustedDeck(big);
    expect(codes(result.issues)).toEqual(['too-large']);
    expect(result.ok).toBe(false);
    expect(
      loadUntrustedDeck(big, { maxBytes: 4 * 1024 * 1024 }).issues.map((i) => i.code)
    ).not.toContain('too-large');
  });

  it('refuses parsed data over 1 MiB, and bounds the copy', () => {
    const blocks = Array.from({ length: 1500 }, () => ({
      type: 'text',
      markdown: 'y'.repeat(1000),
    }));
    const result = loadUntrustedDeck(deck([{ id: 'one', layout: 'free', blocks }]));
    expect(codes(result.issues)).toEqual(['too-large']);
  });

  it('refuses deep nesting on the text and on data, without recursion', () => {
    const text = `${'['.repeat(100_000)}${']'.repeat(100_000)}`;
    expect(codes(loadUntrustedDeck(text).issues)).toEqual(['too-deep']);
    let nested: Json = { type: 'text' };
    for (let i = 0; i < 50_000; i++) nested = { type: 'grid', blocks: [nested] };
    const result = loadUntrustedDeck(deck([{ id: 'one', layout: 'free', blocks: [nested] }]));
    expect(codes(result.issues)).toContain('too-deep');
    expect(result.ok).toBe(false);
  });

  it('reports invalid JSON with a line and column', () => {
    const result = loadUntrustedDeck('{\n  "formatVersion": 2,\n  "meta": { "title": "T" ,, }\n}');
    expect(codes(result.issues)).toEqual(['invalid-json']);
    expect(result.issues[0]?.source).toEqual({ line: 3, column: 27 });
    expect(result.issues[0]?.message).toContain('line 3, column 27');
    expect(lineColumn('ab\ncd', jsonErrorOffset('ab\ncd'))).toEqual({ line: 1, column: 1 });
    for (const [bad, offset] of [
      ['{"a": 1', 7],
      ['{"a": tru}', 6],
      ['[1, 2,]', 6],
      ['{"a": "\u0001"}', 7],
      ['{"a": 1} x', 9],
      ['"\\x"', 1],
      ['', 0],
    ] as const) {
      expect(jsonErrorOffset(bad), bad).toBe(offset);
    }
    expect(jsonErrorOffset('{"a": [1, -2.5e3, true, null, "\\u00e9"]}')).toBe(-1);
  });

  it('refuses cycles, getters, class instances, functions and symbols, with paths', () => {
    const cyclic = deck();
    (cyclic.meta as Json).self = cyclic;
    const getter = deck();
    Object.defineProperty(getter.meta, 'title', { enumerable: true, get: () => 'Sneaky' });
    class Slide {
      id = 'one';
    }
    const cases: [unknown, string, string][] = [
      [cyclic, 'cycle', '/meta/self'],
      [getter, 'invalid-input', '/meta/title'],
      [deck([new Slide()]), 'invalid-input', '/slides/0'],
      [
        deck([{ id: 'one', layout: 'quote', props: { quote: () => 'x' } }]),
        'invalid-input',
        '/slides/0/props/quote',
      ],
      [{ ...deck(), [Symbol('x')]: 1 }, 'invalid-input', ''],
      [
        deck([{ id: 'one', layout: 'quote', props: { quote: Number.NaN } }]),
        'not-finite',
        '/slides/0/props/quote',
      ],
      [new Date(), 'invalid-input', ''],
    ];
    for (const [input, code, pointer] of cases) {
      const result = loadUntrustedDeck(input);
      expect(result.ok, code).toBe(false);
      expect(
        result.issues.map((i) => `${i.code} ${i.pointer}`),
        code
      ).toContain(`${code} ${pointer}`);
    }
    const sparse: unknown[] = [];
    sparse[2] = { id: 'one' };
    expect(codes(loadUntrustedDeck(deck(sparse)).issues)).toContain('invalid-input');
  });

  it('refuses prototype keys from JSON text and data, every one of them', () => {
    const text =
      '{"formatVersion":2,"meta":{"title":"T","__proto__":{"polluted":true}},"slides":[{"id":"a","layout":"quote","props":{"quote":"Q","constructor":{"prototype":{}}}}]}';
    const result = loadUntrustedDeck(text);
    expect(result.issues.map((i) => `${i.code} ${i.pointer}`)).toEqual([
      'unsafe-key /meta/__proto__',
      'unsafe-key /slides/0/props/constructor',
    ]);
    expect(({} as Json).polluted).toBeUndefined();
    const data = JSON.parse(text);
    expect(codes(loadUntrustedDeck(data).issues)).toEqual(['unsafe-key', 'unsafe-key']);
  });

  it('strips bidi controls and zero-width characters, keeping ZWJ, with warnings', () => {
    const result = loadUntrustedDeck(
      deck([
        {
          id: 'one',
          layout: 'quote',
          props: { quote: 'Pay‮⁦ now​!', cite: 'Fam‍‌ily' },
          notes: 'line two\tthree\n',
        },
      ])
    );
    expect(result.ok).toBe(true);
    const slide = result.deck?.slides[0] as Json;
    expect(slide.props).toEqual({ quote: 'Pay now!', cite: 'Fam‍‌ily' });
    expect(slide.notes).toBe('line two\tthree\n');
    expect(result.issues.map((i) => `${i.code} ${i.severity} ${i.pointer}`)).toEqual([
      'hidden-characters warning /slides/0/props/quote',
      'hidden-characters warning /slides/0/notes',
    ]);
    expect(stripHiddenCharacters('a\u0000b\u009Fc﻿d؜e')).toBe('abcde');
    const same = 'plain';
    expect(stripHiddenCharacters(same)).toBe(same);
  });

  it('caps hidden-character warnings with one summary', () => {
    const slides = Array.from({ length: 30 }, (_, i) => ({
      id: `s${i}`,
      layout: 'quote',
      props: { quote: 'a​b' },
    }));
    const result = loadUntrustedDeck(deck(slides));
    expect(result.ok).toBe(true);
    expect(result.issues).toHaveLength(21);
    expect(result.issues[20]?.message).toContain('10 more');
  });

  it('refuses too many slides and too many nodes', () => {
    const slides = Array.from({ length: 201 }, (_, i) => ({
      id: `s${i}`,
      layout: 'quote',
      props: { quote: 'Q' },
    }));
    expect(loadUntrustedDeck(deck(slides)).issues.map((i) => `${i.code} ${i.pointer}`)).toEqual([
      'too-many /slides',
    ]);
    expect(codes(loadUntrustedDeck(deck(slides.slice(0, 20)), { maxSlides: 10 }).issues)).toEqual([
      'too-many',
    ]);
    const blocks = Array.from({ length: 1000 }, () => ({
      type: 'grid',
      blocks: Array.from({ length: 20 }, () => ({ type: 'text' })),
    }));
    expect(codes(loadUntrustedDeck(deck([{ id: 'one', layout: 'free', blocks }])).issues)).toEqual([
      'too-many',
    ]);
  });

  it('refuses non-object roots and unknown shapes', () => {
    for (const input of ['[]', '42', 'null', '"deck"', [], 42, null, undefined]) {
      const result = loadUntrustedDeck(input);
      expect(result.ok).toBe(false);
      expect(codes(result.issues)[0]).toMatch(/^invalid-input$/);
    }
    const unknown = loadUntrustedDeck({ hello: 'world' });
    expect(unknown.from).toBe('unknown');
    expect(codes(unknown.issues)[0]).toBe('invalid-deck');
  });

  it('keeps javascript: and protocol-relative URLs out of layout props', () => {
    const result = loadUntrustedDeck(
      deck([
        {
          id: 'a',
          layout: 'closing-cta',
          props: { title: 'Go', cta: { label: 'Open', href: 'javascript:alert(1)' } },
        },
        {
          id: 'b',
          layout: 'image-centered',
          props: { image: { src: '//evil.example/x.png', alt: 'x' } },
        },
        {
          id: 'c',
          layout: 'image-centered',
          props: { image: { src: 'http://example.com/x.png', alt: 'x' } },
        },
      ])
    );
    expect(result.issues.map((i) => `${i.code} ${i.pointer}`)).toEqual([
      'pattern /slides/0/props/cta/href',
      'pattern /slides/1/props/image/src',
      'pattern /slides/2/props/image/src',
    ]);
  });

  it('never throws, whatever the input', () => {
    const proxy = new Proxy(
      {},
      {
        ownKeys() {
          throw new Error('trap');
        },
        getPrototypeOf() {
          throw new Error('trap');
        },
      }
    );
    for (const input of [
      proxy,
      Symbol('x'),
      () => 1,
      10n,
      new Map([[1, 2]]),
      '\u0000',
      '{'.repeat(10),
    ]) {
      expect(() => loadUntrustedDeck(input)).not.toThrow();
      expect(loadUntrustedDeck(input).ok).toBe(false);
    }
  });

  it('copyPlainData drops what it refuses and reports it', () => {
    const input: Json = { a: 1, b: { c: [1, 2] }, d: undefined };
    Object.defineProperty(input, 'e', { enumerable: true, get: () => 1 });
    const copy = copyPlainData(input);
    expect(copy.value).toEqual({ a: 1, b: { c: [1, 2] } });
    expect(copy.failed).toBe(true);
    expect(codes(copy.issues)).toEqual(['invalid-input']);
  });
});
