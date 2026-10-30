// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { safeImageSrc } from '../../core/src/url-policy/index.ts';
import { isSafeCssColor, isSafeFontFamily } from '../../tokens/src/contract/css-safe.ts';
import {
  applyDesignSystemPatch,
  DESIGN_SYSTEM_LIMITS,
  type DesignSystem,
  type DesignSystemPatch,
  migrateDesignSystem,
  validateDesignSystem,
  validateDesignSystemPatch,
} from '../src/design-system/index.ts';
import { DS_COMPONENT_DEFAULTS, DS_COMPONENT_TOKENS } from '../src/design-system/vocabulary.ts';
import { json } from './helpers.ts';

/**
 * Hostile inputs for the design-system contract: huge and deep documents,
 * prototype-pollution keys, Unicode tricks in identifiers, CSS injection in
 * every string that can reach CSS, URL and data-URL attacks, `extends`
 * attacks, and a migrate that never throws.
 */

type Doc = Record<string, unknown>;
const minimal = json<Doc>('fixtures/design-systems/minimal.json');
const acme = json<Doc>('fixtures/design-systems/acme.json');
const codes = (result: { errors: readonly { code: string; path: string }[] }) =>
  result.errors.map((e) => [e.code, e.path]);
const only = (doc: unknown, options?: Parameters<typeof validateDesignSystem>[1]) => [
  ...new Set(validateDesignSystem(doc, options).errors.map((e) => e.code)),
];

describe('size and depth', () => {
  it('refuses huge lists, maps, strings and key floods quickly, stopping at 64 errors', () => {
    const started = performance.now();
    const tags = Array.from({ length: 30_000 }, (_, i) => `t${i}`);
    expect(codes(validateDesignSystem({ ...minimal, tags }))).toEqual([
      ['invalid-value', '$.tags'],
    ]);
    const lexicon = Object.fromEntries(Array.from({ length: 30_000 }, (_, i) => [`k${i}`, 'v']));
    expect(codes(validateDesignSystem({ ...minimal, voice: { lexicon } }))).toEqual([
      ['invalid-value', '$.voice.lexicon'],
    ]);
    expect(codes(validateDesignSystem({ ...minimal, description: 'x'.repeat(2_000_000) }))).toEqual(
      [['invalid-value', '$.description']]
    );
    const flood = {
      ...minimal,
      ...Object.fromEntries(Array.from({ length: 100_000 }, (_, i) => [`k${i}`, i])),
    };
    const result = validateDesignSystem(flood);
    expect(result.errors).toHaveLength(64);
    expect(new Set(result.errors.map((e) => e.code))).toEqual(new Set(['unknown-key']));
    expect(performance.now() - started).toBeLessThan(2_000);
  });

  it('never descends into unknown structure: 1,000 levels deep inside a variant', () => {
    let deep: unknown = 'leaf';
    for (let i = 0; i < 1_000; i += 1) deep = { nest: deep };
    const doc = { ...minimal, variants: { compact: { space: deep } } };
    expect(codes(validateDesignSystem(doc))).toEqual([
      ['unknown-key', '$.variants.compact.space.nest'],
    ]);
    const nested = { ...minimal, variants: { compact: { variants: { x: {} } } } };
    expect(codes(validateDesignSystem(nested))).toEqual([
      ['unknown-key', '$.variants.compact.variants'],
    ]);
  });

  it('validates a maximal legal document (every section at its cap, 16 variants) under the value cap', () => {
    const valid: Record<string, unknown> = {
      r: 'md',
      d: 'space-0',
      t: 'body',
      b: 'thin',
      e: 1,
      o: 'muted',
      c: 'surface',
      k: 1,
    };
    const components = Object.fromEntries(
      Object.entries(DS_COMPONENT_TOKENS).map(([id, pairs]) => {
        const shape: Record<string, unknown> = Object.fromEntries(
          pairs
            ? pairs.split(' ').map((p) => [p.split(':')[0], valid[p.split(':')[1] as string]])
            : []
        );
        const defaults = DS_COMPONENT_DEFAULTS[id];
        if (defaults)
          shape.defaults = {
            ...(defaults[0] ? { variant: defaults[0].split(' ')[0] } : {}),
            ...(defaults[1] ? { size: defaults[1].split(' ')[0] } : {}),
          };
        return [id, shape];
      })
    );
    const files = Array.from({ length: 8 }, () => ({
      src: 'a.woff2',
      weight: '400',
      style: 'normal',
      display: 'swap',
      preload: true,
    }));
    const family = { stack: Array.from({ length: 8 }, (_, i) => `F${i}`), files };
    const {
      format,
      formatVersion,
      id,
      version,
      name,
      description,
      owner,
      license,
      tags,
      extends: base,
      variants: _,
      ...rest
    } = acme;
    const sections = {
      ...rest,
      typography: {
        ...(acme.typography as Doc),
        families: { sans: family, heading: family, mono: family, serif: family },
      },
      components,
    };
    let values = 0;
    const count = (v: unknown): void => {
      values += 1;
      if (v && typeof v === 'object') Object.values(v).forEach(count);
    };
    count(sections);
    const variants = Object.fromEntries(Array.from({ length: 16 }, (_, i) => [`v${i}`, sections]));
    const doc = {
      format,
      formatVersion,
      id,
      version,
      name,
      description,
      owner,
      license,
      tags,
      extends: base,
      ...sections,
      variants,
    };
    const started = performance.now();
    expect(validateDesignSystem(doc)).toEqual({ ok: true, errors: [] });
    expect(performance.now() - started).toBeLessThan(1_000);
    // About 1,060 values per section set, times 17, stays under the 20,000 cap.
    expect(values * 17).toBeGreaterThan(17_000);
    expect(values * 17).toBeLessThan(DESIGN_SYSTEM_LIMITS.values);
  });
});

