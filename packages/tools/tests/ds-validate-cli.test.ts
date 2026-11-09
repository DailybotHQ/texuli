import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { parseDsArgs, runDs } from '../src/cli/ds.ts';
import { MINIMAL_DESIGN_SYSTEM } from '../src/ops/design-system.ts';
import { texuliOps } from '../src/ops/index.ts';

let directory: string | undefined;
afterEach(async () => {
  process.exitCode = undefined;
  if (directory) await rm(directory, { recursive: true, force: true });
  directory = undefined;
});

async function fixture() {
  directory ??= await mkdtemp(join(tmpdir(), 'texuli-ds-validate-'));
  const document = join(directory, 'brand.json');
  await writeFile(
    document,
    JSON.stringify({
      ...MINIMAL_DESIGN_SYSTEM,
      id: 'harborline',
      name: 'Harborline',
      allow: { 'ghost-widget': {} },
    })
  );
  return { directory, document };
}

async function run(args: string[]) {
  const stdout: string[] = [];
  const stderr: string[] = [];
  const result = await runDs(args, {
    cwd: process.cwd(),
    stdout: { write: (chunk: string) => stdout.push(chunk) },
    stderr: { write: (chunk: string) => stderr.push(chunk) },
  });
  return {
    result,
    stdout: stdout.join(''),
    stderr: stderr.join(''),
    exitCode: process.exitCode ?? 0,
  };
}

describe('texuli ds validate full mode', () => {
  it('accepts the full-validator CLI flags and rejects report without locked mode', () => {
    expect(parseDsArgs(['validate', 'brand.json', '--locked', '--report', '--json'])).toMatchObject(
      {
        command: 'validate',
        locked: true,
        flags: { report: 'true', json: 'true' },
      }
    );
    expect(() => parseDsArgs(['validate', 'brand.json', '--report'])).toThrow(
      'Flag --report needs --locked.'
    );
    expect(() => parseDsArgs(['validate', 'brand.json', '--strict'])).toThrow(
      'Flag --strict needs --render.'
    );
  });

  it('prints the complete JSON findings and report mode exits zero; enforce mode exits one', async () => {
    const { document } = await fixture();
    const report = await run(['validate', document, '--locked', '--report', '--json']);
    const json = JSON.parse(report.stdout) as {
      ok: boolean;
      findings: { code: string; area: string }[];
      counts: { areas: Record<string, { errors: number }> };
    };
    expect(report.exitCode).toBe(0);
    expect(report.result.ok).toBe(true);
    expect(json.ok).toBe(false);
    expect(json.findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'unknown-component', area: 'allow' }),
      ])
    );
    expect(json.counts.areas.allow?.errors).toBeGreaterThan(0);

    process.exitCode = undefined;
    const enforced = await run(['validate', document, '--locked']);
    expect(enforced.exitCode).toBe(1);
    expect(enforced.result.ok).toBe(false);
    expect(enforced.stdout).toContain('unknown-component');
  });

  it('runs the full read-only MCP validator when full mode is requested', async () => {
    const operation = texuliOps.get('ds.validate');
    expect(operation?.annotations.readOnly).toBe(true);
    const result = await texuliOps.invoke('ds.validate', {
      document: {
        ...MINIMAL_DESIGN_SYSTEM,
        id: 'harborline',
        name: 'Harborline',
        allow: { 'ghost-widget': {} },
      },
      full: true,
      report: true,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.output).toMatchObject({
      format: 'texuli/ds-validate',
      valid: false,
      reportOnly: true,
      codes: expect.arrayContaining(['unknown-component']),
    });
  });

  it('checks bounded prototype sources as text without executing them', async () => {
    const { directory, document } = await fixture();
    await writeFile(
      join(directory, 'Widget.svelte'),
      `<script>import { Button } from 'texuli';</script><Button variant="invented" />`
    );
    const result = await run([
      'validate',
      document,
      '--prototype',
      directory,
      '--report',
      '--locked',
    ]);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('not-allowed');
  });
});
