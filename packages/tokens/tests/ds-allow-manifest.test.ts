// @vitest-environment node
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SPEC_VERSION } from '@texuli/spec';
import { designSystemContentHash } from '@texuli/spec/design-system';
import { describe, expect, it } from 'vitest';
import {
  ALLOW_MANIFEST_SPEC_VERSION,
  type CompiledDesignSystem,
  compileAllowManifest,
  compileDesignSystem,
  loadLibraryBase,
} from '../src/design-system/compile.ts';
import { emitCss } from '../src/design-system/emit.ts';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
type Doc = Record<string, unknown>;
const json = (path: string): Doc => JSON.parse(readFileSync(join(root, path), 'utf8'));
const acme = json('packages/spec/fixtures/design-systems/acme.json');
const minimal = json('packages/spec/fixtures/design-systems/minimal.json');
const examplesDir = join(root, 'examples/design-systems');

const ok = (result: { ok: boolean }): result is CompiledDesignSystem => {
  if (!result.ok) throw new Error(JSON.stringify(result));
  return true;
};

async function compile(doc: Doc, extra: Record<string, unknown> = {}) {
  const base = typeof doc.extends === 'string' ? await loadLibraryBase(doc.extends) : undefined;
  const result = compileDesignSystem(doc, {
    resolve: (ref: string) => (ref === doc.extends ? base : undefined),
    ...extra,
  });
  if (!ok(result)) throw new Error('unreachable');
  return result;
}

describe('compileAllowManifest', () => {
  it('copies allow, library ids, version, contentHash and specVersion from the source document', () => {
    const doc = {
      ...minimal,
      version: '1.2.0',
      allow: {
        button: { variants: ['default', 'outline'], sizes: ['sm'], colors: ['chart-2'] },
        card: {},
      },
      library: [
        {
          id: 'pricing-card',
          name: 'Pricing card',
          purpose: 'One plan.',
          version: '0.3.0',
          status: 'draft',
          composes: ['card', 'button'],
        },
      ],
    };
    const manifest = compileAllowManifest(doc, { catalogDigest: 'ab'.repeat(32) });
    expect(manifest).toEqual({
      allow: {
        button: { variants: ['default', 'outline'], sizes: ['sm'], colors: ['chart-2'] },
        card: {},
      },
      library: [{ id: 'pricing-card', version: '0.3.0', status: 'draft' }],
      version: '1.2.0',
      contentHash: designSystemContentHash(doc),
      specVersion: '0.15.0',
      catalogDigest: 'ab'.repeat(32),
    });
    expect(ALLOW_MANIFEST_SPEC_VERSION).toBe(SPEC_VERSION);
  });

  it('omits allow and library when the document has none, and skips reserved keys', () => {
    expect(compileAllowManifest(minimal)).toEqual({
      version: '1.0.0',
      contentHash: designSystemContentHash(minimal),
      specVersion: '0.15.0',
    });
    const hostile = JSON.parse(
      `{"format":"texuli/design-system","formatVersion":1,"id":"a","version":"1.0.0","name":"A","allow":{"__proto__":{"variants":["x"]},"button":{"variants":["default"]}}}`
    );
    expect(compileAllowManifest(hostile).allow).toEqual({ button: { variants: ['default'] } });
  });
});

describe('compileDesignSystem allow manifest', () => {
  it('returns acme’s allow beside the CSS without changing component defaults or tokens', async () => {
    const compiled = await compile(acme, { trust: 'developer' });
    expect(compiled.allowManifest.allow).toEqual({
      button: {
        variants: ['default', 'secondary', 'outline', 'ghost'],
        sizes: ['sm', 'md', 'lg'],
      },
      card: {},
    });
    expect(compiled.allowManifest.version).toBe('2.1.0');
    expect(compiled.allowManifest.contentHash).toBe(designSystemContentHash(acme));
    expect(compiled.allowManifest.specVersion).toBe(SPEC_VERSION);
    expect(compiled.defaults.button).toEqual({ variant: 'default', size: 'md' });
    expect(compiled.vars.light?.['--tx-button-radius']).toBe('9999px');
  });

  it('keeps disallowed variants in the CSS: empty allow lists flag, they do not strip tokens', async () => {
    const locked = {
      ...minimal,
      allow: { button: { variants: [] as string[], sizes: [] as string[] } },
    };
    const open = await compile(minimal);
    const compiled = await compile(locked);
    expect(compiled.allowManifest.allow?.button).toEqual({ variants: [], sizes: [] });
    expect(emitCss(compiled)).toBe(emitCss(open));
    expect(
      compiled.vars.light?.['--tx-button-height-md'] ?? compiled.vars.light?.['--tx-space-4']
    ).toBeTruthy();
  });
});

describe('existing documents compile to byte-identical CSS', () => {
  it('pins emitCss for every example brand, and adding allow does not change it', async () => {
    const files = readdirSync(examplesDir)
      .filter((file) => file.endsWith('.json'))
      .sort();
    expect(files.length).toBeGreaterThan(0);
    for (const file of files) {
      const doc = json(`examples/design-systems/${file}`);
      const base = await compile(doc);
      const css = emitCss(base);
      expect(css.startsWith('/* Texuli design system'), file).toBe(true);
      expect(css).toContain(`[data-tx-ds="${doc.id}"]`);
      const withAllow = await compile({
        ...doc,
        allow: { button: { variants: [] } },
        library: [
          {
            id: 'pricing-card',
            name: 'Pricing card',
            purpose: 'One plan.',
            version: '1.0.0',
            status: 'draft',
            composes: ['card'],
          },
        ],
      });
      expect(emitCss(withAllow), file).toBe(css);
      expect(withAllow.allowManifest.allow?.button).toEqual({ variants: [] });
    }
    const small = await compile(minimal);
    const acmeCss = emitCss(await compile(acme, { trust: 'developer' }));
    expect(emitCss(small)).toBe(emitCss(await compile({ ...minimal, allow: { card: {} } })));
    expect(acmeCss).toContain('--tx-primary: #4f46e5');
  });
});
