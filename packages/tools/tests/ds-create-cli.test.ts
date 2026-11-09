/**
 * ADR-032 creation commands: `texuli ds init --locked [--preset …]`,
 * `texuli ds approve` and `texuli ds hash`, and their pure helpers.
 */
import { mkdtemp, readdir, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { validateDesignSystem } from '@texuli/tokens/design-system/validate';
import { afterEach, describe, expect, it } from 'vitest';
import {
  designSystemContentHash as specContentHash,
  libraryEntryContentHash as specEntryHash,
} from '../../spec/src/design-system/index.ts';
import { parseDsArgs, runDs } from '../src/cli/ds.ts';
import { parseRouterArgs } from '../src/cli/router.ts';
import {
  APPROVAL_NOTE,
  allowFromJson,
  allowPreset,
  fullAllowEntry,
  hashReport,
  MINIMAL_PRESET_IDS,
  presetComponentsFromBuild,
  stampApproval,
} from '../src/ds-create/index.ts';
import { loadOpsCatalog } from '../src/ops/catalog.ts';

let dir: string | undefined;
async function scratch(): Promise<string> {
  dir = await realpath(await mkdtemp(join(tmpdir(), 'texuli-ds-create-')));
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

/** A parsed document file, read loosely to assert on nested fields. */
// biome-ignore lint/suspicious/noExplicitAny: assertions reach into parsed JSON
type Loose = Record<string, any>;

const read = async (cwd: string, file: string) =>
  JSON.parse(await readFile(join(cwd, file), 'utf8')) as Loose;

const base = {
  format: 'texuli/design-system',
  formatVersion: 1,
  id: 'harborline',
  version: '1.0.0',
  name: 'Harborline',
  color: { brand: { seed: '#0e7490' } },
} as const;

describe('allow presets', () => {
  it('builds valid all and minimal presets from the catalog', async () => {
    const build = await loadOpsCatalog();
    const components = presetComponentsFromBuild(build.catalog.entries);
    const ids = build.catalog.entries.map((entry) => entry.id).sort();
    const all = allowPreset(components, 'all');
    expect(Object.keys(all)).toEqual(ids);
    expect(validateDesignSystem({ ...base, allow: all })).toEqual({ ok: true, errors: [] });
    const minimal = allowPreset(components, 'minimal');
    expect(Object.keys(minimal).length).toBeGreaterThan(10);
    expect(Object.keys(minimal).every((id) => MINIMAL_PRESET_IDS.includes(id))).toBe(true);
    // Every documented core id is a real catalog id today.
    expect(MINIMAL_PRESET_IDS.filter((id) => !ids.includes(id))).toEqual([]);
    expect(validateDesignSystem({ ...base, allow: minimal }).ok).toBe(true);
  });

  it('lists full axes and states, leaving out axes beyond the caps', () => {
    const components = presetComponentsFromBuild([
      {
        id: 'button',
        axes: { variant: 'variant', size: 'size' },
        states: ['hover', 'disabled', 'not-a-state'],
        props: [
          { name: 'variant', enumValues: ['default', 'outline'] },
          { name: 'size', enumValues: ['sm', 'md'] },
        ],
      },
      { id: 'card', props: [] },
      {
        id: 'chart',
        axes: { tone: 'tone', density: 'density' },
        props: [
          { name: 'tone', enumValues: Array.from({ length: 33 }, (_, i) => `t${i}`) },
          { name: 'density', enumValues: ['has space'] },
        ],
      },
    ]);
    expect(allowPreset(components, 'all')).toEqual({
      button: {
        variants: ['default', 'outline'],
        sizes: ['sm', 'md'],
        states: ['hover', 'disabled'],
      },
      card: {},
      chart: {},
    });
    expect(fullAllowEntry({ id: 'x' })).toEqual({});
    expect(allowPreset(components, 'minimal')).toEqual({
      button: {
        variants: ['default', 'outline'],
        sizes: ['sm', 'md'],
        states: ['hover', 'disabled'],
      },
      card: {},
    });
  });

  it('reads a preset file as an allow section or a document carrying one', () => {
    expect(allowFromJson({ button: {} })).toEqual({ button: {} });
    expect(allowFromJson({ ...base, allow: { card: {} } })).toEqual({ card: {} });
    expect(() => allowFromJson([])).toThrow(/JSON object/u);
  });
});

describe('approval and hashes', () => {
  const doc = {
    ...base,
    allow: { button: { variants: ['default'] } },
    library: [
      {
        id: 'pricing-card',
        name: 'Pricing card',
        purpose: 'One plan.',
        version: '0.1.0',
        status: 'draft' as const,
        composes: ['card', 'button'],
        approval: { status: 'draft' as const, version: '0.1.0', approvedBy: 'Someone' },
      },
    ],
  };

  it('has one hash implementation: the spec content hashes', async () => {
    const files = await readdir(join(import.meta.dirname, '../src/ds-create'));
    expect(files).not.toContain('content-hash.ts');
    expect(hashReport(doc).contentHash).toBe(specContentHash(doc));
    expect(hashReport(doc).library[0]?.contentHash).toBe(specEntryHash(doc.library[0]));
  });

  it('stamps an approval whose hash verifies, without mutating the input', () => {
    const at = new Date('2026-11-09T14:30:00.000Z');
    const stamped = stampApproval(doc, { by: '  Design reviewer ', at });
    expect(stamped.approval).toEqual({
      status: 'approved',
      approvedBy: 'Design reviewer',
      approvedAt: '2026-11-09T14:30:00.000Z',
      version: '1.0.0',
      contentHash: specContentHash(stamped),
    });
    expect(doc).not.toHaveProperty('approval');
    expect(validateDesignSystem(stamped)).toEqual({ ok: true, errors: [] });
    expect(hashReport(stamped)).toMatchObject({ ok: true, matches: true, status: 'approved' });
    const bumped = stampApproval(doc, { by: 'Design reviewer', at, version: '1.1.0' });
    expect(bumped.version).toBe('1.1.0');
    expect(bumped.approval?.version).toBe('1.1.0');
    expect(() => stampApproval(doc, { by: '  ' })).toThrow(/--by/u);
  });

  it('reports a stale hash after an edit, and per library entry', () => {
    const stamped = stampApproval(doc, { by: 'Design reviewer' });
    const edited = { ...stamped, name: 'Harborline 2' };
    expect(hashReport(edited)).toMatchObject({ ok: false, matches: false });
    const report = hashReport(stamped);
    expect(report.library).toEqual([
      { id: 'pricing-card', contentHash: specEntryHash(doc.library[0]) },
    ]);
    const entryStale = {
      ...stamped,
      library: [
        {
          ...doc.library[0],
          approval: { status: 'approved', version: '0.1.0', contentHash: 'b'.repeat(64) },
        },
      ],
    };
    expect(hashReport(entryStale)).toMatchObject({ ok: false, library: [{ matches: false }] });
    expect(hashReport({ ...base }).matches).toBeUndefined();
  });
});

describe('texuli ds init --locked, approve and hash', () => {
  it('parses the new commands and flags, and lists them in help', () => {
    expect(parseDsArgs(['init', 'a.json', '--locked', '--preset', 'all'])).toMatchObject({
      command: 'init',
      locked: true,
      flags: { preset: 'all' },
    });
    expect(parseDsArgs(['approve', 'a.json', '--by', 'Ana', '--version', '1.1.0'])).toMatchObject({
      command: 'approve',
      flags: { by: 'Ana', version: '1.1.0' },
    });
    expect(parseDsArgs(['hash', 'a.json'])).toMatchObject({ command: 'hash', args: ['a.json'] });
    expect(parseDsArgs(['validate', 'a.json', '--locked'])).toMatchObject({
      command: 'validate',
      locked: true,
    });
    for (const [argv, message] of [
      [['approve', 'a.json'], /needs --by/u],
      [['init', 'a.json', '--preset', 'all'], /--preset needs --locked/u],
      [['hash'], /takes one argument/u],
    ] as const)
      expect(() => parseDsArgs(argv), argv.join(' ')).toThrow(message);
    expect(parseRouterArgs(['ds', 'approve', 'a.json', '--by', 'Ana'])).not.toMatchObject({
      kind: 'error',
    });
  });

  it('scaffolds a locked design system, approves it and verifies its hash', async () => {
    const cwd = await scratch();
    const ds = cli(cwd);

    const init = await ds(
      'init',
      'brand.ds.json',
      '--brand',
      'name Harborline, brand #0e7490',
      '--locked'
    );
    expect(init.code, init.out + init.err).toBe(0);
    const scaffold = await read(cwd, 'brand.ds.json');
    expect(Object.keys(scaffold.allow).every((id) => MINIMAL_PRESET_IDS.includes(id))).toBe(true);
    expect(scaffold).not.toHaveProperty('approval');

    const all = await ds('init', 'all.ds.json', '--locked', '--preset', 'all');
    expect(all.code, all.out + all.err).toBe(0);
    expect(Object.keys((await read(cwd, 'all.ds.json')).allow).length).toBe(
      (await loadOpsCatalog()).catalog.entries.length
    );

    await writeFile(join(cwd, 'allow.json'), JSON.stringify({ button: { variants: ['default'] } }));
    const fromFile = await ds('init', 'file.ds.json', '--locked', '--preset', 'allow.json');
    expect(fromFile.code, fromFile.out + fromFile.err).toBe(0);
    expect((await read(cwd, 'file.ds.json')).allow).toEqual({ button: { variants: ['default'] } });

    // A preset file that breaks the schema is refused, and nothing is written.
    await writeFile(join(cwd, 'bad-allow.json'), JSON.stringify({ Button: {} }));
    expect((await ds('init', 'bad.ds.json', '--locked', '--preset', 'bad-allow.json')).code).toBe(
      1
    );
    await expect(readFile(join(cwd, 'bad.ds.json'), 'utf8')).rejects.toThrow();

    const approve = await ds('approve', 'brand.ds.json', '--by', 'Design reviewer');
    expect(approve.code, approve.out + approve.err).toBe(0);
    const receipt = JSON.parse(approve.out);
    expect(receipt).toMatchObject({ ok: true, operation: 'ds.approve', note: APPROVAL_NOTE });
    expect(receipt.note).toMatch(/cannot prove it/u);
    const approved = await read(cwd, 'brand.ds.json');
    expect(approved.approval).toMatchObject({
      status: 'approved',
      approvedBy: 'Design reviewer',
      version: approved.version,
    });
    expect(approved.approval.contentHash).toBe(specContentHash(approved));
    expect(approved.allow).toEqual(scaffold.allow);

    const hash = await ds('hash', 'brand.ds.json');
    expect(hash.code, hash.out).toBe(0);
    expect(JSON.parse(hash.out)).toMatchObject({
      operation: 'ds.hash',
      ok: true,
      matches: true,
      contentHash: approved.approval.contentHash,
    });
    // Stable: the same file gives the same hash; key order does not matter.
    expect(JSON.parse((await ds('hash', 'brand.ds.json')).out).contentHash).toBe(
      approved.approval.contentHash
    );
    const reordered = Object.fromEntries(Object.entries(approved).reverse());
    await writeFile(join(cwd, 'reordered.ds.json'), JSON.stringify(reordered));
    expect(JSON.parse((await ds('hash', 'reordered.ds.json')).out)).toMatchObject({
      matches: true,
    });

    // An edit after approval makes the stored hash stale: exit 1.
    await writeFile(join(cwd, 'edited.ds.json'), JSON.stringify({ ...approved, name: 'Changed' }));
    const stale = await ds('hash', 'edited.ds.json');
    expect(stale.code).toBe(1);
    expect(JSON.parse(stale.out)).toMatchObject({ ok: false, matches: false });

    // --version moves the document and the approval to the released version.
    const release = await ds(
      'approve',
      'brand.ds.json',
      '--by',
      'Design reviewer',
      '--version',
      '1.1.0'
    );
    expect(release.code, release.out).toBe(0);
    const released = await read(cwd, 'brand.ds.json');
    expect([released.version, released.approval.version]).toEqual(['1.1.0', '1.1.0']);
    expect(released.approval.contentHash).toBe(specContentHash(released));
  });

  it('refuses to approve an invalid document and leaves the file unchanged', async () => {
    const cwd = await scratch();
    const ds = cli(cwd);
    const invalid = JSON.stringify({ ...base, allow: { button: { states: ['pressed'] } } });
    await writeFile(join(cwd, 'bad.ds.json'), invalid);
    const refused = await ds('approve', 'bad.ds.json', '--by', 'Design reviewer');
    expect(refused.code).toBe(1);
    expect(JSON.parse(refused.out)).toMatchObject({
      ok: false,
      operation: 'ds.approve',
      valid: false,
    });
    expect(await readFile(join(cwd, 'bad.ds.json'), 'utf8')).toBe(invalid);

    await writeFile(join(cwd, 'ok.ds.json'), JSON.stringify(base));
    const badName = await ds('approve', 'ok.ds.json', '--by', 'evil\u202Ename');
    expect(badName.code).toBe(1);
    expect(JSON.parse(await readFile(join(cwd, 'ok.ds.json'), 'utf8'))).toEqual(base);

    const badVersion = await ds('approve', 'ok.ds.json', '--by', 'Ana', '--version', '^2');
    expect(badVersion.code).toBe(1);

    expect((await ds('approve', 'missing.ds.json', '--by', 'Ana')).code).toBe(2);
    expect((await ds('hash', 'missing.ds.json')).code).toBe(2);
  });
});
