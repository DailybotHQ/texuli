// @vitest-environment node
/// <reference types="node" />
import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { type AddableComponent, addComponent, provenanceHeader } from '@texuli/tools/cli-add';
import {
  diffComponent,
  matchLines,
  merge3,
  parseProvenance,
  parseUpdateArgs,
  runUpdateCli,
  splitLines,
  type UpdateResult,
  unifiedDiff,
  updateComponent,
} from '@texuli/tools/cli-update';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { scenario } from './scenario.ts';

const temps: string[] = [];
/** Runs after every test and between the scenarios of a grouped test. */
const reset = async () => {
  vi.restoreAllMocks();
  await Promise.all(temps.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
};
afterEach(reset);

async function tempDir(prefix: string): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), prefix));
  temps.push(dir);
  return dir;
}

async function writeTree(root: string, files: Record<string, string>): Promise<void> {
  for (const [path, content] of Object.entries(files)) {
    await mkdir(dirname(join(root, path)), { recursive: true });
    await writeFile(join(root, path), content, 'utf8');
  }
}

const registry: readonly AddableComponent[] = [
  { id: 'button', package: 'texuli', directory: 'src/components/button' },
  { id: 'evil', package: 'primitives', directory: 'src/button' },
];
const DIR = 'packages/texuli/src/components/button';
const OUT = 'src/components/texuli/button';

const BUTTON_V1 = [
  '<script lang="ts">',
  "  let { label = 'Go' }: { label?: string } = $props();",
  '</script>',
  '',
  '<button type="button" class="tx-button">',
  '  {label}',
  '</button>',
  '',
].join('\n');

/** v1 and v2 of a styled button: v2 changes the markup, the CSS, drops old.ts and adds icon.ts. */
const V1 = {
  [`${DIR}/Button.svelte`]: BUTTON_V1,
  [`${DIR}/index.ts`]: "export { default as Button } from './Button.svelte';\n",
  [`${DIR}/button.css`]: '.tx-button {\n  color: inherit;\n}\n',
  [`${DIR}/old.ts`]: 'export const legacy = true;\n',
  [`${DIR}/notes.md`]: 'Button notes.\n',
};
const V2 = {
  [`${DIR}/Button.svelte`]: BUTTON_V1.replace(
    '  {label}\n',
    '  <span class="tx-button-label">{label}</span>\n'
  ),
  [`${DIR}/index.ts`]: "export { default as Button } from './Button.svelte';\n",
  [`${DIR}/button.css`]: '.tx-button {\n  color: inherit;\n  min-block-size: 2.5rem;\n}\n',
  [`${DIR}/icon.ts`]: 'export const icon = null;\n',
  [`${DIR}/notes.md`]: 'Button notes.\n',
};

/** A consumer app with v1 added, plus the v1 and v2 source roots. */
async function setup() {
  const base = await tempDir('texuli-update-v1-');
  const next = await tempDir('texuli-update-v2-');
  const app = await tempDir('texuli-update-app-');
  await writeTree(base, V1);
  await writeTree(next, V2);
  const added = await addComponent({
    id: 'button',
    cwd: app,
    sourceRoot: base,
    version: '0.1.0',
    registry,
  });
  expect(added.ok).toBe(true);
  const local = (path: string) => join(app, OUT, path);
  const read = (path: string) => readFile(local(path), 'utf8');
  const edit = async (path: string, change: (body: string) => string) => {
    await writeFile(local(path), change(await read(path)), 'utf8');
  };
  const options = {
    id: 'button',
    cwd: app,
    sourceRoot: next,
    baseRoot: base,
    version: '0.2.0',
    registry,
  };
  return { base, next, app, local, read, edit, options };
}

const statuses = (result: UpdateResult) =>
  Object.fromEntries(result.files.map((f) => [f.path, [f.status, f.action]]));

