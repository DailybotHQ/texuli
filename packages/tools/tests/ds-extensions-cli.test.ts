/**
 * `texuli ds check` and `texuli ds validate` with `--extensions <file...>` (PLAN_016
 * T-0161-extensions-cli): `allow` is checked against `mergeCatalogs(texuli, extensions)`, so a
 * document that allows `<ns>:<id>` keys passes the CLI as it passes the host's own validation
 * (`checkDesignSystemAllow` over the merged catalog). A refused extension is reported with
 * the merge's code. The namespaces `acme` and `globex` and the brand Harborline are fictional.
 */
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { CATALOG_EXTENSION_FORMAT, mergeCatalogs } from '@texuli/spec/catalog-extensions';
import { checkDesignSystemAllow } from '@texuli/spec/design-system';
import { afterEach, describe, expect, it } from 'vitest';
import { runDs } from '../src/cli/ds.ts';
import { loadAllowCatalog, parseDsCliArgs } from '../src/ds-check/cli.ts';
import { loadMergedCatalog } from '../src/ds-check/index.ts';
import { MINIMAL_DESIGN_SYSTEM } from '../src/ops/design-system.ts';

let directory: string | undefined;
afterEach(async () => {
  process.exitCode = undefined;
  if (directory) await rm(directory, { recursive: true, force: true });
  directory = undefined;
});

/** A fictional host library: one component built from catalog ids. */
const extension = (namespace = 'acme') => ({
  format: CATALOG_EXTENSION_FORMAT,
  version: 1,
  namespace,
  components: [
    {
      id: `${namespace}:kpi-strip`,
      label: 'KPI strip',
      summary: 'A row of key figures for a dashboard header.',
      group: 'display',
      placement: 'app',
      emit: [],
      capability: 'web-only',
      props: [{ name: 'tone', kind: 'enum', enumValues: ['neutral', 'brand'] }],
      axes: { tone: { prop: 'tone', values: ['neutral', 'brand'], default: 'neutral' } },
      composes: ['card', 'button'],
    },
  ],
});

const document = (allow: Record<string, unknown>) => ({
  ...MINIMAL_DESIGN_SYSTEM,
  id: 'harborline',
  name: 'Harborline',
  allow,
});

async function write(name: string, value: unknown): Promise<string> {
  directory ??= await mkdtemp(join(tmpdir(), 'texuli-ds-extensions-'));
  const path = join(directory, name);
  await writeFile(path, JSON.stringify(value));
  return path;
}

async function run(args: string[]) {
  const stdout: string[] = [];
  const stderr: string[] = [];
  await runDs(args, {
    cwd: process.cwd(),
    stdout: { write: (chunk: string) => stdout.push(chunk) },
    stderr: { write: (chunk: string) => stderr.push(chunk) },
  });
  const exitCode = process.exitCode ?? 0;
  process.exitCode = undefined;
  return { stdout: stdout.join(''), stderr: stderr.join(''), exitCode };
}

const ALLOW = { button: {}, 'acme:kpi-strip': { tones: ['brand'] } };

describe('loadMergedCatalog', () => {
  it('merges extension manifests into the agent catalog', async () => {
    const merged = await loadMergedCatalog([extension()]);
    expect(merged.ok).toBe(true);
    expect(merged.issues).toEqual([]);
    expect(merged.catalog.components.map((c) => c.id)).toContain('acme:kpi-strip');
    expect(merged.extensions.map((e) => e.namespace)).toEqual(['acme']);
    // Without extensions it is the agent catalog itself.
    const plain = await loadMergedCatalog([]);
    expect(plain.catalog.components).toHaveLength((await loadAllowCatalog()).components.length);
  });

  it('refuses a bad extension with its code and leaves it out whole', async () => {
    const merged = await loadMergedCatalog([extension('texuli')]);
    expect(merged.ok).toBe(false);
    expect(merged.issues.map((issue) => issue.code)).toContain('extension-namespace');
    expect(merged.catalog.components.some((c) => c.id.includes(':'))).toBe(false);
  });
});

