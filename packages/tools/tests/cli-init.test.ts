// @vitest-environment node
/// <reference types="node" />
import { cp, mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import {
  applyProjectTheme,
  CONFIG_FILE,
  CSS_HEADER,
  detectFramework,
  documentTheme,
  importSpecifier,
  initProject,
  listThemes,
  parseConfig,
  parseInitArgs,
  previewTheme,
  projectPathError,
  runInitCli,
  withCssImport,
  withDocumentWiring,
} from '../src/cli-init/index.ts';
import { scenario } from './scenario.ts';

const FIXTURES = fileURLToPath(new URL('./fixtures/cli-init/', import.meta.url));
const temps: string[] = [];
/** Runs after every test and between the scenarios of a grouped test. */
const reset = async () => {
  await Promise.all(temps.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
};
afterEach(reset);

async function tempDir(prefix = 'texuli-init-'): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), prefix));
  temps.push(dir);
  return dir;
}

/** A fresh copy of one fixture project. */
async function fixture(name: 'vite' | 'astro' | 'sveltekit'): Promise<string> {
  const dir = await tempDir(`texuli-init-${name}-`);
  await cp(join(FIXTURES, name), dir, { recursive: true });
  return dir;
}

const read = (dir: string, rel: string) => readFile(join(dir, rel), 'utf8');
const actions = (result: { files: { path: string; action: string }[] }) =>
  Object.fromEntries(result.files.map((file) => [file.path, file.action]));

it('finds SvelteKit before Astro before Vite, in any dependency field', () => {
  expect(detectFramework({ devDependencies: { vite: '1', '@sveltejs/kit': '2' } })).toBe(
    'sveltekit'
  );
  expect(detectFramework({ dependencies: { astro: '7' } })).toBe('astro');
  expect(detectFramework({ peerDependencies: { vite: '8' } })).toBe('vite');
  expect(detectFramework({ dependencies: { react: '19' } })).toBeNull();
  expect(detectFramework(null)).toBeNull();
});

