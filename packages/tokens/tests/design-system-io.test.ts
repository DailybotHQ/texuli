// @vitest-environment node
/// <reference types="node" />
/**
 * T-ds-io: the design-system importers, emitters, report and diff
 * (`@texuli/tokens/design-system/{import,emit,report,diff,fixtures}`):
 * lossless round trips over the published fixtures, deterministic output and
 * diff ordering. Hostile inputs live in `design-system-io-hostile.test.ts`.
 */
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  type CompiledDesignSystem,
  compileDesignSystem,
  type DesignSystemFailure,
} from '../src/design-system/compile.ts';
import { diffDesignSystems } from '../src/design-system/diff.ts';
import {
  emitCompiledJson,
  emitCss,
  emitDtcg,
  emitDtcgJson,
  emitRolePalette,
  emitTailwindPreset,
  emitTailwindPresetJson,
  emitTokensStudio,
} from '../src/design-system/emit.ts';
import {
  dtcgFixture,
  PROTOYARD_THEME_V1_FORMAT,
  protoyardThemeV1Fixture,
  tokensStudioFixture,
} from '../src/design-system/fixtures.ts';
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
import { generateThemeFromSeed } from '../src/generator/seed.ts';
import { loadLibraryTheme } from '../src/library-port/index.ts';
import { REPORT_TAGS, tags } from './design-system-io-helpers.ts';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
type Doc = Record<string, unknown>;
const json = (path: string): Doc => JSON.parse(readFileSync(join(root, path), 'utf8'));
const acme = json('packages/spec/fixtures/design-systems/acme.json');
const minimal = json('packages/spec/fixtures/design-systems/minimal.json');
/** acme without its `texuli:violet` base, so it compiles synchronously. */
const { extends: _base, ...acmeLocal } = acme;
const knobs = json('packages/tokens/tests/fixtures/design-systems/protoyard-knobs.json');

const imported = (result: DesignSystemImportResult): Doc => {
  if (!result.ok) throw new Error(JSON.stringify(result.errors, null, 2));
  return result.document as unknown as Doc;
};
const compiled = (doc: unknown): CompiledDesignSystem => {
  const result: CompiledDesignSystem | DesignSystemFailure = compileDesignSystem(doc, {
    trust: 'developer',
  });
  if (!result.ok) throw new Error(JSON.stringify(result.errors, null, 2));
  return result;
};

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

describe('fixtures (design-system/fixtures)', () => {
  it('return fresh fictional copies every call', () => {
    const a = protoyardThemeV1Fixture();
    a.name = 'changed';
    expect(protoyardThemeV1Fixture().name).not.toBe('changed');
    expect(protoyardThemeV1Fixture().format).toBe(PROTOYARD_THEME_V1_FORMAT);
    const text = JSON.stringify([protoyardThemeV1Fixture(), dtcgFixture(), tokensStudioFixture()]);
    expect(text).not.toMatch(/@(?!example)[a-z]+\.[a-z]/i);
    expect(Object.keys(protoyardThemeV1Fixture().light)).toHaveLength(33);
    expect(Object.keys(protoyardThemeV1Fixture().dark ?? {})).toHaveLength(33);
  });
});