describe('prototype pollution', () => {
  it('refuses __proto__, constructor and prototype wherever they appear and pollutes nothing', () => {
    for (const key of ['__proto__', 'constructor', 'prototype']) {
      const k = JSON.stringify(key);
      const text = `{"format":"texuli/design-system","formatVersion":1,"id":"a","version":"1.0.0","name":"A",
        ${k}:{"polluted":true},
        "color":{"brand":{"seed":"#fff",${k}:{"polluted":true}}},
        "voice":{"lexicon":{${k}:"x"}},
        "variants":{${k}:{}}}`;
      const doc = JSON.parse(text);
      expect(codes(validateDesignSystem(doc)), key).toEqual([
        ['unknown-key', `$.${key}`],
        ['unknown-key', `$.color.brand.${key}`],
        ['invalid-value', `$.voice.lexicon.${key}`],
        ['invalid-value', `$.variants.${key}`],
      ]);
      const patch = JSON.parse(
        `{${k}:{"polluted":true},"color":{"brand":{${k}:{"polluted":true}}}}`
      );
      expect(only(undefined)).toEqual(['invalid-type']);
      expect(validateDesignSystemPatch(patch).errors.map((e) => e.code)).toEqual([
        'unknown-key',
        'unknown-key',
      ]);
      const merged = applyDesignSystemPatch(
        minimal as unknown as DesignSystem,
        patch as DesignSystemPatch
      );
      expect(Object.getPrototypeOf(merged)).toBe(Object.prototype);
      expect(Object.getPrototypeOf(merged.color?.brand)).toBe(Object.prototype);
      expect(Object.hasOwn(merged, key)).toBe(false);
      const migrated = migrateDesignSystem(doc);
      expect(migrated.ok).toBe(true);
      if (migrated.ok) expect(Object.getPrototypeOf(migrated.document)).toBe(Object.prototype);
      expect(({} as Record<string, unknown>).polluted).toBeUndefined();
    }
  });
});

