// @vitest-environment node
/// <reference types="node" />
/**
 * `@texuli/blocks/formula` must load in plain Node (no DOM, no Svelte) and
 * tree-shake free of interactive renderers. Protoyard adopts this subpath for
 * cold starts that only need the closed calculator engine.
 */
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { gzipSync } from 'node:zlib';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { evaluateFormula, FORMULA_LIMITS, parseFormula } from '../src/core/formula/index.ts';

const FORMULA_ENTRY = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../src/core/formula/index.ts'
);

describe('@texuli/blocks/formula', () => {
  it('is free of DOM globals and maps the published formula subpath', () => {
    expect(typeof document).toBe('undefined');
    expect(typeof window).toBe('undefined');
    const require = createRequire(import.meta.url);
    const pkg = require('../package.json') as {
      exports: Record<string, string | Record<string, string>>;
    };
    const formula = pkg.exports['./formula'];
    expect(formula).toBeDefined();
    if (typeof formula === 'string') {
      expect(formula).toBe('./src/core/formula/index.ts');
    } else if (formula && typeof formula === 'object') {
      expect(formula.default ?? formula.types).toContain('core/formula');
    } else {
      expect.fail('expected ./formula export');
    }
    // Interactive still re-exports the engine for compatibility.
    expect(pkg.exports['./interactive']).toBeTruthy();
  });

  it('parses and evaluates a closed calculator expression without a host', () => {
    const parsed = parseFormula({
      op: 'mul',
      left: { op: 'var', name: 'seats' },
      right: { op: 'num', value: 12 },
    });
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect(evaluateFormula(parsed.formula, { seats: 3 })).toBe(36);
    expect(FORMULA_LIMITS.nodes).toBeGreaterThan(0);
  });
});

describe('@texuli/blocks/formula tree-shake', () => {
  let bundleCode = '';
  let gzipBytes = 0;
  let workDir = '';

  beforeAll(async () => {
    const { build } = await import('vite');
    workDir = await mkdtemp(join(tmpdir(), 'texuli-formula-'));
    const entry = join(workDir, 'entry.js');
    await writeFile(entry, `export * from ${JSON.stringify(pathToFileURL(FORMULA_ENTRY).href)};\n`);
    const result = await build({
      configFile: false,
      logLevel: 'silent',
      mode: 'production',
      root: workDir,
      build: {
        write: false,
        minify: true,
        target: 'es2022',
        lib: { entry, formats: ['es'], fileName: 'formula' },
        rollupOptions: {
          // Pure TS engine — no Svelte peer needed.
          external: (id: string) => id === 'svelte' || id.startsWith('svelte/'),
        },
      },
    });
    const outputs = (Array.isArray(result) ? result : [result]).flatMap((item) =>
      'output' in item ? item.output : []
    );
    bundleCode = outputs
      .filter((file) => file.type === 'chunk')
      .map((file) => ('code' in file ? file.code : ''))
      .join('\n');
    gzipBytes = gzipSync(Buffer.from(bundleCode), { level: 9 }).byteLength;
  }, 60_000);

  afterAll(async () => {
    if (workDir) await rm(workDir, { recursive: true, force: true });
  });

  it('bundles without interactive renderer or Svelte surface code', () => {
    expect(bundleCode.length).toBeGreaterThan(100);
    // Renderer / UI markers that must never appear in the formula subpath.
    for (const needle of [
      'CalculatorBlock',
      'InteractiveFamily',
      'loadInteractiveFamily',
      '.svelte',
      'svelte/internal',
      'create_fragment',
      'texuli/button',
      'PollBlock',
      'QuizBlock',
    ]) {
      expect(bundleCode.includes(needle), `bundle must not contain ${needle}`).toBe(false);
    }
    // Engine surface must remain.
    expect(bundleCode.includes('parseFormula') || bundleCode.includes('evaluate')).toBe(true);
  });

  it('stays well under a light cold-start budget', () => {
    // Measured locally; exact budget lives in texuli.budgets.json.
    expect(gzipBytes).toBeLessThan(8 * 1024);
    // Soft assert for the report: formula is a few KiB, not the interactive family.
    expect(gzipBytes).toBeGreaterThan(200);
  });
});