describe('lossless round trips', () => {
  it('protoyard-theme/v1 → document → protoyard-theme/v1 is exact, and the document compiles', () => {
    const fixture = protoyardThemeV1Fixture();
    const result = importRolePalette(fixture);
    const doc = imported(result);
    expect(result.ok && result.warnings).toEqual([]);
    expect(emitRolePalette(doc as never, { format: fixture.format })).toEqual(fixture);
    // Every Protoyard knob has its home (architecture B.13).
    expect(doc).toMatchObject({
      typography: { families: { sans: {}, heading: {}, mono: {} } },
      space: { density: fixture.density },
      elevation: { style: fixture.style?.elevation },
      surface: { style: fixture.style?.surface },
      motion: { personality: fixture.style?.motion },
      accessibility: { focus: fixture.style?.focusRing },
      color: { dataViz: { light: {}, dark: {} } },
    });
    const out = compiled(doc);
    expect(out.vars.light?.['--tx-primary']).toBe(fixture.light.primary);
    expect(out.vars.dark?.['--tx-background']).toBe(fixture.dark?.background);
  });

  it('DTCG fixture → document → DTCG is exact, and document → DTCG → document is exact', () => {
    const fixture = dtcgFixture();
    const doc = imported(importDtcg(fixture));
    expect(emitDtcg(doc as never)).toEqual(fixture);
    for (const source of [acme, minimal, knobs, doc]) {
      const result = importDtcg(emitDtcg(source as never), { trust: 'developer' });
      expect(imported(result)).toEqual(source);
      expect(result.warnings).toEqual([]);
      // JSON text in, too.
      expect(imported(importDtcg(emitDtcgJson(source as never), { trust: 'developer' }))).toEqual(
        source
      );
    }
    expect(compiled(doc).ok).toBe(true);
  });

  it('Tokens Studio fixture → document → Tokens Studio is exact, and document → Tokens Studio → document is exact', () => {
    const fixture = tokensStudioFixture();
    const doc = imported(importTokensStudio(fixture));
    expect(emitTokensStudio(doc as never)).toEqual(fixture);
    for (const source of [acme, minimal, knobs, doc]) {
      const result = importTokensStudio(emitTokensStudio(source as never), { trust: 'developer' });
      expect(imported(result)).toEqual(source);
      expect(result.warnings).toEqual([]);
    }
  });

  it('a Texuli Theme imports through fromTheme with its losses as warnings', async () => {
    const theme = await loadLibraryTheme('fintech-ledger');
    const doc = imported(importTheme(theme));
    expect(doc.id).toBe('fintech-ledger');
    expect(compiled(doc).vars.light?.['--tx-primary']).toBe(theme.light.primary.default);
    const custom = generateThemeFromSeed({ seed: '#0f766e' });
    const withHooks = { ...custom, components: { button: 'pill' } };
    const result = importTheme(withHooks);
    expect(result.ok).toBe(true);
    expect(result.warnings.map((w) => [w.code, w.path])).toContainEqual(['lossy', '$.components']);
  });
});

