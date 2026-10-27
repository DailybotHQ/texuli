/// <reference types="node" />
import { mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import { isMainModule } from '../src/cli-add/cli.ts';
import {
  type AddableComponent,
  addComponent,
  getAddable,
  hasProvenance,
  isPlainSourcePath,
  isPrimitivesPath,
  listAddableIds,
  parseAddArgs,
  planAdd,
  provenanceHeader,
  provenanceSource,
  runAddCli,
  validateRegistryEntry,
} from '../src/cli-add/index.ts';

const temps: string[] = [];

afterEach(async () => {
  await Promise.all(temps.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe('CLI entry detection', () => {
  it('normalizes a pnpm shim entry path containing a parent segment', () => {
    const previous = process.argv[1];
    process.argv[1] = `${process.cwd()}/packages/tools/src/cli-add/../cli-add/cli.ts`;
    try {
      const moduleUrl = pathToFileURL(resolve('packages/tools/src/cli-add/cli.ts')).href;
      expect(isMainModule(moduleUrl)).toBe(true);
    } finally {
      if (previous === undefined) delete process.argv[1];
      else process.argv[1] = previous;
    }
  });
});

async function tempDir(prefix: string): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), prefix));
  temps.push(dir);
  return dir;
}

/** Mini monorepo fixture: one styled button, one primitives trap. */
async function makeSourceRoot(): Promise<string> {
  const root = await tempDir('texuli-add-src-');
  const buttonDir = join(root, 'packages', 'texuli', 'src', 'components', 'button');
  await mkdir(buttonDir, { recursive: true });
  await writeFile(
    join(buttonDir, 'Button.svelte'),
    `<script lang="ts">\n  let { label = 'Go' }: { label?: string } = $props();\n</script>\n<button type="button">{label}</button>\n`,
    'utf8'
  );
  await writeFile(
    join(buttonDir, 'index.ts'),
    `export { default as Button } from './Button.svelte';\n`,
    'utf8'
  );
  await writeFile(join(buttonDir, 'button.css'), `.tx-button { color: inherit; }\n`, 'utf8');

  const primDir = join(root, 'packages', 'primitives', 'src', 'button');
  await mkdir(primDir, { recursive: true });
  await writeFile(
    join(primDir, 'Root.svelte'),
    `<button type="button"><slot /></button>\n`,
    'utf8'
  );

  return root;
}

const fixtureRegistry: readonly AddableComponent[] = [
  {
    id: 'button',
    package: 'texuli',
    directory: 'src/components/button',
    peers: ['texuli/cx'],
  },
  {
    id: 'evil-primitive',
    package: 'primitives',
    directory: 'src/button',
  },
];

describe('registry', () => {
  it('lists styled addables and looks up by id', () => {
    const ids = listAddableIds();
    expect(ids).toContain('button');
    expect(ids).toContain('card');
    expect(ids).not.toContain('dialog-root');
    expect(getAddable('button')?.package).toBe('texuli');
    expect(getAddable('nope')).toBeUndefined();
  });

  it('detects primitives paths', () => {
    expect(isPrimitivesPath('/repo/packages/primitives/src/dialog/Root.svelte')).toBe(true);
    expect(isPrimitivesPath('/repo/packages/texuli/src/components/button/Button.svelte')).toBe(
      false
    );
  });
});

describe('provenance', () => {
  it('stamps svelte, ts and css headers', () => {
    const meta = {
      id: 'button',
      package: 'texuli',
      version: '1.2.3',
      source: 'packages/texuli/src/components/button/Button.svelte',
    };
    expect(provenanceHeader(meta, 'Button.svelte')).toContain('<!--');
    expect(provenanceHeader(meta, 'Button.svelte')).toContain('@texuli/add');
    expect(provenanceHeader(meta, 'index.ts')).toContain('/**');
    expect(provenanceHeader(meta, 'button.css')).toContain('version: 1.2.3');
    expect(hasProvenance(`${provenanceHeader(meta, 'index.ts')}export {}`)).toBe(true);
  });
});

