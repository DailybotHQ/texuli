// @vitest-environment node
/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { COMPONENT_TOKENS } from '../src/components/registry.ts';
import { SEMANTIC_ROLES } from '../src/contract/semantic.ts';
import { parseDsColor } from '../src/design-system/color.ts';
import * as compileEntry from '../src/design-system/compile.ts';
import {
  type CompiledDesignSystem,
  canonicalJson,
  checkDesignSystemGuarantees,
  checkDesignSystemIndicators,
  compileDesignSystem,
  DESIGN_SYSTEM_ATTRIBUTES,
  type DesignSystemFailure,
  evaluateDesignSystemIndicators,
  resolveDesignSystem,
  resolveDesignSystemSync,
  sha256Hex,
} from '../src/design-system/compile.ts';
import * as compileCore from '../src/design-system/compile-core.ts';
import { isSafeCompiledValue } from '../src/design-system/css-value.ts';
import * as validateEntry from '../src/design-system/validate.ts';
import { chartColorDistance } from '../src/palette/charts.ts';
import { contrastRatio } from '../src/palette/contrast.ts';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
type Doc = Record<string, unknown>;
const json = (path: string): Doc => JSON.parse(readFileSync(join(root, path), 'utf8'));
const acme = json('packages/spec/fixtures/design-systems/acme.json');
const minimal = json('packages/spec/fixtures/design-systems/minimal.json');
const knobs = json('packages/tokens/tests/fixtures/design-systems/protoyard-knobs.json');

const doc = (extra: Doc = {}): Doc => ({ ...structuredClone(minimal), ...extra });
const ok = (result: CompiledDesignSystem | DesignSystemFailure): CompiledDesignSystem => {
  if (!result.ok) throw new Error(JSON.stringify(result.errors, null, 2));
  return result;
};
const codes = (result: CompiledDesignSystem | DesignSystemFailure) =>
  result.ok ? [] : result.errors.map((issue) => [issue.code, issue.path]);

/** The acme document with its `texuli:violet` base loaded from the library. */
async function resolvedAcme(variant?: string): Promise<Doc> {
  const resolved = await resolveDesignSystem(acme, {
    trust: 'developer',
    ...(variant ? { variant } : {}),
  });
  if (!resolved.ok) throw new Error(JSON.stringify(resolved.errors));
  return resolved.document as unknown as Doc;
}

/** Every object's keys reversed, at every depth. */
function reorder(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(reorder);
  if (value === null || typeof value !== 'object') return value;
  return Object.fromEntries(
    Object.entries(value as Doc)
      .reverse()
      .map(([key, child]) => [key, reorder(child)])
  );
}

