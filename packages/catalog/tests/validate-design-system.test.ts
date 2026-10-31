// @vitest-environment node
import { readFileSync } from 'node:fs';
import { checkDesignSystemReference } from '@texuli/spec/design-system';
import { describe, expect, it } from 'vitest';
import { buildCatalog } from '../src/build/index.ts';
import { discoverManifestGroups } from '../src/build/node.ts';
import { type DraftDesignSystemCheck, validateDraft } from '../src/validate/index.ts';

/**
 * Spec 0.10.0 (ADR-024, T-ds-blueprint): the envelope's `designSystem` in
 * `validateDraft`. The shape and the `ref` grammar are always checked; an
 * inline document is checked by the host's `checkDesignSystem` (here the
 * spec's `checkDesignSystemReference`, passed as is) at the draft's tier,
 * with the design-system codes and JSON paths under `$.designSystem`.
 */
const { renderCatalogFromBuild } = await import('../src/render/renderer/index.ts');
const build = await buildCatalog(await discoverManifestGroups());
const catalog = renderCatalogFromBuild(build.catalog);
const spec = (path: string) =>
  JSON.parse(readFileSync(new URL(`../../spec/${path}`, import.meta.url), 'utf8'));
const acme = spec('fixtures/design-systems/acme.json') as Record<string, unknown>;
const minimal = spec('fixtures/design-systems/minimal.json') as Record<string, unknown>;
const check: DraftDesignSystemCheck = checkDesignSystemReference;

function envelope(designSystem: unknown) {
  return {
    format: 'texuli-blueprint',
    version: 1,
    id: 'design-system-test',
    catalog: build.hash,
    status: 'draft',
    createdAt: '2026-10-30T09:00:00Z',
    updatedAt: '2026-10-30T09:00:00Z',
    generator: { kind: 'agent', name: 'Fictional agent' },
    spec: '0.10.0',
    ...(designSystem === undefined ? {} : { designSystem }),
    tree: {
      id: 'layout-doc',
      props: { title: 'Week 44' },
      children: [{ id: 'blocks-text', props: { block: { type: 'text', markdown: 'Shipped.' } } }],
    },
  };
}

type Options = { tier?: 'developer' | 'untrusted'; checked?: boolean };
const run = (designSystem: unknown, { tier, checked = true }: Options = {}) =>
  validateDraft(envelope(designSystem), {
    catalog,
    ...(tier ? { tier } : {}),
    ...(checked ? { checkDesignSystem: check } : {}),
  });
const found = (designSystem: unknown, options?: Options) =>
  run(designSystem, options)
    .diagnostics.filter((d) => d.check === 'design-system')
    .map((d) => `${d.code} ${d.path}`);