describe('ds check --extensions', () => {
  it('passes a document that allows <ns>:<id> keys, matching the host validation', async () => {
    const doc = await write('harborline.json', document(ALLOW));
    const acme = await write('acme.json', extension());

    // Without the extension the key is unknown to Texuli's catalog.
    const without = await run(['check', doc, '--json']);
    expect(without.exitCode).toBe(1);
    expect(JSON.parse(without.stdout).codes).toContain('unknown-component');

    const withExtension = await run(['check', doc, '--extensions', acme, '--json']);
    expect(withExtension.stderr).toBe('');
    expect(withExtension.exitCode).toBe(0);
    expect(JSON.parse(withExtension.stdout).ok).toBe(true);

    // The host's own validation over the same merged catalog agrees.
    const host = mergeCatalogs(await loadAllowCatalog(), [extension()]);
    expect(checkDesignSystemAllow(document(ALLOW), host.catalog).ok).toBe(true);
  });

  it('refuses an allow value the extension does not declare, as the host does', async () => {
    const allow = { 'acme:kpi-strip': { tones: ['loud'] } };
    const doc = await write('harborline.json', document(allow));
    const acme = await write('acme.json', extension());
    const { stdout, exitCode } = await run(['check', doc, '--extensions', acme, '--json']);
    expect(exitCode).toBe(1);
    const host = mergeCatalogs(await loadAllowCatalog(), [extension()]);
    const hostCodes = checkDesignSystemAllow(document(allow), host.catalog).errors.map(
      (e) => e.code
    );
    expect(hostCodes).toEqual(['unknown-tone']);
    expect(JSON.parse(stdout).codes).toEqual(hostCodes);
  });

  it('reports a refused extension with the merge code and its file', async () => {
    const doc = await write('harborline.json', document({ button: {} }));
    const bad = await write('bad.json', extension('texuli'));
    const { stdout, exitCode } = await run(['check', doc, '--extensions', bad, '--json']);
    expect(exitCode).toBe(1);
    const report = JSON.parse(stdout) as {
      codes: string[];
      errors: { code: string; message: string; source?: string; path: string }[];
    };
    expect(report.codes).toContain('catalog-extension');
    const refusal = report.errors.find((e) => e.code === 'catalog-extension');
    expect(refusal?.message).toMatch(/^extension-namespace: /);
    expect(refusal?.source).toBe(bad);
    expect(refusal?.path).toMatch(/^extensions\[0\]/);
  });

  it('merges several files (one flag or a repeated flag)', async () => {
    const allow = { 'acme:kpi-strip': {}, 'globex:kpi-strip': {} };
    const doc = await write('harborline.json', document(allow));
    const acme = await write('acme.json', extension());
    const globex = await write('globex.json', extension('globex'));
    expect((await run(['check', doc, '--extensions', acme, globex])).exitCode).toBe(0);
    expect((await run(['check', doc, '--extensions', acme, '--extensions', globex])).exitCode).toBe(
      0
    );
    expect((await run(['check', doc, '--extensions', acme])).exitCode).toBe(1);
  });

  it('parses the flag and refuses a bad use with exit 2', async () => {
    expect(
      parseDsCliArgs(['check', 'a.json', '--extensions', 'x.json', 'y.json', '--json'])
    ).toMatchObject({
      file: 'a.json',
      extensions: ['x.json', 'y.json'],
      json: true,
    });
    expect(() => parseDsCliArgs(['check', 'a.json', '--extensions'])).toThrow(/needs a file/);
    const many = Array.from({ length: 17 }, (_, i) => `e${i}.json`);
    expect(() => parseDsCliArgs(['check', 'a.json', '--extensions', ...many])).toThrow(
      /extension-oversize/
    );
    const doc = await write('harborline.json', document({ button: {} }));
    const missing = await run([
      'check',
      doc,
      '--extensions',
      join(directory as string, 'none.json'),
    ]);
    expect(missing.exitCode).toBe(2);
    const notJson = await write('not.json', 'x');
    await writeFile(notJson, 'not json');
    expect((await run(['check', doc, '--extensions', notJson])).exitCode).toBe(2);
  });
});

describe('ds validate --extensions', () => {
  it('runs the full validator against the merged catalog', async () => {
    const doc = await write('harborline.json', document(ALLOW));
    const acme = await write('acme.json', extension());
    const { stdout, exitCode } = await run(['validate', doc, '--extensions', acme, '--json']);
    const report = JSON.parse(stdout) as {
      format: string;
      findings: { code: string }[];
    };
    expect(report.format).toBe('texuli/ds-validate');
    expect(report.findings.map((f) => f.code)).not.toContain('unknown-component');
    expect(report.findings.map((f) => f.code)).not.toContain('catalog-extension');
    expect(exitCode).toBe(0);
  });

  it('reports a refused extension as catalog-extension with the merge code', async () => {
    const doc = await write('harborline.json', document({ button: {} }));
    const bad = await write('bad.json', extension('texuli'));
    const { stdout, exitCode } = await run([
      'validate',
      doc,
      '--locked',
      '--extensions',
      bad,
      '--report',
      '--json',
    ]);
    expect(exitCode).toBe(0);
    const finding = (
      JSON.parse(stdout) as { findings: { code: string; message: string; area: string }[] }
    ).findings.find((f) => f.code === 'catalog-extension');
    expect(finding?.area).toBe('catalog');
    expect(finding?.message).toMatch(/^extension-namespace: /);
  });

  it('belongs to validate and check only', async () => {
    const { exitCode, stderr } = await run(['compile', 'a.json', '--extensions', 'x.json']);
    expect(exitCode).toBe(2);
    expect(stderr).toMatch(/belongs to ds validate/);
  });
});