describe('line diff and merge', () => {
  it('line diff and merge: line splitting, LCS, region merges, conflicts and unified diffs', async () => {
    await scenario(
      'splits lines keeping their endings',
      async () => {
        expect(splitLines('a\nb\r\nc')).toEqual(['a\n', 'b\r\n', 'c']);
        expect(splitLines('')).toEqual([]);
      },
      reset
    );
    await scenario(
      'matches a longest common subsequence',
      async () => {
        const a = splitLines('a\nb\nc\nd\n');
        const b = splitLines('a\nx\nc\nd\ny\n');
        expect([...matchLines(a, b)]).toEqual([0, -1, 2, 3]);
        expect([...matchLines(splitLines('a\n'), [])]).toEqual([-1]);
      },
      reset
    );
    await scenario(
      'merges edits to different regions, and the same edit once',
      async () => {
        const base = 'one\ntwo\nthree\nfour\nfive\n';
        const local = 'ONE\ntwo\nthree\nfour\nfive\n';
        const upstream = 'one\ntwo\nthree\nfour\nFIVE\nsix\n';
        expect(merge3(base, local, upstream, labels)).toEqual({
          text: 'ONE\ntwo\nthree\nfour\nFIVE\nsix\n',
          conflicts: 0,
        });
        expect(merge3(base, local, local, labels)).toEqual({ text: local, conflicts: 0 });
        expect(merge3(base, base, upstream, labels).text).toBe(upstream);
        expect(merge3(base, local, base, labels).text).toBe(local);
      },
      reset
    );
    await scenario(
      'marks overlapping edits as a conflict with the base in between',
      async () => {
        const result = merge3('a\nb\nc\n', 'a\nmine\nc\n', 'a\ntheirs\nc\n', labels);
        expect(result).toEqual({
          text: 'a\n<<<<<<< local\nmine\n||||||| base 0.1.0\nb\n=======\ntheirs\n>>>>>>> texuli 0.2.0\nc\n',
          conflicts: 1,
        });
        // Different insertions at the same place conflict too; a missing final newline stays valid.
        const end = merge3('a', 'a\nx', 'a\ny', labels);
        expect(end.conflicts).toBe(1);
        expect(end.text.endsWith('>>>>>>> texuli 0.2.0\n')).toBe(true);
      },
      reset
    );
    await scenario(
      'writes a unified diff',
      async () => {
        expect(unifiedDiff('same\n', 'same\n', { from: 'a/x', to: 'b/x' })).toBe('');
        const before = Array.from({ length: 12 }, (_, i) => `l${i + 1}\n`).join('');
        const after = before.replace('l2\n', 'L2\n').replace('l11\n', '');
        expect(unifiedDiff(before, after, { from: 'a/f', to: 'b/f' })).toBe(
          [
            '--- a/f',
            '+++ b/f',
            '@@ -1,5 +1,5 @@',
            ' l1',
            '-l2',
            '+L2',
            ' l3',
            ' l4',
            ' l5',
            '@@ -8,5 +8,4 @@',
            ' l8',
            ' l9',
            ' l10',
            '-l11',
            ' l12',
            '',
          ].join('\n')
        );
        expect(unifiedDiff('a', 'b', { from: 'x', to: 'y' })).toContain(
          '\\ No newline at end of file'
        );
      },
      reset
    );
  });

  const labels = { local: 'local', base: 'base 0.1.0', upstream: 'texuli 0.2.0' };
});

describe('parseProvenance', () => {
  const meta = { id: 'button', package: 'texuli', version: '0.1.0', source: 'src/x/Button.svelte' };

  it('reads every header form texuli add writes', () => {
    for (const name of ['Button.svelte', 'index.ts', 'button.css', 'notes.md']) {
      const parsed = parseProvenance(`${provenanceHeader(meta, name)}body\n`);
      expect(parsed, name).toEqual({ meta, body: 'body\n' });
    }
  });

  it('returns null for files without an intact header', () => {
    expect(parseProvenance('export const a = 1;\n')).toBeNull();
    const edited = provenanceHeader(meta, 'index.ts').replace(' * id: button', ' * id = button');
    expect(parseProvenance(`${edited}body`)).toBeNull();
  });
});

it('reports each file and its diff, and writes nothing', async () => {
  const t = await setup();
  await t.edit('Button.svelte', (s) => s.replace("label = 'Go'", "label = 'Send'"));
  const before = await t.read('Button.svelte');
  const result = await diffComponent(t.options);
  expect(result).toMatchObject({
    ok: true,
    installedVersion: '0.1.0',
    version: '0.2.0',
    dryRun: true,
  });
  expect(statuses(result)).toEqual({
    'Button.svelte': ['merged', 'would-write'],
    'button.css': ['fast-forward', 'would-write'],
    'icon.ts': ['added', 'would-write'],
    'index.ts': ['unchanged', 'would-write'],
    'notes.md': ['unchanged', 'would-write'],
    'old.ts': ['removed', 'none'],
  });
  const button = result.files.find((f) => f.path === 'Button.svelte');
  expect(button?.diff).toContain('-  {label}\n+  <span class="tx-button-label">{label}</span>\n');
  expect(button?.diff).toContain('-  version: 0.1.0\n+  version: 0.2.0\n');
  expect(await t.read('Button.svelte')).toBe(before);
  expect(existsSync(t.local('icon.ts'))).toBe(false);
});