describe('importers on everyday input', () => {
  it('reads a brand one-liner into a valid document, warning on what it does not know', () => {
    const result = importBrand('brand #4f46e5, font Inter, rounded, compact');
    const doc = imported(result);
    expect(result.warnings).toEqual([]);
    expect(doc).toMatchObject({
      format: 'texuli/design-system',
      formatVersion: 1,
      color: { brand: { seed: '#4f46e5' } },
      typography: { families: { sans: { stack: ['Inter', 'system-ui', 'sans-serif'] } } },
      shape: { radius: 12 },
      space: { density: 0.875 },
    });
    expect(validateDesignSystem(doc).ok).toBe(true);
    const rich = imported(
      importBrand(
        'name Harbor Labs; seed #0F766E; secondary #b45309; neutral slate; heading font Yard Display; mono Yard Mono; sharp; spacious; glass; layered; calm motion; focus inset; AAA'
      )
    );
    expect(rich).toMatchObject({
      id: 'harbor-labs',
      name: 'Harbor Labs',
      color: { brand: { seed: '#0F766E', secondary: '#b45309', neutral: 'slate' } },
      typography: {
        families: {
          heading: { stack: ['Yard Display', 'system-ui', 'sans-serif'] },
          mono: { stack: ['Yard Mono', 'ui-monospace', 'monospace'] },
        },
      },
      shape: { radius: 0 },
      space: { density: 1.125 },
      surface: { style: 'glass' },
      elevation: { style: 'layered' },
      motion: { personality: 'subtle' },
      accessibility: { focus: 'inset', contrast: 'AAA' },
    });
    const vague = importBrand('make it pop, font Inter');
    expect(imported(vague)).toMatchObject({ color: { brand: { seed: '#7c3aed' } } });
    expect(vague.warnings.map((w) => w.code)).toEqual(['unmapped', 'default']);
  });

  it('maps a foreign DTCG file by role names, aliases and modes', () => {
    const result = importDtcg({
      color: {
        $type: 'color',
        brand: { $value: '#0f766e' },
        light: {
          background: { $value: '#ffffff' },
          'primary-foreground': { $value: '#ffffff' },
          primary: { $value: '{color.brand}' },
          card: { $value: { colorSpace: 'srgb', components: [1, 1, 1], hex: '#ffffff' } },
        },
        dark: { background: { $value: { colorSpace: 'oklch', components: [0.2, 0.02, 250] } } },
        hover: { $value: '#123456' },
      },
      font: { body: { $type: 'fontFamily', $value: ['Inter', 'sans-serif'] } },
      radius: { md: { $type: 'dimension', $value: { value: 0.5, unit: 'rem' } } },
    });
    expect(imported(result)).toMatchObject({
      color: {
        brand: { seed: '#0f766e' },
        roles: {
          light: {
            background: '#ffffff',
            primary: '#0f766e',
            primaryForeground: '#ffffff',
            surface: '#ffffff',
          },
          dark: { background: 'oklch(0.2 0.02 250)' },
        },
      },
      typography: { families: { sans: { stack: ['Inter', 'sans-serif'] } } },
      shape: { radius: 8 },
    });
    expect(result.warnings.map((w) => [w.code, w.path])).toEqual([['unmapped', '$.color.hover']]);
  });

  it('maps a foreign Tokens Studio file with light and dark sets', () => {
    const result = importTokensStudio({
      core: {
        brand: { value: '#b45309', type: 'color' },
        base: { value: '{brand}', type: 'color' },
      },
      light: {
        primary: { value: '{brand}', type: 'color' },
        radius: { value: '6', type: 'borderRadius' },
      },
      dark: { primary: { $value: '#fbbf24', $type: 'color' } },
      $themes: [],
      $metadata: { tokenSetOrder: ['core', 'light', 'dark'] },
    });
    expect(imported(result)).toMatchObject({
      color: {
        brand: { seed: '#b45309' },
        roles: { light: { primary: '#b45309' }, dark: { primary: '#fbbf24' } },
      },
      shape: { radius: 6 },
    });
    expect(result.warnings.map((w) => [w.code, w.path])).toEqual([['unmapped', '$.core.base']]);
  });

  it('suggests a palette from logo pixels, deterministically', () => {
    const pixels = new Uint8ClampedArray(64 * 64 * 4);
    for (let i = 0; i < 64 * 64; i++) {
      const [r, g, b, a] =
        i % 64 < 8
          ? [255, 255, 255, 0]
          : i < 2048
            ? [15, 118, 110, 255]
            : i % 3
              ? [245, 245, 245, 255]
              : [180, 83, 9, 255];
      pixels.set([r, g, b, a], i * 4);
    }
    const a = importLogoPixels({ data: pixels }, { name: 'Harbor' });
    const b = importLogoPixels({ data: Array.from(pixels) }, { name: 'Harbor' });
    expect(a).toEqual(b);
    if (!a.ok) throw new Error('no palette');
    expect(a.palette.length).toBeGreaterThan(1);
    expect(a.palette.map((c) => c.color)).toContain(a.document.color?.brand?.seed);
    expect(a.document.color?.brand?.secondary).toBeDefined();
    expect(compiled(a.document).ok).toBe(true);
    const blank = importLogoPixels({ data: new Uint8Array(16) });
    expect(blank.ok).toBe(false);
    expect(!blank.ok && blank.errors[0]?.code).toBe('invalid-input');
  });
});