describe('parseAddArgs', () => {
  it('parses flags and the component id', () => {
    const args = parseAddArgs(
      [
        'add',
        'button',
        '--cwd',
        '/app',
        '--source-root',
        '/repo',
        '--json',
        '--dry-run',
        '--force',
      ],
      { cwd: '/default', sourceRoot: '/default' }
    );
    expect(args.id).toBe('button');
    expect(args.cwd).toBe('/app');
    expect(args.sourceRoot).toBe('/repo');
    expect(args.json).toBe(true);
    expect(args.dryRun).toBe(true);
    expect(args.force).toBe(true);
  });

  it('rejects unknown flags', () => {
    expect(() => parseAddArgs(['button', '--nope'])).toThrow(/Unknown option/);
  });
});

describe('addComponent', () => {
  it('copies styled source with provenance and refuses primitives', async () => {
    const sourceRoot = await makeSourceRoot();
    const cwd = await tempDir('texuli-add-app-');

    const refused = await addComponent({
      id: 'evil-primitive',
      cwd,
      sourceRoot,
      registry: fixtureRegistry,
    });
    expect(refused.ok).toBe(false);
    expect(refused.errors.join(' ')).toMatch(/primitives/i);

    const unknown = await addComponent({
      id: 'no-such',
      cwd,
      sourceRoot,
      registry: fixtureRegistry,
    });
    expect(unknown.ok).toBe(false);

    const dry = await addComponent({
      id: 'button',
      cwd,
      sourceRoot,
      registry: fixtureRegistry,
      dryRun: true,
      version: '0.1.0',
    });
    expect(dry.ok).toBe(true);
    expect(dry.dryRun).toBe(true);
    expect(dry.files.every((f) => f.action === 'would-write')).toBe(true);

    const written = await addComponent({
      id: 'button',
      cwd,
      sourceRoot,
      registry: fixtureRegistry,
      version: '0.1.0',
    });
    expect(written.ok).toBe(true);
    expect(written.files.length).toBe(3);

    const svelte = await readFile(join(cwd, 'src/components/texuli/button/Button.svelte'), 'utf8');
    expect(svelte.startsWith('<!--')).toBe(true);
    expect(svelte).toContain('@texuli/add');
    expect(svelte).toContain('id: button');
    expect(svelte).toContain('version: 0.1.0');
    expect(svelte).toContain('<button type="button">');

    const index = await readFile(join(cwd, 'src/components/texuli/button/index.ts'), 'utf8');
    expect(index.startsWith('/**')).toBe(true);
    expect(index).toContain('export { default as Button }');

    const again = await addComponent({
      id: 'button',
      cwd,
      sourceRoot,
      registry: fixtureRegistry,
    });
    expect(again.ok).toBe(false);
    expect(again.errors.join(' ')).toMatch(/overwrite/i);

    const forced = await addComponent({
      id: 'button',
      cwd,
      sourceRoot,
      registry: fixtureRegistry,
      force: true,
    });
    expect(forced.ok).toBe(true);
  });

  it('planAdd reports missing source roots', async () => {
    const { result } = await planAdd({
      id: 'button',
      cwd: await tempDir('texuli-add-empty-'),
      sourceRoot: join(tmpdir(), 'texuli-add-missing-root-xyz'),
      registry: fixtureRegistry,
    });
    expect(result.ok).toBe(false);
    expect(result.errors[0]).toMatch(/does not exist/);
  });
});