it('texuli update merges local edits, keeps local-only edits and deletions, and keeps files edited locally', async () => {
  await scenario(
    'merges local edits with the new source and restamps the version',
    async () => {
      const t = await setup();
      await t.edit('Button.svelte', (s) => s.replace("label = 'Go'", "label = 'Send'"));
      await writeFile(t.local('mine.ts'), 'export const mine = 1;\n', 'utf8');
      const result = await updateComponent(t.options);
      expect(result.ok).toBe(true);
      expect(result.conflicts).toBe(0);
      expect(statuses(result)['mine.ts']).toEqual(['untracked', 'none']);

      const button = await t.read('Button.svelte');
      expect(button).toContain("label = 'Send'");
      expect(button).toContain('<span class="tx-button-label">{label}</span>');
      expect(parseProvenance(button)?.meta).toEqual({
        id: 'button',
        package: 'texuli',
        version: '0.2.0',
        source: 'packages/texuli/src/components/button/Button.svelte',
      });
      expect(parseProvenance(await t.read('button.css'))?.body).toBe(V2[`${DIR}/button.css`]);
      expect(parseProvenance(await t.read('icon.ts'))?.body).toBe(V2[`${DIR}/icon.ts`]);
      expect(existsSync(t.local('old.ts'))).toBe(true);
      expect(await t.read('mine.ts')).toBe('export const mine = 1;\n');

      // Updating again is a no-op: everything is unchanged and nothing is written.
      const again = await updateComponent({ ...t.options, baseRoot: t.next, baseVersion: '0.2.0' });
      expect(again.files.filter((f) => f.action !== 'none').map((f) => f.path)).toEqual([]);
    },
    reset
  );
  await scenario(
    'keeps local-only edits, keeps local deletions and prunes on request',
    async () => {
      const t = await setup();
      await t.edit('index.ts', (s) => `${s}export const extra = 1;\n`);
      await rm(t.local('notes.md'));
      const result = await updateComponent({ ...t.options, prune: true });
      expect(statuses(result)).toMatchObject({
        'index.ts': ['kept-local', 'write'],
        'notes.md': ['deleted-locally', 'none'],
        'old.ts': ['removed', 'delete'],
      });
      expect(await t.read('index.ts')).toContain('export const extra = 1;');
      expect(existsSync(t.local('notes.md'))).toBe(false);
      expect(existsSync(t.local('old.ts'))).toBe(false);
    },
    reset
  );
  await scenario(
    'keeps a file removed upstream when it was edited locally',
    async () => {
      const t = await setup();
      await t.edit('old.ts', (s) => `${s}// still used\n`);
      const result = await updateComponent({ ...t.options, prune: true });
      expect(statuses(result)['old.ts']).toEqual(['removed-modified', 'none']);
      expect(existsSync(t.local('old.ts'))).toBe(true);
    },
    reset
  );
});

it('texuli update refuses conflicts, needs a matching base, installs fresh components and refuses unsafe input', async () => {
  await scenario(
    'refuses conflicts and writes nothing, or writes markers on request',
    async () => {
      const t = await setup();
      await t.edit('Button.svelte', (s) =>
        s.replace('  {label}\n', '  <strong>{label}</strong>\n')
      );
      const before = await t.read('Button.svelte');
      const refused = await updateComponent(t.options);
      expect(refused.ok).toBe(false);
      expect(refused.conflicts).toBe(1);
      expect(refused.errors.join('\n')).toContain('nothing was written');
      expect(refused.files.every((f) => f.action === 'none')).toBe(true);
      expect(await t.read('Button.svelte')).toBe(before);
      expect(existsSync(t.local('icon.ts'))).toBe(false);

      const marked = await updateComponent({ ...t.options, conflicts: 'markers' });
      expect(marked.ok).toBe(true);
      expect(statuses(marked)['Button.svelte']).toEqual(['conflict', 'write']);
      expect(await t.read('Button.svelte')).toContain(
        '<<<<<<< local\n  <strong>{label}</strong>\n||||||| base 0.1.0\n  {label}\n=======\n  <span class="tx-button-label">{label}</span>\n>>>>>>> texuli 0.2.0\n'
      );
    },
    reset
  );
  await scenario(
    'needs the base to merge, and checks its version',
    async () => {
      const t = await setup();
      const { baseRoot: _base, ...withoutBase } = t.options;
      const diff = await diffComponent(withoutBase);
      expect(diff.ok).toBe(true);
      expect(statuses(diff)['Button.svelte']).toEqual(['needs-base', 'none']);
      expect(statuses(diff)['index.ts']).toEqual(['unchanged', 'would-write']);
      const update = await updateComponent(withoutBase);
      expect(update.ok).toBe(false);
      expect(update.errors[0]).toContain('--base-root');

      const wrong = await updateComponent({ ...t.options, baseVersion: '0.0.9' });
      expect(wrong.errors).toEqual(['Installed version is 0.1.0, but the base root is 0.0.9.']);
    },
    reset
  );
  await scenario(
    'adds every file when the component is not installed yet',
    async () => {
      const t = await setup();
      await rm(join(t.app, OUT), { recursive: true });
      const result = await updateComponent(t.options);
      expect(result.installedVersion).toBeNull();
      expect(new Set(result.files.map((f) => f.status))).toEqual(new Set(['added']));
      expect(existsSync(t.local('Button.svelte'))).toBe(true);
    },
    reset
  );
  await scenario(
    'refuses unsafe paths, primitives and mixed versions',
    async () => {
      const t = await setup();
      expect((await updateComponent({ ...t.options, outDir: '../elsewhere' })).errors[0]).toContain(
        'escapes the project root'
      );
      expect((await updateComponent({ ...t.options, id: 'evil' })).errors[0]).toContain(
        'primitives'
      );
      expect((await updateComponent({ ...t.options, id: 'nope' })).errors[0]).toContain('Unknown');
      expect((await updateComponent({ ...t.options, sourceRoot: join(t.app, 'missing') })).ok).toBe(
        false
      );

      await t.edit('index.ts', (s) => s.replace('version: 0.1.0', 'version: 0.0.5'));
      expect((await updateComponent(t.options)).errors[0]).toContain('different versions');

      const outside = await tempDir('texuli-update-outside-');
      await rm(join(t.app, OUT), { recursive: true });
      await symlink(outside, join(t.app, OUT));
      const linked = await updateComponent(t.options);
      expect(linked.ok).toBe(false);
      expect(existsSync(join(outside, 'Button.svelte'))).toBe(false);
    },
    reset
  );
});