describe('Unicode tricks in identifiers', () => {
  it('refuses lookalikes, full-width letters, invisible and bidi controls, NUL and emoji', () => {
    const tricks = [
      'аcme', // Cyrillic a
      'ａcme', // full-width a
      'ac‍me', // zero-width joiner
      'acme‮', // RLO
      '⁦acme', // LRI
      'acme\u0000',
      'café', // NFD
      'café', // NFC
      'acme\u{1f600}',
    ];
    for (const trick of tricks) {
      const label = JSON.stringify(trick);
      expect(codes(validateDesignSystem({ ...minimal, id: trick })), label).toEqual([
        ['invalid-value', '$.id'],
      ]);
      expect(codes(validateDesignSystem({ ...minimal, tags: [trick] })), label).toEqual([
        ['invalid-value', '$.tags[0]'],
      ]);
      expect(only({ ...minimal, variants: { [trick]: {} } }), label).toEqual(['invalid-value']);
      expect(only({ ...minimal, voice: { lexicon: { [trick]: 'x' } } }), label).toEqual([
        'invalid-value',
      ]);
    }
    // Free text keeps emoji and joiners but refuses control and bidi characters.
    expect(validateDesignSystem({ ...minimal, name: 'Acme \u{1f468}‍\u{1f4bb}' }).ok).toBe(true);
    for (const bad of ['Acme‮emcA', 'Acme\n', 'Acme\u0085', 'Acme⁩'])
      expect(codes(validateDesignSystem({ ...minimal, name: bad })), JSON.stringify(bad)).toEqual([
        ['invalid-value', '$.name'],
      ]);
  });
});

const INJECTIONS = [
  ';}',
  '</style>',
  'url(https://x.example/a)',
  'expression(alert(1))',
  'var(--tx-primary)',
  '\\',
  '!important',
  '@import "x"',
  '/* x */',
  '#fff;}body{color:red',
  'oklch(0.5 0.1 200);}',
];