describe('emitters are deterministic', () => {
  const acmeCompiled = compiled(acmeLocal);

  it('emit byte-equal output for the same input in any key order', () => {
    const shuffled = compiled(reorder(acmeLocal));
    expect(emitCss(shuffled)).toBe(emitCss(acmeCompiled));
    expect(emitCompiledJson(shuffled)).toBe(emitCompiledJson(acmeCompiled));
    expect(emitTailwindPresetJson(shuffled)).toBe(emitTailwindPresetJson(acmeCompiled));
    expect(emitReportHtml(shuffled)).toBe(emitReportHtml(acmeCompiled));
    expect(emitDtcgJson(reorder(acme) as never)).toBe(emitDtcgJson(acme as never));
    expect(JSON.stringify(emitTokensStudio(reorder(acme) as never))).toBe(
      JSON.stringify(emitTokensStudio(acme as never))
    );
  });

  it('scope CSS to a selector, :root or the default attribute, with .dark rules', () => {
    const css = emitCss(acmeCompiled);
    expect(css).toContain('[data-tx-ds="acme"] {\n  --tx-accent: ');
    expect(css).toContain('\n  --tx-background: #ffffff;\n');
    expect(css).toContain('[data-tx-ds="acme"].dark,\n.dark [data-tx-ds="acme"] {');
    const rootCss = emitCss(acmeCompiled, { selector: ':root' });
    expect(rootCss).toContain(':root {\n');
    expect(rootCss).toContain(':root.dark {\n');
    const attr = emitCss(acmeCompiled, { selector: '.brand', dark: 'attribute' });
    expect(attr).toContain('.brand[data-tx-mode="dark"],\n[data-tx-mode="dark"] .brand {');
    const media = emitCss(acmeCompiled, { selector: '.brand', dark: 'media' });
    expect(media).toContain('@media (prefers-color-scheme: dark) {\n  .brand {');
    const lightOnly = emitCss(acmeCompiled, { modes: ['light'] });
    expect(lightOnly).not.toContain('.dark');
    expect(() => emitCss(acmeCompiled, { selector: 'a{}b' })).toThrow(TypeError);
    // Every declaration of the compiled map is written.
    const count = (css.match(/^ {2}--tx-/gm) ?? []).length;
    expect(count).toBe(
      Object.keys(acmeCompiled.vars.light ?? {}).length +
        Object.keys(acmeCompiled.vars.dark ?? {}).length
    );
  });

  it('puts a single compiled mode on the selector, as designSystemStyle does', () => {
    const darkOnly = compiled({
      ...acmeLocal,
      color: { ...(acmeLocal.color as Doc), modes: ['dark'] },
    });
    expect(Object.keys(darkOnly.vars)).toEqual(['dark']);
    for (const dark of ['class', 'attribute', 'media'] as const) {
      const css = emitCss(darkOnly, { dark });
      expect(css).toContain('[data-tx-ds="acme"] {\n  --tx-');
      expect(css).not.toMatch(/\.dark|data-tx-mode|@media/);
      expect(css).toContain(`--tx-background: ${darkOnly.vars.dark?.['--tx-background']};`);
    }
    // An explicit single mode of a two-mode design system is the base rule too.
    const darkRule = emitCss(acmeCompiled, { selector: ':root', modes: ['dark'] });
    expect(darkRule).toContain(`:root {\n`);
    expect(darkRule).toContain(`--tx-background: ${acmeCompiled.vars.dark?.['--tx-background']};`);
    expect(darkRule).not.toContain('.dark');
    // The Tailwind preset of a dark-only design system still names every variable.
    expect(emitTailwindPreset(darkOnly).theme.extend.colors.primary).toBe('var(--tx-primary)');
  });

  it('builds a Tailwind preset over the --tx-* variables or concrete values', () => {
    const preset = emitTailwindPreset(acmeCompiled);
    expect(preset.theme.extend.colors.primary).toBe('var(--tx-primary)');
    expect(preset.theme.extend.colors['primary-foreground']).toBe('var(--tx-primary-foreground)');
    expect(preset.theme.extend.borderRadius.md).toBe('var(--tx-shape-radius-md)');
    expect(preset.theme.extend.fontFamily.sans).toEqual(['var(--tx-font-sans)']);
    expect(preset.theme.extend.spacing['tx-4']).toBe('var(--tx-space-4)');
    const concrete = emitTailwindPreset(acmeCompiled, { values: 'dark' });
    expect(concrete.theme.extend.colors.background).toBe('#111827');
    expect(concrete.theme.extend.fontFamily.sans).toEqual(['Acme Sans', 'system-ui', 'sans-serif']);
    expect(JSON.parse(emitTailwindPresetJson(acmeCompiled))).toEqual(preset);
  });

  it('writes compiled JSON with sorted keys that parses back to the compiled design system', () => {
    const text = emitCompiledJson(acmeCompiled);
    expect(JSON.parse(text)).toEqual(JSON.parse(JSON.stringify(acmeCompiled)));
    expect(text.endsWith('\n')).toBe(true);
    expect(text.indexOf('"accessibility"')).toBeLessThan(text.indexOf('"assets"'));
  });

  it('renders a static report: swatches, type ramp, component sheet, contrast table', () => {
    const html = emitReportHtml(acmeCompiled);
    expect(html.startsWith('<!doctype html>')).toBe(true);
    expect(html).toContain("default-src 'none'");
    expect(html).toContain('<h1>Acme 2.1.0</h1>');
    for (const section of ['Swatches', 'Type ramp', 'Components', 'Contrast', 'Adjustments'])
      expect(html).toContain(`<h2>${section}</h2>`);
    expect(tags(html)).toEqual(REPORT_TAGS);
    for (const tag of html.match(/<[a-z!][^>]*>/gi) ?? []) expect(tag).not.toMatch(/\son[a-z]+=/i);
  });
});