describe('texuli init', () => {
  it('texuli init wires Vite idempotently and writes nothing in a dry run', async () => {
    await scenario(
      'wires a Vite project: stylesheet, entry import, no-flash document, config',
      async () => {
        const dir = await fixture('vite');
        const result = await initProject({ cwd: dir });
        expect(result.errors).toEqual([]);
        expect(actions(result)).toEqual({
          'src/texuli.css': 'create',
          'src/main.ts': 'update',
          'index.html': 'update',
          [CONFIG_FILE]: 'create',
        });
        const css = await read(dir, 'src/texuli.css');
        expect(css.startsWith(CSS_HEADER)).toBe(true);
        expect(css).toContain("@import '@texuli/tokens/base.css';");
        expect(css).toContain("[data-tx-theme='enterprise-neutral'][data-tx-mode='dark']");
        expect((await read(dir, 'src/main.ts')).split('\n')[0]).toBe("import './texuli.css';");
        const html = await read(dir, 'index.html');
        expect(documentTheme(html)).toBe('enterprise-neutral');
        // The bootstrap is the first thing in <head>, before any stylesheet.
        expect(html.indexOf('<!-- texuli:no-flash -->')).toBeLessThan(
          html.indexOf('<meta charset')
        );
        expect(html).toContain('texuli.app.appearance');
        expect(JSON.parse(await read(dir, CONFIG_FILE))).toEqual({
          framework: 'vite',
          css: 'src/texuli.css',
          entry: 'src/main.ts',
          document: 'index.html',
          theme: 'enterprise-neutral',
          namespace: 'app',
        });
      },
      reset
    );
    await scenario(
      'is idempotent: a second run changes nothing',
      async () => {
        const dir = await fixture('vite');
        await initProject({ cwd: dir });
        const before = await read(dir, 'index.html');
        const again = await initProject({ cwd: dir });
        expect(again.ok).toBe(true);
        expect(new Set(again.files.map((file) => file.action))).toEqual(new Set(['unchanged']));
        expect(await read(dir, 'index.html')).toBe(before);
        expect((await read(dir, 'src/main.ts')).match(/texuli\.css/g)).toHaveLength(1);
      },
      reset
    );
    await scenario(
      'writes nothing in a dry run',
      async () => {
        const dir = await fixture('vite');
        const result = await initProject({ cwd: dir, dryRun: true });
        expect(result.ok).toBe(true);
        expect(actions(result)['src/texuli.css']).toBe('create');
        await expect(read(dir, 'src/texuli.css')).rejects.toThrow();
        await expect(read(dir, CONFIG_FILE)).rejects.toThrow();
      },
      reset
    );
  });

  it('texuli init wires SvelteKit, Astro, an explicit framework and a custom stylesheet', async () => {
    await scenario(
      'wires SvelteKit: creates the root layout and keeps app.html placeholders',
      async () => {
        const dir = await fixture('sveltekit');
        const result = await initProject({ cwd: dir, theme: 'ocean', namespace: 'billing' });
        expect(result.errors).toEqual([]);
        expect(actions(result)['src/routes/+layout.svelte']).toBe('create');
        const layout = await read(dir, 'src/routes/+layout.svelte');
        expect(layout).toContain("import '../texuli.css';");
        expect(layout).toContain('{@render children()}');
        const app = await read(dir, 'src/app.html');
        expect(app).toContain('%sveltekit.head%');
        expect(app).toContain('%sveltekit.body%');
        expect(documentTheme(app)).toBe('ocean');
        expect(app).toContain('texuli.billing.appearance');
        expect(await read(dir, 'src/texuli.css')).toContain("[data-tx-theme='ocean']");
      },
      reset
    );
    await scenario(
      'wires Astro: import in the layout frontmatter and an inline bootstrap',
      async () => {
        const dir = await fixture('astro');
        const result = await initProject({ cwd: dir });
        expect(result.errors).toEqual([]);
        expect(actions(result)).toEqual({
          'src/styles/texuli.css': 'create',
          'src/layouts/Layout.astro': 'update',
          [CONFIG_FILE]: 'create',
        });
        const layout = await read(dir, 'src/layouts/Layout.astro');
        expect(layout.split('\n').slice(0, 2)).toEqual(['---', "import '../styles/texuli.css';"]);
        expect(layout).toContain('<script is:inline>');
        expect(documentTheme(layout)).toBe('enterprise-neutral');
        expect(layout).toContain('{title}');
        expect(
          (await initProject({ cwd: dir })).files.every((file) => file.action === 'unchanged')
        ).toBe(true);
      },
      reset
    );
    await scenario(
      'takes an explicit framework and a custom stylesheet path',
      async () => {
        const dir = await tempDir();
        const result = await initProject({
          cwd: dir,
          framework: 'vite',
          css: 'styles/app-theme.css',
        });
        expect(result.errors).toEqual([]);
        expect(await read(dir, 'src/main.ts')).toBe("import '../styles/app-theme.css';\n");
        expect(result.notes.join(' ')).toContain('index.html');
      },
      reset
    );
  });

  it('texuli init refuses a foreign stylesheet, a broken config and unknown projects, themes and ids', async () => {
    await scenario(
      'refuses to replace a stylesheet it did not generate, unless forced',
      async () => {
        const dir = await fixture('vite');
        await writeFile(join(dir, 'src/texuli.css'), 'body { color: red; }\n');
        const refused = await initProject({ cwd: dir });
        expect(refused.ok).toBe(false);
        expect(refused.errors[0]).toContain('--force');
        expect(await read(dir, 'src/texuli.css')).toBe('body { color: red; }\n');
        expect((await initProject({ cwd: dir, force: true })).ok).toBe(true);
        expect((await read(dir, 'src/texuli.css')).startsWith(CSS_HEADER)).toBe(true);
      },
      reset
    );
    await scenario(
      'refuses a broken config unless forced',
      async () => {
        const dir = await fixture('vite');
        await writeFile(join(dir, CONFIG_FILE), '{"framework":"vite","css":"../x.css"}');
        expect((await initProject({ cwd: dir })).errors[0]).toContain(CONFIG_FILE);
        expect((await initProject({ cwd: dir, force: true })).ok).toBe(true);
      },
      reset
    );
    await scenario(
      'refuses unknown projects, themes and ids',
      async () => {
        const empty = await tempDir();
        expect((await initProject({ cwd: empty })).errors[0]).toContain('No package.json');
        await writeFile(join(empty, 'package.json'), '{"dependencies":{"react":"19"}}');
        expect((await initProject({ cwd: empty })).errors[0]).toContain('Could not detect');
        await writeFile(join(empty, 'package.json'), '{nope');
        expect((await initProject({ cwd: empty })).errors[0]).toContain('not valid JSON');
        const dir = await fixture('vite');
        expect((await initProject({ cwd: dir, theme: 'no-such-theme' })).errors[0]).toContain(
          'Unknown theme'
        );
        expect((await initProject({ cwd: dir, theme: '../etc' })).errors[0]).toContain(
          'Unknown theme'
        );
        expect((await initProject({ cwd: dir, namespace: 'Bad Name' })).errors[0]).toContain(
          '--namespace'
        );
        expect((await initProject({ cwd: join(empty, 'missing') })).errors[0]).toContain(
          'does not exist'
        );
      },
      reset
    );
  });

  describe('path refusals', () => {
    const BAD_CSS: ReadonlyArray<[string, string]> = [
      ['/etc/texuli.css', 'absolute'],
      ['C:\\styles\\texuli.css', 'absolute'],
      ['../outside.css', "'..'"],
      ['src/../../outside.css', "'..'"],
      ['src/./texuli.css', 'normalized'],
      ['src//texuli.css', 'normalized'],
      ['src/te\0xuli.css', 'NUL'],
      ['src/texuli.txt', '.css'],
    ];

    it('refuses every unsafe --css path and writes nothing', async () => {
      for (const [css, reason] of BAD_CSS) {
        const dir = await fixture('vite');
        const result = await initProject({ cwd: dir, css, force: true });
        expect(result.ok, css).toBe(false);
        expect(result.errors.join(' '), css).toContain(reason);
        expect(result.files, css).toEqual([]);
        await expect(read(dir, CONFIG_FILE), css).rejects.toThrow();
      }
    });

    it('texuli init refuses symlinked folders, files, entries and folder destinations', async () => {
      await scenario(
        'refuses to write through a symlinked folder, even with --force',
        async () => {
          const dir = await fixture('vite');
          const outside = await tempDir('texuli-outside-');
          await mkdir(join(dir, 'styles'));
          await rm(join(dir, 'styles'), { recursive: true });
          await symlink(outside, join(dir, 'styles'));
          const result = await initProject({ cwd: dir, css: 'styles/texuli.css', force: true });
          expect(result.ok).toBe(false);
          expect(result.errors[0]).toContain('symlink');
          await expect(read(outside, 'texuli.css')).rejects.toThrow();
        },
        reset
      );
      await scenario(
        'refuses a symlinked destination file, even with --force',
        async () => {
          const dir = await fixture('vite');
          const outside = await tempDir('texuli-outside-');
          await writeFile(join(outside, 'target.css'), 'keep me\n');
          await symlink(join(outside, 'target.css'), join(dir, 'src/texuli.css'));
          const result = await initProject({ cwd: dir, force: true });
          expect(result.ok).toBe(false);
          expect(result.errors[0]).toContain('symlink');
          expect(await read(outside, 'target.css')).toBe('keep me\n');
        },
        reset
      );
      await scenario(
        'refuses a symlinked entry or document',
        async () => {
          const dir = await fixture('vite');
          const outside = await tempDir('texuli-outside-');
          await writeFile(join(outside, 'index.html'), '<html><head></head></html>');
          await rm(join(dir, 'index.html'));
          await symlink(join(outside, 'index.html'), join(dir, 'index.html'));
          const result = await initProject({ cwd: dir, force: true });
          expect(result.errors[0]).toContain('symlink');
          expect(result.files).toEqual([]);
          expect(await read(outside, 'index.html')).toBe('<html><head></head></html>');
        },
        reset
      );
      await scenario(
        'refuses a destination that is a folder',
        async () => {
          const dir = await fixture('vite');
          await mkdir(join(dir, 'src/texuli.css'));
          expect((await initProject({ cwd: dir })).errors[0]).toContain('not a regular file');
        },
        reset
      );
    });

    it('validates config paths: relative, normalized, no .., no NUL', () => {
      expect(projectPathError('css', 'src/texuli.css')).toBeNull();
      for (const bad of [
        '',
        '/abs.css',
        '../x.css',
        'a/../b.css',
        'a/./b.css',
        'a\0b.css',
        '\\\\host\\x.css',
      ]) {
        expect(projectPathError('css', bad)).not.toBeNull();
      }
      const base = {
        framework: 'vite',
        css: 'src/t.css',
        entry: 'src/main.ts',
        document: 'index.html',
        theme: 'ocean',
        namespace: 'app',
      };
      expect('config' in parseConfig(JSON.stringify(base))).toBe(true);
      for (const patch of [
        { css: '../t.css' },
        { entry: '/main.ts' },
        { document: 'a\0.html' },
        { framework: 'next' },
        { theme: 'Bad' },
      ]) {
        expect('errors' in parseConfig(JSON.stringify({ ...base, ...patch }))).toBe(true);
      }
      expect('errors' in parseConfig('[]')).toBe(true);
      expect('errors' in parseConfig('{')).toBe(true);
    });
  });
});

