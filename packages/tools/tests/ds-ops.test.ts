// @vitest-environment node
import { mkdir, mkdtemp, readFile, realpath, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  type CompiledDesignSystem,
  resolveDesignSystem,
} from '@texuli/tokens/design-system/compile';
import { DESIGN_SYSTEM_IMPORT_LIMITS } from '@texuli/tokens/design-system/import';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { parseDsArgs, runDs } from '../src/cli/ds.ts';
import { parseRouterArgs } from '../src/cli/router.ts';
import { localFiles } from '../src/internal/local-write.ts';
import { DESIGN_SYSTEM_EXAMPLES } from '../src/ops/design-system-examples.ts';
import { previewSvg } from '../src/ops/design-system-preview.ts';
import {
  DS_INPUT_BYTES,
  type InvokeOptions,
  LOCAL_RUNTIMES,
  MINIMAL_DESIGN_SYSTEM,
  texuliOps,
} from '../src/ops/index.ts';
import { scenario } from './scenario.ts';

/**
 * The design-system operations (T-ds-agent-tools): deterministic output
 * with snapshots, stable refusal codes, hostile input, the local write
 * policy of ds.save, blueprint.theme and the blueprint.validate hook, and
 * the `texuli ds` commands. Data is fictional.
 */

const FIXTURES = new URL('../../spec/fixtures/design-systems/', import.meta.url);
const EXAMPLES = new URL('../../../examples/design-systems/', import.meta.url);
// biome-ignore lint/suspicious/noExplicitAny: operation outputs are JSON the tests inspect.
type Json = any;

async function run(name: string, input: unknown, options: InvokeOptions = {}): Promise<Json> {
  const outcome = await texuliOps.invoke(name, input, options);
  if (!outcome.ok) throw new Error(`${name}: ${outcome.error.code} ${outcome.error.message}`);
  return outcome.output;
}

/** The same object with its keys in reverse order at every depth. */
function reversed(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(reversed);
  if (typeof value !== 'object' || value === null) return value;
  return Object.fromEntries(
    Object.entries(value)
      .reverse()
      .map(([key, item]) => [key, reversed(item)])
  );
}

function capture() {
  const out: string[] = [];
  const err: string[] = [];
  return {
    out,
    err,
    io: {
      stdout: { write: (chunk: string) => out.push(chunk) },
      stderr: { write: (chunk: string) => err.push(chunk) },
    },
  };
}

let dir: string | undefined;
async function scratch(): Promise<string> {
  dir = await realpath(await mkdtemp(join(tmpdir(), 'texuli-ds-ops-')));
  return dir;
}
afterEach(async () => {
  process.exitCode = undefined;
  if (dir) await rm(dir, { recursive: true, force: true });
  dir = undefined;
});

const HARBORLINE = {
  ...MINIMAL_DESIGN_SYSTEM,
  id: 'harborline',
  name: 'Harborline',
  color: { brand: { seed: '#0e7490' } },
};
const LOW_CONTRAST = {
  ...MINIMAL_DESIGN_SYSTEM,
  id: 'low-contrast',
  color: {
    brand: { seed: '#4f46e5' },
    roles: { light: { background: '#ffffff', foreground: '#eeeeee' } },
  },
};

