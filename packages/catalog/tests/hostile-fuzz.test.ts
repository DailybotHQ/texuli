// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { build, invalidOrInert } from './hostile-helpers.ts';

/**
 * Deterministic, seeded fuzz rounds: random hostile trees and raw JSON (no
 * network, fixed seeds, a few seconds). Every input must be invalid or inert
 * through validateDraft and both player policies.
 */

/** mulberry32: a small, fast, seedable PRNG. */
function prng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const HOSTILE_STRINGS = [
  'javascript:alert(1)',
  'java\tscript:alert(1)',
  ' JaVa\nScRiPt:alert(1)',
  'vbscript:msgbox(1)',
  'data:text/html,<script>alert(1)</script>',
  'data:image/svg+xml,<svg onload="alert(1)"/>',
  '//evil.example/steal',
  '/admin/delete-all',
  'https://bank.example@evil.example/login',
  '<img src=x onerror=alert(1)>',
  '<script>alert(1)</script>',
  'Pay\u202epal',
  '\u2066Secure\u2069',
  'java\u200bscript:alert(1)',
  '{{constructor.constructor("alert(1)")()}}',
  '[Open](javascript:alert(1))',
  'https://example.com/ok',
  'images/ok.webp',
  'Plain text',
  'A'.repeat(3000),
];
const SAFE_STRINGS = ['Quarterly update', 'Shipped on time.', 'https://example.com/docs', 'Team'];
const KEYS = [
  'href',
  'src',
  'poster',
  'imageUrl',
  'linkHref',
  'title',
  'label',
  'description',
  'class',
  'style',
  'onClick',
  'onload',
  'innerHTML',
  'srcdoc',
  '__proto__',
  'constructor',
  'prototype',
  'block',
  'data',
  'series',
  'markdown',
  'text',
];
const BLOCK_TYPES = [
  'heading',
  'text',
  'list',
  'quote',
  'callout',
  'table',
  'cta',
  'image',
  'map',
  'evil',
];
const IDS = [
  ...build.catalog.tiers.untrusted,
  'dialog',
  'sheet',
  'app-nav',
  'card',
  'marquee',
  'script',
  'iframe',
];

interface Generator {
  next(): unknown;
}

function generator(seed: number): Generator {
  const random = prng(seed);
  const pick = <T>(list: readonly T[]): T => list[Math.floor(random() * list.length)] as T;
  const chance = (p: number) => random() < p;

  const deepArray = (depth: number): unknown => {
    let value: unknown = pick(HOSTILE_STRINGS);
    for (let i = 0; i < depth; i += 1) value = [value];
    return value;
  };

  const value = (depth: number, safe: boolean): unknown => {
    const roll = random();
    if (safe) return roll < 0.8 ? pick(SAFE_STRINGS) : Math.floor(random() * 100);
    if (roll < 0.45) return pick(HOSTILE_STRINGS);
    if (roll < 0.55) return chance(0.5) ? Math.floor(random() * 1e6) : chance(0.5);
    if (roll < 0.6) return null;
    if (roll < 0.65)
      return deepArray(chance(0.3) ? 150 + Math.floor(random() * 150) : Math.floor(random() * 20));
    if (depth > 3) return pick(HOSTILE_STRINGS);
    if (roll < 0.8)
      return Array.from({ length: Math.floor(random() * 4) }, () => value(depth + 1, false));
    return object(depth + 1, false);
  };

  const object = (depth: number, safe: boolean): Record<string, unknown> => {
    const out: Record<string, unknown> = {};
    const count = Math.floor(random() * 5);
    for (let i = 0; i < count; i += 1) {
      const key = safe ? pick(['title', 'label', 'description']) : pick(KEYS);
      // defineProperty keeps "__proto__" an own key, as JSON.parse would.
      Object.defineProperty(out, key, {
        value: value(depth, safe),
        enumerable: true,
        writable: true,
        configurable: true,
      });
    }
    return out;
  };

  const node = (depth: number, safe: boolean): Record<string, unknown> => {
    const id = safe ? pick(['blocks-text', 'layout-card', 'charts-sparkline']) : pick(IDS);
    const props = object(depth, safe);
    if (id.startsWith('blocks-') || chance(0.2)) {
      props.block = safe
        ? { type: 'text', markdown: pick(SAFE_STRINGS) }
        : { type: pick(BLOCK_TYPES), ...object(depth + 1, false) };
    }
    const out: Record<string, unknown> = { id, props };
    if (depth < 4 && chance(0.5)) {
      out.children = Array.from({ length: Math.floor(random() * 4) }, () => node(depth + 1, safe));
    }
    if (!safe && chance(0.08)) out.onclick = pick(HOSTILE_STRINGS);
    return out;
  };

  return {
    next() {
      const safe = chance(0.2);
      let tree: unknown = node(0, safe);
      if (chance(0.6)) {
        tree = {
          id: pick(['layout-doc', 'layout-page', 'layout-deck']),
          props: { title: 'Fuzz' },
          children: [tree],
        };
      }
      if (safe || chance(0.6)) return tree;
      // Raw JSON mutations a JS object cannot express.
      const text = JSON.stringify(tree);
      const mutation = random();
      if (mutation < 0.35) return text.replace('{"id":', '{"id":"layout-doc","id":');
      if (mutation < 0.6)
        return text.replace('"props":{', '"props":{"__proto__":{"polluted":"yes"},');
      if (mutation < 0.8)
        return text.replace(
          /"href":"[^"]*"/,
          '"href":"https://example.com","href":"javascript:alert(1)"'
        );
      return text.slice(0, Math.max(1, Math.floor(text.length * random())));
    },
  };
}

const SEEDS = [0x7e11, 0xbada55, 20261024];
const ROUNDS = 180;

describe('seeded hostile fuzz', () => {
  it('is deterministic: the same seed gives the same inputs', () => {
    const a = generator(SEEDS[0] as number);
    const b = generator(SEEDS[0] as number);
    const c = generator((SEEDS[0] as number) + 1);
    const first = Array.from({ length: 25 }, () => JSON.stringify(a.next()));
    expect(Array.from({ length: 25 }, () => JSON.stringify(b.next()))).toEqual(first);
    expect(Array.from({ length: 25 }, () => JSON.stringify(c.next()))).not.toEqual(first);
  });

  for (const seed of SEEDS) {
    it(`seed ${seed}: ${ROUNDS} rounds are invalid or inert`, async () => {
      const gen = generator(seed);
      const failures: string[] = [];
      let valid = 0;
      for (let round = 0; round < ROUNDS; round += 1) {
        const input = gen.next();
        const verdict = await invalidOrInert(input);
        if (verdict.valid) valid += 1;
        failures.push(...verdict.failures.map((f) => `round ${round}: ${f}`));
        if (failures.length > 10) break;
      }
      expect(failures).toEqual([]);
      // Benign rounds keep the valid branch covered too.
      expect(valid).toBeGreaterThan(0);
      expect(valid).toBeLessThan(ROUNDS);
      expect(({} as Record<string, unknown>).polluted).toBeUndefined();
    }, 60_000);
  }
});
