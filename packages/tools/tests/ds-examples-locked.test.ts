// @vitest-environment node
/**
 * Example brands at spec 0.13.0 (T-t1-examples, ADR-032): each has an
 * allowed set, a library entry and draft approval, validates, and compiles
 * an allow manifest.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  ALLOW_MANIFEST_SPEC_VERSION,
  type CompiledDesignSystem,
  compileDesignSystem,
  loadLibraryBase,
} from '@texuli/tokens/design-system/compile';
import { validateDesignSystem } from '@texuli/tokens/design-system/validate';
import { describe, expect, it } from 'vitest';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const dir = join(root, 'examples/design-systems');
const BRANDS = ['ledgerline', 'quillmark', 'tumbletown'] as const;

type Doc = Record<string, unknown> & {
  id: string;
  version: string;
  allow?: Record<string, unknown>;
  library?: unknown[];
  approval?: { status?: string; version?: string };
};

const load = (id: string): Doc => JSON.parse(readFileSync(join(dir, `${id}.json`), 'utf8')) as Doc;

async function compile(doc: Doc): Promise<CompiledDesignSystem> {
  const base = typeof doc.extends === 'string' ? await loadLibraryBase(doc.extends) : undefined;
  const result = compileDesignSystem(doc, {
    resolve: (ref: string) => (ref === doc.extends ? base : undefined),
  });
  if (!result.ok) throw new Error(`${doc.id}: ${JSON.stringify(result.errors)}`);
  return result;
}

describe('example brands at spec 0.13.0', () => {
  it('are the three fictional brands, one file each', () => {
    const files = readdirSync(dir)
      .filter((file) => file.endsWith('.json'))
      .sort();
    expect(files).toEqual(BRANDS.map((id) => `${id}.json`).sort());
  });

  it('each validates with an allowed set, a library entry and draft approval', () => {
    expect(ALLOW_MANIFEST_SPEC_VERSION).toBe('0.13.0');
    for (const id of BRANDS) {
      const doc = load(id);
      expect(doc.id).toBe(id);
      expect(validateDesignSystem(doc, { trust: 'untrusted' })).toEqual({ ok: true, errors: [] });
      expect(Object.keys(doc.allow ?? {}).length, id).toBeGreaterThan(0);
      expect(Array.isArray(doc.library) && doc.library.length, id).toBeGreaterThan(0);
      expect(doc.approval?.status, id).toBe('draft');
      expect(doc.approval?.version, id).toBe(doc.version);
    }
  });

  it('each compiles an allow manifest at spec 0.13.0', async () => {
    for (const id of BRANDS) {
      const doc = load(id);
      const compiled = await compile(doc);
      expect(compiled.ok, id).toBe(true);
      expect(compiled.allowManifest.specVersion, id).toBe(ALLOW_MANIFEST_SPEC_VERSION);
      expect(compiled.allowManifest.version, id).toBe(doc.version);
      expect(compiled.allowManifest.allow, id).toEqual(doc.allow);
      expect(compiled.allowManifest.library?.length, id).toBeGreaterThan(0);
      expect(compiled.allowManifest.contentHash, id).toMatch(/^[0-9a-f]{64}$/);
    }
  });
});
