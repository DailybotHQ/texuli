// @vitest-environment node
/**
 * T-ds-io hostile inputs: every importer returns codes and never throws, never
 * pollutes a prototype, refuses CSS-injection strings and invisible
 * characters, and caps huge inputs; the emitters drop unsafe compiled values
 * and the report escapes every name and value by construction.
 */
import { describe, expect, it } from 'vitest';
import { type CompiledDesignSystem, compileDesignSystem } from '../src/design-system/compile.ts';
import { diffDesignSystems } from '../src/design-system/diff.ts';
import { emitCss, emitTailwindPreset } from '../src/design-system/emit.ts';
import {
  type DesignSystemImportResult,
  importBrand,
  importDtcg,
  importLogoPixels,
  importRolePalette,
  importTheme,
  importTokensStudio,
} from '../src/design-system/import.ts';
import { emitReportHtml } from '../src/design-system/report.ts';
import { validateDesignSystem } from '../src/design-system/validate.ts';
import { REPORT_TAGS, tags } from './design-system-io-helpers.ts';

const RLO = '\u202e';
const ZWSP = '\u200b';
const INJECT = 'red;}body{background:url(//evil.example/x)';
const BREAKOUT = '</style><script>alert(1)</script>';

type Importer = (input: never) => DesignSystemImportResult;
const IMPORTERS: [string, Importer][] = [
  ['brand', importBrand as Importer],
  ['dtcg', importDtcg as Importer],
  ['tokens-studio', importTokensStudio as Importer],
  ['role-palette', importRolePalette as Importer],
  ['theme', importTheme as Importer],
  ['logo-pixels', importLogoPixels as Importer],
];

const WRONG_TYPES: unknown[] = [
  undefined,
  null,
  0,
  Number.NaN,
  true,
  'not json {',
  '[]',
  [],
  [1, 2, 3],
  () => 1,
  Symbol('x'),
  new Date(0),
  { data: 'string' },
  { light: 'x', $value: 1, value: [] },
];

/** A valid result is a valid document; an invalid one carries codes. */
function sound(result: DesignSystemImportResult) {
  expect(Array.isArray(result.warnings)).toBe(true);
  if (result.ok) expect(validateDesignSystem(result.document).ok).toBe(true);
  else
    for (const error of result.errors) {
      expect(typeof error.code).toBe('string');
      expect(error.path.startsWith('$')).toBe(true);
    }
}

describe('every importer on wrong types', () => {
  it('returns a result with codes and never throws', () => {
    for (const [name, run] of IMPORTERS)
      for (const input of WRONG_TYPES) {
        let result: DesignSystemImportResult | undefined;
        expect(
          () => {
            result = run(input as never);
          },
          `${name} ${String(input)}`
        ).not.toThrow();
        sound(result as DesignSystemImportResult);
      }
  });

  it('survives throwing getters and cycles', () => {
    const trap = Object.defineProperty({}, 'light', {
      enumerable: true,
      get() {
        throw new Error('boom');
      },
    });
    const cycle: Record<string, unknown> = { color: {} };
    (cycle.color as Record<string, unknown>).self = cycle;
    for (const [, run] of IMPORTERS)
      for (const input of [trap, cycle]) {
        const result = run(input as never);
        sound(result);
      }
  });
});

