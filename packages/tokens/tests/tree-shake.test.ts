// @vitest-environment node
/// <reference types="node" />
/**
 * Prove package sideEffects (CSS-only glob) lets a named import from
 * `@texuli/tokens` (and the `./css` subpath) tree-shake away the theme library
 * and generator.
 */
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const tokensSrc = join(root, 'packages/tokens/src');
const require = createRequire(import.meta.url);

/** The slice of esbuild's API this gate uses (esbuild is not a direct dependency). */
type Esbuild = {
  build(options: Record<string, unknown>): Promise<{
    outputFiles?: { text: string }[];
    metafile?: { inputs?: Record<string, unknown> };
  }>;
};

function loadEsbuild(): Esbuild {
  // esbuild is a transitive dep of Vite; resolve through Vite so we do not add
  // a root dependency solely for this gate.
  const vitePkg = require.resolve('vite/package.json');
  const esbuildId = require.resolve('esbuild', { paths: [dirname(vitePkg)] });
  return require(esbuildId) as Esbuild;
}

async function bundleNamedImport(entrySource: string): Promise<string> {
  const esbuild = loadEsbuild();
  const result = await esbuild.build({
    stdin: {
      contents: entrySource,
      resolveDir: tokensSrc,
      sourcefile: 'tree-shake-entry.ts',
      loader: 'ts',
    },
    bundle: true,
    write: false,
    format: 'esm',
    platform: 'browser',
    target: 'es2022',
    // Match package.json sideEffects so CSS-only side effects are kept and
    // pure JS modules can be dropped.
    packages: 'bundle',
    logLevel: 'silent',
  });
  const file = result.outputFiles?.[0];
  if (!file) throw new Error('esbuild produced no output');
  return file.text;
}

const LIBRARY_MARKERS = [
  'THEME_LIBRARY_META',
  'loadLibraryTheme',
  'listThemeLibrary',
  'loadAllLibraryThemes',
  'EXPAND_THEME_LIBRARY_META',
  'loadExpandTheme',
  'library-port/themes/',
  'PORT_THEME_RECORDS',
  'velvet-shop',
  'winter-frost',
] as const;

const GENERATOR_MARKERS = [
  'generateThemeFromSeed',
  'generateThemeFromMood',
  'generateThemeFromImage',
  'dominantColors',
  'MOODS',
  'NEUTRAL_FAMILIES',
] as const;

