/**
 * The `skills/texuli/components` sub-skill keeps its promise that every
 * command and snippet runs or validates. Registered from `skill.test.ts`.
 *
 * - bash: every command line is executed, in order, through the CLI's own
 *   run function, against a temporary Vite app (`../my-app`), with this
 *   checkout as the source (`.`) and the merge base (`../texuli-0.1.0`).
 * - svelte: compiled with the Svelte compiler.
 * - ts: parsed; the provenance block equals what `texuli add` writes.
 * - json: parsed; dependencies name real workspace packages and folders.
 * - every import resolves to a package export, every `--tx-*` token exists in
 *   a real theme, and every `data-tx-*` hook exists in the component sources.
 */
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import { compile } from 'svelte/compiler';
import ts from 'typescript';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { compileThemeCss } from '../../packages/tokens/src/index.ts';
import { loadLibraryTheme } from '../../packages/tokens/src/library-port/index.ts';
import { runAddCli } from '../../packages/tools/src/cli-add/index.ts';
import { runInitCli } from '../../packages/tools/src/cli-init/index.ts';
import { runUpdateCli } from '../../packages/tools/src/cli-update/index.ts';
import { repositoryRootFromHere } from '../check-skill.ts';

const root = repositoryRootFromHere();
const subSkill = join(root, 'skills', 'texuli', 'components');

interface Block {
  file: string;
  lang: string;
  code: string;
}

function markdownFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory()
      ? markdownFiles(join(dir, entry.name))
      : entry.name.endsWith('.md')
        ? [join(dir, entry.name)]
        : []
  );
}

/** Every fenced code block of the sub-skill, in reading order (SKILL.md first). */
export function componentsSkillBlocks(): Block[] {
  const files = markdownFiles(subSkill).sort((a, b) =>
    a.endsWith('SKILL.md') ? -1 : b.endsWith('SKILL.md') ? 1 : a.localeCompare(b)
  );
  return files.flatMap((file) => {
    const text = readFileSync(file, 'utf8');
    return [...text.matchAll(/^```(\w*)\n([\s\S]*?)^```$/gm)].map((match) => ({
      file: relative(subSkill, file),
      lang: match[1] ?? '',
      code: match[2] ?? '',
    }));
  });
}

const blocks = componentsSkillBlocks();
const byLang = (lang: string) => blocks.filter((block) => block.lang === lang);
const allText = markdownFiles(subSkill)
  .map((file) => readFileSync(file, 'utf8'))
  .join('\n');

function packageExports(name: string): string[] {
  const folder = name === 'texuli' ? 'texuli' : name.replace('@texuli/', '');
  const manifest = join(root, 'packages', folder, 'package.json');
  if (!existsSync(manifest)) return [];
  return Object.keys(JSON.parse(readFileSync(manifest, 'utf8')).exports ?? {});
}

/** Whether a bare import specifier is a public export of a workspace package. */
function isPublicImport(specifier: string): boolean {
  const match = /^(texuli|@texuli\/[a-z-]+)(\/.*)?$/.exec(specifier);
  if (!match) return false;
  return packageExports(match[1] as string).includes(match[2] ? `.${match[2]}` : '.');
}

function importsOf(code: string): string[] {
  return [...code.matchAll(/(?:from|import)\s+'([^']+)'/g)].map((match) => match[1] as string);
}