describe('prototype pollution', () => {
  it('skips __proto__, constructor and prototype keys in every parser', () => {
    const polluted = (inner: string) =>
      JSON.parse(
        `{"__proto__":{"polluted":1},"constructor":{"prototype":{"polluted":1}},${inner}}`
      );
    const inputs: [Importer, unknown][] = [
      [
        importDtcg as Importer,
        polluted('"color":{"__proto__":{"$value":"#000000"},"brand":{"$value":"#0f766e"}}'),
      ],
      [
        importDtcg as Importer,
        polluted(
          '"$extensions":{"com.texuli.design-system":{"__proto__":{"polluted":1},"name":"X","color":{"brand":{"seed":"#0f766e","__proto__":{"polluted":1}}}}}'
        ),
      ],
      [
        importTokensStudio as Importer,
        polluted(
          '"light":{"__proto__":{"value":"#000","type":"color"},"primary":{"value":"#0f766e","type":"color"}}'
        ),
      ],
      [
        importRolePalette as Importer,
        polluted(
          '"light":{"__proto__":"#000000","primary":"#0f766e","primaryForeground":"#ffffff"},"style":{"__proto__":{"surface":"glass"}}'
        ),
      ],
      [importTheme as Importer, polluted('"id":"x"')],
    ];
    for (const [run, input] of inputs) {
      const result = run(input as never);
      sound(result);
      expect(({} as Record<string, unknown>).polluted).toBeUndefined();
      expect(Object.prototype).not.toHaveProperty('polluted');
      if (result.ok) expect(JSON.stringify(result.document)).not.toContain('polluted');
      expect(result.warnings.some((w) => w.code === 'reserved-key')).toBe(true);
    }
  });
});

describe('huge inputs', () => {
  it('refuse JSON text over the byte cap and token trees over the node cap', () => {
    const big = `{"a":"${'x'.repeat(1_100_000)}"}`;
    for (const run of [importDtcg, importTokensStudio, importRolePalette, importTheme]) {
      const result = run(big as never);
      expect(result.ok).toBe(false);
      expect(!result.ok && result.errors[0]?.code).toBe('input-limit');
    }
    expect(importBrand('brand #0f766e, '.repeat(500)).ok).toBe(false);
    const wide: Record<string, unknown> = {};
    for (let i = 0; i < 60_000; i++) wide[`t${i}`] = { $value: '#000000', $type: 'color' };
    const result = importDtcg({ color: wide });
    expect(result.ok).toBe(false);
    expect(!result.ok && result.errors[0]?.code).toBe('input-limit');
    let deep: Record<string, unknown> = { $value: '#000000' };
    for (let i = 0; i < 200; i++) deep = { g: deep };
    const nested = importDtcg(deep);
    sound(nested);
    expect(nested.warnings.some((w) => w.code === 'limit')).toBe(true);
    const pixels = importLogoPixels({ data: { length: 2 ** 40 } as never });
    expect(!pixels.ok && pixels.errors[0]?.code).toBe('input-limit');
  });

  it('caps alias chains and refuses alias cycles', () => {
    const tokens: Record<string, unknown> = { brand: { $value: '{a0}', $type: 'color' } };
    for (let i = 0; i < 40; i++) tokens[`a${i}`] = { $value: `{a${i + 1}}`, $type: 'color' };
    tokens.a40 = { $value: '#0f766e', $type: 'color' };
    const long = importDtcg(tokens);
    sound(long);
    expect(long.warnings.some((w) => w.code === 'alias')).toBe(true);
    const cyclic = importDtcg({
      brand: { $value: '{x}', $type: 'color' },
      x: { $value: '{brand}', $type: 'color' },
    });
    sound(cyclic);
    expect(cyclic.warnings.filter((w) => w.code === 'alias').length).toBeGreaterThan(0);
  });
});

