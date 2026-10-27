// @vitest-environment node
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  CSS_FILE_DTS_SOURCE,
  CSS_MODULES_DTS,
  CSS_MODULES_DTS_SOURCE,
  compileGeneratedTypeScript,
  distTarget,
  ensureCssTypeDeclarations,
  isSvelteComponentDeclarationProblem,
  NEVER_PACKED,
  parseArgs,
  parseNpmPackJson,
  publishManifest,
  readWorkspace,
  referencePathTo,
  rewriteDeclarationSpecifiers,
  rewriteGeneratedTypeScriptSpecifiers,
  selectPackages,
  type WorkspacePackage,
} from '../packages.ts';

const pkg = (manifest: Record<string, unknown>): WorkspacePackage => ({
  dir: 'demo',
  name: String(manifest.name),
  version: String(manifest.version),
  manifest: manifest as WorkspacePackage['manifest'],
});

describe('distTarget', () => {
  it('maps source targets to the emitted files', () => {
    expect(distTarget('./src/index.ts', 'default')).toBe('./dist/index.js');
    expect(distTarget('./src/index.ts', 'types')).toBe('./dist/index.d.ts');
    expect(distTarget('./src/a/B.svelte', 'svelte')).toBe('./dist/a/B.svelte');
    expect(distTarget('./src/a/B.svelte', 'types')).toBe('./dist/a/B.svelte.d.ts');
    expect(distTarget('./src/x.svelte.ts', 'default')).toBe('./dist/x.svelte.js');
    expect(distTarget('./src/theme.css', 'default')).toBe('./dist/theme.css');
    expect(() => distTarget('./README.md', 'default')).toThrow('outside src/');
    expect(() => distTarget('./src/logo.png', 'default')).toThrow('unsupported');
  });
});

describe('publishManifest', () => {
  const versions = new Map([
    ['@texuli/core', '0.3.0'],
    ['demo', '0.3.0'],
  ]);

  it('derives the published manifest from the source one; reports what it cannot derive instead of guessing', () => {
    // derives the published manifest from the source one
    {
      const { manifest, problems, stubs } = publishManifest(
        pkg({
          name: 'demo',
          version: '0.3.0',
          private: true,
          license: 'MIT',
          type: 'module',
          sideEffects: ['**/*.css'],
          scripts: { typecheck: 'tsc' },
          devDependencies: { vitest: '^5.0.0' },
          exports: {
            '.': { types: './src/index.ts', svelte: './src/index.ts', default: './src/index.ts' },
            './roving': './src/roving/index.ts',
            './theme.css': './src/theme.css',
          },
          bin: { 'demo-cli': './src/cli.ts' },
          dependencies: { '@texuli/core': 'workspace:*', 'example-lib': '^1.2.3' },
          peerDependencies: { svelte: '^5.57.2' },
        }),
        versions
      );
      expect(problems).toEqual([]);
      expect(stubs).toEqual(['./dist/theme.css.d.ts']);
      expect(manifest).toEqual({
        name: 'demo',
        version: '0.3.0',
        license: 'MIT',
        type: 'module',
        sideEffects: ['**/*.css'],
        exports: {
          '.': {
            types: './dist/index.d.ts',
            svelte: './dist/index.js',
            default: './dist/index.js',
          },
          './roving': './dist/roving/index.js',
          './theme.css': { types: './dist/theme.css.d.ts', default: './dist/theme.css' },
        },
        bin: { 'demo-cli': './dist/cli.js' },
        files: ['dist'],
        dependencies: { '@texuli/core': '0.3.0', 'example-lib': '^1.2.3' },
        peerDependencies: { svelte: '^5.57.2' },
      });
    }
    // reports what it cannot derive instead of guessing
    {
      const { problems } = publishManifest(
        pkg({
          name: 'demo',
          version: '0.3.0',
          exports: { '.': './index.js' },
          dependencies: { '@texuli/ghost': 'workspace:*' },
        }),
        versions
      );
      expect(problems).toEqual([
        'manifest: exports..: export target outside src/: ./index.js',
        'manifest: @texuli/ghost is not a workspace package',
        // The unresolvable range stays `workspace:*`, which the packed-manifest
        // check then rejects too — both problems are reported, not guessed.
        'manifest: @texuli/ghost: published range must be a real semver range, got "workspace:*"',
      ]);
      expect(publishManifest(pkg({ name: 'demo', version: '0.3.0' }), versions).problems).toEqual([
        'manifest: no exports map',
      ]);
    }
  });
});

