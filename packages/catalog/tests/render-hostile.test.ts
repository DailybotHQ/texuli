// @vitest-environment node

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { resetArtifactFrameIds } from '../src/render/frame/index.ts';
import {
  assertInertRoots,
  HOSTILE_SAMPLES,
  hardenInertRoots,
  hostileSamplesJson,
  looksExecutable,
  runHostileCorpus,
  runHostileSample,
} from '../src/render/hostile/index.ts';
import {
  type RenderComponentSpec,
  type RenderNode,
  renderCatalogFromBuild,
  renderCatalogFromSpecs,
} from '../src/render/renderer/index.ts';
import { RICHTEXT_LIMITS } from '../src/render/richtext/index.ts';
import { validateDraft } from '../src/validate/index.ts';
import { build, catalog, invalidOrInert } from './hostile-helpers.ts';
import { scenario } from './scenario.ts';

describe('hostile helpers and samples', () => {
  const card: RenderComponentSpec = {
    id: 'card',
    label: 'Card',
    agentEmittable: true,
    emit: ['developer', 'untrusted'],
    props: [
      {
        name: 'variant',
        kind: 'enum',
        enumValues: ['elevated', 'flat'],
        default: 'elevated',
      },
      { name: 'title', kind: 'string' },
      { name: 'href', kind: 'string', trust: 'untrusted' },
      { name: 'src', kind: 'string', trust: 'untrusted' },
    ],
  };

  const dialog: RenderComponentSpec = {
    id: 'dialog',
    label: 'Dialog',
    agentEmittable: false,
    emit: ['developer'],
    props: [{ name: 'title', kind: 'string', required: true }],
  };

  const alertDialog: RenderComponentSpec = {
    id: 'alert-dialog',
    label: 'AlertDialog',
    agentEmittable: false,
    emit: ['developer'],
    props: [
      { name: 'title', kind: 'string', required: true },
      { name: 'confirmLabel', kind: 'string' },
    ],
  };

  const catalog = renderCatalogFromSpecs([card, dialog, alertDialog]);

  /** Runs after every test and between the scenarios of a grouped test. */
  const reset = () => {
    resetArtifactFrameIds();
  };
  afterEach(reset);

  it('hostile helpers detect executable strings, export a frozen corpus and judge srcset like paint', async () => {
    await scenario(
      'detects executable strings and forbidden props in trees',
      async () => {
        expect(looksExecutable('javascript:alert(1)')).toBe(true);
        expect(looksExecutable('https://example.com')).toBe(false);
        const bad: RenderNode[] = [
          {
            kind: 'component',
            id: 'card',
            props: { class: 'x', title: 'ok' },
            children: [],
          },
        ];
        expect(assertInertRoots(bad).some((f) => f.includes('class'))).toBe(true);
      },
      reset
    );
    await scenario(
      'exports a frozen JSON-serializable corpus',
      async () => {
        const json = hostileSamplesJson();
        expect(Array.isArray(json)).toBe(true);
        expect(JSON.parse(JSON.stringify(json))).toEqual(json);
        expect(HOSTILE_SAMPLES.length).toBeGreaterThanOrEqual(12);
      },
      reset
    );
    await scenario(
      'hardenInertRoots judges srcset by the untrusted image policy, like the paint pass',
      async () => {
        const hardened = hardenInertRoots([
          {
            kind: 'component',
            id: 'media-image',
            props: {
              srcset: 'http://evil.example/track.webp 1x',
              fallbackSrcset: 'https://example.com/a.webp 1x, https://example.com/a2x.webp 2x',
            },
            children: [],
          },
        ]);
        const node = hardened[0];
        expect(node?.kind).toBe('component');
        if (node?.kind === 'component') {
          expect(Object.hasOwn(node.props, 'srcset')).toBe(false);
          expect(node.props.fallbackSrcset).toBe(
            'https://example.com/a.webp 1x, https://example.com/a2x.webp 2x'
          );
        }
      },
      reset
    );
  });

  it('runHostileSample keeps script URLs, fake chrome, bidi labels, giant trees, HTML props and richtext links inert', async () => {
    await scenario(
      'renders script URLs without executable props surviving',
      async () => {
        const result = runHostileSample(
          HOSTILE_SAMPLES.find((s) => s.id === 'script-javascript-href')!,
          { catalog }
        );
        expect(result.inert).toBe(true);
        expect(result.failures).toEqual([]);
        // href may be dropped as invalid/unknown policy at host; never javascript:
        const roots = result.render?.roots ?? result.frame?.roots ?? [];
        for (const node of roots) {
          if (node.kind === 'component') {
            expect(String(node.props.href ?? '')).not.toMatch(/javascript:/i);
          }
        }
      },
      reset
    );
    await scenario(
      'placeholders fake dialog chrome under untrusted',
      async () => {
        const result = runHostileSample(
          HOSTILE_SAMPLES.find((s) => s.id === 'fake-dialog-overlay')!,
          {
            catalog,
          }
        );
        expect(result.inert).toBe(true);
        expect(result.render?.roots[0]).toMatchObject({
          kind: 'placeholder',
          reason: 'tier-denied',
        });
      },
      reset
    );
    await scenario(
      'scrubs bidi from frame labels',
      async () => {
        const result = runHostileSample(
          HOSTILE_SAMPLES.find((s) => s.id === 'bidi-override-title')!,
          {
            catalog,
          }
        );
        expect(result.inert).toBe(true);
        expect(result.frame?.label).not.toMatch(/[\u202a-\u202e\u200b-\u200f]/);
      },
      reset
    );
    await scenario(
      'rejects giant trees at the limits gate',
      async () => {
        const deep = runHostileSample(HOSTILE_SAMPLES.find((s) => s.id === 'giant-depth')!, {
          catalog,
        });
        expect(deep.inert).toBe(true);
        expect(deep.limits?.withinLimits).toBe(false);
        expect(deep.limits?.roots).toEqual([]);

        const wide = runHostileSample(HOSTILE_SAMPLES.find((s) => s.id === 'giant-breadth')!, {
          catalog,
        });
        expect(wide.inert).toBe(true);
        expect(wide.limits?.withinLimits).toBe(false);
      },
      reset
    );
    await scenario(
      'drops HTML string props and strips class/style',
      async () => {
        const html = runHostileSample(HOSTILE_SAMPLES.find((s) => s.id === 'html-string-prop')!, {
          catalog,
        });
        expect(html.inert).toBe(true);
        expect(html.render?.roots ?? []).toEqual([]);

        const styled = runHostileSample(
          HOSTILE_SAMPLES.find((s) => s.id === 'style-class-passthrough')!,
          { catalog }
        );
        expect(styled.inert).toBe(true);
        const root = styled.render?.roots[0];
        if (root?.kind === 'component') {
          expect(root.props.class).toBeUndefined();
          expect(root.props.style).toBeUndefined();
          expect(root.props.className).toBeUndefined();
        }
      },
      reset
    );
    await scenario(
      'refuses script links in richtext',
      async () => {
        const result = runHostileSample(
          HOSTILE_SAMPLES.find((s) => s.id === 'prompt-injection-richtext')!,
          { catalog }
        );
        expect(result.inert).toBe(true);
        expect(result.failures).toEqual([]);
      },
      reset
    );
  });

  it('looksExecutable reads event handlers in linear time and matches the old pattern', () => {
    // Each pair is a value and whether `/on\w+\s*=/i` (with the scheme
    // alternatives) matched it.
    for (const [value, expected] of [
      ['<img src=x onerror=alert(1)>', true],
      ['ONLOAD = go()', true],
      ['xonclick\u2028=1', true],
      ['data-on_x=1', true],
      ['on=1', false],
      ['onx', false],
      ['on x=1', false],
      ['button-on =1', false],
      ['data:  text/html,x', true],
      ['< script', true],
      ['once upon a time', false],
    ] as const) {
      expect(looksExecutable(value), value).toBe(expected);
    }
    // `on` repeated restarted the old `on\w+` at every pair and backtracked
    // to each word end: quadratic. The draft sink scan calls this on every
    // string with no length cap, so the probe is twice the rich-text cap.
    const size = 2 * RICHTEXT_LIMITS.source;
    for (const value of [
      'on'.repeat(size / 2),
      `${'on'.repeat(size / 2 - 1)}=`,
      `o${'n'.repeat(size - 1)}`,
    ]) {
      let best = Number.POSITIVE_INFINITY;
      for (let run = 0; run < 3; run += 1) {
        const started = performance.now();
        looksExecutable(value);
        best = Math.min(best, performance.now() - started);
      }
      expect(best, `${value.slice(0, 8)}…: ${best.toFixed(2)} ms`).toBeLessThan(20);
    }
    expect(looksExecutable(`${'on'.repeat(size / 2 - 1)}=`)).toBe(true);
  });

  it('marks the full corpus inert', () => {
    const report = runHostileCorpus({ catalog });
    if (!report.ok) {
      const detail = report.results
        .filter((r) => !r.inert)
        .map((r) => `${r.sample.id}: ${r.failures.join('; ')}`)
        .join('\n');
      throw new Error(`Hostile corpus failures:\n${detail}`);
    }
    expect(report.ok).toBe(true);
    expect(report.failureCount).toBe(0);
    expect(report.results.length).toBe(HOSTILE_SAMPLES.length);
  });
});

