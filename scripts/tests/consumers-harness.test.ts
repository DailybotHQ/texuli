// @vitest-environment node
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { PINNED } from '../../tests/consumers/fixtures/versions.ts';
import {
  assertInstalledFromTarballs,
  astroSubpathsPage,
  CONSUMERS,
  installArgs,
  judgeDiagnostics,
  KNOWN_TYPE_DEFECTS,
  parseSvelteCheckDiagnostics,
  parseTscDiagnostics,
  REPO_ROOT,
  rewritePlaceholders,
  rewritePlaceholdersToVersion,
  type TarballMap,
  TEXULI_INSTALL_NAMES,
  tarballFileName,
  typecheckModule,
  universeModule,
} from '../../tests/consumers/harness.ts';
import {
  consumerSubpaths,
  cssIdentifiers,
  detectedEnvironment,
  importSpecifiers,
  NON_BROWSER_SUBPATHS,
  nodeImportable,
  packablePackages,
  RENDER_CHECKS,
  uiPackages,
  walkInstalled,
} from '../../tests/consumers/surface.ts';

const FIXTURES = join(REPO_ROOT, 'tests/consumers/fixtures');

describe('consumer harness matrix', () => {
  it('lists six fixtures across three frameworks with and without Tailwind; pins every third-party fixture dependency exactly (no ^ or ~); installs with ignore-scripts, never legacy-peer-deps, offline from tarballs and prefer-offline from the registry; exports assertInstalledFromTarballs that requires file: tarball resolution', () => {
    expect(CONSUMERS).toHaveLength(6);
    expect(CONSUMERS.map((c) => c.id).sort()).toEqual(
      [
        'astro-plain',
        'astro-tailwind',
        'sveltekit-plain',
        'sveltekit-tailwind',
        'vite-plain',
        'vite-tailwind',
      ].sort()
    );
    expect(new Set(CONSUMERS.map((c) => c.framework)).size).toBe(3);
    expect(CONSUMERS.filter((c) => c.tailwind)).toHaveLength(3);
    expect([...TEXULI_INSTALL_NAMES]).toEqual([
      '@texuli/core',
      '@texuli/tokens',
      '@texuli/primitives',
      'texuli',
      '@texuli/data',
    ]);
    expect(typeof assertInstalledFromTarballs).toBe('function');

    const fixtureDirs = readdirSync(FIXTURES, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name);
    expect(fixtureDirs.length).toBeGreaterThanOrEqual(6);
    for (const name of fixtureDirs) {
      const pkg = JSON.parse(readFileSync(join(FIXTURES, name, 'package.json'), 'utf8')) as {
        dependencies?: Record<string, string>;
        devDependencies?: Record<string, string>;
      };
      for (const [dep, version] of Object.entries({
        ...pkg.dependencies,
        ...pkg.devDependencies,
      })) {
        if (version.startsWith('file:')) {
          expect(version).toMatch(/^file:PLACEHOLDER_/);
          continue;
        }
        expect(version, `${name} ${dep}`).not.toMatch(/^[\^~]/);
        expect(version, `${name} ${dep}`).toMatch(/^\d+\.\d+\.\d+/);
        if (dep in PINNED) {
          expect(version, `${name} ${dep} matches PINNED`).toBe(PINNED[dep as keyof typeof PINNED]);
        }
      }
    }

    expect(installArgs('tarballs')).toEqual([
      'install',
      '--no-fund',
      '--no-audit',
      '--ignore-scripts',
      '--offline',
    ]);
    expect(installArgs('registry')).toEqual([
      'install',
      '--no-fund',
      '--no-audit',
      '--ignore-scripts',
      '--prefer-offline',
    ]);
    const harnessSrc = readFileSync(join(REPO_ROOT, 'tests/consumers/harness.ts'), 'utf8');
    expect(harnessSrc).not.toMatch(/['"]--legacy-peer-deps['"]/);
  });

  it('names tarballs as npm pack does and points every placeholder, plus every other packable package, at its tarball', () => {
    expect(tarballFileName('@texuli/core', '0.5.0')).toBe('texuli-core-0.5.0.tgz');
    expect(tarballFileName('texuli', '0.5.0')).toBe('texuli-0.5.0.tgz');

    const packages = packablePackages(REPO_ROOT);
    const tarballs: TarballMap = {
      dir: '/t',
      byName: Object.fromEntries(packages.map((p) => [p.name, `/t/${p.dir}.tgz`])),
      nameByDir: Object.fromEntries(packages.map((p) => [p.dir, p.name])),
    };
    for (const fixture of CONSUMERS) {
      const source = readFileSync(join(FIXTURES, fixture.fixture, 'package.json'), 'utf8');
      const manifest = JSON.parse(rewritePlaceholders(source, tarballs)) as {
        dependencies: Record<string, string>;
        devDependencies?: Record<string, string>;
      };
      for (const pkg of packages) {
        expect(manifest.dependencies[pkg.name], `${fixture.id} ${pkg.name}`).toBe(
          `file:/t/${pkg.dir}.tgz`
        );
      }
      expect(JSON.stringify(manifest)).not.toContain('PLACEHOLDER');
      expect(rewritePlaceholdersToVersion(source, '9.9.9')).not.toContain('PLACEHOLDER');
    }
    expect(() =>
      rewritePlaceholders('{"dependencies":{"x":"file:PLACEHOLDER_NOPE"}}', tarballs)
    ).toThrow(/PLACEHOLDER_NOPE/);
  });
});

describe('consumer surface', () => {
  it('derives every export key of every packable package, and only listed entries leave the browser', () => {
    const subpaths = consumerSubpaths(REPO_ROOT);
    const packages = packablePackages(REPO_ROOT);
    const expected = packages.flatMap((pkg) =>
      Object.keys(pkg.manifest.exports as Record<string, unknown>).map((key) =>
        key === '.' ? pkg.name : `${pkg.name}/${key.slice(2)}`
      )
    );
    expect(subpaths.map((s) => s.specifier)).toEqual(expected);
    expect(new Set(subpaths.map((s) => s.pkg))).toEqual(new Set(packages.map((p) => p.name)));
    for (const sub of subpaths) {
      const listed = NON_BROWSER_SUBPATHS[sub.specifier];
      if (sub.kind === 'css' || sub.kind === 'tailwind-css') {
        expect(sub.subpath, sub.specifier).toMatch(/\.css$/);
        expect(listed).toBeUndefined();
      } else if (listed) {
        expect(sub.kind).toBe(listed.kind);
      } else {
        expect(sub.kind, sub.specifier).toBe('module');
      }
    }
    for (const [specifier, entry] of Object.entries(NON_BROWSER_SUBPATHS)) {
      expect(expected, `${specifier} is still exported`).toContain(specifier);
      expect(entry.reason.length, `${specifier} has a reason`).toBeGreaterThan(20);
    }
    expect(subpaths.filter((s) => s.kind === 'tailwind-css').map((s) => s.specifier)).toContain(
      '@texuli/tokens/tailwind/preset.css'
    );
  });

  it('writes generated files that import every subpath of their kind (typecheck leaves out Node-only entries)', () => {
    const subpaths = consumerSubpaths(REPO_ROOT);
    const universe = universeModule(subpaths);
    const types = typecheckModule(subpaths);
    const astro = astroSubpathsPage(subpaths);
    for (const sub of subpaths) {
      const quoted = `'${sub.specifier}'`;
      expect(universe.includes(`from ${quoted}`), `universe ${sub.specifier}`).toBe(
        sub.kind === 'module'
      );
      expect(universe.includes(`import ${quoted};`), `universe css ${sub.specifier}`).toBe(
        sub.kind === 'css'
      );
      expect(types.includes(quoted), `typecheck ${sub.specifier}`).toBe(sub.kind !== 'node');
      expect(astro.includes(`from ${quoted}`), `astro page ${sub.specifier}`).toBe(
        sub.kind === 'astro'
      );
    }
  });

  it('every Tailwind fixture stylesheet imports every Tailwind-only stylesheet; SvelteKit keeps its prerendered index', () => {
    const tailwind = consumerSubpaths(REPO_ROOT).filter((s) => s.kind === 'tailwind-css');
    const sheets: Record<string, string> = {
      'vite-tailwind': 'src/app.css',
      'astro-tailwind': 'src/styles.css',
      'sveltekit-tailwind': 'src/app.css',
    };
    for (const consumer of CONSUMERS.filter((c) => c.tailwind)) {
      const css = readFileSync(
        join(FIXTURES, consumer.fixture, sheets[consumer.id] as string),
        'utf8'
      );
      for (const sub of tailwind) expect(css, consumer.id).toContain(`"${sub.specifier}"`);
    }
    for (const consumer of CONSUMERS.filter((c) => c.framework === 'sveltekit')) {
      const config = readFileSync(join(FIXTURES, consumer.fixture, 'svelte.config.js'), 'utf8');
      expect(config, consumer.id).not.toContain("fallback: 'index.html'");
    }
  });

  it('renders one component per UI package, each in a region of Smoke.svelte or Packages.svelte', () => {
    expect(Object.keys(RENDER_CHECKS).sort()).toEqual(uiPackages(REPO_ROOT).sort());
    const sources =
      readFileSync(join(FIXTURES, 'Smoke.svelte'), 'utf8') +
      readFileSync(join(FIXTURES, 'Packages.svelte'), 'utf8');
    for (const [pkg, check] of Object.entries(RENDER_CHECKS)) {
      const attr = /\[(data-[a-z-]+)="([^"]+)"\]/.exec(check.region);
      expect(attr, pkg).not.toBeNull();
      expect(sources, `${pkg} region`).toContain(`${attr?.[1]}="${attr?.[2]}"`);
      expect(check.client.length).toBeGreaterThan(0);
    }
  });

  it('reads import specifiers: static, side-effect, re-export and dynamic, never type-only or commented', () => {
    const cases: Array<[string, string[]]> = [
      ["import { a } from './a.js';", ['./a.js']],
      ["import './side.css';", ['./side.css']],
      ["export { b } from '@texuli/core/ids';", ['@texuli/core/ids']],
      ["export * from 'texuli/button';", ['texuli/button']],
      ["const m = await import('node:fs');", ['node:fs']],
      ["import type { T } from 'astro';", []],
      ["export type { T } from './types.js';", []],
      ["// import x from 'node:fs';\n/* import y from 'node:path'; */", []],
      ["const url = 'https://example.com'; import z from './z.js';", ['./z.js']],
      ["<script>\nimport Comp from './Comp.svelte';\n</script>", ['./Comp.svelte']],
    ];
    for (const [code, want] of cases) expect(importSpecifiers(code), code).toEqual(want);
  });

  it('walks an installed graph and reports missing files, undeclared or unexported imports, Node built-ins and .astro files', () => {
    const dir = mkdtempSync(join(tmpdir(), 'texuli-consumer-graph-'));
    try {
      const write = (path: string, text: string) => {
        mkdirSync(dirname(join(dir, path)), { recursive: true });
        writeFileSync(join(dir, path), text);
      };
      write(
        'node_modules/@texuli/a/package.json',
        JSON.stringify({
          name: '@texuli/a',
          exports: {
            '.': './dist/index.js',
            './node': './dist/node.js',
            './comp': './dist/comp.js',
            './broken': './dist/broken.js',
          },
          dependencies: { '@texuli/b': '1.0.0' },
        })
      );
      write('node_modules/@texuli/a/dist/index.js', "export { x } from './x.js';\n");
      write('node_modules/@texuli/a/dist/x.js', "import '@texuli/b';\nexport const x = 1;\n");
      write('node_modules/@texuli/a/dist/node.js', "import { readFileSync } from 'node:fs';\n");
      write(
        'node_modules/@texuli/a/dist/comp.js',
        "import C from './C.astro';\nimport './c.css';\n"
      );
      write('node_modules/@texuli/a/dist/C.astro', '---\n---\n<p />\n');
      write('node_modules/@texuli/a/dist/c.css', '.tx-c{}');
      write(
        'node_modules/@texuli/a/dist/broken.js',
        "import './gone.js';\nimport 'left-pad';\nimport '@texuli/b/hidden';\n"
      );
      write(
        'node_modules/@texuli/b/package.json',
        JSON.stringify({ name: '@texuli/b', exports: { '.': './dist/index.js' } })
      );
      write('node_modules/@texuli/b/dist/index.js', 'export const b = 2;\n');

      const root = walkInstalled(dir, '@texuli/a');
      expect([root.missing, root.undeclared, root.unexported]).toEqual([[], [], []]);
      expect(detectedEnvironment(root)).toBe('browser');
      expect(nodeImportable(root)).toBe(true);
      expect(root.files).toBe(3);

      const node = walkInstalled(dir, '@texuli/a/node');
      expect(detectedEnvironment(node)).toBe('node');
      expect([...node.nodeBuiltins.keys()]).toEqual(['node:fs']);

      const comp = walkInstalled(dir, '@texuli/a/comp');
      expect(detectedEnvironment(comp)).toBe('astro');
      expect(nodeImportable(comp)).toBe(false);

      const broken = walkInstalled(dir, '@texuli/a/broken');
      expect(broken.missing).toHaveLength(1);
      expect(broken.missing[0]).toContain('gone.js');
      expect(broken.undeclared).toEqual([expect.stringContaining('imports left-pad')]);
      expect(broken.unexported).toEqual([expect.stringContaining('does not export ./hidden')]);

      const absent = walkInstalled(dir, '@texuli/a/nope');
      expect(absent.unexported).toEqual([expect.stringContaining('does not export ./nope')]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('judges type diagnostics: third-party ignored, known Texuli defects counted, anything else or a stale known defect fails', () => {
    const tsc = parseTscDiagnostics(
      [
        'node_modules/astro/dist/x.d.ts(1,2): error TS2307: Cannot find module.',
        `${KNOWN_TYPE_DEFECTS[0]?.file}(3,10): error TS${KNOWN_TYPE_DEFECTS[0]?.code}: conflict`,
        'node_modules/@texuli/core/dist/y.d.ts(4,5): error TS2322: Type mismatch.',
      ].join('\n')
    );
    expect(tsc.map((d) => d.code)).toEqual([2307, KNOWN_TYPE_DEFECTS[0]?.code, 2322]);
    const verdict = judgeDiagnostics('tsc', tsc);
    expect(verdict.thirdParty).toBe(1);
    expect(verdict.known).toBe(1);
    expect(verdict.failures.filter((f) => f.includes('TS2322'))).toHaveLength(1);
    expect(verdict.failures.filter((f) => f.includes('no longer reproduces'))).toHaveLength(
      KNOWN_TYPE_DEFECTS.length - 1
    );

    const all = KNOWN_TYPE_DEFECTS.map((k) => ({ file: k.file, code: k.code, message: 'm' }));
    expect(judgeDiagnostics('tsc', all)).toEqual({
      failures: [],
      thirdParty: 0,
      known: KNOWN_TYPE_DEFECTS.length,
    });

    const svelte = parseSvelteCheckDiagnostics(
      [
        '1 START "/app"',
        '2 {"type":"ERROR","filename":"src/App.svelte","start":{"line":1,"character":1},"message":"Bad prop","code":2353}',
        '3 {"type":"WARNING","filename":"src/App.svelte","message":"w","code":1}',
        '4 COMPLETED 10 FILES 1 ERRORS 1 WARNINGS 1 FILES_WITH_PROBLEMS',
      ].join('\n')
    );
    expect(svelte).toEqual([{ file: 'src/App.svelte', code: 2353, message: 'Bad prop' }]);
  });

  it('reads the classes and custom properties a stylesheet defines, comments ignored', () => {
    expect(
      cssIdentifiers(
        '/* .tx-gone { --tx-gone: 1 } */ .tx-a, .tx-b:hover { color: var(--tx-used); --tx-def: 1px; }'
      )
    ).toEqual(['--tx-def', '.tx-a', '.tx-b']);
    expect(cssIdentifiers('@import "x.css";')).toEqual([]);
  });
});