describe('parseNpmPackJson', () => {
  it('reads the first tarball entry and ignores surrounding noise', () => {
    const body = JSON.stringify([{ filename: 'texuli-0.0.0.tgz', entryCount: 12 }]);
    expect(parseNpmPackJson(`npm notice\n${body}\nnpm notice total files: 12\n`)).toEqual({
      filename: 'texuli-0.0.0.tgz',
      entryCount: 12,
    });
    expect(parseNpmPackJson('not json')).toBeUndefined();
  });
});

describe('rewriteDeclarationSpecifiers', () => {
  it('points relative .ts imports at .js and drops side-effect CSS imports', () => {
    const before = [
      "import './button.css';",
      "export { a } from './a.ts';",
      "export * from '../b/index.ts';",
      'import type { C } from "./c.ts";',
      "type D = import('./d.ts').D;",
      "export { e } from './e.d.ts';",
      "export { f } from 'pkg/f.ts';",
      "import X from './X.svelte';",
      'export {};',
      '',
    ].join('\n');
    expect(rewriteDeclarationSpecifiers(before)).toBe(
      [
        "export { a } from './a.js';",
        "export * from '../b/index.js';",
        'import type { C } from "./c.js";',
        "type D = import('./d.js').D;",
        "export { e } from './e.d.ts';",
        "export { f } from 'pkg/f.ts';",
        "import X from './X.svelte';",
        'export {};',
        '',
      ].join('\n')
    );
  });
});

describe('rewriteGeneratedTypeScriptSpecifiers', () => {
  it('maps sibling generated-source imports into the packed dist tree', () => {
    expect(
      rewriteGeneratedTypeScriptSpecifiers(
        'export type * from \'../generated/typescript/model.js\';\nexport { value } from "../generated/typescript/vocabulary.js";\n'
      )
    ).toBe(
      'export type * from \'./generated/typescript/model.js\';\nexport { value } from "./generated/typescript/vocabulary.js";\n'
    );
  });
});