it('texuli theme lists, searches, previews and applies themes idempotently', async () => {
  await scenario(
    'lists the full library and searches it',
    async () => {
      const all = await listThemes();
      expect(all.length).toBeGreaterThanOrEqual(200);
      expect(all.some((theme) => theme.id === 'enterprise-neutral')).toBe(true);
      const found = await listThemes('ocean');
      expect(found.length).toBeGreaterThan(0);
      expect(found.length).toBeLessThan(all.length);
    },
    reset
  );
  await scenario(
    'previews key tokens and the WCAG AA report',
    async () => {
      const light = await previewTheme('enterprise-neutral', 'light');
      const dark = await previewTheme('enterprise-neutral', 'dark');
      expect(light?.tokens['--tx-background']).toMatch(/^#|^oklch|^rgb/);
      expect(light?.tokens['--tx-background']).not.toBe(dark?.tokens['--tx-background']);
      expect(light?.aa.pass).toBe(true);
      expect(light?.aa.modes.map((mode) => mode.mode)).toEqual(
        expect.arrayContaining(['light', 'dark'])
      );
      expect(await previewTheme('no-such-theme', 'light')).toBeNull();
    },
    reset
  );
  await scenario(
    'applies another theme to an initialized project, idempotently',
    async () => {
      const dir = await fixture('vite');
      await initProject({ cwd: dir });
      const result = await applyProjectTheme({ cwd: dir, theme: 'ocean' });
      expect(result.errors).toEqual([]);
      expect(actions(result)).toEqual({
        'src/texuli.css': 'update',
        'index.html': 'update',
        [CONFIG_FILE]: 'update',
      });
      const css = await read(dir, 'src/texuli.css');
      expect(css).toContain('/* texuli:theme ocean */');
      expect(css).not.toContain("[data-tx-theme='enterprise-neutral']");
      expect(documentTheme(await read(dir, 'index.html'))).toBe('ocean');
      expect((await read(dir, 'index.html')).match(/texuli:no-flash -->/g)).toHaveLength(2);
      expect(JSON.parse(await read(dir, CONFIG_FILE)).theme).toBe('ocean');
      const again = await applyProjectTheme({ cwd: dir, theme: 'ocean' });
      expect(again.files.every((file) => file.action === 'unchanged')).toBe(true);
    },
    reset
  );
});

it('texuli theme refuses without init, with an unsafe config, an edited or symlinked stylesheet', async () => {
  await scenario(
    'refuses without init, with an unsafe config, or an edited stylesheet',
    async () => {
      const dir = await fixture('vite');
      expect((await applyProjectTheme({ cwd: dir, theme: 'ocean' })).errors[0]).toContain(
        'texuli init'
      );
      await initProject({ cwd: dir });
      expect((await applyProjectTheme({ cwd: dir, theme: 'nope' })).errors[0]).toContain(
        'Unknown theme'
      );
      const config = JSON.parse(await read(dir, CONFIG_FILE));
      await writeFile(join(dir, CONFIG_FILE), JSON.stringify({ ...config, css: '../../evil.css' }));
      const unsafe = await applyProjectTheme({ cwd: dir, theme: 'ocean' });
      expect(unsafe.errors.join(' ')).toContain("'..'");
      expect(unsafe.files).toEqual([]);
      await writeFile(join(dir, CONFIG_FILE), JSON.stringify(config));
      await writeFile(join(dir, 'src/texuli.css'), 'hand edited\n');
      expect((await applyProjectTheme({ cwd: dir, theme: 'ocean' })).errors[0]).toContain(
        '--force'
      );
      expect((await applyProjectTheme({ cwd: dir, theme: 'ocean', force: true })).ok).toBe(true);
    },
    reset
  );
  await scenario(
    'refuses a stylesheet behind a symlink, even with --force',
    async () => {
      const dir = await fixture('vite');
      await initProject({ cwd: dir });
      const outside = await tempDir('texuli-outside-');
      await writeFile(join(outside, 'x.css'), 'keep\n');
      await rm(join(dir, 'src/texuli.css'));
      await symlink(join(outside, 'x.css'), join(dir, 'src/texuli.css'));
      const result = await applyProjectTheme({ cwd: dir, theme: 'ocean', force: true });
      expect(result.errors[0]).toContain('symlink');
      expect(await read(outside, 'x.css')).toBe('keep\n');
    },
    reset
  );
});

it('wiring transforms: import specifiers, Svelte script imports, Astro frontmatter and the document head', async () => {
  await scenario(
    'computes import specifiers between project files',
    async () => {
      expect(importSpecifier('src/main.ts', 'src/texuli.css')).toBe('./texuli.css');
      expect(importSpecifier('src/routes/+layout.svelte', 'src/texuli.css')).toBe('../texuli.css');
    },
    reset
  );
  await scenario(
    'adds the import to an existing Svelte script once',
    async () => {
      const source = '<script lang="ts">\n  let { children } = $props();\n</script>\n';
      const once = withCssImport(source, 'src/routes/+layout.svelte', '../texuli.css');
      expect(once).toContain('<script lang="ts">\n  import \'../texuli.css\';');
      expect(withCssImport(once, 'src/routes/+layout.svelte', '../texuli.css')).toBe(once);
    },
    reset
  );
  await scenario(
    'adds frontmatter to an Astro file that has none',
    async () => {
      expect(withCssImport('<p>hi</p>\n', 'src/layouts/Layout.astro', '../styles/t.css')).toBe(
        "---\nimport '../styles/t.css';\n---\n\n<p>hi</p>\n"
      );
    },
    reset
  );
  await scenario(
    'replaces an existing data-tx-theme and bootstrap block, and needs <html> and <head>',
    async () => {
      const doc = "<html lang='en' data-tx-theme='old'><head></head></html>";
      const wired = withDocumentWiring(doc, 'new-one', 'X()', false) as string;
      expect(documentTheme(wired)).toBe('new-one');
      expect(withDocumentWiring(wired, 'new-one', 'Y()', false)).toContain('<script>Y()</script>');
      expect(withDocumentWiring('<div></div>', 'x', 'X()', false)).toBeNull();
    },
    reset
  );
});

it('the CLI parses commands, refuses bad input and runs init and theme with JSON and exit codes', async () => {
  await scenario(
    'parses commands and refuses bad input',
    async () => {
      expect(parseInitArgs(['init', '--framework', 'astro', '--json'], '/app')).toMatchObject({
        command: 'init',
        framework: 'astro',
        json: true,
        cwd: '/app',
      });
      expect(parseInitArgs(['theme', 'preview', 'ocean', '--mode', 'dark'])).toMatchObject({
        command: 'theme-preview',
        id: 'ocean',
        mode: 'dark',
      });
      expect(() => parseInitArgs(['init', '--framework', 'next'])).toThrow('--framework');
      expect(() => parseInitArgs(['theme', 'apply'])).toThrow('theme id');
      expect(() => parseInitArgs(['theme', 'paint'])).toThrow('Unknown theme command');
      expect(() => parseInitArgs(['deploy'])).toThrow('Unknown command');
      expect(() => parseInitArgs(['init', '--css'])).toThrow('needs a value');
    },
    reset
  );
  await scenario(
    'runs init and theme commands with JSON output and exit codes',
    async () => {
      const dir = await fixture('sveltekit');
      const lines: string[] = [];
      const io = {
        cwd: dir,
        out: (line: string) => lines.push(line),
        err: (line: string) => lines.push(line),
      };
      expect(await runInitCli(['init', '--json'], io)).toBe(0);
      expect(JSON.parse(lines.pop() as string).ok).toBe(true);
      expect(await runInitCli(['theme', 'list', '--search', 'ocean', '--json'], io)).toBe(0);
      expect(JSON.parse(lines.pop() as string).themes.length).toBeGreaterThan(0);
      expect(await runInitCli(['theme', 'preview', 'ocean'], io)).toBe(0);
      expect(lines.some((line) => line.startsWith('WCAG AA:'))).toBe(true);
      expect(await runInitCli(['theme', 'apply', 'ocean', '--dry-run'], io)).toBe(0);
      expect(lines.some((line) => line.includes('would update'))).toBe(true);
      expect(await runInitCli(['init', '--css', '../x.css'], io)).toBe(1);
      expect(await runInitCli(['theme', 'preview', 'nope'], io)).toBe(1);
      expect(await runInitCli(['--help'], io)).toBe(0);
    },
    reset
  );
});