describe('path containment', () => {
  it('refuses ../ outDir', async () => {
    const sourceRoot = await makeSourceRoot();
    const cwd = await tempDir('texuli-add-out-');
    const result = await addComponent({
      id: 'button',
      cwd,
      sourceRoot,
      registry: fixtureRegistry,
      outDir: '../escape',
    });
    expect(result.ok).toBe(false);
    expect(result.errors.join(' ')).toMatch(/escapes the project root/);
  });

  it('refuses absolute outDir', async () => {
    const sourceRoot = await makeSourceRoot();
    const cwd = await tempDir('texuli-add-abs-');
    const result = await addComponent({
      id: 'button',
      cwd,
      sourceRoot,
      registry: fixtureRegistry,
      outDir: join(tmpdir(), 'texuli-add-absolute-out'),
    });
    expect(result.ok).toBe(false);
    expect(result.errors.join(' ')).toMatch(/absolute path/i);
  });

  it('refuses a symlinked destination file even with --force', async () => {
    const sourceRoot = await makeSourceRoot();
    const cwd = await tempDir('texuli-add-sl-file-');
    const outDir = join(cwd, 'src', 'components', 'texuli', 'button');
    await mkdir(outDir, { recursive: true });
    const outside = join(cwd, 'secret.txt');
    await writeFile(outside, 'secret\n', 'utf8');
    await symlink(outside, join(outDir, 'Button.svelte'));

    const result = await addComponent({
      id: 'button',
      cwd,
      sourceRoot,
      registry: fixtureRegistry,
      force: true,
    });
    expect(result.ok).toBe(false);
    expect(result.errors.join(' ')).toMatch(/symlink/i);
    expect(await readFile(outside, 'utf8')).toBe('secret\n');
  });

  it('refuses a symlinked parent directory even with --force', async () => {
    const sourceRoot = await makeSourceRoot();
    const cwd = await tempDir('texuli-add-sl-parent-');
    const realParent = join(cwd, 'real-components');
    await mkdir(realParent, { recursive: true });
    const linkParent = join(cwd, 'src', 'components');
    await mkdir(join(cwd, 'src'), { recursive: true });
    await symlink(realParent, linkParent);

    const result = await addComponent({
      id: 'button',
      cwd,
      sourceRoot,
      registry: fixtureRegistry,
      force: true,
    });
    expect(result.ok).toBe(false);
    expect(result.errors.join(' ')).toMatch(/symlink/i);
  });

  it("refuses registry directory with '..' segments", async () => {
    const sourceRoot = await makeSourceRoot();
    const cwd = await tempDir('texuli-add-reg-dot-');
    const bad: AddableComponent = {
      id: 'button',
      package: 'texuli',
      directory: 'src/components/../../primitives/src/button',
    };
    expect(validateRegistryEntry(bad).ok).toBe(false);
    const result = await addComponent({
      id: 'button',
      cwd,
      sourceRoot,
      registry: [bad],
    });
    expect(result.ok).toBe(false);
    expect(result.errors.join(' ')).toMatch(/\.\./);
  });

  it('refuses absolute registry directory', async () => {
    const sourceRoot = await makeSourceRoot();
    const cwd = await tempDir('texuli-add-reg-abs-');
    const bad: AddableComponent = {
      id: 'button',
      package: 'texuli',
      directory: join(sourceRoot, 'packages', 'texuli', 'src', 'components', 'button'),
    };
    expect(validateRegistryEntry(bad).ok).toBe(false);
    const result = await addComponent({
      id: 'button',
      cwd,
      sourceRoot,
      registry: [bad],
    });
    expect(result.ok).toBe(false);
    expect(result.errors.join(' ')).toMatch(/absolute/i);
  });
});

describe('runAddCli', () => {
  it('prints json and supports --list', async () => {
    const sourceRoot = await makeSourceRoot();
    const cwd = await tempDir('texuli-add-cli-');

    const logs: string[] = [];
    const errors: string[] = [];
    const originalLog = console.log;
    const originalError = console.error;
    console.log = (message?: unknown) => {
      logs.push(String(message));
    };
    console.error = (message?: unknown) => {
      errors.push(String(message));
    };

    try {
      const listCode = await runAddCli(['--list', '--json'], { cwd, sourceRoot });
      expect(listCode).toBe(0);
      const listed = JSON.parse(logs.at(-1) ?? '{}') as { ids: string[] };
      expect(listed.ids).toContain('button');

      logs.length = 0;
      const code = await runAddCli(
        ['button', '--cwd', cwd, '--source-root', sourceRoot, '--json', '--version', '9.9.9'],
        { cwd, sourceRoot }
      );
      // CLI uses the default registry; button exists there, but source is the fixture —
      // default registry points at the same relative path, so it works with our fixture.
      expect(code).toBe(0);
      const payload = JSON.parse(logs.at(-1) ?? '{}') as {
        ok: boolean;
        id: string;
        files: unknown[];
      };
      expect(payload.ok).toBe(true);
      expect(payload.id).toBe('button');
      expect(payload.files.length).toBeGreaterThan(0);

      const missing = await runAddCli(['not-a-component', '--json'], { cwd, sourceRoot });
      expect(missing).toBe(1);
    } finally {
      console.log = originalLog;
      console.error = originalError;
    }
  });
});