describe('generated TypeScript packaging', () => {
  it('compiles external generated sources into matching JavaScript and declaration paths', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'tx-generated-types-'));
    try {
      const source = join(dir, 'generated', 'typescript');
      const output = join(dir, 'dist', 'generated', 'typescript');
      mkdirSync(source, { recursive: true });
      writeFileSync(
        join(source, 'model.ts'),
        'export interface Model { value: string }\nexport const modelVersion = 1;\n'
      );
      writeFileSync(
        join(source, 'index.ts'),
        "export type { Model } from './model.ts';\nexport { modelVersion } from './model.ts';\n"
      );

      expect(await compileGeneratedTypeScript(source, output)).toEqual([]);
      expect(readFileSync(join(output, 'index.js'), 'utf8')).toMatch(/from ["']\.\/model\.js/);
      expect(readFileSync(join(output, 'index.d.ts'), 'utf8')).toMatch(/from ["']\.\/model\.js/);
      expect(readFileSync(join(output, 'model.d.ts'), 'utf8')).toContain('interface Model');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }, 60_000);
});

describe('ensureCssTypeDeclarations', () => {
  it('is a no-op when dist has no CSS; writes sibling CSS stubs, root ambient, and entry/svelte references', () => {
    // is a no-op when dist has no CSS
    {
      const dir = mkdtempSync(join(tmpdir(), 'tx-css-types-'));
      try {
        writeFileSync(join(dir, 'index.d.ts'), 'export {};\n');
        expect(ensureCssTypeDeclarations(dir)).toEqual({
          cssFiles: 0,
          stubsWritten: 0,
          referencesAdded: 0,
          ambient: false,
        });
        expect(readFileSync(join(dir, 'index.d.ts'), 'utf8')).toBe('export {};\n');
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    }
    // writes sibling CSS stubs, root ambient, and entry/svelte references
    {
      const dir = mkdtempSync(join(tmpdir(), 'tx-css-types-'));
      try {
        const button = join(dir, 'components', 'button');
        mkdirSync(button, { recursive: true });
        writeFileSync(join(button, 'button.css'), '.x{}');
        writeFileSync(
          join(button, 'index.d.ts'),
          "export { default as Button } from './Button.svelte';\n"
        );
        writeFileSync(
          join(button, 'Button.svelte.d.ts'),
          'declare const Button: unknown;\nexport default Button;\n'
        );
        // Existing colocated stub must stay untouched.
        const badge = join(dir, 'components', 'badge');
        mkdirSync(badge, { recursive: true });
        writeFileSync(join(badge, 'badge.css'), '.b{}');
        writeFileSync(join(badge, 'badge.css.d.ts'), 'export {};\n');
        writeFileSync(join(badge, 'index.d.ts'), 'export {};\n');

        const result = ensureCssTypeDeclarations(dir);
        expect(result.cssFiles).toBe(2);
        expect(result.stubsWritten).toBe(1);
        expect(result.ambient).toBe(true);
        expect(result.referencesAdded).toBe(3);

        expect(readFileSync(join(button, 'button.css.d.ts'), 'utf8')).toBe(CSS_FILE_DTS_SOURCE);
        expect(readFileSync(join(badge, 'badge.css.d.ts'), 'utf8')).toBe('export {};\n');
        expect(readFileSync(join(dir, CSS_MODULES_DTS), 'utf8')).toBe(CSS_MODULES_DTS_SOURCE);

        const buttonIndex = readFileSync(join(button, 'index.d.ts'), 'utf8');
        expect(buttonIndex.startsWith('/// <reference path="../../css-modules.d.ts" />\n')).toBe(
          true
        );
        const buttonSvelte = readFileSync(join(button, 'Button.svelte.d.ts'), 'utf8');
        expect(buttonSvelte.startsWith('/// <reference path="../../css-modules.d.ts" />\n')).toBe(
          true
        );
        expect(referencePathTo(join(button, 'index.d.ts'), join(dir, CSS_MODULES_DTS))).toBe(
          '../../css-modules.d.ts'
        );
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    }
  });
});

describe('the svelte-component-declaration exception', () => {
  const files = new Set(['dist/a/B.svelte', 'dist/a/B.svelte.d.ts', 'dist/a/C.svelte']);
  const problem = (over: Record<string, string>) => ({
    kind: 'InternalResolutionError',
    resolutionOption: 'node16',
    moduleSpecifier: './B.svelte',
    fileName: '/node_modules/demo/dist/a/index.d.ts',
    ...over,
  });

  it('drops only node16 component imports whose declaration ships', () => {
    expect(isSvelteComponentDeclarationProblem(problem({}), 'demo', files)).toBe(true);
    expect(
      isSvelteComponentDeclarationProblem(problem({ moduleSpecifier: './C.svelte' }), 'demo', files)
    ).toBe(false);
    expect(
      isSvelteComponentDeclarationProblem(problem({ resolutionOption: 'bundler' }), 'demo', files)
    ).toBe(false);
    expect(
      isSvelteComponentDeclarationProblem(problem({ moduleSpecifier: './x.css' }), 'demo', files)
    ).toBe(false);
    expect(
      isSvelteComponentDeclarationProblem(problem({ kind: 'NoResolution' }), 'demo', files)
    ).toBe(false);
    expect(
      isSvelteComponentDeclarationProblem(
        problem({ moduleSpecifier: '../../../B.svelte' }),
        'demo',
        files
      )
    ).toBe(false);
    expect(isSvelteComponentDeclarationProblem(problem({}), 'other', files)).toBe(false);
  });
});

describe('workspace selection', () => {
  it('packs every package except the examples; parses the CLI', () => {
    // packs every package except the examples
    {
      const all = readWorkspace();
      const names = selectPackages(all, []).map((p) => p.name);
      expect(names).toContain('texuli');
      expect(names).toContain('@texuli/core');
      for (const never of NEVER_PACKED) expect(names).not.toContain(never);
      expect(selectPackages(all, ['core', 'texuli']).map((p) => p.name)).toEqual([
        '@texuli/core',
        'texuli',
      ]);
      expect(() => selectPackages(all, ['examples'])).toThrow('Unknown package');
    }
    expect(parseArgs(['--filter', 'core, tokens', '--json'])).toEqual({
      filters: ['core', 'tokens'],
      json: true,
    });
    expect(() => parseArgs(['--bogus'])).toThrow('Unknown option');
  });
});

describe('sideEffects', () => {
  it('every package declares CSS-only sideEffects (examples also register entries)', () => {
    const all = readWorkspace();
    for (const pkg of all) {
      const side = pkg.manifest.sideEffects;
      expect(side, pkg.name).toBeDefined();
      expect(Array.isArray(side), pkg.name).toBe(true);
      expect(side as string[], pkg.name).toContain('**/*.css');
      if (pkg.name === '@texuli/examples') {
        expect(side as string[]).toEqual([
          '**/*.css',
          './src/index.ts',
          './src/**/entry.ts',
          './src/**/entries.ts',
        ]);
      } else if (pkg.name === '@texuli/charts') {
        // The worker offload entry self-registers its message listener, so it
        // must stay in the bundle output even when nothing imports its return.
        expect(side as string[]).toEqual(['**/*.css', '**/worker/entry.*']);
      } else {
        // texuli layout register subpaths are pure (CSS-only sideEffects); hosts
        // import register entries explicitly so bundlers can tree-shake layouts.
        expect(side as string[], pkg.name).toEqual(['**/*.css']);
      }
    }
  });
});
