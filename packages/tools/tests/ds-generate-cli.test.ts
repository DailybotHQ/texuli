// @vitest-environment node
import { mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { parseDsArgs, runDs } from '../src/cli/ds.ts';
import { parseRouterArgs } from '../src/cli/router.ts';

let scratchDir: string | undefined;
async function scratch(): Promise<string> {
  scratchDir = await realpath(await mkdtemp(join(tmpdir(), 'texuli-ds-generate-')));
  return scratchDir;
}

afterEach(async () => {
  process.exitCode = undefined;
  if (scratchDir) await rm(scratchDir, { recursive: true, force: true });
  scratchDir = undefined;
});

describe('texuli ds generate', () => {
  it('parses source options and the output shorthand', () => {
    expect(
      parseDsArgs([
        'generate',
        '--brief',
        'brand #0f766e',
        '--from-tokens',
        'tokens.json',
        '--from-css',
        'site.css',
        '--from-logo',
        'pixels.json',
        '-o',
        'brand.json',
      ])
    ).toMatchObject({
      command: 'generate',
      args: [],
      flags: {
        brief: 'brand #0f766e',
        'from-tokens': 'tokens.json',
        'from-css': 'site.css',
        'from-logo': 'pixels.json',
        out: 'brand.json',
      },
    });
    expect(parseRouterArgs(['ds', 'generate', '--brief', 'brand #0f766e'])).toMatchObject({
      kind: 'legacy',
      command: 'ds',
    });
  });

  it('writes the generated document and its loss, repair and guarantee report', async () => {
    const cwd = await scratch();
    await writeFile(
      join(cwd, 'tokens.json'),
      JSON.stringify({ color: { brand: { seed: { $type: 'color', $value: '#2563eb' } } } })
    );
    await writeFile(join(cwd, 'site.css'), ':root { --tx-radius-md: 12px; --tx-space-1: 4px; }');
    await writeFile(
      join(cwd, 'pixels.json'),
      JSON.stringify({ data: [15, 118, 110, 255, 37, 99, 235, 255] })
    );

    const out: string[] = [];
    const err: string[] = [];
    const result = await runDs(
      [
        'generate',
        '--brief',
        'brand #0f766e',
        '--from-tokens',
        'tokens.json',
        '--from-css',
        'site.css',
        '--from-logo',
        'pixels.json',
        '-o',
        'generated.json',
      ],
      {
        cwd,
        stdout: { write: (chunk: string) => out.push(chunk) },
        stderr: { write: (chunk: string) => err.push(chunk) },
      }
    );
    expect(result.ok, err.join('')).toBe(true);
    if (!result.ok) return;
    expect(result.out).toBe('generated.json');
    expect(JSON.parse(await readFile(join(cwd, 'generated.json'), 'utf8'))).toMatchObject({
      color: { brand: { seed: expect.any(String) } },
      shape: { radius: 12 },
      space: { base: 4 },
    });
    expect(
      JSON.parse(await readFile(join(cwd, 'generated.json.report.json'), 'utf8'))
    ).toMatchObject({
      losses: expect.any(Array),
      repairs: expect.any(Array),
      guarantees: { passed: true, issues: [] },
    });
    expect(JSON.parse(out.join(''))).toMatchObject({ ok: true, operation: 'ds.generate' });
  });
});