describe('CSS injection and invisible characters', () => {
  const VALUES = [
    INJECT,
    BREAKOUT,
    'expression(alert(1))',
    '#0f766e;color:red',
    `#0f766e${ZWSP}`,
    `${RLO}#0f766e`,
    'url(javascript:alert(1))',
    'oklch(0.5 0.1 200) /*',
  ];

  it('refuses them in colors, fonts and identity in every parser', () => {
    for (const bad of VALUES) {
      const results: DesignSystemImportResult[] = [
        importBrand(`brand ${bad}, font ${bad}, name ${bad}`),
        importDtcg({
          color: { brand: { seed: { $value: bad, $type: 'color' } } },
          typography: {
            families: { sans: { stack: { $value: [bad, 'Inter'], $type: 'fontFamily' } } },
          },
          $extensions: { 'com.texuli.design-system': { name: bad, id: bad } },
        }),
        importTokensStudio({ global: { primary: { value: bad, type: 'color' } } }),
        importRolePalette({
          name: bad,
          light: { primary: bad, background: '#ffffff' },
          fontFamily: `${bad}, Inter`,
          radius: bad,
        }),
      ];
      for (const result of results) {
        sound(result);
        const text = JSON.stringify(result.ok ? result.document : {});
        expect(text).not.toMatch(/url\(|expression|<\/style|;color|\\u200b|\\u202e/i);
        expect(text).not.toContain(ZWSP);
        expect(text).not.toContain(RLO);
        expect(
          result.warnings.some((w) => w.code === 'unsafe-value' || w.code === 'invalid-value')
        ).toBe(true);
      }
    }
  });
});

describe('emitters and the report on hostile compiled values', () => {
  const base = compileDesignSystem({
    format: 'texuli/design-system',
    formatVersion: 1,
    id: 'safe',
    version: '1.0.0',
    name: 'Safe',
    color: { brand: { seed: '#4f46e5' } },
  }) as CompiledDesignSystem;
  const hostile: CompiledDesignSystem = {
    ...base,
    id: `x"]{}</style>${RLO}`,
    name: `<img src=x onerror=alert(1)>${BREAKOUT}`,
    version: '"><script>',
    vars: {
      light: {
        ...base.vars.light,
        '--tx-primary': INJECT,
        '--tx-background': BREAKOUT,
        '--tx-evil;}': '#000000',
      } as never,
      dark: base.vars.dark,
    },
    report: {
      ...base.report,
      warnings: [{ path: `$.${BREAKOUT}`, message: `<b onclick="x">${INJECT}</b>` }],
      adjustments: [
        {
          mode: 'light',
          variable: '--tx-<i>',
          from: BREAKOUT,
          to: '"\'&',
          path: '$.x',
          reason: '<svg onload=alert(1)>',
        },
      ],
    },
  };

  it('drop unsafe declarations from CSS and the Tailwind preset', () => {
    const css = emitCss(hostile, { selector: '.ok' });
    expect(css).not.toMatch(/url\(|<\/style|evil|<script/);
    expect(css).toContain('skipped 3 unsafe declarations');
    const preset = JSON.stringify(emitTailwindPreset(hostile, { values: 'light' }));
    expect(preset).not.toMatch(/url\(|<\/style/);
  });

  it('escape every name and value in the report HTML', () => {
    const html = emitReportHtml(hostile);
    for (const tag of tags(html)) expect(REPORT_TAGS).toContain(tag);
    expect(html).not.toMatch(/<script|<img|<svg|<b |<\/style><s/i);
    // No real tag carries an event handler (escaped text may spell one out, inertly).
    for (const tag of html.match(/<[a-z!][^>]*>/gi) ?? []) expect(tag).not.toMatch(/\son[a-z]+=/i);
    // CSS only lives in the one stylesheet and in style attributes; neither loads anything.
    const css = [
      ...(html.match(/<style>[\s\S]*?<\/style>/g) ?? []),
      ...(html.match(/style="[^"]*"/g) ?? []),
    ].join('\n');
    expect(css).not.toMatch(/url\(|expression|evil/i);
    expect(html).not.toContain(RLO);
    expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;');
    expect(html).toContain('&quot;&#39;&amp;');
    expect(emitReportHtml(hostile, { title: '<script>' })).toContain('&lt;script&gt;');
  });

  it('diff never throws on a malformed compiled value', () => {
    expect(() => diffDesignSystems(hostile, base)).not.toThrow();
    expect(() => diffDesignSystems({} as never, null as never)).not.toThrow();
  });
});