describe('provenance source paths', () => {
  it('accepts only plain relative paths inside the root', () => {
    expect(provenanceSource('packages/texuli/src/components/button', 'Button.svelte')).toBe(
      'packages/texuli/src/components/button/Button.svelte'
    );
    for (const [dir, file] of [
      ['../../private/var/x/packages/texuli', 'a.ts'],
      ['/abs/packages', 'a.ts'],
      ['C:/repo', 'a.ts'],
      ['packages/./texuli', 'a.ts'],
      ['packages//texuli', 'a.ts'],
      ['packages\\texuli', 'a.ts'],
      ['packages/texuli', 'a\nversion: 9.9.9'],
      ['packages/texuli', 'a */ b.ts'],
      ['packages/texuli', 'a --> b.svelte'],
      ['', ''],
    ] as const) {
      expect(provenanceSource(dir, file), `${dir}/${file}`).toBeNull();
    }
    expect(isPlainSourcePath('a/b.ts')).toBe(true);
  });

  it('stamps the source relative to the real root when the root is a symlink', async () => {
    const real = await makeSourceRoot();
    const links = await tempDir('texuli-add-link-');
    const linkedRoot = join(links, 'texuli-src');
    await symlink(real, linkedRoot);
    const cwd = await tempDir('texuli-add-app-');
    const result = await addComponent({
      id: 'button',
      cwd,
      sourceRoot: linkedRoot,
      registry: fixtureRegistry,
    });
    expect(result.ok).toBe(true);
    for (const name of ['Button.svelte', 'index.ts', 'button.css']) {
      const text = await readFile(join(cwd, 'src/components/texuli/button', name), 'utf8');
      const source = /source: (.*)\n/.exec(text)?.[1];
      expect(source, name).toBe(`packages/texuli/src/components/button/${name}`);
      expect(source?.split('/')).not.toContain('..');
      expect(text).not.toContain(real);
    }
  });

  it('refuses a source file whose name would break the header', async () => {
    const root = await makeSourceRoot();
    await writeFile(
      join(root, 'packages/texuli/src/components/button/evil-->x.svelte'),
      'export {};\n',
      'utf8'
    );
    const cwd = await tempDir('texuli-add-app-');
    const result = await addComponent({
      id: 'button',
      cwd,
      sourceRoot: root,
      registry: fixtureRegistry,
    });
    expect(result.ok).toBe(false);
    expect(result.errors[0]).toContain('plain relative path');
  });
});

describe('triple-slash directives', () => {
  it('sit above every statement in the tools sources (TypeScript ignores them otherwise)', async () => {
    const { readdir } = await import('node:fs/promises');
    const root = resolve(import.meta.dirname, '../src');
    const entries = await readdir(root, { recursive: true });
    const misplaced: string[] = [];
    for (const entry of entries) {
      if (!entry.endsWith('.ts')) continue;
      const lines = (await readFile(join(root, entry), 'utf8')).split('\n');
      let seenStatement = false;
      for (const line of lines) {
        const text = line.trim();
        if (text.startsWith('/// <reference')) {
          if (seenStatement) misplaced.push(entry);
          continue;
        }
        if (text === '' || text.startsWith('//') || text.startsWith('#!')) continue;
        seenStatement = true;
      }
    }
    expect(misplaced).toEqual([]);
  });
});
