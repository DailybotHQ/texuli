import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { dsFullCounts, formatDsFullReport, parseDsCliArgs, runDsCli } from '../src/ds-check/cli.ts';
import type { DsFullReport } from '../src/ds-check/full.ts';

let dir: string | undefined;
afterEach(async () => {
  process.exitCode = undefined;
  if (dir) await rm(dir, { recursive: true, force: true });
  dir = undefined;
});

async function invalidLockedDocument(): Promise<string> {
  dir ??= await mkdtemp(join(tmpdir(), 'texuli-ds-report-'));
  const path = join(dir, 'locked.json');
  await writeFile(
    path,
    JSON.stringify({
      format: 'texuli/design-system',
      formatVersion: 1,
      id: 'harborline',
      version: '1.0.0',
      name: 'Harborline',
      color: { brand: { seed: '#0e7490' } },
      allow: { 'ghost-widget': {} },
    })
  );
  return path;
}

async function invoke(args: string[]) {
  const stdout: string[] = [];
  const stderr: string[] = [];
  const result = await runDsCli(args, {
    cwd: process.cwd(),
    stdout: { write: (chunk: string) => stdout.push(chunk) },
    stderr: { write: (chunk: string) => stderr.push(chunk) },
  });
  return { result, stdout: stdout.join(''), stderr: stderr.join(''), code: process.exitCode ?? 0 };
}

describe('texuli ds check --locked report mode', () => {
  it('parses report mode only with locked checks and documents the exit contract', () => {
    expect(parseDsCliArgs(['check', 'brand.json', '--locked', '--report'])).toMatchObject({
      locked: true,
      report: true,
    });
    expect(() => parseDsCliArgs(['check', 'brand.json', '--report'])).toThrow(
      'Flag --report needs --locked.'
    );
  });

  it('lists every finding in JSON and exits zero in report mode', async () => {
    const run = await invoke([
      'check',
      await invalidLockedDocument(),
      '--locked',
      '--report',
      '--json',
    ]);
    const output = JSON.parse(run.stdout) as DsFullReport & {
      counts: ReturnType<typeof dsFullCounts>;
    };
    expect(run.code).toBe(0);
    expect(run.result.ok).toBe(true);
    expect(output.ok).toBe(false);
    expect(output.findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'unknown-component', area: 'allow' }),
      ])
    );
    expect(output.summary.errors).toBeGreaterThan(0);
    expect(output.counts.areas.allow?.errors).toBeGreaterThan(0);
    expect(run.stderr).toBe('');
  });

  it('enforces the same finding with exit one, and readable report mode lists it without failing', async () => {
    const file = await invalidLockedDocument();
    const enforced = await invoke(['check', file, '--locked']);
    expect(enforced.code).toBe(1);
    expect(enforced.result.ok).toBe(false);
    expect(enforced.stdout).toContain('unknown-component');

    process.exitCode = undefined;
    const reported = await invoke(['check', file, '--locked', '--report']);
    expect(reported.code).toBe(0);
    expect(reported.result.ok).toBe(true);
    expect(reported.stdout).toContain('area allow:');
    expect(reported.stdout).toContain('ERROR unknown-component');
    expect(reported.stdout).toContain('baseline');
  });

  it('counts findings by area and route and uses the prototype component usage counts', () => {
    const fake = {
      document: { id: 'route-fixture' },
      summary: { errors: 2, warnings: 0, info: 0 },
      findings: [
        {
          severity: 'error',
          area: 'prototype-components',
          path: 'route:home#$.tree',
          code: 'unmapped',
        },
        {
          severity: 'error',
          area: 'prototype-components',
          path: 'route:home#$.tree.children[0]',
          code: 'not-allowed',
        },
      ],
      prototype: { components: { button: 2 } },
    } as unknown as DsFullReport;
    expect(dsFullCounts(fake)).toMatchObject({
      errors: 2,
      areas: { 'prototype-components': { errors: 2, warnings: 0, info: 0 } },
      routes: { home: 2 },
      components: { button: 2 },
    });
    expect(formatDsFullReport(fake)).toContain('route home: 2 findings');
  });
});