describe('design-system operations', () => {
  it('serve the spec fixtures and constants unchanged', async () => {
    for (const id of ['acme', 'minimal']) {
      const file = JSON.parse(await readFile(new URL(`${id}.json`, FIXTURES), 'utf8'));
      expect(DESIGN_SYSTEM_EXAMPLES[id], id).toEqual(file);
    }
    for (const id of ['quillmark', 'ledgerline', 'tumbletown']) {
      const file = JSON.parse(await readFile(new URL(`${id}.json`, EXAMPLES), 'utf8'));
      expect(DESIGN_SYSTEM_EXAMPLES[id], id).toEqual(file);
    }
    expect(Object.keys(DESIGN_SYSTEM_EXAMPLES)).toEqual([
      'acme',
      'minimal',
      'quillmark',
      'ledgerline',
      'tumbletown',
    ]);
    expect(MINIMAL_DESIGN_SYSTEM).toEqual(DESIGN_SYSTEM_EXAMPLES.minimal);
    expect(DS_INPUT_BYTES).toBe(DESIGN_SYSTEM_IMPORT_LIMITS.bytes);
  });

  it('give byte-identical output for the same document, in any key order (snapshots)', async () => {
    await scenario('preview and compile snapshots', async () => {
      const svg = await run('ds.preview', { document: MINIMAL_DESIGN_SYSTEM });
      await expect(svg.content).toMatchFileSnapshot('./__snapshots__/ds-preview-minimal.svg');
      const css = await run('ds.compile', { document: MINIMAL_DESIGN_SYSTEM, format: 'css' });
      await expect(css.content).toMatchFileSnapshot('./__snapshots__/ds-compile-minimal.css.txt');
      expect(svg.hash).toBe(css.hash);
      expect(svg.bytes).toBe(new TextEncoder().encode(svg.content).byteLength);
    });
    await scenario('every format, twice and with keys reversed', async () => {
      const acme = DESIGN_SYSTEM_EXAMPLES.acme;
      for (const format of ['json', 'css', 'tailwind', 'dtcg', 'tokens-studio']) {
        const first = await run('ds.compile', { document: acme, format });
        const again = await run('ds.compile', { document: reversed(acme), format });
        expect(first.valid, format).toBe(true);
        expect(again, format).toEqual(first);
        if (format !== 'css') expect(() => JSON.parse(first.content), format).not.toThrow();
      }
      for (const format of ['svg', 'html']) {
        const first = await run('ds.preview', { document: acme, format });
        expect(await run('ds.preview', { document: reversed(acme), format }), format).toEqual(
          first
        );
        expect(first.content, format).not.toMatch(/<script|javascript:|\bon[a-z]+=/iu);
      }
      const contrast = await run('ds.contrast', { document: acme });
      expect(contrast.modes.every((mode: Json) => mode.failing === 0)).toBe(true);
      expect(await run('ds.contrast', { document: reversed(acme) })).toEqual(contrast);
    });
  });

  it('return refusals as results with the stable codes and JSON paths', async () => {
    await scenario('ds.validate: spec codes, then the guarantees', async () => {
      const broken = await run('ds.validate', {
        document: { ...MINIMAL_DESIGN_SYSTEM, colour: {}, extends: 'acme@^1.0.0' },
      });
      expect(broken).toMatchObject({ valid: false, codes: ['extends-range', 'unknown-key'] });
      expect(broken.errors.map((error: Json) => error.path)).toEqual(
        expect.arrayContaining(['$.colour', '$.extends'])
      );
      const low = await run('ds.validate', { document: LOW_CONTRAST });
      expect(low.codes).toEqual(['aa-text']);
      expect(low.errors[0]).toMatchObject({
        path: '$.color.roles.light.foreground',
        mode: 'light',
      });
      expect(low.errors[0].pairs.length).toBeGreaterThan(0);
      // The same refusal through every operation that compiles.
      for (const name of ['ds.compile', 'ds.contrast', 'ds.preview']) {
        const output = await run(name, { document: LOW_CONTRAST });
        expect(output.valid, name).toBe(false);
        expect(
          output.errors.map((error: Json) => error.code),
          name
        ).toContain('aa-text');
      }
      // L-2: a zero-width character in free text is refused, as the importers refuse it.
      for (const name of ['A\u200bB', 'A\u2060B', 'A\ufeffB', 'A\u{e0041}B']) {
        const hidden = await run('ds.validate', { document: { ...MINIMAL_DESIGN_SYSTEM, name } });
        expect(hidden, JSON.stringify(name)).toMatchObject({
          valid: false,
          codes: ['invalid-value'],
          errors: [{ path: '$.name' }],
        });
      }
      const diff = await run('ds.diff', { before: MINIMAL_DESIGN_SYSTEM, after: LOW_CONTRAST });
      expect(diff.valid).toBe(false);
      expect(diff.errors.every((error: Json) => error.source === 'after')).toBe(true);
    });
    await scenario('variants, bases and the css selector', async () => {
      const missing = await run('ds.validate', {
        document: MINIMAL_DESIGN_SYSTEM,
        variant: 'compact',
      });
      expect(missing).toMatchObject({ valid: false, codes: ['invalid-value'] });
      const child = { ...HARBORLINE, id: 'harborline-docs', extends: 'harborline@1.0.0' };
      expect((await run('ds.validate', { document: child })).codes).toContain('invalid-value');
      expect(
        await run('ds.validate', { document: child, bases: { 'harborline@1.0.0': HARBORLINE } })
      ).toMatchObject({ valid: true });
      const selector = await run('ds.compile', {
        document: MINIMAL_DESIGN_SYSTEM,
        format: 'css',
        selector: 'a{}body',
      });
      expect(selector).toMatchObject({ valid: false, errors: [{ path: '$.selector' }] });
    });
    await scenario(
      'dtcg and tokens-studio emit what was compiled: extends and the variant applied',
      async () => {
        const child = {
          ...HARBORLINE,
          id: 'harborline-docs',
          extends: 'harborline@1.0.0',
          variants: { dense: { space: { density: 0.8 } } },
        };
        const bases = { 'harborline@1.0.0': HARBORLINE };
        for (const format of ['dtcg', 'tokens-studio'] as const) {
          const from = format;
          const base = await run('ds.compile', { document: child, bases, format });
          const baseDoc = (await run('ds.import', { from, input: base.content })).document;
          // The base's seed reaches the token files; the extends reference does not.
          expect(baseDoc.color.brand.seed, format).toBe('#0e7490');
          expect(baseDoc.extends, format).toBeUndefined();
          expect(baseDoc.variants, format).toEqual(child.variants);
          const dense = await run('ds.compile', {
            document: child,
            bases,
            format,
            variant: 'dense',
          });
          expect(dense).toMatchObject({ valid: true, variant: 'dense' });
          expect(dense.hash, format).not.toBe(base.hash);
          const denseDoc = (await run('ds.import', { from, input: dense.content })).document;
          // The variant's patch is applied, and the variants it came from are gone.
          expect(denseDoc.space?.density, format).toBe(0.8);
          expect(denseDoc.variants, format).toBeUndefined();
          expect(dense.content, format).not.toBe(base.content);
        }
      }
    );
    await scenario('an emit error that is not the selector is reported at $', async () => {
      vi.resetModules();
      vi.doMock('@texuli/tokens/design-system/emit', async (original) => ({
        ...(await original<typeof import('@texuli/tokens/design-system/emit')>()),
        emitTailwindPresetJson: () => {
          throw new TypeError('The preset failed.');
        },
      }));
      try {
        const { runCompile } = await import('../src/ops/design-system-run.ts');
        const failed = await runCompile({
          document: MINIMAL_DESIGN_SYSTEM,
          format: 'tailwind',
          selector: 'a{}body',
        });
        expect(failed).toMatchObject({ valid: false, errors: [{ path: '$' }] });
        expect(failed.errors[0]).not.toHaveProperty('hint');
        expect(failed.errors[0]?.message).toContain('The preset failed.');
      } finally {
        vi.doUnmock('@texuli/tokens/design-system/emit');
        vi.resetModules();
      }
    });
  });

  it('suggest and import deterministically, refusing hostile input without throwing', async () => {
    await scenario('ds.suggest: one source, RGBA pixels, the same palette every time', async () => {
      const both = await run('ds.suggest', { seed: '#0e7490', colors: ['#0e7490'] });
      expect(both).toMatchObject({ valid: false, errors: [{ code: 'invalid-input' }] });
      const ragged = await run('ds.suggest', { pixels: [1, 2, 3] });
      expect(ragged).toMatchObject({ valid: false, errors: [{ path: '$.pixels' }] });
      const pixels = [
        ...Array.from({ length: 12 }, () => [14, 116, 144, 255]),
        ...Array.from({ length: 4 }, () => [245, 158, 11, 255]),
        [0, 0, 0, 0],
      ].flat();
      const logo = await run('ds.suggest', { pixels, id: 'harborline' });
      expect(logo.valid).toBe(true);
      expect(logo.palette.length).toBeGreaterThan(1);
      expect(logo.document.color.brand.seed).toMatch(/^#[0-9a-f]{6}$/u);
      expect(await run('ds.suggest', { pixels, id: 'harborline' })).toEqual(logo);
      const colors = await run('ds.suggest', { colors: ['#4f46e5', '#0891b2', '#f59e0b'] });
      expect(colors.document.color.brand).toMatchObject({
        seed: '#4f46e5',
        secondary: '#0891b2',
        accent: '#f59e0b',
      });
      expect(Object.keys(colors.roles)).toEqual(['light', 'dark']);
    });
    await scenario('ds.import: every source, and refusals with codes', async () => {
      const brand = await run('ds.import', { from: 'brand', input: 'brand #0e7490, pill, AAA' });
      expect(brand.document).toMatchObject({
        shape: { radius: 20 },
        accessibility: { contrast: 'AAA' },
      });
      const theme = await run('ds.import', { from: 'theme', input: 'ocean' });
      expect(theme.valid).toBe(true);
      expect(await run('ds.import', { from: 'theme', input: 'no-such-theme' })).toMatchObject({
        valid: false,
        errors: [{ code: 'not-found' }],
      });
      expect(await run('ds.import', { from: 'brand', input: { seed: '#fff' } })).toMatchObject({
        valid: false,
        errors: [{ code: 'invalid-input' }],
      });
      // dtcg and tokens-studio carry the resolved document: acme's texuli:violet base merged in.
      const resolvedAcme = await resolveDesignSystem(DESIGN_SYSTEM_EXAMPLES.acme);
      if (!resolvedAcme.ok) throw new Error('acme resolves');
      const dtcg = await run('ds.compile', {
        document: DESIGN_SYSTEM_EXAMPLES.acme,
        format: 'dtcg',
      });
      const back = await run('ds.import', { from: 'dtcg', input: dtcg.content });
      expect(back.document).toEqual(resolvedAcme.document);
      expect(back.document.extends).toBeUndefined();
      const studio = await run('ds.compile', {
        document: DESIGN_SYSTEM_EXAMPLES.acme,
        format: 'tokens-studio',
      });
      expect(
        (await run('ds.import', { from: 'tokens-studio', input: studio.content })).document
      ).toEqual(resolvedAcme.document);
      const hostile = await run('ds.import', {
        from: 'dtcg',
        input:
          '{"__proto__":{"polluted":true},"brand":{"$type":"color","$value":"red;}body{background:url(https://example.com/x)"}}',
      });
      expect(({} as Record<string, unknown>).polluted).toBeUndefined();
      expect(hostile.warnings.map((warning: Json) => warning.code)).toEqual(
        expect.arrayContaining(['reserved-key', 'unsafe-value'])
      );
      expect(await run('ds.import', { from: 'dtcg', input: 'not json' })).toMatchObject({
        valid: false,
        errors: [{ code: 'invalid-input' }],
      });
    });
  });

  it('escape every value in the SVG snapshot, and paint only safe colors', () => {
    const tampered = {
      id: 'x',
      version: '1.0.0',
      name: '</title><script>alert(1)</script>',
      modes: ['light'],
      vars: {
        light: {
          '--tx-background': 'url(javascript:alert(1))',
          '--tx-primary': '#4f46e5"/><script>',
          '--tx-foreground': '#111111',
        },
      },
      accessibility: { contrast: 'AA', targetMin: 24 },
      report: { contrast: { light: [] } },
    } as unknown as CompiledDesignSystem;
    const svg = previewSvg(tampered);
    expect(svg).not.toMatch(/<script|javascript:/iu);
    expect(svg).toContain('&lt;/title&gt;&lt;script&gt;');
    expect(svg).toContain('fill="#808080"');
    expect(svg).toContain('fill="#111111"');
  });

  it('save only valid documents to explicit paths inside the working directory', async () => {
    const cwd = await scratch();
    const files = localFiles({ cwd });
    const save = (input: Record<string, unknown>) => run('ds.save', input, { files });
    await scenario('writes two-space JSON, refuses an existing file unless overwrite', async () => {
      const path = 'design-systems/harborline.ds.json';
      expect(await save({ path, document: HARBORLINE })).toMatchObject({ saved: true, path });
      expect(await readFile(join(cwd, path), 'utf8')).toBe(
        `${JSON.stringify(HARBORLINE, null, 2)}\n`
      );
      expect(await save({ path, document: HARBORLINE })).toMatchObject({
        saved: false,
        errors: [{ code: 'exists', path: '$.path' }],
      });
      expect(await save({ path, document: HARBORLINE, overwrite: true })).toMatchObject({
        saved: true,
      });
      expect(await save({ path: 'dry.ds.json', document: HARBORLINE, dryRun: true })).toMatchObject(
        { saved: false, dryRun: true, path: 'dry.ds.json' }
      );
      await expect(readFile(join(cwd, 'dry.ds.json'))).rejects.toThrow();
    });
    await scenario('refuses traversal, symlinks and invalid documents', async () => {
      for (const path of ['../escape.ds.json', '/etc/escape.ds.json', 'a/../../escape.json'])
        expect((await save({ path, document: HARBORLINE })).errors[0].code, path).toBe(
          'outside-working-directory'
        );
      await mkdir(join(cwd, 'real'));
      await symlink(join(cwd, 'real'), join(cwd, 'link'));
      expect((await save({ path: 'link/x.ds.json', document: HARBORLINE })).errors[0].code).toBe(
        'symlink'
      );
      const refused = await save({ path: 'low.ds.json', document: LOW_CONTRAST });
      expect(refused.errors[0].code).toBe('aa-text');
      await expect(readFile(join(cwd, 'low.ds.json'))).rejects.toThrow();
    });
    await scenario(
      'writes .json files only, never in dot directories, node_modules or package.json',
      async () => {
        // I-1: even with overwrite, ds.save cannot replace repository or tool files.
        const refusals: [string, string][] = [
          ['harborline', 'path-extension'],
          ['harborline.ds', 'path-extension'],
          ['notes.md', 'path-extension'],
          ['.github/workflows/ci.yml', 'path-reserved'],
          ['.github/workflows/ci.json', 'path-reserved'],
          ['.git/hooks/pre-commit', 'path-reserved'],
          ['.git/config.json', 'path-reserved'],
          ['.vscode/settings.json', 'path-reserved'],
          ['.npmrc', 'path-reserved'],
          ['.harborline.json', 'path-reserved'],
          ['design-systems/.hidden/x.json', 'path-reserved'],
          ['node_modules/x/index.json', 'path-reserved'],
          ['packages/a/node_modules/x.json', 'path-reserved'],
          ['Node_Modules/x.json', 'path-reserved'],
          ['package.json', 'path-reserved'],
          ['packages/a/package.json', 'path-reserved'],
          ['PACKAGE.JSON', 'path-reserved'],
        ];
        await mkdir(join(cwd, '.github'), { recursive: true });
        await writeFile(join(cwd, 'package.json'), '{"name":"fictional"}\n');
        for (const [path, code] of refusals) {
          for (const extra of [{}, { overwrite: true }, { dryRun: true }])
            expect(await save({ path, document: HARBORLINE, ...extra }), path).toMatchObject({
              saved: false,
              errors: [{ code, path: '$.path' }],
            });
        }
        expect(await readFile(join(cwd, 'package.json'), 'utf8')).toBe('{"name":"fictional"}\n');
        await expect(readFile(join(cwd, '.github/workflows/ci.json'))).rejects.toThrow();
        // A .json name anywhere else is fine, the extension in any case.
        for (const path of ['brand.json', 'design-systems/Brand.JSON', 'a.b/c.ds.json'])
          expect(await save({ path, document: HARBORLINE }), path).toMatchObject({ saved: true });
      }
    );
    await scenario('needs a door that writes files; the remote runtimes refuse it', async () => {
      const input = { path: 'x.ds.json', document: HARBORLINE };
      expect(await texuliOps.invoke('ds.save', input)).toMatchObject({
        ok: false,
        error: { code: 'runtime-unavailable' },
      });
      expect(
        await texuliOps.invoke('ds.save', input, { runtimes: ['edge', 'site'], files })
      ).toMatchObject({ ok: false, error: { code: 'runtime-unavailable' } });
    });
  });
});

describe('blueprints and design systems', () => {
  const page = {
    id: 'layout-page',
    props: { title: 'Fictional page' },
    children: [{ id: 'blocks-text', props: { block: { type: 'heading', level: 2, text: 'Hi' } } }],
  };

  it('blueprint.validate checks an inline design system with the spec codes', async () => {
    const themed = await run('blueprint.theme', {
      blueprint: page,
      designSystem: { ref: 'texuli:ocean' },
    });
    const envelope = themed.blueprint;
    const inline = await run('blueprint.validate', {
      draft: { ...envelope, designSystem: { inline: { ...MINIMAL_DESIGN_SYSTEM, colour: {} } } },
    });
    expect(inline.valid).toBe(false);
    expect(inline.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          check: 'design-system',
          code: 'unknown-key',
          path: '$.designSystem.inline.colour',
        }),
      ])
    );
    // Agent output (untrusted) refuses data: URLs in the inline document.
    const dataUrl = await run('blueprint.validate', {
      draft: {
        ...envelope,
        designSystem: {
          inline: {
            ...MINIMAL_DESIGN_SYSTEM,
            assets: { favicon: 'data:image/png;base64,iVBORw0KGgo=' },
          },
        },
      },
    });
    expect(dataUrl.diagnostics.map((d: Json) => d.code)).toContain('url-refused');
  });

  it('blueprint.theme wraps a tree or themes an envelope, then validates the result', async () => {
    await scenario('a library ref on a wrapped tree', async () => {
      const themed = await run('blueprint.theme', {
        blueprint: page,
        designSystem: { ref: 'texuli:ocean' },
        id: 'landing',
      });
      expect(themed).toMatchObject({ valid: true, status: 'valid' });
      expect(themed.blueprint).toMatchObject({
        format: 'texuli-blueprint',
        id: 'landing',
        status: 'draft',
        spec: '0.10.0',
        createdAt: '1970-01-01T00:00:00.000Z',
        designSystem: { ref: 'texuli:ocean' },
        tree: page,
      });
      // Re-theming the envelope keeps it and swaps the design system only.
      const again = await run('blueprint.theme', {
        blueprint: themed.blueprint,
        designSystem: { ref: 'harborline@1.0.0' },
      });
      expect(again.blueprint).toEqual({
        ...themed.blueprint,
        designSystem: { ref: 'harborline@1.0.0' },
      });
    });
    await scenario('refusals: an unknown theme, a range, two keys, a failing inline', async () => {
      const unknown = await run('blueprint.theme', {
        blueprint: page,
        designSystem: { ref: 'texuli:no-such-theme' },
      });
      expect(unknown.valid).toBe(false);
      expect(unknown.diagnostics.map((d: Json) => d.path)).toContain('$.designSystem.ref');
      expect(
        await texuliOps.invoke('blueprint.theme', {
          blueprint: page,
          designSystem: { ref: 'acme@^1.0.0' },
        })
      ).toMatchObject({ ok: false, error: { code: 'invalid-input' } });
      const both = await run('blueprint.theme', {
        blueprint: page,
        designSystem: { ref: 'texuli:ocean', inline: MINIMAL_DESIGN_SYSTEM },
      });
      expect(both.valid).toBe(false);
      const low = await run('blueprint.theme', {
        blueprint: page,
        designSystem: { inline: LOW_CONTRAST },
      });
      expect(low.valid).toBe(false);
      expect(low.diagnostics).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            code: 'aa-text',
            path: '$.designSystem.inline.color.roles.light.foreground',
          }),
        ])
      );
    });
  });
});