describe('diffDesignSystems', () => {
  const base = compiled(minimal);

  it('reports nothing for the same design system', () => {
    const diff = diffDesignSystems(base, compiled(reorder(minimal)));
    expect(diff.identical).toBe(true);
    expect(diff.tokens).toEqual([]);
  });

  it('lists token, default and attribute changes per mode in a stable order', () => {
    const next = compiled({
      ...minimal,
      version: '1.1.0',
      shape: { radius: 4 },
      components: { button: { defaults: { variant: 'outline' } } },
      color: { brand: { seed: '#4f46e5' }, roles: { dark: { background: '#000000' } } },
    });
    const diff = diffDesignSystems(base, next);
    expect(diff.identical).toBe(false);
    expect(diff.tokens).toContainEqual({
      mode: 'light',
      variable: '--tx-radius',
      change: 'changed',
      before: '0.625rem',
      after: '0.25rem',
    });
    expect(diff.tokens).toContainEqual(
      expect.objectContaining({ mode: 'dark', variable: '--tx-background', after: '#000000' })
    );
    expect(
      diff.tokens.filter((t) => t.mode === 'light' && t.variable === '--tx-background')
    ).toEqual([]);
    const order = diff.tokens.map((t) => `${t.mode === 'light' ? 0 : 1}${t.variable}`);
    expect(order).toEqual([...order].sort());
    expect(diff.defaults).toEqual([
      { component: 'button', key: 'variant', before: undefined, after: 'outline' },
    ]);
    expect(diff.attrs).toEqual([
      { attribute: 'data-tx-ds-version', before: '1.0.0', after: '1.1.0' },
    ]);
    expect(diffDesignSystems(base, next)).toEqual(diff);
  });

  it('reports contrast regressions: pairs that fell below the baseline target', () => {
    const strict = compiled({ ...minimal, accessibility: { contrast: 'AAA' } });
    const loose = compiled({
      ...minimal,
      color: { brand: { seed: '#4f46e5' }, roles: { light: { mutedForeground: '#6b7280' } } },
    });
    const diff = diffDesignSystems(strict, loose);
    expect(diff.contrast.length).toBeGreaterThan(0);
    const muted = diff.contrast.find(
      (pair) => pair.mode === 'light' && pair.foreground === '--tx-muted-foreground'
    );
    expect(muted).toMatchObject({ required: 7 });
    expect(muted && muted.after < 7 && muted.before >= 7).toBe(true);
    expect(diffDesignSystems(loose, strict).contrast).toEqual([]);
  });
});