describe('hostile corpus through the pipeline', () => {
  const input = (sample: (typeof HOSTILE_SAMPLES)[number]) => sample.text ?? sample.tree;
  const framed = (sample: (typeof HOSTILE_SAMPLES)[number]) =>
    sample.text !== undefined
      ? `{"id":"layout-doc","props":{"title":"Hostile"},"children":[${sample.text}]}`
      : { id: 'layout-doc', props: { title: 'Hostile' }, children: [sample.tree] };

  it('the corpus covers every class, matches the fixture file, and is invalid or inert bare and framed', async () => {
    // covers every hostile class, including the new ones
    {
      const categories = new Set(HOSTILE_SAMPLES.map((s) => s.category));
      for (const category of [
        'script-url',
        'bidi',
        'giant-tree',
        'deep-nesting',
        'unicode',
        'prototype',
        'oversized',
        'duplicate-key',
        'url-trick',
      ]) {
        expect(categories.has(category as never), category).toBe(true);
      }
      expect(HOSTILE_SAMPLES.length).toBeGreaterThanOrEqual(39);
    }
    // keeps tests/fixtures/hostile/corpus.json in step with the samples
    {
      const fixture = JSON.parse(
        readFileSync(
          join(import.meta.dirname, '../../../tests/fixtures/hostile/corpus.json'),
          'utf8'
        )
      );
      expect(fixture).toEqual(JSON.parse(JSON.stringify(hostileSamplesJson())));
    }
    // is invalid or inert through validateDraft and the player, bare and framed
    {
      const failures: string[] = [];
      let valid = 0;
      let total = 0;
      for (const sample of HOSTILE_SAMPLES) {
        if (input(sample) === undefined) continue;
        for (const [label, value, options] of [
          ['bare', input(sample), { frameRoots: false as const }],
          ['framed', framed(sample), {}],
        ] as const) {
          total += 1;
          const verdict = await invalidOrInert(value, options);
          if (verdict.valid) valid += 1;
          failures.push(...verdict.failures.map((f) => `${sample.id} (${label}): ${f}`));
        }
      }
      expect(failures).toEqual([]);
      expect(total).toBeGreaterThan(60);
      // Most hostile inputs are refused outright; the rest are valid and inert.
      expect(valid).toBeLessThan(total);
    }
  });

  describe('specific hostile classes', () => {
    const codes = (value: unknown) =>
      validateDraft(value, { catalog, frameRoots: false }).diagnostics.map((d) => d.code);
    const byId = (id: string) => {
      const sample = HOSTILE_SAMPLES.find((s) => s.id === id);
      if (!sample) throw new Error(id);
      return sample.text ?? sample.tree;
    };

    it('specific classes: prototype and duplicate keys, script URLs, link and image gaps, depth bombs and paint-time stripping', async () => {
      expect(codes(byId('prototype-proto-in-props'))).toContain('prototype-key');
      expect(codes(byId('prototype-constructor-in-block'))).toContain('prototype-key');
      expect(codes(byId('prototype-proto-node-key'))).toContain('prototype-key');
      expect(codes(byId('duplicate-href-key'))).toContain('sink');
      expect(codes(byId('duplicate-id-key'))).toContain('tier-denied');
      for (const id of [
        'url-tab-split-scheme',
        'url-newline-and-case',
        'url-protocol-relative',
        'url-nested-deep-href',
        'unicode-zero-width-scheme',
      ]) {
        expect(codes(byId(id)), id).toContain('sink');
      }
      // refuses the four link and image gaps closed by the security review
      {
        const zwsp = String.fromCharCode(0x200b);
        const gaps = [
          byId('url-credentials-host'),
          byId('unicode-bidi-host'),
          { id: 'card', props: { title: 'Bank', href: 'https:evil.example/login' } },
          { id: 'media-image', props: { src: `java${zwsp}script:alert(1)`, alt: 'Chart' } },
          { id: 'media-image', props: { src: `images/te${zwsp}am.webp`, alt: 'Team' } },
        ];
        for (const gap of gaps) {
          const label = JSON.stringify(gap);
          expect(codes(gap), label).toContain('sink');
          const verdict = await invalidOrInert(gap);
          expect(verdict.valid, label).toBe(false);
          expect(verdict.failures, label).toEqual([]);
        }
      }
      // refuses depth bombs before measuring them
      {
        const result = validateDraft(byId('deep-props-array-bomb'), { catalog, frameRoots: false });
        expect(result).toMatchObject({ ok: false, status: 'over-limits' });
      }
      // strips a developer-tier relative link at paint (untrusted at paint)
      {
        const chrome = renderCatalogFromBuild(build.catalog, { developer: 'all' });
        // Valid for an app-authored tree, refused for an agent's.
        // The sample's card minus its unknown title: only the relative link is in play.
        const relative = { id: 'card', props: { href: '/admin/delete-all' } };
        const developer = await invalidOrInert(relative, {
          frameRoots: false,
          tier: 'developer',
          renderCatalog: chrome,
        });
        expect(developer.valid).toBe(true);
        // The painted props pass the untrusted policy: the player dropped the href.
        expect(developer.failures).toEqual([]);
        expect(codes(relative)).toContain('sink');
        expect(codes(byId('url-developer-only-relative'))).toContain('sink');
      }
    });
  });
});

