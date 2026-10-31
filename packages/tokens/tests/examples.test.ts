// @vitest-environment node
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  type CompiledDesignSystem,
  compileDesignSystem,
  loadLibraryBase,
} from '../src/design-system/compile.ts';
import { emitCss, isSafeCompiledValue } from '../src/design-system/emit.ts';
import {
  checkDesignSystemGuarantees,
  validateDesignSystem,
} from '../src/design-system/validate.ts';

/**
 * The fictional example brands in `examples/design-systems/` (the guide's
 * worked examples, docs/DESIGN_SYSTEMS.md): every one validates as agent
 * output (`untrusted`), compiles in light and dark, base and every variant,
 * with zero refusals, and the guarantees hold over what the compiler emitted.
 */

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const dir = join(root, 'examples/design-systems');
type Doc = Record<string, unknown> & { id: string; variants?: Record<string, unknown> };

const EXPECTED = ['ledgerline', 'quillmark', 'tumbletown'];

function load(file: string): Doc {
  return JSON.parse(readFileSync(join(dir, file), 'utf8')) as Doc;
}

async function compileAll(
  doc: Doc
): Promise<{ variant: string | null; compiled: CompiledDesignSystem }[]> {
  const base = typeof doc.extends === 'string' ? await loadLibraryBase(doc.extends) : undefined;
  const runs: { variant: string | null; compiled: CompiledDesignSystem }[] = [];
  for (const variant of [null, ...Object.keys(doc.variants ?? {})]) {
    const result = compileDesignSystem(doc, {
      resolve: (ref: string) => (ref === doc.extends ? base : undefined),
      ...(variant ? { variant } : {}),
    });
    if (!result.ok)
      throw new Error(
        `${doc.id} ${variant ?? 'base'}: ${result.errors.map((e) => `${e.code} ${e.path}`).join(', ')}`
      );
    runs.push({ variant, compiled: result });
  }
  return runs;
}

describe('example design systems', () => {
  it('are the three fictional brands, one file each, named by id', () => {
    const files = readdirSync(dir).filter((file) => file.endsWith('.json'));
    expect(files.sort()).toEqual(EXPECTED.map((id) => `${id}.json`));
    for (const file of files) {
      const doc = load(file);
      expect(`${doc.id}.json`).toBe(file);
      expect(validateDesignSystem(doc, { trust: 'untrusted' })).toEqual({ ok: true, errors: [] });
      expect(doc.tags, file).toContain('example');
    }
  });

  it('compile in light and dark, base and every variant, with no refusal and every guarantee held', async () => {
    for (const id of EXPECTED) {
      const doc = load(`${id}.json`);
      const runs = await compileAll(doc);
      expect(runs.length, id).toBe(1 + Object.keys(doc.variants ?? {}).length);
      for (const { variant, compiled } of runs) {
        const label = `${id} ${variant ?? 'base'}`;
        expect(compiled.modes, label).toEqual(['light', 'dark']);
        expect(checkDesignSystemGuarantees(compiled), label).toEqual([]);
        for (const mode of compiled.modes) {
          const pairs = compiled.report.contrast[mode] ?? [];
          expect(pairs.length, `${label} ${mode}`).toBeGreaterThan(40);
          expect(
            pairs.filter((pair) => !pair.pass),
            `${label} ${mode}`
          ).toEqual([]);
          for (const value of Object.values(compiled.vars[mode] ?? {}))
            expect(isSafeCompiledValue(value), `${label} ${mode} ${value}`).toBe(true);
        }
        expect(emitCss(compiled)).toContain(`[data-tx-ds="${id}"]`);
      }
    }
  });

  it('cover what the guide shows: a library base, a high-contrast variant at AAA, a pinned brand color', async () => {
    const ledgerline = load('ledgerline.json');
    expect(ledgerline.extends).toBe('texuli:slate-masthead');
    const highContrast = (await compileAll(ledgerline)).find(
      (run) => run.variant === 'high-contrast'
    );
    expect(highContrast?.compiled.accessibility.contrast).toBe('AAA');
    const [tumbletown] = await compileAll(load('tumbletown.json'));
    // The pin is kept exactly; the solver only picks its readable on-color.
    expect(tumbletown?.compiled.vars.light?.['--tx-primary']).toBe('#d6336c');
    expect(tumbletown?.compiled.accessibility.targetMin).toBe(44);
    const [quillmark] = await compileAll(load('quillmark.json'));
    expect(quillmark?.compiled.vars.light?.['--tx-font-heading']).toMatch(/^Fraunces, /u);
  });
});
