// @vitest-environment node
/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { themeVariables } from '../src/css/apply.ts';
import {
  checkDesignSystemGuarantees,
  compileDesignSystem,
  fromTheme,
  fromThemeWithReport,
  loadLibraryBase,
  resolveDesignSystemSync,
} from '../src/design-system/compile.ts';
import { validateDesignSystem } from '../src/design-system/validate.ts';
import { generateThemeFromSeed } from '../src/generator/seed.ts';
import { loadAllFullLibraryThemes } from '../src/library-expand/index.ts';

const tokensSrc = resolve(dirname(fileURLToPath(import.meta.url)), '../src');

/** `themeVariables` with its own `var()` references resolved (its shadows read `--tx-shadow`). */
function resolved(vars: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [name, value] of Object.entries(vars)) {
    let v = value;
    for (let i = 0; i < 8 && v.includes('var('); i++)
      v = v.replace(
        /var\((--[a-z0-9-]+)(?:,\s*([^()]*))?\)/g,
        (_, ref, fallback) => vars[ref] ?? fallback ?? ''
      );
    out[name] = v;
  }
  return out;
}

describe('fromTheme: the zero-drift bridge', () => {
  it('turns all 210 library themes into valid documents that compile to their themeVariables', async () => {
    const themes = await loadAllFullLibraryThemes();
    expect(themes).toHaveLength(210);
    let compared = 0;
    for (const theme of themes) {
      const plain = fromThemeWithReport(theme);
      const library = await loadLibraryBase(`texuli:${theme.id}`);
      expect(plain.losses, theme.id).toEqual([]);
      for (const document of [plain.document, library]) {
        expect(validateDesignSystem(document).ok, theme.id).toBe(true);
        const compiled = compileDesignSystem(document);
        if (!compiled.ok) throw new Error(`${theme.id}: ${JSON.stringify(compiled.errors[0])}`);
        expect(checkDesignSystemGuarantees(compiled), theme.id).toEqual([]);
        for (const mode of ['light', 'dark'] as const) {
          const expected = resolved(themeVariables({ theme, mode }));
          const got = compiled.vars[mode] as Record<string, string>;
          const shared = Object.keys(expected);
          expect(
            Object.fromEntries(shared.map((name) => [name, got[name]])),
            `${theme.id} ${mode}`
          ).toEqual(expected);
          compared += shared.length;
        }
      }
    }
    // Every themeVariables entry of every theme, mode and path was compared.
    expect(compared).toBeGreaterThan(210 * 2 * 2 * 130);
  }, 120_000);

  it('pins only the roles the generator would not reproduce, and reports what it cannot carry', () => {
    const generated = generateThemeFromSeed({ seed: '#0e7490', neutral: 'slate' });
    const document = fromTheme(generated, {
      brand: { seed: '#0e7490', neutral: 'slate' },
    }) as unknown as Record<string, Record<string, unknown>>;
    expect(document.color?.roles).toBeUndefined();
    const custom = {
      ...generated,
      radius: '9999px',
      light: { ...generated.light, primary: { default: 'rebeccapurple' } },
      style: {
        ...generated.style,
        motion: { durations: { fast: 10, base: 20, slow: 30 }, easing: 'steps(2)' },
      },
    };
    const report = fromThemeWithReport(custom);
    expect(report.losses.map((loss) => loss.path)).toEqual(
      expect.arrayContaining(['$.color.roles.light.primary', '$.shape.radius', '$.motion.easing'])
    );
    expect(validateDesignSystem(report.document).ok).toBe(true);
    // 210 themes × 2 modes × 2 paths: about 2 s locally, slower under CI load.
  }, 30_000);
});