describe('seeded hostile fuzz', () => {
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
        return deepArray(
          chance(0.3) ? 150 + Math.floor(random() * 150) : Math.floor(random() * 20)
        );
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
      // Benign nodes carry only declared props (a block), so they stay valid
      // however the catalog's id list (and with it the sequence) grows.
      const props = safe ? {} : object(depth, safe);
      if (id.startsWith('blocks-') || (!safe && chance(0.2))) {
        props.block = safe
          ? { type: 'text', markdown: pick(SAFE_STRINGS) }
          : { type: pick(BLOCK_TYPES), ...object(depth + 1, false) };
      }
      const out: Record<string, unknown> = { id, props };
      if (depth < 4 && chance(0.5)) {
        out.children = Array.from({ length: Math.floor(random() * 4) }, () =>
          node(depth + 1, safe)
        );
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

  it('seeded fuzz is deterministic, and every round of every seed is invalid or inert', async () => {
    await scenario('is deterministic: the same seed gives the same inputs', async () => {
      const a = generator(SEEDS[0] as number);
      const b = generator(SEEDS[0] as number);
      const c = generator((SEEDS[0] as number) + 1);
      const first = Array.from({ length: 25 }, () => JSON.stringify(a.next()));
      expect(Array.from({ length: 25 }, () => JSON.stringify(b.next()))).toEqual(first);
      expect(Array.from({ length: 25 }, () => JSON.stringify(c.next()))).not.toEqual(first);
    });
    await scenario(`every seed: ${ROUNDS} rounds are invalid or inert`, async () => {
      for (const seed of SEEDS) {
        const gen = generator(seed);
        const failures: string[] = [];
        let valid = 0;
        for (let round = 0; round < ROUNDS; round += 1) {
          const input = gen.next();
          const verdict = await invalidOrInert(input);
          if (verdict.valid) valid += 1;
          failures.push(...verdict.failures.map((f) => `seed ${seed} round ${round}: ${f}`));
          if (failures.length > 10) break;
        }
        expect(failures).toEqual([]);
        // Benign rounds keep the valid branch covered too.
        expect(valid).toBeGreaterThan(0);
        expect(valid).toBeLessThan(ROUNDS);
        expect(({} as Record<string, unknown>).polluted).toBeUndefined();
      }
    });
  }, 180000);
});
