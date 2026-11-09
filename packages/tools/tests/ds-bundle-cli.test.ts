// @vitest-environment node
/**
 * `texuli ds pack` / `texuli ds unpack` and the `ds.bundle` operation:
 * a document round-trips through a bundle with its history; tampered and
 * path-traversing bundles are refused.
 */
import { mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { designSystemContentHash, unpackBundle } from '@texuli/spec/design-system';
import { afterEach, describe, expect, it } from 'vitest';
import { parseDsArgs, runDs } from '../src/cli/ds.ts';
import { texuliOps } from '../src/ops/index.ts';

let dir: string | undefined;
async function scratch(): Promise<string> {
  dir = await realpath(await mkdtemp(join(tmpdir(), 'texuli-ds-bundle-')));
  return dir;
}
afterEach(async () => {
  process.exitCode = undefined;
  if (dir) await rm(dir, { recursive: true, force: true });
  dir = undefined;
});

function cli(cwd: string) {
  return async (...argv: string[]) => {
    const out: string[] = [];
    const err: string[] = [];
    const result = await runDs(argv, {
      cwd,
      stdout: { write: (chunk: string) => out.push(chunk) },
      stderr: { write: (chunk: string) => err.push(chunk) },
    });
    const code = process.exitCode ?? 0;
    process.exitCode = undefined;
    return { result, code, out: out.join(''), err: err.join('') };
  };
}

const document = {
  format: 'texuli/design-system',
  formatVersion: 1,
  id: 'harborline',
  version: '1.2.0',
  name: 'Harborline',
  color: { brand: { seed: '#0e7490' } },
};

const source = {
  id: 'pricing-card',
  version: '0.3.0',
  language: 'svelte',
  source: '<div class="tx-card"></div>',
};

describe('parseDsArgs pack/unpack', () => {
  it('accepts pack with --out and unpack with an optional --out', () => {
    expect(parseDsArgs(['pack', 'a.json', '--out', 'b.json'])).toMatchObject({
      command: 'pack',
      args: ['a.json'],
      flags: { out: 'b.json' },
    });
    expect(parseDsArgs(['unpack', 'b.json'])).toMatchObject({
      command: 'unpack',
      args: ['b.json'],
    });
    expect(() => parseDsArgs(['pack', 'a.json'])).toThrow(/--out/);
  });
});

describe('texuli ds pack and unpack', () => {
  it('round-trips a document with sources and history', async () => {
    const cwd = await scratch();
    const history = [
      {
        version: '1.2.0',
        contentHash: designSystemContentHash(document),
        changelog: 'Initial locked release.',
        status: 'approved',
      },
    ];
    await writeFile(join(cwd, 'harborline.json'), `${JSON.stringify(document)}\n`);
    await writeFile(join(cwd, 'sources.json'), `${JSON.stringify([source])}\n`);
    await writeFile(join(cwd, 'history.json'), `${JSON.stringify(history)}\n`);
    const run = cli(cwd);
    const packed = await run(
      'pack',
      'harborline.json',
      '--sources',
      'sources.json',
      '--history',
      'history.json',
      '--out',
      'harborline.bundle.json'
    );
    expect(packed.code).toBe(0);
    expect(packed.result.ok).toBe(true);
    const bundle = JSON.parse(
      await readFile(join(cwd, 'harborline.bundle.json'), 'utf8')
    ) as unknown;
    const check = unpackBundle(bundle);
    expect(check.ok).toBe(true);
    const unpacked = await run('unpack', 'harborline.bundle.json', '--out', 'parts.json');
    expect(unpacked.code).toBe(0);
    const parts = JSON.parse(await readFile(join(cwd, 'parts.json'), 'utf8')) as {
      document: unknown;
      history: unknown;
    };
    expect(parts.document).toEqual(document);
    expect(parts.history).toEqual(history);
  });

  it('refuses a tampered bundle and a path-traversing source id', async () => {
    const cwd = await scratch();
    await writeFile(join(cwd, 'harborline.json'), `${JSON.stringify(document)}\n`);
    const run = cli(cwd);
    await run('pack', 'harborline.json', '--out', 'ok.bundle.json');
    const bundle = JSON.parse(await readFile(join(cwd, 'ok.bundle.json'), 'utf8')) as {
      document: Record<string, unknown>;
    };
    bundle.document = { ...bundle.document, name: 'Edited' };
    await writeFile(join(cwd, 'tampered.bundle.json'), `${JSON.stringify(bundle)}\n`);
    const refused = await run('unpack', 'tampered.bundle.json');
    expect(refused.code).toBe(1);
    expect(refused.out).toContain('content-hash-mismatch');
    await writeFile(
      join(cwd, 'bad-sources.json'),
      `${JSON.stringify([{ id: '../secret', version: '0.3.0', source: 'x' }])}\n`
    );
    const traversal = await run(
      'pack',
      'harborline.json',
      '--sources',
      'bad-sources.json',
      '--out',
      'nope.json'
    );
    expect(traversal.code).toBe(1);
    expect(traversal.out).toContain('path-refused');
  });
});

describe('ds.bundle', () => {
  it('packs and unpacks through the registry without writing files', async () => {
    const packed = await texuliOps.invoke('ds.bundle', { document, librarySources: [source] });
    expect(packed.ok).toBe(true);
    if (!packed.ok) throw new Error(packed.error.message);
    const output = packed.output as { ok: boolean; bundle: unknown };
    expect(output.ok).toBe(true);
    const unpacked = await texuliOps.invoke('ds.bundle', { bundle: output.bundle });
    expect(unpacked.ok).toBe(true);
    if (!unpacked.ok) throw new Error(unpacked.error.message);
    const parts = unpacked.output as { ok: boolean; document: unknown };
    expect(parts.ok).toBe(true);
    expect(parts.document).toEqual(document);
  });
});