it('provenance source after update stays plain and header-safe', async () => {
  await scenario(
    'stamps a plain relative source when the source roots are symlinks',
    async () => {
      const t = await setup();
      const links = await tempDir('texuli-update-links-');
      await symlink(t.next, join(links, 'next'));
      await symlink(t.base, join(links, 'base'));
      const result = await updateComponent({
        ...t.options,
        sourceRoot: join(links, 'next'),
        baseRoot: join(links, 'base'),
      });
      expect(result.ok).toBe(true);
      for (const name of ['Button.svelte', 'button.css', 'icon.ts', 'index.ts']) {
        const source = parseProvenance(await t.read(name))?.meta.source;
        expect(source, name).toBe(`packages/texuli/src/components/button/${name}`);
        expect(source?.split('/')).not.toContain('..');
      }
    },
    reset
  );
  await scenario(
    'refuses a new source file whose name would break the header',
    async () => {
      const t = await setup();
      await writeFile(join(t.next, DIR, 'bad\nversion: 9.ts'), 'export {};\n', 'utf8');
      const result = await updateComponent(t.options);
      expect(result.ok).toBe(false);
      expect(result.errors[0]).toContain('plain relative path');
    },
    reset
  );
});

it('the diff/update CLI parses commands and runs diff with JSON and exit codes', async () => {
  await scenario(
    'parses commands and options',
    async () => {
      expect(
        parseUpdateArgs(
          ['update', 'button', '--base-root', 'v1', '--conflicts', 'markers', '--prune'],
          {
            cwd: '/app',
          }
        )
      ).toMatchObject({
        command: 'update',
        id: 'button',
        cwd: '/app',
        sourceRoot: '/app',
        baseRoot: 'v1',
        conflicts: 'markers',
        prune: true,
      });
      expect(() => parseUpdateArgs(['merge', 'button'])).toThrow('Unknown command');
      expect(() => parseUpdateArgs(['diff', 'button', '--conflicts', 'ours'])).toThrow(
        'refuse or markers'
      );
    },
    reset
  );
  await scenario(
    'runs diff with --json and returns exit codes',
    async () => {
      const t = await setup();
      const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
      vi.spyOn(console, 'error').mockImplementation(() => undefined);
      // The built-in registry knows `button` at the same directory as the fixture.
      const code = await runUpdateCli(
        [
          'diff',
          'button',
          '--cwd',
          t.app,
          '--source-root',
          t.next,
          '--base-root',
          t.base,
          '--json',
        ],
        {}
      );
      expect(code).toBe(0);
      const result = JSON.parse(String(log.mock.calls.at(-1)?.[0])) as UpdateResult;
      expect(result.dryRun).toBe(true);
      expect(result.files.find((f) => f.path === 'button.css')?.status).toBe('fast-forward');
      expect(await runUpdateCli(['update'], {})).toBe(1);
    },
    reset
  );
});
