// @vitest-environment node
/**
 * `texuli ds check` on locked design systems (T-t1-cli, ADR-032): the allowed set checked
 * against the agent catalog (or `--catalog`), the approval status as declared, and the
 * recorded content hashes, with stable codes and exit status. `texuli ds hash` prints the
 * hashes the check compares. The check never claims to prove who approved.
 */
import { mkdtemp, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { designSystemContentHash, libraryEntryContentHash } from '@texuli/spec/design-system';
import { afterEach, describe, expect, it } from 'vitest';
import { runDs } from '../src/cli/ds.ts';
import { parseDsCliArgs, runDsCli } from '../src/ds-check/cli.ts';
import {
  checkDesignSystem,
  DS_CHECK_LOCKED_CODES,
  type DsCheckLockedReport,
  lockedReport,
} from '../src/ds-check/static.ts';

let dir: string | undefined;
async function file(name: string, value: unknown): Promise<string> {
  dir ??= await realpath(await mkdtemp(join(tmpdir(), 'texuli-ds-locked-')));
  const path = join(dir, name);
  await writeFile(path, typeof value === 'string' ? value : JSON.stringify(value));
  return path;
}
afterEach(async () => {
  process.exitCode = undefined;
  if (dir) await rm(dir, { recursive: true, force: true });
  dir = undefined;
});

async function check(args: readonly string[]) {
  const out: string[] = [];
  const err: string[] = [];
  const result = await runDsCli(['check', ...args], {
    stdout: { write: (chunk: string) => out.push(chunk) },
    stderr: { write: (chunk: string) => err.push(chunk) },
  });
  const code = process.exitCode ?? 0;
  process.exitCode = undefined;
  const text = out.join('');
  return {
    result,
    code,
    err: err.join(''),
    text,
    json: args.includes('--json') ? (JSON.parse(text) as DsCheckLockedReport) : undefined,
  };
}

type Doc = Record<string, unknown>;
const base = (extra: Doc = {}): Doc => ({
  format: 'texuli/design-system',
  formatVersion: 1,
  id: 'harborline',
  version: '1.2.0',
  name: 'Harborline',
  color: { brand: { seed: '#0f766e' } },
  ...extra,
});

const entry = {
  id: 'primary-cta',
  name: 'Primary call to action',
  purpose: 'The one main action of a page.',
  version: '1.0.0',
  status: 'approved',
  composes: ['button'],
};

/** A locked document approved over its own content hash. */
function approved(extra: Doc = {}): Doc {
  const doc = base({
    allow: { button: { variants: ['default', 'outline'], sizes: ['sm', 'md'] }, card: {} },
    library: [
      {
        ...entry,
        approval: {
          status: 'approved',
          version: '1.0.0',
          approvedBy: 'design-review@example.com',
          approvedAt: '2026-11-09T12:00:00Z',
          contentHash: libraryEntryContentHash(entry),
        },
      },
    ],
    ...extra,
  });
  return {
    ...doc,
    approval: {
      status: 'approved',
      version: '1.2.0',
      approvedBy: 'design-review@example.com',
      approvedAt: '2026-11-09T12:00:00Z',
      contentHash: designSystemContentHash(doc),
    },
  };
}

describe('ds check: the allowed set', () => {
  it('reports an unlocked document as not locked, with no approval, and passes', async () => {
    const run = await check([await file('open.json', base()), '--json']);
    expect(run.code).toBe(0);
    expect(run.json?.locked).toMatchObject({
      locked: false,
      allowed: [],
      catalogChecked: true,
      approval: { status: 'none' },
    });
    expect(run.json?.locked.approval.contentHash).toBe(designSystemContentHash(base()));
    const human = await check([await file('open.json', base())]);
    expect(human.text).toContain('not locked: no allow section');
    expect(human.text).toContain('approval: none');
    expect(human.text).toContain('none recorded');
  });

  it('checks allow against the agent catalog and lists the allowed set', async () => {
    const run = await check([await file('locked.json', approved()), '--json']);
    expect(run.code, JSON.stringify(run.json?.errors)).toBe(0);
    expect(run.json?.locked).toMatchObject({
      locked: true,
      allowed: ['button', 'card'],
      library: ['primary-cta'],
      catalogChecked: true,
    });
    const human = await check([await file('locked.json', approved())]);
    expect(human.text).toContain('locked: 2 components allowed (checked against the catalog)');
    expect(human.text).toContain('library: primary-cta');
  });

  it('refuses ids and values the catalog does not list, with code and path (exit 1)', async () => {
    const cases: [Doc, string, string][] = [
      [{ 'ghost-widget': {} }, 'unknown-component', '$.allow["ghost-widget"]'],
      [{ button: { variants: ['neon'] } }, 'unknown-variant', '$.allow.button.variants[0]'],
      [{ button: { sizes: ['xxl'] } }, 'unknown-size', '$.allow.button.sizes[0]'],
      [{ button: { states: ['teleporting'] } }, 'unknown-state', '$.allow.button.states[0]'],
    ];
    for (const [allow, code, path] of cases) {
      const run = await check([await file(`${code}.json`, base({ allow })), '--json']);
      expect(run.code, code).toBe(1);
      expect(run.json?.codes, code).toContain(code);
      expect(
        run.json?.errors.some((error) => error.code === code && error.path === path),
        `${code}: ${JSON.stringify(run.json?.errors)}`
      ).toBe(true);
      const human = await check([await file(`${code}.json`, base({ allow }))]);
      expect(human.code, code).toBe(1);
      expect(human.text, code).toContain(`${code} ${path}`);
    }
  });

  it('checks against --catalog when given, and cannot run on a bad catalog file (exit 2)', async () => {
    const stub = { components: [{ id: 'button', axes: { size: { values: ['md'] } } }] };
    const catalog = await file('catalog.json', stub);
    const doc = await file('small.json', base({ allow: { button: { sizes: ['sm'] } } }));
    const run = await check([doc, '--catalog', catalog, '--json']);
    expect(run.code).toBe(1);
    expect(run.json?.codes).toEqual(['unknown-size']);
    // The same document passes the real catalog, where button has a small size.
    expect((await check([doc, '--json'])).code).toBe(0);
    const bad = await check([doc, '--catalog', await file('bad.json', { items: [] })]);
    expect(bad.code).toBe(2);
    expect(bad.err).toContain('has no components list');
    expect(parseDsCliArgs(['check', 'a.json', '--catalog', 'c.json']).catalog).toBe('c.json');
    expect(() => parseDsCliArgs(['check', 'a.json', '--catalog'])).toThrow(/needs a value/);
  });

  it('reports the allowed set without a catalog, unchecked, when called as a library', async () => {
    const report = await checkDesignSystem(base({ allow: { 'ghost-widget': {} } }));
    expect(report.locked).toMatchObject({
      locked: true,
      allowed: ['ghost-widget'],
      catalogChecked: false,
    });
    expect(report.codes).not.toContain('unknown-component');
  });

  it('refuses a stale hash only when asked (ds check does; ds.validate and ds approve do not)', async () => {
    const edited = { ...approved(), name: 'Harborline edited' };
    const plain = await checkDesignSystem(edited);
    expect(plain.ok).toBe(true);
    expect(plain.locked.approval.matches).toBe(false);
    const strict = await checkDesignSystem(edited, { hashes: true });
    expect(strict.codes).toEqual(['content-hash-mismatch']);
  });
});

describe('ds check: approval and content hashes', () => {
  it('reports an approval as declared, with a matching hash, and passes', async () => {
    const run = await check([await file('approved.json', approved()), '--json']);
    expect(run.code).toBe(0);
    const approval = run.json?.locked.approval;
    expect(approval).toMatchObject({
      status: 'approved',
      version: '1.2.0',
      approvedBy: 'design-review@example.com',
      approvedAt: '2026-11-09T12:00:00Z',
      matches: true,
    });
    expect(approval?.stored).toBe(approval?.contentHash);
    expect(run.json?.locked.entries).toEqual([
      expect.objectContaining({ id: 'primary-cta', status: 'approved', matches: true }),
    ]);
    const human = await check([await file('approved.json', approved())]);
    expect(human.text).toContain(
      'approval: approved (version 1.2.0, declared by design-review@example.com, at 2026-11-09T12:00:00Z)'
    );
    expect(human.text).toContain('matches the approval');
    expect(human.text).toContain('library primary-cta: approved, hash matches');
    expect(human.text).not.toMatch(/verified/i);
  });

  it('refuses a document edited after approval (content-hash-mismatch, exit 1)', async () => {
    const edited = { ...approved(), name: 'Harborline edited' };
    const run = await check([await file('edited.json', edited), '--json']);
    expect(run.code).toBe(1);
    expect(run.json?.codes).toEqual(['content-hash-mismatch']);
    expect(run.json?.errors[0]).toMatchObject({
      code: 'content-hash-mismatch',
      path: '$.approval.contentHash',
    });
    expect(run.json?.locked.approval.matches).toBe(false);
    const human = await check([await file('edited.json', edited)]);
    expect(human.text).toContain('content-hash-mismatch $.approval.contentHash');
    expect(human.text).toContain('does not match the approval');
  });

  it('refuses a library entry edited after its approval (library-hash-mismatch)', async () => {
    const doc = approved();
    const library = doc.library as Doc[];
    const edited = base({
      allow: doc.allow,
      library: [{ ...library[0], purpose: 'Changed after approval.' }],
    });
    const stamped = {
      ...edited,
      approval: { ...(doc.approval as Doc), contentHash: designSystemContentHash(edited) },
    };
    const run = await check([await file('entry.json', stamped), '--json']);
    expect(run.code).toBe(1);
    expect(run.json?.codes).toEqual(['library-hash-mismatch']);
    expect(run.json?.errors[0]?.path).toBe('$.library[0].approval.contentHash');
    // The document hash still matches: approving an entry never moves it.
    expect(run.json?.locked.approval.matches).toBe(true);
  });

  it('reports a draft without refusing it', async () => {
    const draft = base({ approval: { status: 'draft', version: '1.2.0' } });
    const run = await check([await file('draft.json', draft), '--json']);
    expect(run.code).toBe(0);
    expect(run.json?.locked.approval).toMatchObject({ status: 'draft', version: '1.2.0' });
    expect(run.json?.locked.approval).not.toHaveProperty('matches');
  });

  it('keeps the locked codes stable and the report total over hostile input', () => {
    expect([...DS_CHECK_LOCKED_CODES]).toEqual(['content-hash-mismatch', 'library-hash-mismatch']);
    for (const input of [null, 'x', 42, [], { approval: 'x', library: 'y', allow: [] }])
      expect(() => lockedReport(input, false)).not.toThrow();
    const long = lockedReport(
      base({ approval: { status: 'approved', version: '1.0.0', approvedBy: 'x'.repeat(5000) } }),
      false
    );
    expect(long.report.approval.approvedBy?.length).toBe(200);
  });
});

describe('ds hash', () => {
  it('prints the content hash the check compares, and exits 1 when a stored one differs', async () => {
    const out: string[] = [];
    const path = await file('approved.json', approved());
    await runDs(['hash', path], {
      stdout: { write: (chunk: string) => out.push(chunk) },
      stderr: { write: () => undefined },
    });
    expect(process.exitCode ?? 0).toBe(0);
    process.exitCode = undefined;
    const printed = JSON.parse(out.join('')) as { contentHash: string };
    const run = await check([path, '--json']);
    expect(printed.contentHash).toBe(run.json?.locked.approval.contentHash);
    await runDs(['hash', await file('edited.json', { ...approved(), name: 'Edited' })], {
      stdout: { write: () => undefined },
      stderr: { write: () => undefined },
    });
    expect(process.exitCode).toBe(1);
  });
});