describe('tokens tree-shaking (sideEffects css-only)', () => {
  it('package.json declares sideEffects so bundlers can drop pure modules', () => {
    const pkg = require(join(root, 'packages/tokens/package.json')) as {
      sideEffects?: unknown;
      exports?: Record<string, unknown>;
    };
    expect(pkg.sideEffects).toEqual(['**/*.css']);
    expect(pkg.exports?.['./css']).toBeTruthy();
    expect(pkg.exports?.['./contract']).toBeTruthy();
    expect(pkg.exports?.['./build']).toBeTruthy();
    expect(pkg.exports?.['./palette']).toBe('./src/palette/index.ts');
  });

  it('named applyTheme from root barrel excludes library and generator', async () => {
    const code = await bundleNamedImport(
      `export { applyTheme } from ${JSON.stringify(join(tokensSrc, 'index.ts'))};\n`
    );
    expect(code).toMatch(/applyTheme/);
    for (const marker of LIBRARY_MARKERS) {
      expect(code, `library marker leaked: ${marker}`).not.toContain(marker);
    }
    for (const marker of GENERATOR_MARKERS) {
      expect(code, `generator marker leaked: ${marker}`).not.toContain(marker);
    }
    // Bundle must stay far below the full root barrel budget (~50 KiB gzip).
    expect(code.length).toBeLessThan(80_000);
  });

  it('`@texuli/tokens/css` applyTheme also excludes library and generator', async () => {
    const code = await bundleNamedImport(
      `export { applyTheme } from ${JSON.stringify(join(tokensSrc, 'css/index.ts'))};\n`
    );
    expect(code).toMatch(/applyTheme/);
    for (const marker of [...LIBRARY_MARKERS, ...GENERATOR_MARKERS]) {
      expect(code, `marker leaked from ./css: ${marker}`).not.toContain(marker);
    }
  });

  it('`@texuli/tokens/build` can build one theme without the catalog', async () => {
    const code = await bundleNamedImport(
      `export { buildLibraryTheme } from ${JSON.stringify(join(tokensSrc, 'build/index.ts'))};\n`
    );
    expect(code).toMatch(/buildLibraryTheme/);
    for (const marker of [
      'THEME_LIBRARY_META',
      'loadLibraryTheme',
      'listThemeLibrary',
      'EXPAND_THEME_LIBRARY_META',
      'PORT_THEME_RECORDS',
      'velvet-shop',
      'generateThemeFromImage',
    ] as const) {
      expect(code, `catalog/generator leaked into ./build: ${marker}`).not.toContain(marker);
    }
  });

  it('`@texuli/tokens/palette` has no library port or expand code', async () => {
    const esbuild = loadEsbuild();
    const result = await esbuild.build({
      stdin: {
        contents: `export { deriveChartTokens, generatePaletteScale, contrastRatio, oklchToHex } from ${JSON.stringify(join(tokensSrc, 'palette/index.ts'))};\n`,
        resolveDir: tokensSrc,
        sourcefile: 'palette-only.ts',
        loader: 'ts',
      },
      bundle: true,
      write: false,
      format: 'esm',
      platform: 'browser',
      target: 'es2022',
      packages: 'bundle',
      logLevel: 'silent',
      minify: true,
      metafile: true,
    });
    const code = result.outputFiles?.[0]?.text ?? '';
    expect(code).toMatch(/deriveChartTokens|generatePaletteScale/);
    for (const marker of [
      ...LIBRARY_MARKERS,
      'library-port/',
      'library-expand/',
      'EXPAND_THEME_ROWS',
      'loadExpandTheme',
      'fintech-ledger',
      'generateThemeFromSeed',
      'runLibraryAaGate',
    ] as const) {
      expect(code, `library/catalog leaked into ./palette: ${marker}`).not.toContain(marker);
    }
    const libInputs = Object.keys(result.metafile?.inputs ?? {}).filter(
      (p) => p.includes('library-port') || p.includes('library-expand')
    );
    expect(libInputs, 'palette bundle must not list library modules as inputs').toEqual([]);
  });

  it('library meta is statically importable; one definition loads a single records chunk', async () => {
    const esbuild = loadEsbuild();
    const metaEntry = await bundleNamedImport(
      `export { THEME_LIBRARY_META } from ${JSON.stringify(join(tokensSrc, 'library-port/index.ts'))};\n`
    );
    expect(metaEntry).toMatch(/THEME_LIBRARY_META/);
    expect(metaEntry).toMatch(/harbor-teal|fintech-ledger/);

    const metaPlusOne = await esbuild.build({
      stdin: {
        contents: `
import { THEME_LIBRARY_META, loadLibraryTheme } from ${JSON.stringify(join(tokensSrc, 'library-port/index.ts'))};
export { THEME_LIBRARY_META };
export const loadOne = () => loadLibraryTheme('harbor-teal');
`,
        resolveDir: tokensSrc,
        sourcefile: 'meta-one.ts',
        loader: 'ts',
      },
      bundle: true,
      write: false,
      format: 'esm',
      platform: 'browser',
      target: 'es2022',
      packages: 'bundle',
      logLevel: 'silent',
      minify: true,
      metafile: true,
    });
    const themeInputs = Object.keys(metaPlusOne.metafile?.inputs ?? {}).filter((p) =>
      p.includes('library-port/themes/')
    );
    expect(themeInputs, 'must not keep 64 per-theme modules').toEqual([]);
    const recordsInputs = Object.keys(metaPlusOne.metafile?.inputs ?? {}).filter((p) =>
      p.includes('library-port/records')
    );
    expect(recordsInputs.length).toBeGreaterThanOrEqual(1);
  });
});
