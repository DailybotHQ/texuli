/**
 * ADR-032 for agents: the create-design-system prompt's locked flow, the
 * `ds.allow` operation, and `ds.save` refusing anything marked approved
 * (approval stays human; only `texuli ds approve` may write it).
 */
import { mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { runDs } from '../src/cli/ds.ts';
import { MINIMAL_PRESET_IDS } from '../src/ds-create/index.ts';
import { localFiles } from '../src/internal/local-write.ts';
import { createDesignSystemPrompt } from '../src/mcp/prompts.ts';
import { loadOpsCatalog } from '../src/ops/catalog.ts';
import { approvalMarks } from '../src/ops/design-system-run.ts';
import { LOCAL_RUNTIMES, texuliOps } from '../src/ops/index.ts';

/** An operation's output, read loosely to assert on nested fields (test-only). */
// biome-ignore lint/suspicious/noExplicitAny: assertions reach into operation output
type Loose = Record<string, any>;

let dir: string | undefined;
async function scratch(): Promise<string> {
  dir = await realpath(await mkdtemp(join(tmpdir(), 'texuli-ds-create-mcp-')));
  return dir;
}
afterEach(async () => {
  process.exitCode = undefined;
  if (dir) await rm(dir, { recursive: true, force: true });
  dir = undefined;
});

const text = (args: Record<string, string>) =>
  createDesignSystemPrompt.render(args).messages[0]?.content.text as string;

async function op(name: string, input: unknown, cwd?: string) {
  const result = await texuliOps.invoke(name, input, {
    runtimes: LOCAL_RUNTIMES,
    ...(cwd ? { files: localFiles({ cwd }) } : {}),
  });
  if (!result.ok) throw new Error(`${name}: ${result.error.message}`);
  return result.output as Loose;
}

/** What an agent following the locked prompt produces: suggestion + ds.allow + a draft library and approval. */
async function agentDraft(preset: 'minimal' | 'all' = 'minimal') {
  const suggested = await op('ds.suggest', {
    seed: '#0e7490',
    id: 'example-co',
    name: 'Example Co.',
  });
  const { allow } = await op('ds.allow', { preset });
  return {
    ...suggested.document,
    allow,
    library: [
      {
        id: 'pricing-card',
        name: 'Pricing card',
        purpose: 'One plan with its price and a call to action.',
        version: '0.1.0',
        status: 'draft',
        composes: ['card', 'button', 'badge'],
      },
    ],
    approval: { status: 'draft', version: suggested.document.version },
  };
}

describe('the create-design-system prompt, locked', () => {
  it('keeps the unlocked prompt as it was and declares the locked argument', () => {
    const plain = text({ brief: 'Example Co.: teal #0e7490' });
    expect(plain).not.toContain('ds.allow');
    expect(plain).toMatch(/\n4\. Validate\./u);
    expect(createDesignSystemPrompt.arguments.find((arg) => arg.name === 'locked')).toMatchObject({
      enum: ['minimal', 'all', 'custom'],
    });
  });

  it('walks the agent through ds.allow, a draft library and a draft approval, and keeps approval human', () => {
    for (const locked of ['minimal', 'all', 'custom']) {
      const body = text({ brief: 'Example Co.: teal #0e7490', locked });
      expect(body, locked).toContain('ds.allow');
      if (locked === 'custom') expect(body).toContain('"components"');
      else expect(body).toContain(`"preset": "${locked}"`);
      expect(body).toContain('"library"');
      expect(body).toContain('"status": "draft"');
      expect(body).toContain('"approval": { "status": "draft"');
      expect(body).toMatch(/Never set "status": "approved"/u);
      expect(body).toContain('approval-human-only');
      expect(body).toContain('texuli ds approve');
      expect(body).toMatch(/cannot prove who approved/u);
      // The steps renumber: lock 4, approval 5, then validate 6, check 7, deliver 8.
      expect(body).toMatch(
        /\n4\. Lock it\.[\s\S]*\n5\. Approval stays human\.[\s\S]*\n6\. Validate\.[\s\S]*\n7\. Check\.[\s\S]*\n8\. Deliver/u
      );
      // Every tool the prompt names exists.
      for (const tool of body.match(/`([a-z]+\.[a-z]+)`/gu) ?? [])
        expect(texuliOps.get(tool.slice(1, -1)), tool).toBeDefined();
    }
  });
});

describe('ds.allow', () => {
  it('returns the minimal and all presets from the catalog', async () => {
    const catalog = await loadOpsCatalog();
    const minimal = await op('ds.allow', {});
    expect(Object.keys(minimal.allow).sort()).toEqual([...MINIMAL_PRESET_IDS].sort());
    expect(minimal).toMatchObject({
      count: MINIMAL_PRESET_IDS.length,
      unknown: [],
      minimal: [...MINIMAL_PRESET_IDS],
    });
    const all = await op('ds.allow', { preset: 'all' });
    expect(all.count).toBe(catalog.catalog.entries.length);
  });

  it('returns the named components and reports unknown ids', async () => {
    const named = await op('ds.allow', { components: ['card', 'button', 'nope', 'card'] });
    expect(Object.keys(named.allow)).toEqual(['button', 'card']);
    expect(named.unknown).toEqual(['nope']);
    const refused = await texuliOps.invoke(
      'ds.allow',
      { preset: 'everything' },
      { runtimes: LOCAL_RUNTIMES }
    );
    expect(refused.ok).toBe(false);
  });

  it('is an edge operation, read only', () => {
    const operation = texuliOps.get('ds.allow');
    expect(operation).toMatchObject({ runtime: 'edge', annotations: { readOnly: true } });
  });
});

describe('an agent produces a valid draft and cannot mark it approved', () => {
  it('validates the draft locked document an agent builds from the prompt', async () => {
    for (const preset of ['minimal', 'all'] as const) {
      const draft = await agentDraft(preset);
      const verdict = await op('ds.validate', { document: draft });
      expect(verdict, preset).toMatchObject({ valid: true, errors: [] });
      expect(approvalMarks(draft)).toEqual([]);
    }
  });

  it('saves the draft, and refuses every approved mark through ds.save', async () => {
    const cwd = await scratch();
    const draft = await agentDraft();
    const saved = await op('ds.save', { path: 'example-co.ds.json', document: draft }, cwd);
    expect(saved).toMatchObject({ saved: true, errors: [] });
    expect(JSON.parse(await readFile(join(cwd, 'example-co.ds.json'), 'utf8'))).toEqual(draft);

    const approvedDoc = { ...draft, approval: { status: 'approved', version: draft.version } };
    const approvedEntry = { ...draft, library: [{ ...draft.library[0], status: 'approved' }] };
    const approvedEntryApproval = {
      ...draft,
      library: [{ ...draft.library[0], approval: { status: 'approved', version: '0.1.0' } }],
    };
    for (const [document, path] of [
      [approvedDoc, '$.approval.status'],
      [approvedEntry, '$.library[0].status'],
      [approvedEntryApproval, '$.library[0].approval.status'],
    ] as const) {
      for (const dryRun of [true, false]) {
        const refused = await op(
          'ds.save',
          { path: 'approved.ds.json', document, dryRun, overwrite: true },
          cwd
        );
        expect(refused, path).toMatchObject({
          saved: false,
          errors: [{ code: 'approval-human-only', path }],
        });
      }
    }
    await expect(readFile(join(cwd, 'approved.ds.json'), 'utf8')).rejects.toThrow();
  });

  it('leaves texuli ds approve as the one door that writes an approval', async () => {
    const cwd = await scratch();
    const draft = await agentDraft();
    await writeFile(join(cwd, 'example-co.ds.json'), JSON.stringify(draft));
    const out: string[] = [];
    const result = await runDs(['approve', 'example-co.ds.json', '--by', 'Design reviewer'], {
      cwd,
      stdout: { write: (chunk: string) => out.push(chunk) },
      stderr: { write: () => true },
    });
    expect(result.ok, out.join('')).toBe(true);
    const approved = JSON.parse(await readFile(join(cwd, 'example-co.ds.json'), 'utf8'));
    expect(approved.approval).toMatchObject({ status: 'approved', approvedBy: 'Design reviewer' });
    // The MCP path (no approve option) still cannot write that file back.
    const back = await op(
      'ds.save',
      { path: 'example-co.ds.json', document: approved, overwrite: true },
      cwd
    );
    expect(back.errors.map((issue: { code: string }) => issue.code)).toEqual([
      'approval-human-only',
    ]);
  });
});