describe('texuli ds', () => {
  it('routes file forms to the ds commands and JSON input to the operations', () => {
    expect(parseRouterArgs(['ds', 'validate', 'brand.ds.json'])).toMatchObject({
      kind: 'legacy',
      command: 'ds',
    });
    expect(parseRouterArgs(['ds', 'validate', '--json', '{}'])).toMatchObject({
      kind: 'operation',
      operation: 'ds.validate',
    });
    expect(parseRouterArgs(['ds', 'export', 'a.json', '--format', 'css'])).toMatchObject({
      kind: 'error',
      message: expect.stringMatching(/--format and --out/u),
    });
    for (const [argv, message] of [
      [['compile', 'a.json', '--format', 'pdf'], /--format is one of/u],
      [['diff', 'a.json'], /takes 2 arguments/u],
      [['import', 'a.json'], /needs --from/u],
      [['validate', 'a.json', '--frob', 'x'], /Unknown ds validate flag/u],
      [['compile', 'a.json', '--overwrite'], /--overwrite needs --out/u],
    ] as const)
      expect(() => parseDsArgs(argv), argv.join(' ')).toThrow(message);
  });

  it('runs init, validate, compile, export, preview, import and diff on files in the working directory', async () => {
    const cwd = await scratch();
    const ds = async (...argv: string[]) => {
      const { out, err, io } = capture();
      const result = await runDs(argv, { ...io, cwd });
      const code = process.exitCode ?? 0;
      process.exitCode = undefined;
      return { result, code, out: out.join(''), err: err.join('') };
    };
    const init = await ds('init', 'brand.ds.json', '--brand', 'name Harborline, brand #0e7490');
    expect(init.code, init.out).toBe(0);
    const saved = JSON.parse(await readFile(join(cwd, 'brand.ds.json'), 'utf8'));
    expect(saved).toMatchObject({ name: 'Harborline', color: { brand: { seed: '#0e7490' } } });
    expect(JSON.parse((await ds('validate', 'brand.ds.json')).out)).toMatchObject({ valid: true });
    expect(
      (await ds('compile', 'brand.ds.json', '--format', 'css', '--out', 'out/a.css')).code
    ).toBe(0);
    const css = await run('ds.compile', { document: saved, format: 'css' });
    expect(await readFile(join(cwd, 'out/a.css'), 'utf8')).toBe(css.content);
    expect(
      (await ds('export', 'brand.ds.json', '--format', 'dtcg', '--out', 'out/a.tokens.json')).code
    ).toBe(0);
    const imported = await ds(
      'import',
      'out/a.tokens.json',
      '--from',
      'dtcg',
      '--out',
      'back.ds.json'
    );
    expect(imported.code, imported.out).toBe(0);
    expect(JSON.parse(await readFile(join(cwd, 'back.ds.json'), 'utf8'))).toEqual(saved);
    expect((await ds('preview', 'brand.ds.json', '--out', 'out/a.svg')).code).toBe(0);
    expect(await readFile(join(cwd, 'out/a.svg'), 'utf8')).toMatch(/^<svg /u);
    const diff = JSON.parse((await ds('diff', 'brand.ds.json', 'back.ds.json')).out);
    expect(diff).toMatchObject({ valid: true, identical: true });

    await writeFile(join(cwd, 'low.ds.json'), JSON.stringify(LOW_CONTRAST));
    const refused = await ds('validate', 'low.ds.json');
    expect(refused.code).toBe(1);
    expect(JSON.parse(refused.out).codes).toEqual(['aa-text']);
    expect((await ds('compile', 'brand.ds.json', '--out', 'out/a.css')).code).toBe(1);
    expect((await ds('init', '../outside.ds.json')).code).toBe(1);
    expect((await ds('validate', 'missing.ds.json')).code).toBe(2);
    expect((await ds('lint')).code).toBe(2);
    expect(LOCAL_RUNTIMES).toEqual(['edge', 'node']);
  });
});