describe('skills/texuli/components: every command and snippet', () => {
  let app = '';
  const logs: string[] = [];

  beforeAll(() => {
    // The developer's app: a minimal Vite project.
    app = mkdtempSync(join(tmpdir(), 'texuli-skill-app-'));
    mkdirSync(join(app, 'src'));
    writeFileSync(
      join(app, 'package.json'),
      JSON.stringify({ name: 'my-app', private: true, devDependencies: { vite: '^8.0.0' } })
    );
    writeFileSync(
      join(app, 'index.html'),
      '<!doctype html>\n<html lang="en">\n  <head>\n    <meta charset="utf-8" />\n  </head>\n  <body>\n    <div id="app"></div>\n  </body>\n</html>\n'
    );
    writeFileSync(join(app, 'src', 'main.ts'), "console.log('app');\n");
    vi.spyOn(console, 'log').mockImplementation((...parts) => void logs.push(parts.join(' ')));
    vi.spyOn(console, 'error').mockImplementation((...parts) => void logs.push(parts.join(' ')));
  });
  afterAll(() => {
    vi.restoreAllMocks();
    rmSync(app, { recursive: true, force: true });
  });

  it('has bash, svelte, ts, json and css snippets to check', () => {
    for (const lang of ['bash', 'svelte', 'ts', 'json', 'css'])
      expect(byLang(lang).length).toBeGreaterThan(0);
    expect(
      blocks.every((block) => ['bash', 'svelte', 'ts', 'json', 'css'].includes(block.lang))
    ).toBe(true);
  });

  it('runs every command, in order, against a temporary app', async () => {
    const substitute = (arg: string) =>
      arg === '../my-app' ? app : arg === '.' || arg === '../texuli-0.1.0' ? root : arg;
    const runners: Record<string, (argv: string[]) => Promise<number>> = {
      'packages/tools/src/cli-add/cli.ts': (argv) => runAddCli(argv),
      'packages/tools/src/cli-update/cli.ts': (argv) => runUpdateCli(argv),
      'packages/tools/src/cli-init/cli.ts': (argv) =>
        runInitCli(argv, {
          out: (line) => void logs.push(line),
          err: (line) => void logs.push(line),
        }),
    };
    let ran = 0;
    for (const block of byLang('bash')) {
      for (const raw of block.code.split('\n')) {
        const line = raw.trim();
        if (!line || line.startsWith('#')) continue;
        const words = line.split(/\s+/);
        if (words[0] === 'pnpm' && words[1] === 'vitest' && words[2] === 'run') {
          expect(existsSync(join(root, words[3] as string)), line).toBe(true);
          continue;
        }
        expect(words.slice(0, 2), line).toEqual(['pnpm', 'exec']);
        expect(words[2], line).toBe('tsx');
        const script = words[3] as string;
        expect(existsSync(join(root, script)), line).toBe(true);
        if (script === 'scripts/check-skill.ts') continue; // the pack check itself, run by the gate
        const run = runners[script];
        expect(run, `no runner for ${script}`).toBeDefined();
        const code = await (run as (argv: string[]) => Promise<number>)(
          words.slice(4).map(substitute)
        );
        expect(code, `${block.file}: ${line}\n${logs.slice(-5).join('\n')}`).toBe(0);
        ran += 1;
      }
    }
    expect(ran).toBeGreaterThanOrEqual(10);
    // The commands did what the skill says.
    const copied = readFileSync(join(app, 'src/components/texuli/button/index.ts'), 'utf8');
    expect(copied).toContain('@texuli/add');
    expect(copied).toContain('version: 0.1.0');
    expect(readFileSync(join(app, 'src/main.ts'), 'utf8')).toContain("import './texuli.css';");
    expect(readFileSync(join(app, 'index.html'), 'utf8')).toContain('data-tx-theme="ocean"');
    expect(JSON.parse(readFileSync(join(app, 'texuli.config.json'), 'utf8')).theme).toBe('ocean');
  });

  it('compiles every Svelte snippet and checks its imports and Button options', async () => {
    const { BUTTON_SIZES, BUTTON_VARIANTS } = await import(
      '../../packages/texuli/src/components/button/button-variants.ts'
    );
    for (const block of byLang('svelte')) {
      expect(() => compile(block.code, { filename: 'Snippet.svelte' }), block.file).not.toThrow();
      for (const specifier of importsOf(block.code))
        expect(isPublicImport(specifier), specifier).toBe(true);
      for (const [, variant] of block.code.matchAll(/variant="([^"]+)"/g))
        expect(BUTTON_VARIANTS).toContain(variant);
      for (const [, size] of block.code.matchAll(/size="([^"]+)"/g))
        expect(BUTTON_SIZES).toContain(size);
    }
  });

  it('parses every TypeScript snippet; the provenance block is what texuli add writes', () => {
    for (const block of byLang('ts')) {
      const result = ts.transpileModule(block.code, {
        reportDiagnostics: true,
        compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
      });
      expect(result.diagnostics ?? [], block.file).toEqual([]);
      for (const specifier of importsOf(block.code)) {
        if (!specifier.startsWith('.')) expect(isPublicImport(specifier), specifier).toBe(true);
      }
    }
    // The provenance block is exactly what `texuli add` wrote into the app above.
    const header = byLang('ts').find((block) => block.code.includes('@texuli/add'));
    const copied = readFileSync(join(app, 'src/components/texuli/button/index.ts'), 'utf8');
    expect(header?.code).toBeDefined();
    expect(copied.startsWith(header?.code ?? '-')).toBe(true);
  });

  it('parses every JSON snippet; dependencies are real workspace packages', () => {
    for (const block of byLang('json')) {
      const deps = (JSON.parse(block.code) as { dependencies: Record<string, string> })
        .dependencies;
      for (const [name, spec] of Object.entries(deps)) {
        expect(packageExports(name).length, name).toBeGreaterThan(0);
        if (spec.startsWith('link:')) {
          const folder = spec.replace(/^link:\.\.\/texuli\//, '');
          expect(existsSync(join(root, folder, 'package.json')), spec).toBe(true);
        } else expect(spec).toBe('workspace:*');
      }
    }
  });

  it('names only real tokens, hooks and layers', async () => {
    const css = compileThemeCss(await loadLibraryTheme('enterprise-neutral'));
    const tokens = new Set(css.match(/--tx-[a-z0-9-]+/g));
    const named = new Set(allText.match(/--tx-[a-z0-9-]+/g));
    expect(named.size).toBeGreaterThan(0);
    for (const token of named) expect(tokens.has(token), token).toBe(true);
    const sources = readFileSync(
      join(root, 'packages/texuli/src/components/button/Button.svelte'),
      'utf8'
    );
    for (const hook of allText.match(/data-tx-[a-z]+/g) ?? []) {
      if (hook === 'data-tx-theme' || hook === 'data-tx-mode') continue;
      expect(sources, hook).toContain(hook);
    }
    expect(
      readFileSync(join(root, 'packages/texuli/src/components/button/button.css'), 'utf8')
    ).toContain('@layer tx.components');
    for (const block of byLang('css')) {
      expect(block.code.split('{').length, block.file).toBe(block.code.split('}').length);
    }
  });
});
