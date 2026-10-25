// @vitest-environment node
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { HOSTILE_SAMPLES, hostileSamplesJson } from '../src/render/hostile/index.ts';
import { renderCatalogFromBuild } from '../src/render/renderer/index.ts';
import { validateDraft } from '../src/validate/index.ts';
import { build, catalog, invalidOrInert } from './hostile-helpers.ts';

const input = (sample: (typeof HOSTILE_SAMPLES)[number]) => sample.text ?? sample.tree;
const framed = (sample: (typeof HOSTILE_SAMPLES)[number]) =>
  sample.text !== undefined
    ? `{"id":"layout-doc","props":{"title":"Hostile"},"children":[${sample.text}]}`
    : { id: 'layout-doc', props: { title: 'Hostile' }, children: [sample.tree] };

describe('hostile corpus', () => {
  it('covers every hostile class, including the new ones', () => {
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
  });

  it('keeps tests/fixtures/hostile/corpus.json in step with the samples', () => {
    const fixture = JSON.parse(
      readFileSync(join(import.meta.dirname, '../../../tests/fixtures/hostile/corpus.json'), 'utf8')
    );
    expect(fixture).toEqual(JSON.parse(JSON.stringify(hostileSamplesJson())));
  });

  it('is invalid or inert through validateDraft and the player, bare and framed', async () => {
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
  });
});

describe('specific hostile classes', () => {
  const codes = (value: unknown) =>
    validateDraft(value, { catalog, frameRoots: false }).diagnostics.map((d) => d.code);
  const byId = (id: string) => {
    const sample = HOSTILE_SAMPLES.find((s) => s.id === id);
    if (!sample) throw new Error(id);
    return sample.text ?? sample.tree;
  };

  it('refuses own prototype keys from raw JSON', () => {
    expect(codes(byId('prototype-proto-in-props'))).toContain('prototype-key');
    expect(codes(byId('prototype-constructor-in-block'))).toContain('prototype-key');
    expect(codes(byId('prototype-proto-node-key'))).toContain('prototype-key');
  });

  it('judges duplicate keys by the value that wins', () => {
    expect(codes(byId('duplicate-href-key'))).toContain('sink');
    expect(codes(byId('duplicate-id-key'))).toContain('tier-denied');
  });

  it('refuses split, cased, protocol-relative and nested script URLs', () => {
    for (const id of [
      'url-tab-split-scheme',
      'url-newline-and-case',
      'url-protocol-relative',
      'url-nested-deep-href',
      'unicode-zero-width-scheme',
    ]) {
      expect(codes(byId(id)), id).toContain('sink');
    }
  });

  it('refuses the four link and image gaps closed by the security review', async () => {
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
  });

  it('refuses depth bombs before measuring them', () => {
    const result = validateDraft(byId('deep-props-array-bomb'), { catalog, frameRoots: false });
    expect(result).toMatchObject({ ok: false, status: 'over-limits' });
  });

  it('strips a developer-tier relative link at paint (untrusted at paint)', async () => {
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
  });
});