describe('CSS injection', () => {
  it('refuses injection in every string that can reach CSS', () => {
    for (const bad of INJECTIONS) {
      const label = JSON.stringify(bad);
      expect(only({ ...minimal, color: { brand: { seed: bad } } }), label).toEqual([
        'invalid-value',
      ]);
      expect(
        codes(
          validateDesignSystem({
            ...minimal,
            color: { brand: { seed: '#fff' }, roles: { light: { primary: bad } } },
          })
        ),
        label
      ).toEqual([['invalid-value', '$.color.roles.light.primary']]);
      expect(
        only({ ...minimal, typography: { families: { sans: { stack: [bad] } } } }),
        label
      ).toEqual(['invalid-value']);
      expect(
        only({
          ...minimal,
          typography: {
            families: { sans: { stack: ['A'], files: [{ src: 'a.woff2', weight: bad }] } },
          },
        }),
        label
      ).toEqual(['invalid-value']);
      expect(only({ ...minimal, components: { button: { radius: bad } } }), label).toEqual([
        'invalid-value',
      ]);
      expect(only({ ...minimal, assets: { favicon: bad } }), label).toEqual(['url-refused']);
      expect(only({ ...minimal, motion: { easing: bad } }), label).toEqual(['invalid-value']);
    }
    // Color keywords and other color functions are refused too: hex and numeric oklch only.
    for (const bad of ['red', 'transparent', 'rgb(0 0 0)', 'color-mix(in oklch, red, blue)'])
      expect(only({ ...minimal, color: { brand: { seed: bad } } }), bad).toEqual(['invalid-value']);
  });

  it('accepts only colors and stacks the token contract’s css-safe checks also accept', () => {
    const colors: string[] = [];
    const visit = (value: unknown): void => {
      if (typeof value === 'string' && (value.startsWith('#') || value.startsWith('oklch')))
        colors.push(value);
      else if (Array.isArray(value)) value.forEach(visit);
      else if (value && typeof value === 'object') Object.values(value).forEach(visit);
    };
    visit(acme.color);
    const corpus = [
      ...colors,
      '#abc',
      '#AABBCC',
      '#aabbccdd',
      'oklch(0.5 0.1 200)',
      'oklch(50% 0.1 200 / 0.5)',
      'oklch(.5 .1 359.999999 / 50%)',
      'oklch(1 0 0)',
      ...INJECTIONS,
      'rgb(0 0 0)',
      'oklch(0.5 0.1 200',
      'oklch(0.5, 0.1, 200)',
      'OKLCH(0.5 0.1 200)',
      '#abcd',
    ];
    expect(colors.length).toBeGreaterThan(100);
    let accepted = 0;
    for (const value of corpus) {
      const ok = validateDesignSystem({ ...minimal, color: { brand: { seed: value } } }).ok;
      if (ok) {
        accepted += 1;
        expect(isSafeCssColor(value), value).toBe(true);
      }
    }
    expect(accepted).toBeGreaterThan(100);
    const stacks = [
      ['Acme Sans', 'system-ui', 'sans-serif'],
      ['-apple-system', 'Segoe UI'],
      Array.from({ length: 8 }, (_, i) => `${'N'.repeat(31)}${i}`),
      Array.from({ length: 8 }, () => `-${'a'.repeat(32)}`),
      ['A"B'],
      ["A'B"],
      ['A,B'],
      ['var(--x)'],
      ['A(B)'],
    ];
    for (const stack of stacks) {
      const ok = validateDesignSystem({
        ...minimal,
        typography: { families: { sans: { stack } } },
      }).ok;
      // The compiler quotes each name and joins with commas.
      const css = stack.map((name) => `"${name}"`).join(', ');
      if (ok) expect(isSafeFontFamily(css), css).toBe(true);
      else
        expect(
          stack.some((name) => /["',()]/.test(name)),
          css
        ).toBe(true);
    }
  });
});

describe('URLs and data URLs', () => {
  const src = (value: string, trust?: 'developer') =>
    only({ ...minimal, assets: { logo: { light: value } } }, { trust });

  it('refuses remote, scheme, protocol-relative, traversal and encoded paths', () => {
    for (const bad of [
      'https://cdn.example/logo.png',
      'http://cdn.example/logo.png',
      '//cdn.example/logo.png',
      'javascript:alert(1)',
      'JaVaScRiPt:alert(1)',
      'file:///etc/passwd.png',
      'blob:https://x.example/1',
      '%2e%2e/logo.png',
      '..\\logo.png',
      '../logo.png',
      'a/../../logo.png',
      'a//logo.png',
      'logo.png?x=1',
      'logo.png#x',
      '/\\cdn.example/logo.png',
      'logo.exe',
      `${'a/'.repeat(300)}logo.png`,
    ])
      for (const trust of [undefined, 'developer'] as const)
        expect(src(bad, trust), `${bad} ${trust}`).toEqual(['url-refused']);
  });

  it('refuses SVG data, any data URL at untrusted, and font data as an image', () => {
    expect(src('data:image/svg+xml;base64,PHN2Zz4=', 'developer')).toEqual(['url-refused']);
    expect(src('data:image/svg+xml,<svg onload=alert(1)>', 'developer')).toEqual(['url-refused']);
    expect(src('data:image/png;base64,AAAA')).toEqual(['url-refused']);
    expect(src('DATA:image/png;base64,AAAA')).toEqual(['url-refused']);
    expect(src('data:font/woff2;base64,AAAA', 'developer')).toEqual(['url-refused']);
    expect(src('data:text/html;base64,AAAA', 'developer')).toEqual(['url-refused']);
    expect(src('data:image/png;base64,AAA', 'developer')).toEqual(['url-refused']);
    const font = (value: string, trust?: 'developer') =>
      only(
        {
          ...minimal,
          typography: { families: { sans: { stack: ['A'], files: [{ src: value }] } } },
        },
        { trust }
      );
    expect(font('data:font/woff2;base64,AAAA')).toEqual(['url-refused']);
    expect(font('data:font/woff2;base64,AAAA', 'developer')).toEqual([]);
  });

  it('enforces each cap at its edge and the 256 KiB total', () => {
    const data = (bytes: number) => `data:image/png;base64,${'A'.repeat((bytes / 3) * 4)}`;
    const logo = (bytes: number) => src(data(bytes), 'developer');
    expect(logo(32_766)).toEqual([]);
    expect(logo(32_769)).toEqual(['inline-bytes']);
    const fontData = (bytes: number) => `data:font/woff2;base64,${'A'.repeat((bytes / 3) * 4)}`;
    const file = { src: fontData(131_070) };
    const fonts = (n: number) => ({
      ...minimal,
      typography: {
        families: { sans: { stack: ['A'], files: Array.from({ length: n }, () => file) } },
      },
    });
    expect(validateDesignSystem(fonts(2), { trust: 'developer' }).ok).toBe(true);
    expect(codes(validateDesignSystem(fonts(3), { trust: 'developer' }))).toEqual([
      ['inline-bytes', '$.typography.families.sans.files[2].src'],
    ]);
  });

  it('accepts only sources the URL policy also accepts at the matching trust', () => {
    const corpus = [
      'logo.png',
      './a/b.svg',
      '/a.webp',
      'a-b_c.d.avif',
      'favicon.ico',
      'data:image/png;base64,AAAA',
      'data:image/avif;base64,AAAA',
      'data:image/jpeg;base64,AA==',
      ...['https://x.example/a.png', '//x.example/a.png', 'javascript:a', '../a.png'],
    ];
    let accepted = 0;
    for (const trust of ['untrusted', 'developer'] as const)
      for (const value of corpus)
        if (src(value, trust === 'developer' ? 'developer' : undefined).length === 0) {
          accepted += 1;
          expect(safeImageSrc(value, trust), `${value} ${trust}`).toBe(value);
        }
    expect(accepted).toBe(5 + 8);
  });
});

describe('extends', () => {
  it('refuses paths, URLs and ranges, and loops through a resolver', () => {
    const ext = (value: string) => only({ ...minimal, extends: value });
    for (const bad of [
      '../acme@1.0.0',
      '/abs',
      'https://x.example/acme@1.0.0',
      'acme@1.0.0/../../x',
      'texuli:../violet',
      'javascript:alert(1)',
      'data:application/json,{}',
    ])
      expect(ext(bad), bad).toEqual(['url-refused']);
    for (const range of [
      'acme@^1',
      'acme@1',
      'acme@1.x',
      'acme@>=1.0.0',
      'acme@~1.2.0',
      'acme@*',
      'acme@1.0.0 || 2.0.0',
    ])
      expect(ext(range), range).toEqual(['extends-range']);
    expect(ext('minimal@1.0.0')).toEqual(['extends-cycle']);
    const loop: Record<string, Doc> = {
      'a@1.0.0': { ...minimal, id: 'a', extends: 'b@1.0.0' },
      'b@1.0.0': { ...minimal, id: 'b', extends: 'a@1.0.0' },
    };
    let calls = 0;
    const resolve = (ref: string) => {
      calls += 1;
      return loop[ref];
    };
    expect(only({ ...minimal, extends: 'a@1.0.0' }, { resolve })).toEqual(['extends-cycle']);
    expect(calls).toBe(2);
    const infinite = (ref: string) => ({ ...minimal, extends: `${ref.split('@')[0]}x@1.0.0` });
    expect(only({ ...minimal, extends: 'a@1.0.0' }, { resolve: infinite })).toEqual([
      'extends-depth',
    ]);
    expect(only({ ...minimal, extends: 'a@1.0.0' }, { resolve: () => 'not a document' })).toEqual(
      []
    );
  });
});

describe('migrate is total', () => {
  it('returns a result, never an exception, for every JSON value and odd version', () => {
    const values: unknown[] = [null, undefined, 0, 1, 'x', [], [minimal], true, {}];
    for (const formatVersion of [
      2,
      1.5,
      '1',
      Number.NaN,
      -1,
      0,
      Number.MAX_SAFE_INTEGER,
      null,
      undefined,
    ])
      values.push({ ...minimal, formatVersion });
    for (const value of values) {
      const result = migrateDesignSystem(value);
      expect(result.ok, JSON.stringify(value) ?? 'undefined').toBe(false);
      if (!result.ok) {
        expect(result.errors).toHaveLength(1);
        expect(['invalid-type', 'format-version']).toContain(result.errors[0].code);
      }
      expect(() => validateDesignSystem(value)).not.toThrow();
      expect(() => validateDesignSystemPatch(value)).not.toThrow();
    }
    expect(migrateDesignSystem(minimal).ok).toBe(true);
  });
});