describe('validateDraft: the envelope design system', () => {
  it('accepts a reference or an inline document and keeps it on the earned envelope', () => {
    for (const designSystem of [
      { ref: 'acme@2.1.0' },
      { ref: 'texuli:violet' },
      { inline: acme },
    ]) {
      const result = run(designSystem);
      expect(result.ok, JSON.stringify(designSystem).slice(0, 40)).toBe(true);
      expect(result.checks['design-system']).toBe('pass');
      expect(result.envelope?.designSystem).toEqual(designSystem);
    }
    // No design system is nothing to check; a tree without an envelope skips it.
    expect(run(undefined).checks['design-system']).toBe('pass');
    const bare = validateDraft(envelope(undefined).tree, { catalog });
    expect(bare.checks['design-system']).toBe('skipped');
  });

  it('checks the shape and the ref grammar with stable codes, with or without the host check', () => {
    for (const checked of [true, false]) {
      for (const [value, expected] of [
        [{ ref: 'acme@^2' }, checked ? 'extends-range $.designSystem.ref' : 'invalid-value'],
        [{ ref: 'https://cdn.example/acme.json' }, checked ? 'url-refused' : 'invalid-value'],
        [{ ref: '../acme@1.0.0' }, checked ? 'url-refused' : 'invalid-value'],
        [{ ref: 'acme@1.0.0', inline: minimal }, 'invalid-value $.designSystem'],
        [{}, 'required $.designSystem'],
        [{ ref: 'acme@1.0.0', css: 'x' }, 'unknown-key $.designSystem.css'],
        [{ inline: 'acme' }, 'invalid-type $.designSystem.inline'],
        ['acme@1.0.0', 'invalid-type $.designSystem'],
      ] as const) {
        const result = found(value, { checked });
        expect(result[0], `${checked} ${JSON.stringify(value)}`).toContain(expected);
        expect(run(value, { checked }).ok).toBe(false);
      }
    }
    // Without the host check, an inline document passes on shape and the receipt says skipped.
    const unchecked = run({ inline: { ...minimal, color: { css: 'x' } } }, { checked: false });
    expect(unchecked.ok).toBe(true);
    expect(unchecked.checks['design-system']).toBe('skipped');
  });

  it('validates inline documents at the untrusted tier: data URLs and remote assets are refused', () => {
    const png = `data:image/png;base64,${'A'.repeat(64)}`;
    const withLogo = { inline: { ...minimal, assets: { favicon: png } } };
    expect(found(withLogo)).toEqual(['url-refused $.designSystem.inline.assets.favicon']);
    expect(found(withLogo, { tier: 'developer' })).toEqual([]);
    for (const src of ['https://cdn.example/logo.png', '//cdn.example/logo.png', 'javascript:x']) {
      const remote = { inline: { ...minimal, assets: { logo: { light: src } } } };
      expect(found(remote, { tier: 'developer' }), src).toEqual([
        'url-refused $.designSystem.inline.assets.logo.light',
      ]);
    }
    const font = {
      inline: {
        ...minimal,
        typography: {
          families: {
            sans: { stack: ['Acme'], files: [{ src: 'https://fonts.example/a.woff2' }] },
          },
        },
      },
    };
    expect(found(font)).toEqual([
      'url-refused $.designSystem.inline.typography.families.sans.files[0].src',
    ]);
  });

  it('refuses hostile inline documents: CSS injection, invisible characters, prototype keys, huge documents', () => {
    const hostile: [string, unknown, string][] = [
      [
        'css in a color',
        { color: { brand: { seed: 'red;} body{background:url(//x.example)}' } } },
        'invalid-value $.designSystem.inline.color.brand.seed',
      ],
      [
        'css in a font name',
        { typography: { families: { sans: { stack: ['Acme"; } * { color: red'] } } } },
        'invalid-value $.designSystem.inline.typography.families.sans.stack[0]',
      ],
      [
        'bidi override in a font name',
        {
          typography: {
            families: { sans: { stack: [`Acme${String.fromCodePoint(0x202e)}Sans`] } },
          },
        },
        'invalid-value $.designSystem.inline.typography.families.sans.stack[0]',
      ],
      [
        'zero-width space in an id',
        { id: `ac${String.fromCodePoint(0x200b)}me` },
        'invalid-value $.designSystem.inline.id',
      ],
      [
        'raw css section',
        { css: ':root{--tx-primary:red}' },
        'unknown-key $.designSystem.inline.css',
      ],
      [
        'expression in a role',
        {
          color: {
            brand: { seed: '#4f46e5' },
            roles: { light: { primary: 'expression(alert(1))' } },
          },
        },
        'invalid-value $.designSystem.inline.color.roles.light.primary',
      ],
    ];
    for (const [name, patch, expected] of hostile) {
      const result = found({ inline: { ...minimal, ...(patch as object) } });
      expect(result[0], name).toBe(expected);
    }
    // Prototype keys, as JSON.parse leaves them (own properties).
    for (const text of [
      `{"inline":{"__proto__":{"polluted":true},${JSON.stringify(minimal).slice(1)}}`,
      '{"inline":{"format":"texuli/design-system","formatVersion":1,"id":"a","version":"1.0.0","name":"A","constructor":{"x":1}}}',
      '{"__proto__":{"ref":"acme@1.0.0"}}',
    ]) {
      const value = JSON.parse(text);
      const result = found(value);
      expect(result.join(' '), text).toMatch(/unknown-key \$\.designSystem/);
      expect(({} as Record<string, unknown>).polluted).toBeUndefined();
    }
    // A huge document (about 40,000 values) stops at the value cap, quickly.
    const huge = {
      inline: {
        ...minimal,
        voice: {
          lexicon: Object.fromEntries(Array.from({ length: 40_000 }, (_, i) => [`w${i}`, `v${i}`])),
        },
      },
    };
    const started = performance.now();
    const result = run(huge);
    expect(performance.now() - started).toBeLessThan(2_000);
    expect(result.ok).toBe(false);
    const codes = result.diagnostics.filter((d) => d.check === 'design-system');
    expect(codes.length).toBeGreaterThan(0);
    expect(codes.length).toBeLessThanOrEqual(64);
    expect(codes.map((d) => d.code)).toContain('invalid-value');
  });

  it('reads a design system from text input, inside the text cap', () => {
    const text = JSON.stringify(envelope({ inline: acme }));
    expect(validateDraft(text, { catalog, checkDesignSystem: check }).ok).toBe(true);
    const tooBig = JSON.stringify(
      envelope({ inline: { ...minimal, description: 'x'.repeat(2_000_000) } })
    );
    expect(validateDraft(tooBig, { catalog, checkDesignSystem: check }).diagnostics[0]?.code).toBe(
      'too-large'
    );
  });
});