/** A small seeded PRNG (mulberry32) so property runs are reproducible. */
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe('property: random valid documents', () => {
  it('compile, hold every guarantee, stay concrete and hash stably (or refuse only for pins)', () => {
    const random = rng(20261030);
    const pick = <T>(list: readonly T[]): T => list[Math.floor(random() * list.length)] as T;
    const color = () =>
      `#${Math.floor(random() * 0xffffff)
        .toString(16)
        .padStart(6, '0')}`;
    const between = (lo: number, hi: number, step = 0.01) =>
      Math.round((lo + random() * (hi - lo)) / step) * step;
    let compiled = 0;
    let refused = 0;
    for (let run = 0; run < 120; run++) {
      const pins = random() < 0.4;
      const doc: Record<string, unknown> = {
        format: 'texuli/design-system',
        formatVersion: 1,
        id: `random-${run}`,
        version: '1.0.0',
        name: `Random ${run}`,
        color: {
          brand: {
            seed: color(),
            ...(random() < 0.5 ? { secondary: color() } : {}),
            ...(random() < 0.5 ? { accent: color() } : {}),
            neutral: pick(['zinc', 'slate', 'stone', 'gray', 'warm', 'cool', 'tinted']),
          },
          ...(pins
            ? { pin: { [pick(['primary', 'destructive', 'success', 'warning', 'info'])]: color() } }
            : {}),
          ...(random() < 0.3 ? { modes: [pick(['light', 'dark'])] } : {}),
          ...(random() < 0.3 ? { dataViz: { cvdSafe: true } } : {}),
        },
        typography: {
          scale: { base: between(12, 24, 1), ratio: between(1.05, 1.6) },
          roles: { body: { weight: pick([300, 400, 500]), line: between(1, 2.5, 0.05) } },
        },
        shape: {
          radius: between(0, 48, 1),
          radiusScale: between(0, 4, 0.05),
          borderWidth: between(0, 4, 0.5),
        },
        space: { base: between(2, 8, 1), density: between(0.75, 1.25) },
        elevation: { style: pick(['flat', 'soft', 'crisp', 'glow', 'layered']) },
        surface: {
          style: pick(['solid', 'glass']),
          glass: { alpha: between(0, 1), blur: between(0, 64, 1) },
        },
        motion: { personality: pick(['none', 'subtle', 'standard', 'expressive']) },
        icons: { style: pick(['outline', 'filled']), stroke: between(0.5, 3, 0.25) },
        components: {
          button: {
            radius: pick(['none', 'sm', 'full']),
            'height-md': pick(['control-md', 'control-lg', 'space-10']),
          },
        },
        accessibility: {
          contrast: pick(['AA', 'AA', 'AAA']),
          targetMin: pick([24, 24, 28, 32]),
          focus: pick(['ring', 'outline', 'glow', 'inset']),
          focusWidth: pick([2, 3, 4]),
        },
      };
      expect(validateDesignSystem(doc).ok, `run ${run}`).toBe(true);
      const result = compileDesignSystem(doc);
      const again = compileDesignSystem(structuredClone(doc));
      expect(JSON.stringify(again)).toBe(JSON.stringify(result));
      if (!result.ok) {
        refused++;
        // Only an author's pin (or a pinned size) can make a document unsatisfiable.
        for (const issue of result.errors) {
          expect(['aa-text', 'aa-focus', 'target-size'], `run ${run}`).toContain(issue.code);
          expect(issue.path, `run ${run}`).toMatch(/^\$\.(color\.pin|components)/);
        }
        continue;
      }
      compiled++;
      expect(checkDesignSystemGuarantees(result), `run ${run}`).toEqual([]);
      for (const vars of Object.values(result.vars))
        for (const value of Object.values(vars ?? {})) expect(value).not.toMatch(/var\(|url\(/);
      const hash = resolveDesignSystemSync(doc);
      expect(hash.ok && hash.hash).toMatch(/^[0-9a-f]{64}$/);
    }
    expect(compiled).toBeGreaterThan(80);
    expect(compiled + refused).toBe(120);
  });
});

describe('laziness: the root never reaches the compiler', () => {
  it('keeps design-system modules and @texuli/spec out of the @texuli/tokens root import graph', () => {
    const seen = new Set<string>();
    const visit = (file: string) => {
      if (seen.has(file)) return;
      seen.add(file);
      const source = readFileSync(file, 'utf8');
      for (const match of source.matchAll(/^(?:import|export)\s[^;]*?from\s+'([^']+)'/gms)) {
        const spec = match[1] as string;
        if (match[0].startsWith('import type') || match[0].startsWith('export type')) continue;
        expect(
          spec.startsWith('@texuli/spec'),
          `${relative(tokensSrc, file)} imports ${spec}`
        ).toBe(false);
        if (spec.startsWith('.')) visit(join(dirname(file), spec));
      }
    };
    visit(join(tokensSrc, 'index.ts'));
    expect(seen.size).toBeGreaterThan(20);
    expect([...seen].filter((file) => file.includes('/design-system/'))).toEqual([]);
  });
});