describe('compileDesignSystem: the spec fixtures', () => {
  it('compiles minimal and acme (every variant, both modes) into concrete, sorted, allowlisted output', async () => {
    const small = ok(compileDesignSystem(minimal));
    expect(small.modes).toEqual(['light', 'dark']);
    for (const variant of [undefined, 'high-contrast', 'compact', 'holiday']) {
      const compiled = ok(
        compileDesignSystem(await resolvedAcme(), {
          trust: 'developer',
          ...(variant ? { variant } : {}),
        })
      );
      for (const result of [small, compiled])
        for (const mode of result.modes) {
          const vars = result.vars[mode] as Record<string, string>;
          const names = Object.keys(vars);
          expect(names).toEqual([...names].sort());
          for (const [name, value] of Object.entries(vars)) {
            expect(name).toMatch(/^--tx-[a-z0-9-]+$/);
            expect(typeof value).toBe('string');
            expect(value, name).not.toMatch(/var\(|url\(|[;{}<>]/);
          }
          // Every semantic role and the always-emitted data-viz family.
          for (const role of SEMANTIC_ROLES)
            expect(
              vars[`--tx-${role.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)}`]
            ).toBeTruthy();
          expect(vars['--tx-chart-8']).toBeTruthy();
          expect(vars['--tx-chart-diverging-9']).toBeTruthy();
          expect(vars['--tx-space-12']).toBeTruthy();
        }
      expect(
        Object.keys(compiled.attrs).every((name) =>
          (DESIGN_SYSTEM_ATTRIBUTES as readonly string[]).includes(name)
        )
      ).toBe(true);
      expect(checkDesignSystemGuarantees(compiled)).toEqual([]);
      if (variant) expect(compiled.attrs['data-tx-ds-variant']).toBe(variant);
    }
  });

  it('carries acme’s pins, fonts, assets, defaults and component tokens', async () => {
    const compiled = ok(compileDesignSystem(await resolvedAcme(), { trust: 'developer' }));
    const light = compiled.vars.light as Record<string, string>;
    const dark = compiled.vars.dark as Record<string, string>;
    expect(light['--tx-primary']).toBe('#4f46e5');
    expect(dark['--tx-primary']).toBe('oklch(0.72 0.16 277)');
    expect(light['--tx-font-sans']).toBe('"Acme Sans", system-ui, sans-serif');
    expect(light['--tx-button-radius']).toBe('9999px');
    expect(light['--tx-card-background']).toBe(light['--tx-surface']);
    expect(light['--tx-icon-stroke-width']).toBe('1.5');
    expect(light['--tx-layout-content-max']).toBe('1120px');
    expect(light['--tx-motion-easing']).toBe('cubic-bezier(0.2, 0, 0, 1)');
    expect(light['--tx-type-title-weight']).toBe('650');
    expect(light['--tx-type-display-size']).toBe('3rem');
    expect(light['--tx-surface-style']).toBe('glass');
    expect(light['--tx-glass-opacity']).toBe('72%');
    // Only the component tokens the document sets.
    expect(
      Object.keys(light)
        .filter((name) => name.startsWith('--tx-button-'))
        .sort()
    ).toEqual([
      '--tx-button-disabled-opacity',
      '--tx-button-elevation',
      '--tx-button-font-weight',
      '--tx-button-height-md',
      '--tx-button-radius',
    ]);
    expect(compiled.defaults).toEqual({
      button: { variant: 'default', size: 'md' },
      card: { variant: 'flat' },
      'icon-button': { variant: 'ghost', size: 'icon' },
    });
    expect(compiled.fontFaces).toEqual([
      expect.objectContaining({
        family: 'Acme Sans',
        src: 'fonts/acme-sans.woff2',
        format: 'woff2',
        weight: '100 900',
        inline: false,
        preload: {
          href: 'fonts/acme-sans.woff2',
          as: 'font',
          type: 'font/woff2',
          crossorigin: 'anonymous',
        },
      }),
      expect.objectContaining({ family: 'Acme Display' }),
    ]);
    expect(compiled.assets.logo?.mark).toBe('./assets/mark.svg');
    expect(compiled.assets.favicon).toBe('assets/favicon.ico');
    expect(compiled.report.inlineBytes).toBe(0);
    expect(compiled.attrs).toEqual({
      'data-tx-ds': 'acme',
      'data-tx-ds-version': '2.1.0',
      'data-tx-surface': 'glass',
      'data-tx-elevation': 'soft',
      'data-tx-focus-ring-style': 'ring',
      'data-tx-icon-style': 'outline',
    });
    expect(compiled.report.contrast.light?.every((pair) => pair.pass)).toBe(true);
  });

  it('counts inline bytes for developer data URLs and refuses them by default', () => {
    const png = `data:image/png;base64,${'A'.repeat(400)}`;
    const font = `data:font/woff2;base64,${'B'.repeat(800)}`;
    const input = doc({
      assets: { favicon: png },
      typography: {
        families: { sans: { stack: ['Inline Sans'], files: [{ src: font, preload: true }] } },
      },
    });
    const compiled = ok(compileDesignSystem(input, { trust: 'developer' }));
    expect(compiled.report.inlineBytes).toBe(300 + 600);
    expect(compiled.fontFaces[0]).toMatchObject({ inline: true, format: 'woff2' });
    expect(compiled.fontFaces[0]?.preload).toBeUndefined();
    expect(codes(compileDesignSystem(input))).toEqual([
      ['url-refused', '$.assets.favicon'],
      ['url-refused', '$.typography.families.sans.files[0].src'],
    ]);
  });
});

describe('determinism and the hash', () => {
  it('gives byte-equal output and the same hash whatever the key order', async () => {
    const resolved = await resolvedAcme();
    const a = compileDesignSystem(resolved, { trust: 'developer' });
    const b = compileDesignSystem(structuredClone(resolved), { trust: 'developer' });
    const c = compileDesignSystem(reorder(resolved), { trust: 'developer' });
    expect(JSON.stringify(b)).toBe(JSON.stringify(a));
    expect(JSON.stringify(c)).toBe(JSON.stringify(a));
    const r1 = resolveDesignSystemSync(minimal);
    const r2 = resolveDesignSystemSync(reorder(minimal));
    expect(r1.ok && r2.ok && r1.hash === r2.hash).toBe(true);
    // A real change moves the hash; the variant and the modes are part of it.
    const other = ok(compileDesignSystem({ ...resolved, name: 'Acme 2' }, { trust: 'developer' }));
    const lightOnly = ok(compileDesignSystem(resolved, { trust: 'developer', modes: ['light'] }));
    expect(new Set([ok(a).hash, other.hash, lightOnly.hash]).size).toBe(3);
    expect(lightOnly.vars.dark).toBeUndefined();
  });

  it('hashes canonical JSON with SHA-256', () => {
    expect(sha256Hex('abc')).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad'
    );
    expect(sha256Hex('')).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
    expect(sha256Hex('a'.repeat(1000))).toBe(
      '41edece42d63e8d9bf515a9ba6932e1c20cbc9f5a5d134645adb5db1b9737ea3'
    );
    expect(canonicalJson({ b: [2, { d: 1, c: undefined }], a: 'x' })).toBe(
      '{"a":"x","b":[2,{"d":1}]}'
    );
  });
});

describe('refusals: every code, as results', () => {
  const resolver = (docs: Record<string, Doc>) => (ref: string) => docs[ref];
  const based = (id: string, extendsRef?: string): Doc => ({
    ...doc({ id, version: '1.0.0' }),
    ...(extendsRef ? { extends: extendsRef } : {}),
  });

  it('raises each spec and guarantee code with its JSON path', () => {
    const cases: [string, unknown, Parameters<typeof compileDesignSystem>[1]?, string?][] = [
      ['unknown-key', doc({ colour: {} }), undefined, '$.colour'],
      ['invalid-type', doc({ shape: 3 }), undefined, '$.shape'],
      ['invalid-value', doc({ shape: { radius: 99 } }), undefined, '$.shape.radius'],
      ['required', (({ name: _, ...rest }) => rest)(doc()), undefined, '$.name'],
      ['format-version', doc({ formatVersion: 2 }), undefined, '$.formatVersion'],
      ['extends-range', doc({ extends: 'acme@^1.0.0' }), undefined, '$.extends'],
      [
        'url-refused',
        doc({ assets: { favicon: 'https://cdn.example/f.png' } }),
        undefined,
        '$.assets.favicon',
      ],
      [
        'inline-bytes',
        doc({ assets: { favicon: `data:image/png;base64,${'A'.repeat(12_000)}` } }),
        { trust: 'developer' },
        '$.assets.favicon',
      ],
      [
        'extends-cycle',
        based('a', 'b@1.0.0'),
        { resolve: resolver({ 'b@1.0.0': based('b', 'a@1.0.0') }) },
        '$.extends',
      ],
      [
        'extends-depth',
        based('a', 'b@1.0.0'),
        {
          resolve: resolver({
            'b@1.0.0': based('b', 'c@1.0.0'),
            'c@1.0.0': based('c', 'd@1.0.0'),
            'd@1.0.0': based('d', 'e@1.0.0'),
            'e@1.0.0': based('e', 'f@1.0.0'),
            'f@1.0.0': based('f'),
          }),
        },
        '$.extends',
      ],
      [
        'aa-text',
        doc({
          color: {
            brand: { seed: '#4f46e5' },
            roles: { light: { background: '#777777', foreground: '#888888' } },
          },
        }),
        undefined,
        '$.color.roles.light.foreground',
      ],
      [
        'aa-focus',
        doc({
          color: {
            brand: { seed: '#4f46e5' },
            roles: { dark: { ring: '#202020', background: '#1a1a1a' } },
          },
        }),
        undefined,
        '$.color.roles.dark.ring',
      ],
      [
        'aa-focus',
        doc({ accessibility: { focusWidth: 1 } }),
        undefined,
        '$.accessibility.focusWidth',
      ],
      [
        'target-size',
        doc({ components: { button: { 'height-md': 'icon-sm' } } }),
        undefined,
        '$.components.button["height-md"]',
      ],
    ];
    for (const [code, input, options, path] of cases) {
      const result = compileDesignSystem(input, options);
      expect(result.ok, code).toBe(false);
      expect(codes(result)[0], code).toEqual([code, path]);
    }
  });

  it('names the failing pairs and every pin involved', () => {
    const result = compileDesignSystem(
      doc({
        color: {
          brand: { seed: '#4f46e5' },
          roles: { light: { background: '#777777', foreground: '#888888' } },
        },
      })
    );
    if (result.ok) throw new Error('expected a refusal');
    const issue = result.errors.find((e) => e.message.includes('--tx-background is'));
    expect(issue).toMatchObject({ code: 'aa-text', mode: 'light' });
    expect(issue?.pairs?.[0]).toMatchObject({
      foreground: '--tx-foreground',
      background: '--tx-background',
      required: 4.5,
      pass: false,
    });
    expect(issue?.hint).toContain('$.color.roles.light.background');
  });

  it('refuses unresolved bases, wrong ids and unknown variants, and never throws on hostile input', async () => {
    expect(codes(compileDesignSystem(doc({ extends: 'texuli:violet' })))).toEqual([
      ['invalid-value', '$.extends'],
    ]);
    expect(
      codes(compileDesignSystem(doc({ extends: 'b@1.0.0' }), { resolve: () => based('c') }))
    ).toEqual([['invalid-value', '$.extends']]);
    expect(codes(compileDesignSystem(minimal, { variant: 'nope' }))).toEqual([
      ['invalid-value', '$.variants["nope"]'],
    ]);
    const unknown = await resolveDesignSystem(doc({ extends: 'texuli:no-such-theme' }));
    expect(unknown.ok).toBe(false);
    // An empty modes option compiles nothing a writer could paint: refused, like `color.modes: []`.
    expect(codes(compileDesignSystem(minimal, { modes: [] }))).toEqual([
      ['invalid-value', '$.color.modes'],
    ]);
    expect(codes(compileDesignSystem(doc({ color: { modes: [] } }))).map(([code]) => code)).toEqual(
      ['invalid-value']
    );
    for (const hostile of [
      null,
      undefined,
      42,
      'acme',
      [],
      JSON.parse('{"__proto__":{"polluted":1},"format":"texuli/design-system"}'),
      doc({ components: { button: { radius: 'url(x)' } } }),
      doc({ typography: { families: { sans: { stack: ['x;}</style>'] } } } }),
    ]) {
      const result = compileDesignSystem(hostile);
      expect(result.ok).toBe(false);
    }
    expect(({} as Doc).polluted).toBeUndefined();
  });
});

describe('the color solver', () => {
  it('keeps role pins exactly and moves only derived colors, reporting each move', () => {
    const compiled = ok(
      compileDesignSystem(
        doc({ color: { brand: { seed: '#4f46e5' }, roles: { light: { background: '#fdf6e3' } } } })
      )
    );
    expect(compiled.vars.light?.['--tx-background']).toBe('#fdf6e3');
    for (const pair of compiled.report.contrast.light ?? [])
      expect(pair.pass, pair.foreground).toBe(true);
  });

  it('keeps brand pins as fills, derives on-colors and tints, and refuses a pin no text can read on', () => {
    const compiled = ok(
      compileDesignSystem(
        doc({ color: { brand: { seed: '#4f46e5' }, pin: { success: '#079455' } } })
      )
    );
    expect(compiled.vars.light?.['--tx-success']).toBe('#079455');
    expect(compiled.vars.light?.['--tx-success-foreground']).toBe('#0a0a0a');
    const moves = compiled.report.adjustments.filter((a) => a.path === '$.color.pin.success');
    expect(moves.map((a) => a.variable)).toEqual(
      expect.arrayContaining([
        '--tx-success-foreground',
        '--tx-success-soft',
        '--tx-success-soft-foreground',
      ])
    );
    const aaa = compileDesignSystem(
      doc({
        color: { brand: { seed: '#4f46e5' }, pin: { success: '#079455' } },
        accessibility: { contrast: 'AAA' },
      })
    );
    expect(codes(aaa)).toContainEqual(['aa-text', '$.color.pin.success']);
  });

  it('meets AAA for a seed alone, and lifts system controls to targetMin', () => {
    const compiled = ok(
      compileDesignSystem(doc({ accessibility: { contrast: 'AAA', targetMin: 40 } }))
    );
    expect(compiled.report.contrast.dark?.find((p) => p.kind === 'text')?.required).toBe(7);
    expect(compiled.vars.light?.['--tx-size-control-xs']).toBe('40px');
    expect(compiled.vars.light?.['--tx-size-control-lg']).toBe('2.75rem');
    expect(
      compiled.report.adjustments.filter((a) => a.path === '$.accessibility.targetMin')
    ).toHaveLength(6);
    expect(compiled.report.targets.every((t) => t.pass)).toBe(true);
  });
});

describe('variants and patches', () => {
  it('applies variants orthogonally to mode, and patches over variants over extends', async () => {
    const compact = ok(
      compileDesignSystem(await resolvedAcme(), { variant: 'compact', trust: 'developer' })
    );
    for (const mode of ['light', 'dark'] as const) {
      expect(compact.vars[mode]?.['--tx-density']).toBe('0.8');
      expect(compact.vars[mode]?.['--tx-space-4']).toBe('0.8rem');
    }
    const patched = ok(
      compileDesignSystem(await resolvedAcme(), {
        variant: 'compact',
        trust: 'developer',
        patches: [{ space: { density: 1.2 } }, { motion: null }],
      })
    );
    expect(patched.vars.light?.['--tx-density']).toBe('1.2');
    expect(patched.vars.light?.['--tx-motion-easing']).toBe('cubic-bezier(0.4, 0, 0.2, 1)');
    const bad = compileDesignSystem(minimal, { patches: [{ shape: { radius: 'x' } } as never] });
    expect(bad.ok ? [] : bad.errors.map((e) => [e.code, e.path, e.source])).toEqual([
      ['invalid-type', '$.shape.radius', 'patch:0'],
    ]);
  });

  it('merges an id@version chain over a library base, nearest first', async () => {
    const base = {
      ...doc({ id: 'brand', version: '1.0.0' }),
      extends: 'texuli:ocean',
      shape: { radius: 4 },
    };
    const child = {
      ...doc({ id: 'team', version: '2.0.0' }),
      extends: 'brand@1.0.0',
      space: { density: 1.1 },
    };
    delete (base as Doc).color;
    delete (child as Doc).color;
    const resolved = await resolveDesignSystem(child, {
      resolve: async (ref) => (ref === 'brand@1.0.0' ? base : undefined),
    });
    if (!resolved.ok) throw new Error(JSON.stringify(resolved.errors));
    expect(resolved.chain).toEqual(['brand@1.0.0', 'texuli:ocean']);
    const compiled = ok(compileDesignSystem(resolved.document));
    expect(compiled.id).toBe('team');
    expect(compiled.vars.light?.['--tx-radius']).toBe('0.25rem');
    expect(compiled.vars.light?.['--tx-density']).toBe('1.1');
  });
});

describe('the Protoyard knob mapping (architecture B.13)', () => {
  it('lands every Protoyard Theme knob in its variable or attribute', () => {
    const compiled = ok(compileDesignSystem(knobs));
    const light = compiled.vars.light as Record<string, string>;
    const dark = compiled.vars.dark as Record<string, string>;
    expect([light['--tx-background'], light['--tx-primary'], dark['--tx-primary']]).toEqual([
      '#ffffff',
      '#0f766e',
      '#5eead4',
    ]);
    expect(light['--tx-font-sans']).toBe('"Yard Sans", system-ui, sans-serif');
    expect(light['--tx-font-heading']).toBe('"Yard Display", "Yard Sans", sans-serif');
    expect(light['--tx-font-mono']).toBe('"Yard Mono", ui-monospace, monospace');
    expect(light['--tx-radius']).toBe('0.375rem');
    expect(light['--tx-density']).toBe('0.875');
    expect(light['--tx-elevation-style']).toBe('layered');
    expect(light['--tx-elevation-3']).toBe(light['--tx-shadow-float']);
    expect(light['--tx-surface-style']).toBe('glass');
    expect([light['--tx-glass-opacity'], light['--tx-glass-blur']]).toEqual(['70%', '12px']);
    expect(light['--tx-focus-ring-style']).toBe('glow');
    expect([
      light['--tx-motion-fast'],
      light['--tx-motion-base'],
      light['--tx-motion-slow'],
    ]).toEqual(['200ms', '300ms', '500ms']);
    expect(light['--tx-motion-easing']).toBe('cubic-bezier(0.34, 1.56, 0.64, 1)');
    expect(light['--tx-chart-1']).toBe('#0f766e');
    expect(dark['--tx-chart-1']).toBe('#5eead4');
    expect(compiled.attrs).toMatchObject({
      'data-tx-surface': 'glass',
      'data-tx-elevation': 'layered',
      'data-tx-focus-ring-style': 'glow',
    });
  });
});

describe('@texuli/tokens/design-system/validate', () => {
  it('re-exports the spec checks and re-checks compiled maps without the compiler', async () => {
    expect(validateEntry.validateDesignSystem(acme, { trust: 'developer' }).ok).toBe(true);
    expect(validateEntry.DESIGN_SYSTEM_COMPILER_CODES).toEqual([
      'aa-text',
      'aa-focus',
      'target-size',
      'aa-non-text',
    ]);
    const compiled = ok(compileDesignSystem(await resolvedAcme(), { trust: 'developer' }));
    expect(validateEntry.checkDesignSystemGuarantees(compiled)).toEqual([]);
    const tampered = structuredClone(compiled);
    Object.assign(tampered.vars.light as Doc, {
      '--tx-foreground': '#ffffff',
      '--tx-ring': '#ffffff',
      '--tx-focus-ring-width': '1px',
      '--tx-size-control-xs': '20px',
    });
    const found = validateEntry.checkDesignSystemGuarantees(tampered).map((i) => [i.code, i.path]);
    expect(found).toContainEqual(['aa-text', '$.vars.light["--tx-foreground"]']);
    expect(found).toContainEqual(['aa-focus', '$.vars.light["--tx-ring"]']);
    expect(found).toContainEqual(['aa-focus', '$.vars.light["--tx-focus-ring-width"]']);
    expect(found).toContainEqual(['target-size', '$.vars.light["--tx-size-control-xs"]']);
  });
});

describe('component tokens map through the registry', () => {
  it('compiles every token set to the step its registry default reads to that default’s value', () => {
    const toStep = (ref: string): string | number | undefined => {
      const m = /^var\(--tx-([a-z0-9-]+)\)$/.exec(ref)?.[1];
      if (!m) return;
      const rules: [RegExp, (x: RegExpExecArray) => string | number][] = [
        [/^shape-radius-(\w+)$/, (x) => x[1] as string],
        [/^type-(\w+)-\w+$/, (x) => x[1] as string],
        [/^border-width-(\w+)$/, (x) => x[1] as string],
        [/^elevation-(\d)$/, (x) => Number(x[1])],
        [/^opacity-(\w+)$/, (x) => x[1] as string],
        [/^(space-\d+)$/, (x) => x[1] as string],
        [/^size-(control-\w+|icon-\w+|target-min|target-touch)$/, (x) => x[1] as string],
        [
          /^([a-z]+(?:-[a-z]+)*)$/,
          (x) => (x[1] as string).replace(/-([a-z])/g, (_, c) => c.toUpperCase()),
        ],
      ];
      for (const [pattern, map] of rules) {
        const hit = pattern.exec(m);
        if (hit) return map(hit);
      }
    };
    const components: Record<string, Record<string, string | number>> = {};
    const expected: Record<string, string> = {};
    for (const entry of COMPONENT_TOKENS) {
      const step = toStep(entry.default);
      if (step === undefined) continue;
      const probe = doc({ components: { [entry.component]: { [entry.key]: step } } });
      if (!validateEntry.validateDesignSystem(probe).ok) continue;
      components[entry.component] ??= {};
      (components[entry.component] as Record<string, string | number>)[entry.key] = step;
      expected[entry.token] = entry.default.slice(4, -1);
    }
    const compiled = ok(compileDesignSystem(doc({ components })));
    const light = compiled.vars.light as Record<string, string>;
    const names = Object.keys(expected);
    expect(names.length).toBeGreaterThan(250);
    for (const name of names) expect(light[name], name).toBe(light[expected[name] as string]);
  });
});

describe('the button label line height (C-G-014)', () => {
  it('is the component token --tx-button-line-height, read by button.css and settable by a design system', () => {
    const css = readFileSync(
      join(root, 'packages/texuli/src/components/button/button.css'),
      'utf8'
    );
    expect(css).toContain('line-height: var(--tx-button-line-height, var(--tx-type-label-line));');
    expect(COMPONENT_TOKENS.find((t) => t.token === '--tx-button-line-height')?.default).toBe(
      'var(--tx-type-label-line)'
    );
    for (const step of ['label', 'heading', 'body']) {
      const compiled = ok(
        compileDesignSystem(doc({ components: { button: { 'line-height': step } } }))
      );
      const light = compiled.vars.light as Record<string, string>;
      expect(light['--tx-button-line-height'], step).toBe(light[`--tx-type-${step}-line`]);
    }
  });
});

describe('compileDesignSystem: partial data-viz palettes', () => {
  it('fills the lists a document leaves out from the derived palette instead of throwing', () => {
    const categorical = [
      '#6d28d9',
      '#0891b2',
      '#ca8a04',
      '#16a34a',
      '#dc2626',
      '#db2777',
      '#4f46e5',
      '#64748b',
    ];
    const full = ok(compileDesignSystem(minimal));
    const partial = ok(
      compileDesignSystem(
        doc({
          color: {
            brand: { seed: '#4f46e5' },
            dataViz: { light: { categorical, grid: '#e2e8f0' } },
          },
        })
      )
    );
    categorical.forEach((color, i) => {
      expect(partial.vars.light?.[`--tx-chart-${i + 1}`]).toBe(color);
    });
    expect(partial.vars.light?.['--tx-chart-grid']).toBe('#e2e8f0');
    for (const name of [
      '--tx-chart-sequential-1',
      '--tx-chart-diverging-9',
      '--tx-chart-axis',
    ] as const)
      expect(partial.vars.light?.[name]).toBe(full.vars.light?.[name]);
    expect(partial.vars.dark).toEqual(full.vars.dark);
  });
});

describe('@texuli/tokens/design-system/compile-core (G127)', () => {
  it('resolves texuli:<id> bases only through an injected loader, and compile keeps the library default', async () => {
    const base = doc({ extends: 'texuli:violet' });
    // No loader: the same unresolved-base refusal the sync resolver gives.
    const bare = await compileCore.resolveDesignSystemCore(base);
    expect(bare.ok).toBe(false);
    expect(bare.ok ? [] : bare.errors.map((issue) => [issue.code, issue.path])).toEqual([
      ['invalid-value', '$.extends'],
    ]);
    expect(bare.ok ? '' : bare.errors[0]?.message).toBe('Nothing resolves texuli:violet.');
    // An injected loader (here the library's, by name) resolves it like resolveDesignSystem.
    const asked: string[] = [];
    const injected = await compileCore.resolveDesignSystemCore(base, {
      loadLibraryBase: (ref) => {
        asked.push(ref);
        return compileEntry.loadLibraryBase(ref);
      },
    });
    const library = await resolveDesignSystem(base);
    expect(asked).toEqual(['texuli:violet']);
    expect(injected.ok && library.ok).toBe(true);
    if (injected.ok && library.ok) expect(injected.hash).toBe(library.hash);
    // The host resolver is asked first; null and undefined fall through to the loader.
    const viaResolve = await compileCore.resolveDesignSystemCore(base, {
      resolve: () => null,
      loadLibraryBase: () => undefined,
    });
    expect(viaResolve.ok).toBe(false);
    // The core entry is the compile entry without the library pair.
    expect(Object.keys(compileEntry).sort()).toEqual(
      [...Object.keys(compileCore), 'loadLibraryBase', 'resolveDesignSystem'].sort()
    );
  });
});

describe('compileDesignSystem: the consumer format gaps (spec 0.11.0)', () => {
  const vars = (compiled: CompiledDesignSystem, mode: 'light' | 'dark') =>
    compiled.vars[mode] as Record<string, string>;

  it('derives sidebarPrimary when the copied primary pin would vanish on the sidebar fill (D-G-015)', () => {
    // [pin, sidebar fill]: the same color, a close one, and the default (neutral) sidebar.
    for (const [pin, sidebar] of [
      ['#4f46e5', '#4f46e5'],
      ['#2563eb', '#3b82f6'],
      ['#2563eb', undefined],
    ] as const) {
      const compiled = ok(
        compileDesignSystem(
          doc({
            color: {
              brand: { seed: pin },
              pin: { primary: pin },
              ...(sidebar ? { roles: { light: { sidebar }, dark: { sidebar } } } : {}),
            },
          })
        )
      );
      for (const mode of compiled.modes) {
        const v = vars(compiled, mode);
        const active = v['--tx-sidebar-primary'] as string;
        const fill = v['--tx-sidebar'] as string;
        const ratio = contrastRatio(active, fill);
        const derived = compiled.report.adjustments.find(
          (a) => a.mode === mode && a.variable === '--tx-sidebar-primary'
        );
        if (sidebar === undefined) {
          // A sidebar the pin already stands out on keeps the copy.
          expect(active, mode).toBe(pin);
          expect(derived, mode).toBeUndefined();
          continue;
        }
        expect(active, `${pin} ${mode}`).not.toBe(fill);
        expect(derived, mode).toMatchObject({ from: pin, path: '$.color.pin.primary' });
        // 3:1 where the primary ink allows it; otherwise the most distinct fill that keeps the ink.
        if (sidebar === '#3b82f6') expect(ratio, mode).toBeGreaterThanOrEqual(3);
        else expect(ratio, mode).toBeGreaterThan(2.5);
        expect(
          contrastRatio(v['--tx-primary-foreground'] as string, active)
        ).toBeGreaterThanOrEqual(4.5);
        expect(v['--tx-primary'], mode).toBe(pin);
      }
      expect(checkDesignSystemGuarantees(compiled)).toEqual([]);
    }
  });

  it('holds a soft fill with a pinned ink to that ink only, and body text follows the ink (D-G-016)', () => {
    // A pastel chip with its own dark text in dark mode: the light page text cannot read on it.
    const pastel = { successSoft: '#bbf7d0', successSoftForeground: '#052e16' };
    const compiled = ok(
      compileDesignSystem(doc({ color: { brand: { seed: '#4f46e5' }, roles: { dark: pastel } } }))
    );
    const dark = vars(compiled, 'dark');
    expect(dark['--tx-success-soft']).toBe('#bbf7d0');
    expect(dark['--tx-success-soft-foreground']).toBe('#052e16');
    expect(dark['--tx-success-soft-body']).toBe('#052e16');
    expect(contrastRatio(dark['--tx-foreground'] as string, '#bbf7d0')).toBeLessThan(4.5);
    // Light mode pins nothing, so its page foreground still reads on every soft fill.
    expect(Object.keys(vars(compiled, 'light')).filter((n) => n.endsWith('-soft-body'))).toEqual(
      []
    );
    expect(compiled.report.adjustments).toContainEqual(
      expect.objectContaining({
        mode: 'dark',
        variable: '--tx-success-soft-body',
        path: '$.color.roles.dark.successSoftForeground',
      })
    );
    // Every rendered pair holds: the guarantee reads the body ink, and without it the page foreground.
    expect(checkDesignSystemGuarantees(compiled)).toEqual([]);
    const { '--tx-success-soft-body': _, ...stripped } = dark;
    expect(
      checkDesignSystemGuarantees({ ...compiled, vars: { dark: stripped } }).map((i) => i.path)
    ).toEqual(['$.vars.dark["--tx-foreground"]']);
    // Without the ink pin the fill is still held to the page foreground.
    const { successSoftForeground: _ink, ...fillOnly } = pastel;
    expect(
      compileDesignSystem(doc({ color: { brand: { seed: '#4f46e5' }, roles: { dark: fillOnly } } }))
        .ok
    ).toBe(false);
  });

  it('completes a short categorical palette deterministically, keeping the given colors (D-G-017)', () => {
    for (const given of [['#4f46e5'], ['#4f46e5', '#0ea5e9', '#f59e0b'], ['oklch(0.6 0.15 30)']]) {
      const source = doc({
        color: {
          brand: { seed: '#4f46e5' },
          dataViz: { light: { categorical: given }, dark: { categorical: given }, cvdSafe: true },
        },
      });
      const compiled = ok(compileDesignSystem(source));
      expect(ok(compileDesignSystem(source)).vars).toEqual(compiled.vars);
      for (const mode of compiled.modes) {
        const v = vars(compiled, mode);
        const chart = Array.from({ length: 8 }, (_, i) => v[`--tx-chart-${i + 1}`] as string);
        expect(chart.slice(0, given.length), mode).toEqual(given);
        const derived = chart.slice(given.length);
        expect(new Set(chart).size, mode).toBe(8);
        for (const [i, color] of derived.entries()) {
          for (const surface of [v['--tx-surface'], v['--tx-background']])
            expect(contrastRatio(color, surface as string), mode).toBeGreaterThanOrEqual(3);
          for (const other of derived.slice(0, i))
            expect(chartColorDistance(color, other), mode).toBeGreaterThanOrEqual(0.08);
        }
        expect(
          compiled.report.adjustments
            .filter((a) => a.mode === mode && a.path === `$.color.dataViz.${mode}.categorical`)
            .map((a) => [a.variable, a.to])
        ).toEqual(derived.map((color, i) => [`--tx-chart-${given.length + i + 1}`, color]));
      }
    }
    // Eight stay exactly as written with no derivation; none and nine are refused.
    const eight = ['#111111', '#222222', '#333333', '#444444', '#555555', '#666666', '#777777'];
    const full = ok(
      compileDesignSystem(
        doc({
          color: {
            brand: { seed: '#4f46e5' },
            dataViz: { light: { categorical: [...eight, '#888888'] } },
          },
        })
      )
    );
    expect(full.report.adjustments.filter((a) => a.variable.startsWith('--tx-chart-'))).toEqual([]);
    for (const list of [[], [...eight, '#888888', '#999999']])
      expect(
        codes(
          compileDesignSystem(
            doc({
              color: { brand: { seed: '#4f46e5' }, dataViz: { light: { categorical: list } } },
            })
          )
        )
      ).toEqual([['invalid-value', '$.color.dataViz.light.categorical']]);
  });

  it('compiles structured elevation levels to safe shadows in the mode’s shadow color (D-G-018)', () => {
    const levels = {
      '1': [{ y: 1, blur: 2, opacity: 0.2 }],
      '4': [
        { x: -2, y: 12, blur: 32, spread: -8, opacity: 0.25 },
        { y: 0, blur: 0, spread: 1, opacity: 1, inset: true },
      ],
    };
    const compiled = ok(compileDesignSystem(doc({ elevation: { style: 'crisp', levels } })));
    for (const mode of compiled.modes) {
      const v = vars(compiled, mode);
      const shadow = parseDsColor(v['--tx-shadow'] as string)?.hex;
      expect(v['--tx-elevation-1'], mode).toBe(`0 1px 2px 0 ${shadow}33`);
      expect(v['--tx-elevation-4'], mode).toBe(
        `-2px 12px 32px -8px ${shadow}40, inset 0 0 0 1px ${shadow}ff`
      );
      // Levels the document leaves out keep the style's shadows.
      expect(v['--tx-elevation-3'], mode).toBe(
        ok(compileDesignSystem(doc({ elevation: { style: 'crisp' } }))).vars[mode]?.[
          '--tx-elevation-3'
        ]
      );
      for (const n of [1, 2, 3, 4, 5])
        expect(isSafeCompiledValue(v[`--tx-elevation-${n}`])).toBe(true);
    }
    // Bounded numbers, closed layers and levels 1 to 5 only: never a raw CSS string.
    for (const [bad, path] of [
      [{ '1': [{ y: 1, blur: 500, opacity: 0.2 }] }, '$.elevation.levels["1"][0].blur'],
      [{ '1': [{ y: 1, blur: 2, opacity: 1.5 }] }, '$.elevation.levels["1"][0].opacity'],
      [{ '6': [{ y: 1, blur: 2, opacity: 0.2 }] }, '$.elevation.levels["6"]'],
      [{ '1': [] }, '$.elevation.levels["1"]'],
      [{ '1': '0 1px 2px red' }, '$.elevation.levels["1"]'],
      [
        { '1': [{ y: 1, blur: 2, opacity: 0.2, color: 'red' }] },
        '$.elevation.levels["1"][0].color',
      ],
    ] as const)
      expect(codes(compileDesignSystem(doc({ elevation: { levels: bad } })))[0]?.[1]).toBe(path);
  });

  it('compiles product tokens with checked on-colors in both modes (C-G-007)', () => {
    const extensions = {
      'brand-gold': {
        light: '#fef3c7',
        dark: '#78350f',
        on: { light: '#451a03', dark: '#fffbeb' },
      },
      'focus-band': { light: '#e0e7ff', dark: '#312e81', on: {} },
      stripe: { light: '#c7d2fe', dark: '#3730a3' },
    };
    const compiled = ok(compileDesignSystem(doc({ extensions })));
    const light = vars(compiled, 'light');
    const dark = vars(compiled, 'dark');
    expect(light['--tx-ext-brand-gold']).toBe('#fef3c7');
    expect(light['--tx-ext-brand-gold-foreground']).toBe('#451a03');
    expect(dark['--tx-ext-brand-gold-foreground']).toBe('#fffbeb');
    expect(light['--tx-ext-stripe']).toBe('#c7d2fe');
    expect(light['--tx-ext-stripe-foreground']).toBeUndefined();
    for (const [mode, v] of [
      ['light', light],
      ['dark', dark],
    ] as const) {
      const ink = v['--tx-ext-focus-band-foreground'] as string;
      expect(contrastRatio(ink, v['--tx-ext-focus-band'] as string), mode).toBeGreaterThanOrEqual(
        4.5
      );
      expect(compiled.report.adjustments).toContainEqual(
        expect.objectContaining({ mode, variable: '--tx-ext-focus-band-foreground', to: ink })
      );
      expect(compiled.report.contrast[mode]).toContainEqual(
        expect.objectContaining({ foreground: '--tx-ext-brand-gold-foreground', pass: true })
      );
    }
    expect(checkDesignSystemGuarantees(compiled)).toEqual([]);
    // A pinned on-color below the target is refused in the mode it fails, at its own path.
    const failing = compileDesignSystem(
      doc({
        extensions: {
          gold: { light: '#fef3c7', dark: '#78350f', on: { light: '#451a03', dark: '#92400e' } },
        },
      })
    );
    expect(codes(failing)).toEqual([['aa-text', '$.extensions.gold.on.dark']]);
    // A tampered compiled map is caught by the guarantee re-check.
    expect(
      checkDesignSystemGuarantees({
        ...compiled,
        vars: { light: { ...light, '--tx-ext-brand-gold-foreground': '#fef3c7' } },
      }).map((issue) => [issue.code, issue.path])
    ).toEqual([['aa-text', '$.vars.light["--tx-ext-brand-gold-foreground"]']]);
    // Names are kebab-case, at most 32 characters, never ending in -foreground; at most 32 tokens.
    const token = { light: '#ffffff', dark: '#000000' };
    for (const name of [
      'Brand',
      'brand_gold',
      'gold-foreground',
      `a${'b'.repeat(32)}`,
      '__proto__',
    ])
      expect(codes(compileDesignSystem(doc({ extensions: { [name]: token } })))).toEqual([
        [
          'invalid-value',
          `$.extensions${/^[A-Za-z_$][\w$]*$/.test(name) ? `.${name}` : `[${JSON.stringify(name)}]`}`,
        ],
      ]);
    const many = Object.fromEntries(Array.from({ length: 33 }, (_, i) => [`t${i}`, token]));
    expect(codes(compileDesignSystem(doc({ extensions: many })))).toEqual([
      ['invalid-value', '$.extensions'],
    ]);
    expect(
      codes(compileDesignSystem(doc({ extensions: { gold: { light: 'red', dark: '#000' } } })))
    ).toEqual([['invalid-value', '$.extensions.gold.light']]);
  });
});

describe('compileDesignSystem: the consumer gaps of spec 0.12.0', () => {
  const vars = (compiled: CompiledDesignSystem, mode: 'light' | 'dark') =>
    compiled.vars[mode] as Record<string, string>;
  const nonText = (compiled: CompiledDesignSystem) =>
    compiled.report.warnings.filter((w) => w.code === 'aa-non-text');

  it('takes a layer’s darkOpacity in dark mode only, and leaves levels without one as before (D-G-028)', () => {
    const plain = {
      '2': [
        { y: 2, blur: 6, opacity: 0.2 },
        { y: 0, blur: 1, opacity: 0.1 },
      ],
    };
    const split = {
      '2': [
        { y: 2, blur: 6, opacity: 0.2, darkOpacity: 0.6 },
        { y: 0, blur: 1, opacity: 0.1 },
      ],
    };
    const before = ok(compileDesignSystem(doc({ elevation: { levels: plain } })));
    const after = ok(compileDesignSystem(doc({ elevation: { levels: split } })));
    const light = vars(after, 'light');
    const dark = vars(after, 'dark');
    const shadow = (v: Record<string, string>) => parseDsColor(v['--tx-shadow'] as string)?.hex;
    expect(light['--tx-elevation-2']).toBe(
      `0 2px 6px 0 ${shadow(light)}33, 0 0 1px 0 ${shadow(light)}1a`
    );
    expect(dark['--tx-elevation-2']).toBe(
      `0 2px 6px 0 ${shadow(dark)}99, 0 0 1px 0 ${shadow(dark)}1a`
    );
    // Light mode and every other variable are unchanged; only the dark level moves.
    expect(light).toEqual(vars(before, 'light'));
    expect({ ...dark, '--tx-elevation-2': '' }).toEqual({
      ...vars(before, 'dark'),
      '--tx-elevation-2': '',
    });
    for (const v of [light, dark]) expect(isSafeCompiledValue(v['--tx-elevation-2'])).toBe(true);
    // Bounded like opacity.
    for (const bad of [-0.1, 1.5, '0.5'])
      expect(
        codes(
          compileDesignSystem(
            doc({
              elevation: { levels: { '1': [{ y: 1, blur: 2, opacity: 0.2, darkOpacity: bad }] } },
            })
          )
        )[0]
      ).toEqual([
        typeof bad === 'string' ? 'invalid-type' : 'invalid-value',
        '$.elevation.levels["1"][0].darkOpacity',
      ]);
  });

  it('derives sidebarPrimary under a primary role pin too, and never moves a sidebarPrimary pin (D-G-027)', () => {
    const roles = { light: { primary: '#4f46e5', sidebar: '#4f46e5' } };
    for (const color of [
      { brand: { seed: '#4f46e5' }, roles },
      // A brand pin and a role pin of the primary: the role pin wins in light.
      { brand: { seed: '#4f46e5' }, pin: { primary: '#4f46e5' }, roles },
      { brand: { seed: '#0f766e' }, roles: { light: { primary: '#0f766e', sidebar: '#0f766e' } } },
    ]) {
      const compiled = ok(compileDesignSystem(doc({ color })));
      const v = vars(compiled, 'light');
      const fill = v['--tx-sidebar'] as string;
      const active = v['--tx-sidebar-primary'] as string;
      expect(active).not.toBe(fill);
      expect(contrastRatio(active, fill)).toBeGreaterThanOrEqual(3);
      expect(contrastRatio(v['--tx-primary-foreground'] as string, active)).toBeGreaterThanOrEqual(
        4.5
      );
      expect(v['--tx-primary']).toBe(color.roles.light.primary);
      expect(compiled.report.adjustments).toContainEqual(
        expect.objectContaining({
          mode: 'light',
          variable: '--tx-sidebar-primary',
          to: active,
          path: '$.color.roles.light.sidebar',
        })
      );
      expect(nonText(compiled)).toEqual([]);
      expect(checkDesignSystemIndicators(compiled)).toEqual([]);
    }
    // An explicit sidebarPrimary pin stays as written: a finding, not a move.
    const pinned = ok(
      compileDesignSystem(
        doc({
          color: {
            brand: { seed: '#4f46e5' },
            roles: { light: { sidebarPrimary: '#4f46e5', sidebar: '#4f46e5' } },
          },
        })
      )
    );
    expect(vars(pinned, 'light')['--tx-sidebar-primary']).toBe('#4f46e5');
    expect(pinned.report.adjustments.filter((a) => a.variable === '--tx-sidebar-primary')).toEqual(
      []
    );
    expect(nonText(pinned)).toEqual([
      expect.objectContaining({ mode: 'light', path: '$.color.roles.light.sidebarPrimary' }),
    ]);
  });

  it('checks role fills against their container at 3:1 (aa-non-text, D-G-029)', () => {
    const compiled = ok(compileDesignSystem(doc()));
    expect(checkDesignSystemIndicators(compiled)).toEqual([]);
    expect(nonText(compiled)).toEqual([]);
    for (const mode of compiled.modes)
      expect(evaluateDesignSystemIndicators(vars(compiled, mode))).toEqual([
        expect.objectContaining({ foreground: '--tx-sidebar-primary', pass: true, blocking: true }),
        expect.objectContaining({ foreground: '--tx-primary', pass: true, blocking: false }),
      ]);
    // An active fill equal to the sidebar fill is refused by the indicator check.
    const light = vars(compiled, 'light');
    const invisible = {
      ...compiled,
      vars: { light: { ...light, '--tx-sidebar-primary': light['--tx-sidebar'] as string } },
    };
    expect(checkDesignSystemIndicators(invisible).map((i) => [i.code, i.path])).toEqual([
      ['aa-non-text', '$.vars.light["--tx-sidebar-primary"]'],
    ]);
    // The guarantee re-check stays the compiler's own list: it never raises aa-non-text.
    expect(checkDesignSystemGuarantees(invisible).map((i) => i.code)).not.toContain('aa-non-text');
    // A light primary pin on a white page is advisory: a warning with the code, no refusal.
    const yellow = ok(
      compileDesignSystem(
        doc({ color: { brand: { seed: '#4f46e5' }, pin: { primary: '#facc15' } } })
      )
    );
    expect(nonText(yellow)).toEqual([
      expect.objectContaining({ mode: 'light', path: '$.color.pin.primary' }),
    ]);
    expect(checkDesignSystemIndicators(yellow)).toEqual([]);
  });
});
