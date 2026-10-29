/// <reference types="node" />
/**
 * Install the packed Texuli tarballs into consumer apps, check what landed,
 * type-check and build them. Packing is scripts/packages.ts (the same code as
 * `pnpm verify:packages`).
 *
 * Tarball mode (consumers.spec.ts) installs every packable package and
 * imports every exported subpath (tests/consumers/surface.ts derives the list
 * from the source `exports` maps):
 * - `module` subpaths go into a generated `universe.generated.ts`, which the
 *   app renders as a list (client, and the server pass in SvelteKit and Astro);
 * - `css` subpaths are imported by the same file; the built CSS must keep
 *   every class and custom property each packed stylesheet defines;
 * - `astro` subpaths go into a generated Astro page (Astro apps only);
 * - `node` subpaths, and every subpath plain Node can load, are imported by a
 *   generated `node-check.mjs`; every `bin` of every package runs `--help`.
 * Before the build, the installed `dist/` import graph of every subpath is
 * walked: a relative import with no file in the tarball, an undeclared
 * dependency, an unexported Texuli subpath or a `node:` import outside
 * {@link NON_BROWSER_SUBPATHS} fails the app.
 *
 * Registry mode (consumers-registry.spec.ts) installs the published version
 * of the base set ({@link TEXULI_INSTALL_NAMES}) and renders Smoke.svelte
 * only: the every-subpath surface follows the workspace exports, which a
 * published version may predate.
 *
 * Install policy (T-quality-supply-chain + FIX-consumers-install):
 * - no `--legacy-peer-deps` (peer errors must surface; fix peers on Texuli packages)
 * - `--ignore-scripts` (no install lifecycle scripts)
 * - tarball mode: `--offline` (never fetch: a third-party pin missing from
 *   the npm cache fails with ENOTCACHED and is reported, not downloaded)
 * - registry mode: `--prefer-offline` (it must reach the registry)
 * - third-party versions are exact pins in fixtures (no ^ / ~)
 *
 * Typecheck (FIX-css-types-ship, T-std-consumers): every app runs tsc
 * --noEmit over every non-Node subpath (CSS ones as side-effect imports);
 * Vite and SvelteKit apps also run svelte-check over the app, Smoke.svelte
 * and Packages.svelte. No consumer-local `*.css` ambient. Diagnostics in
 * third-party declarations are counted and ignored; a diagnostic in a
 * Texuli file fails unless it is in {@link KNOWN_TYPE_DEFECTS}, and a listed
 * defect that no longer reproduces fails too.
 */
import { execFile } from 'node:child_process';
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  realpathSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { verifyPackages } from '../../scripts/packages.ts';
import {
  type ConsumerSubpath,
  consumerSubpaths,
  cssIdentifiers,
  detectedEnvironment,
  type InstalledGraph,
  nodeImportable,
  packablePackages,
  runtimeTarget,
  walkInstalled,
} from './surface.ts';

const execFileAsync = promisify(execFile);

export const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

/** The base set registry mode installs and asserts (tarball mode installs every packable package). */
export const TEXULI_INSTALL_NAMES = [
  '@texuli/core',
  '@texuli/tokens',
  '@texuli/primitives',
  'texuli',
  '@texuli/data',
] as const;

const ASTRO_TRANSITIVE_PACKAGES = [
  '@texuli/astro',
  '@texuli/blocks',
  '@texuli/charts',
  '@texuli/media',
] as const;

/** Frameworks that also run svelte-check (every framework runs tsc). */
export const TYPECHECK_FRAMEWORKS = ['vite', 'sveltekit'] as const;

/**
 * Type errors the packed declarations have today. Each entry must still
 * reproduce (a fixed one fails as stale); any other Texuli diagnostic fails.
 * Reported to the owners of the packages; they are source fixes, not
 * consumer-harness ones.
 */
export const KNOWN_TYPE_DEFECTS: ReadonlyArray<{ file: string; code: number; reason: string }> = [
  ...['CalculatorBlock', 'ChecklistBlock', 'PollBlock', 'QuizBlock'].map((name) => ({
    file: `node_modules/@texuli/blocks/dist/interactive/${name}.svelte.d.ts`,
    code: 2440,
    reason: `the component imports a type named ${name} from ./schema, which collides with the component declaration svelte2tsx emits`,
  })),
  ...['accordion', 'slider'].map((name) => ({
    file: `node_modules/@texuli/primitives/dist/${name}/index.d.ts`,
    code: 2590,
    reason: `the emitted ${name} namespace object type is a union too complex for TypeScript to represent`,
  })),
];

export type ConsumerKind =
  | 'vite-plain'
  | 'vite-tailwind'
  | 'astro-plain'
  | 'astro-tailwind'
  | 'sveltekit-plain'
  | 'sveltekit-tailwind';

export interface ConsumerDef {
  id: ConsumerKind;
  framework: 'vite' | 'astro' | 'sveltekit';
  tailwind: boolean;
  /** Relative path under tests/consumers/fixtures. */
  fixture: string;
}

export const CONSUMERS: readonly ConsumerDef[] = [
  { id: 'vite-plain', framework: 'vite', tailwind: false, fixture: 'vite-plain' },
  { id: 'vite-tailwind', framework: 'vite', tailwind: true, fixture: 'vite-tailwind' },
  { id: 'astro-plain', framework: 'astro', tailwind: false, fixture: 'astro-plain' },
  { id: 'astro-tailwind', framework: 'astro', tailwind: true, fixture: 'astro-tailwind' },
  { id: 'sveltekit-plain', framework: 'sveltekit', tailwind: false, fixture: 'sveltekit-plain' },
  {
    id: 'sveltekit-tailwind',
    framework: 'sveltekit',
    tailwind: true,
    fixture: 'sveltekit-tailwind',
  },
];

export interface TarballMap {
  /** Directory containing tarballs. */
  dir: string;
  /** Package name → absolute tarball path, for every packable package. */
  byName: Record<string, string>;
  /** Package directory → package name. */
  nameByDir: Record<string, string>;
}

/** `npm pack`'s file name: `@texuli/core@0.5.0` → `texuli-core-0.5.0.tgz`. */
export function tarballFileName(name: string, version: string): string {
  return `${name.replace(/^@/, '').replace('/', '-')}-${version}.tgz`;
}

function newestMtime(path: string): number {
  if (!existsSync(path)) return 0;
  const stat = statSync(path);
  if (!stat.isDirectory()) return stat.mtimeMs;
  let newest = stat.mtimeMs;
  for (const entry of readdirSync(path)) newest = Math.max(newest, newestMtime(join(path, entry)));
  return newest;
}

/**
 * The tarball of every packable package at its workspace version. Packs the
 * packages whose tarball is missing or older than their sources (`src/`,
 * `generated/`, `package.json`, `README.md`), so a stale tarball from an
 * earlier version or edit is never installed.
 */
export async function ensureConsumerTarballs(options?: {
  force?: boolean;
  root?: string;
}): Promise<TarballMap> {
  const root = options?.root ?? REPO_ROOT;
  const dir = join(root, 'tmp/packages/tarballs');
  const packages = packablePackages(root);
  const stale = packages.filter((pkg) => {
    if (options?.force) return true;
    const file = join(dir, tarballFileName(pkg.name, pkg.version));
    if (!existsSync(file)) return true;
    const source = join(root, 'packages', pkg.dir);
    const newest = Math.max(
      ...['src', 'generated', 'package.json', 'README.md'].map((p) => newestMtime(join(source, p)))
    );
    return statSync(file).mtimeMs < newest;
  });
  if (stale.length > 0) {
    const { packages: reports } = await verifyPackages({
      root,
      filters: stale.map((pkg) => pkg.dir),
    });
    const failed = reports.filter((r) => !r.ok);
    if (failed.length > 0) {
      const detail = failed.map((r) => `${r.name}: ${r.problems.join('; ')}`).join('\n');
      throw new Error(`Pack failed:\n${detail}`);
    }
  }
  const byName: Record<string, string> = {};
  const nameByDir: Record<string, string> = {};
  for (const pkg of packages) {
    const file = join(dir, tarballFileName(pkg.name, pkg.version));
    if (!existsSync(file)) throw new Error(`Tarball not found for ${pkg.name}: ${file}`);
    byName[pkg.name] = file;
    nameByDir[pkg.dir] = pkg.name;
  }
  return { dir, byName, nameByDir };
}

/**
 * Point every `file:PLACEHOLDER_<DIR>` dependency at its tarball, then add
 * every other packable package, so the app installs all of them.
 */
export function rewritePlaceholders(pkgJson: string, tarballs: TarballMap): string {
  const replaced = pkgJson.replaceAll(/file:PLACEHOLDER_([A-Z]+)/g, (_match, dir: string) => {
    const name = tarballs.nameByDir[dir.toLowerCase()];
    if (!name) throw new Error(`No packable package for PLACEHOLDER_${dir}`);
    return `file:${tarballs.byName[name]}`;
  });
  const manifest = JSON.parse(replaced) as { dependencies?: Record<string, string> };
  manifest.dependencies ??= {};
  for (const [name, file] of Object.entries(tarballs.byName)) {
    manifest.dependencies[name] = `file:${file}`;
  }
  return JSON.stringify(manifest, null, 2);
}

/**
 * Point every Texuli dependency at one exact published version, so the
 * install resolves from the npm registry (the consumers-matrix registry
 * mode). Fails the gate honestly when that version is not published.
 */
export function rewritePlaceholdersToVersion(pkgJson: string, version: string): string {
  return pkgJson.replaceAll(/file:PLACEHOLDER_[A-Z]+/g, version);
}

/** The `npm install` arguments for a source: never fetch in tarball mode. */
export function installArgs(source: 'tarballs' | 'registry'): string[] {
  return source === 'registry'
    ? ['install', '--no-fund', '--no-audit', '--ignore-scripts', '--prefer-offline']
    : ['install', '--no-fund', '--no-audit', '--ignore-scripts', '--offline'];
}

/**
 * Assert every packable Texuli package resolved from its local packed
 * tarball (`file:`), never the public registry.
 */
export function assertInstalledFromTarballs(consumerDir: string, tarballs: TarballMap): void {
  const lockPath = join(consumerDir, 'package-lock.json');
  if (!existsSync(lockPath)) {
    throw new Error(`Missing package-lock.json in ${consumerDir} after npm install`);
  }
  const lock = JSON.parse(readFileSync(lockPath, 'utf8')) as {
    packages?: Record<string, { resolved?: string; version?: string; link?: boolean }>;
  };

  for (const [name, tarball] of Object.entries(tarballs.byName)) {
    const key = `node_modules/${name}`;
    const entry = lock.packages?.[key];
    if (!entry) {
      throw new Error(`package-lock missing ${key}`);
    }
    const resolved = entry.resolved ?? '';
    if (!resolved.startsWith('file:')) {
      throw new Error(
        `${name} resolved to "${resolved || '(empty)'}" — expected a file: tarball, not the registry`
      );
    }
    let filePath = resolved.slice('file:'.length);
    if (!filePath.startsWith('/')) {
      filePath = resolve(consumerDir, filePath);
    }
    let actual: string;
    try {
      actual = realpathSync(filePath);
    } catch {
      throw new Error(`${name} file: path does not exist: ${filePath}`);
    }
    const want = realpathSync(tarball);
    if (actual !== want) {
      throw new Error(`${name} resolved to ${actual}, expected packed tarball ${want}`);
    }

    const nm = join(consumerDir, 'node_modules', ...name.split('/'));
    if (!existsSync(nm)) {
      throw new Error(`Missing installed package at ${nm}`);
    }
  }
}

/**
 * Assert every Texuli dependency resolved from the npm registry at exactly
 * `version` (the registry mode of the consumers matrix) — never a file:
 * tarball and never a different version.
 */
export function assertInstalledFromRegistry(
  consumerDir: string,
  names: readonly string[],
  version: string
): void {
  const lockPath = join(consumerDir, 'package-lock.json');
  if (!existsSync(lockPath)) {
    throw new Error(`Missing package-lock.json in ${consumerDir} after npm install`);
  }
  const lock = JSON.parse(readFileSync(lockPath, 'utf8')) as {
    packages?: Record<string, { resolved?: string; version?: string }>;
  };
  for (const name of names) {
    const entry = lock.packages?.[`node_modules/${name}`];
    if (!entry) throw new Error(`package-lock missing ${name}`);
    const resolved = entry.resolved ?? '';
    if (!resolved.startsWith('https://registry.npmjs.org/')) {
      throw new Error(`${name} resolved to "${resolved || '(empty)'}" — expected the npm registry`);
    }
    if (entry.version !== version) {
      throw new Error(`${name} installed ${entry.version ?? '(?)'}, expected ${version}`);
    }
    if (!existsSync(join(consumerDir, 'node_modules', ...name.split('/')))) {
      throw new Error(`Missing installed package at ${name} in ${consumerDir}`);
    }
  }
}

// ── the installed surface ─────────────────────────────────────────────────

export interface InstalledSurface {
  subpaths: ConsumerSubpath[];
  /** Import graph of every non-CSS subpath. */
  graphs: Map<string, InstalledGraph>;
}

/**
 * Check every subpath against the installed packages: the packed exports map
 * keeps every source export key, every target file is in the tarball, and
 * the runtime import graph is complete, declared, exported and in the
 * environment its kind says. Throws with every problem at once.
 */
export function assertSurfaceInstalled(
  consumerDir: string,
  subpaths: readonly ConsumerSubpath[]
): InstalledSurface {
  const problems: string[] = [];
  const graphs = new Map<string, InstalledGraph>();
  const manifests = new Map<string, { exports?: Record<string, unknown> }>();
  for (const sub of subpaths) {
    const root = join(consumerDir, 'node_modules', ...sub.pkg.split('/'));
    if (!manifests.has(sub.pkg)) {
      manifests.set(sub.pkg, JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')));
    }
    const exportsMap = manifests.get(sub.pkg)?.exports ?? {};
    const target = runtimeTarget(exportsMap[sub.subpath]);
    if (target === undefined) {
      problems.push(`${sub.specifier}: the packed manifest does not export ${sub.subpath}`);
      continue;
    }
    if (!existsSync(join(root, target))) {
      problems.push(`${sub.specifier}: export target ${target} is not in the tarball`);
      continue;
    }
    if (sub.kind === 'css' || sub.kind === 'tailwind-css') continue;
    const graph = walkInstalled(consumerDir, sub.specifier);
    graphs.set(sub.specifier, graph);
    for (const line of [...graph.missing, ...graph.undeclared, ...graph.unexported]) {
      problems.push(`${sub.specifier}: ${line}`);
    }
    const env = detectedEnvironment(graph);
    const want = sub.kind === 'module' ? 'browser' : sub.kind;
    if (env !== want) {
      const why =
        env === 'node'
          ? `imports ${[...graph.nodeBuiltins].map(([b, f]) => `${b} (${f})`).join(', ')}`
          : env === 'astro'
            ? `imports ${graph.astroFiles.join(', ')}`
            : 'imports no Node built-in and no .astro file';
      problems.push(
        `${sub.specifier} is listed as ${want} but ${why}; update NON_BROWSER_SUBPATHS in tests/consumers/surface.ts only if that is intended`
      );
    }
  }
  if (problems.length > 0) {
    throw new Error(`Installed surface problems (${problems.length}):\n${problems.join('\n')}`);
  }
  return { subpaths: [...subpaths], graphs };
}

/** The import specifiers plain Node loads: every `node` subpath plus every Node-importable module. */
export function nodeCheckSpecifiers(surface: InstalledSurface): string[] {
  return surface.subpaths
    .filter((sub) => {
      if (sub.kind === 'node') return true;
      if (sub.kind !== 'module') return false;
      const graph = surface.graphs.get(sub.specifier);
      return graph !== undefined && nodeImportable(graph);
    })
    .map((sub) => sub.specifier);
}

/**
 * Import each specifier in plain Node from the app directory (exact ESM
 * resolution: no bundler leniency about extensions or conditions), and run
 * every installed Texuli `bin` with `--help`. Returns the export count per
 * specifier.
 */
export async function nodeCheckConsumer(
  consumerDir: string,
  specifiers: readonly string[]
): Promise<{ exports: Record<string, number>; bins: string[] }> {
  const script = join(consumerDir, 'node-check.mjs');
  writeFileSync(
    script,
    [
      '// Generated by tests/consumers/harness.ts: plain Node imports of the packed subpaths.',
      `const specifiers = ${JSON.stringify(specifiers)};`,
      'const exports = {};',
      'const failed = {};',
      'for (const specifier of specifiers) {',
      '  try {',
      '    exports[specifier] = Object.keys(await import(specifier)).length;',
      '  } catch (error) {',
      '    failed[specifier] = String(error?.stack ?? error).slice(0, 600);',
      '  }',
      '}',
      'console.log(JSON.stringify({ exports, failed }));',
      '',
    ].join('\n')
  );
  const { stdout } = await execFileAsync('node', [script], {
    cwd: consumerDir,
    env: process.env,
    maxBuffer: 20 * 1024 * 1024,
  });
  const result = JSON.parse(stdout.trim().split('\n').pop() ?? '{}') as {
    exports: Record<string, number>;
    failed: Record<string, string>;
  };
  const failures = Object.entries(result.failed);
  if (failures.length > 0) {
    throw new Error(
      `Plain Node import failed for ${failures.length} subpath(s):\n${failures
        .map(([spec, error]) => `${spec}: ${error}`)
        .join('\n')}`
    );
  }

  const bins: string[] = [];
  const binProblems: string[] = [];
  for (const pkg of packablePackages(REPO_ROOT)) {
    const root = join(consumerDir, 'node_modules', ...pkg.name.split('/'));
    const manifest = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')) as {
      bin?: Record<string, string>;
    };
    for (const [command, target] of Object.entries(manifest.bin ?? {})) {
      const file = join(root, target);
      if (!existsSync(file)) {
        binProblems.push(`${pkg.name} bin ${command}: ${target} is not in the tarball`);
        continue;
      }
      const output = await new Promise<string>((done) => {
        execFile(
          'node',
          [file, '--help'],
          { cwd: consumerDir, env: process.env, timeout: 60_000 },
          (_error, out, err) => done(`${out}${err}`)
        );
      });
      if (
        output.trim() === '' ||
        /ERR_MODULE_NOT_FOUND|ERR_PACKAGE_PATH_NOT_EXPORTED|ERR_UNKNOWN_FILE_EXTENSION|SyntaxError|Cannot find module/.test(
          output
        )
      ) {
        binProblems.push(`${pkg.name} bin ${command} --help: ${output.trim().slice(0, 600)}`);
        continue;
      }
      bins.push(command);
    }
  }
  if (binProblems.length > 0) throw new Error(`Bin problems:\n${binProblems.join('\n')}`);
  return { exports: result.exports, bins };
}

// ── generated app files ───────────────────────────────────────────────────

/** `universe.generated.ts`: every `module` subpath as a namespace import, every `css` subpath for its side effect. */
export function universeModule(subpaths: readonly ConsumerSubpath[]): string {
  const modules = subpaths.filter((sub) => sub.kind === 'module');
  const css = subpaths.filter((sub) => sub.kind === 'css');
  return [
    "// Generated by tests/consumers/harness.ts from the packages' exports maps. Do not edit.",
    ...css.map((sub) => `import '${sub.specifier}';`),
    ...modules.map((sub, index) => `import * as m${index} from '${sub.specifier}';`),
    '',
    'export const UNIVERSE: ReadonlyArray<{ specifier: string; exports: number }> = [',
    ...modules.map(
      (sub, index) => `  { specifier: '${sub.specifier}', exports: Object.keys(m${index}).length },`
    ),
    '];',
    '',
  ].join('\n');
}

/** `src/pages/subpaths.astro`: every `astro` subpath, imported and evaluated at build time. */
export function astroSubpathsPage(subpaths: readonly ConsumerSubpath[]): string {
  const astro = subpaths.filter((sub) => sub.kind === 'astro');
  return [
    '---',
    '// Generated by tests/consumers/harness.ts: every .astro-backed subpath. Do not edit.',
    ...astro.map((sub, index) => `import * as a${index} from '${sub.specifier}';`),
    'const ASTRO = [',
    ...astro.map(
      (sub, index) =>
        `  { specifier: '${sub.specifier}', exports: Object.keys(a${index}).length, component: typeof a${index}.default },`
    ),
    '];',
    '---',
    '<html lang="en">',
    '  <head><meta charset="utf-8" /><title>Astro subpaths</title></head>',
    '  <body>',
    '    <ul data-tx-consumer-astro-subpaths>',
    '      {ASTRO.map((entry) => <li data-subpath={entry.specifier} data-exports={entry.exports} data-component={entry.component}>{entry.specifier}</li>)}',
    '    </ul>',
    '  </body>',
    '</html>',
    '',
  ].join('\n');
}

/** `typecheck-imports.ts`: every subpath plain TypeScript checks (everything except `node`). */
export function typecheckModule(subpaths: readonly ConsumerSubpath[]): string {
  const typed = subpaths.filter((sub) => sub.kind === 'module' || sub.kind === 'astro');
  const css = subpaths.filter((sub) => sub.kind === 'css' || sub.kind === 'tailwind-css');
  return [
    '// Generated by tests/consumers/harness.ts: the packed type surface. Do not edit.',
    '// Node-only subpaths are left out: their declarations reference @types/node, which',
    '// the npm cache cannot install offline (undici-types is not cached); they get the',
    '// plain Node import check instead.',
    ...css.map((sub) => `import '${sub.specifier}';`),
    ...typed.map((sub, index) => `import type * as t${index} from '${sub.specifier}';`),
    '',
    'export type ConsumerPackSurface = [',
    ...typed.map((_sub, index) => `  typeof t${index},`),
    '];',
    '',
  ].join('\n');
}

const SMOKE_IMPORT = /(?:\.\.\/)+Smoke\.svelte/g;

function rewriteSmokeImport(file: string, rel: string, target: string): void {
  if (!existsSync(file)) return;
  writeFileSync(file, readFileSync(file, 'utf8').replaceAll(SMOKE_IMPORT, `${rel}${target}`));
}

/**
 * Consumer tsconfigs: strict, no local *.css ambient,
 * noUncheckedSideEffectImports so missing package CSS types fail the gate.
 */
export function writeConsumerTypecheckConfig(
  consumerDir: string,
  subpaths: readonly ConsumerSubpath[] | undefined
): {
  svelteTsconfig: string;
  tscTsconfig: string;
} {
  const shared = {
    target: 'ES2023',
    lib: ['ES2023', 'DOM', 'DOM.Iterable'],
    module: 'ESNext',
    moduleResolution: 'bundler',
    moduleDetection: 'force',
    resolveJsonModule: true,
    verbatimModuleSyntax: true,
    isolatedModules: true,
    noEmit: true,
    strict: true,
    skipLibCheck: false,
    noUncheckedSideEffectImports: true,
    forceConsistentCasingInFileNames: true,
    types: [] as string[],
  };

  // Registry mode keeps the original, smaller import surface.
  writeFileSync(
    join(consumerDir, 'typecheck-imports.ts'),
    subpaths
      ? typecheckModule(subpaths)
      : [
          "import { DataGrid } from '@texuli/data/grid-core';",
          "import { Button } from 'texuli/button';",
          "import { Select } from 'texuli/select';",
          'export type ConsumerPackSurface = {',
          '  Button: typeof Button;',
          '  Select: typeof Select;',
          '  DataGrid: typeof DataGrid;',
          '};',
          '',
        ].join('\n')
  );

  const svelteFiles = subpaths
    ? [
        'Smoke.svelte',
        'Packages.svelte',
        'Universe.svelte',
        'Everything.svelte',
        'universe.generated.ts',
      ]
    : ['Smoke.svelte'];
  const svelteTsconfig = join(consumerDir, 'tsconfig.consumer.json');
  writeFileSync(
    svelteTsconfig,
    `${JSON.stringify(
      {
        compilerOptions: shared,
        include: ['src/**/*.ts', 'src/**/*.svelte', ...svelteFiles, 'typecheck-imports.ts'],
      },
      null,
      2
    )}\n`
  );

  const tscTsconfig = join(consumerDir, 'tsconfig.consumer-tsc.json');
  writeFileSync(
    tscTsconfig,
    `${JSON.stringify({ compilerOptions: shared, include: ['typecheck-imports.ts'] }, null, 2)}\n`
  );
  return { svelteTsconfig, tscTsconfig };
}

/**
 * Assert packed texuli/data install the CSS type surface (sibling stubs + ambient
 * reference on entries that consumers import for the smoke gate).
 */
export function assertPackedCssTypes(consumerDir: string): void {
  const checks: Array<{ pkg: string; files: string[]; entryIndexes: string[] }> = [
    {
      pkg: 'texuli',
      files: [
        'dist/css-modules.d.ts',
        'dist/components/button/button.css.d.ts',
        'dist/components/select/select.css.d.ts',
      ],
      entryIndexes: ['dist/components/button/index.d.ts', 'dist/components/select/index.d.ts'],
    },
    {
      pkg: '@texuli/data',
      files: ['dist/css-modules.d.ts', 'dist/grid-core/grid-core.css.d.ts'],
      entryIndexes: ['dist/grid-core/index.d.ts'],
    },
  ];
  for (const { pkg, files, entryIndexes } of checks) {
    const root = join(consumerDir, 'node_modules', ...pkg.split('/'));
    for (const rel of [...files, ...entryIndexes]) {
      const full = join(root, rel);
      if (!existsSync(full)) {
        throw new Error(`Packed ${pkg} missing CSS type surface file: ${rel}`);
      }
    }
    for (const entry of entryIndexes) {
      const text = readFileSync(join(root, entry), 'utf8');
      if (!text.includes('css-modules.d.ts')) {
        throw new Error(
          `Packed ${pkg} ${entry} must /// <reference> css-modules.d.ts (got head: ${text.slice(0, 120)})`
        );
      }
    }
  }
}

export interface TypeDiagnostic {
  file: string;
  code: number;
  message: string;
}

/** `file(line,col): error TS1234: message` lines of tsc output. */
export function parseTscDiagnostics(output: string): TypeDiagnostic[] {
  const out: TypeDiagnostic[] = [];
  for (const match of output.matchAll(/^(.+?)\(\d+,\d+\): error TS(\d+): (.*)$/gm)) {
    out.push({ file: match[1] as string, code: Number(match[2]), message: match[3] as string });
  }
  return out;
}

/** ERROR records of `svelte-check --output machine-verbose`. */
export function parseSvelteCheckDiagnostics(output: string): TypeDiagnostic[] {
  const out: TypeDiagnostic[] = [];
  for (const line of output.split('\n')) {
    const json = line.slice(line.indexOf('{'));
    if (!line.includes('"type":"ERROR"')) continue;
    try {
      const record = JSON.parse(json) as { filename: string; code?: number; message: string };
      out.push({ file: record.filename, code: record.code ?? 0, message: record.message });
    } catch {
      out.push({ file: '(unparsed)', code: 0, message: line });
    }
  }
  return out;
}

const THIRD_PARTY = /^node_modules\/(?!texuli\/|@texuli\/)/;

/**
 * Split diagnostics into third-party ones (ignored, counted), known Texuli
 * defects and failures; a known defect that did not reproduce is a failure.
 */
export function judgeDiagnostics(
  tool: string,
  diagnostics: readonly TypeDiagnostic[]
): { failures: string[]; thirdParty: number; known: number } {
  const failures: string[] = [];
  let thirdParty = 0;
  const seenKnown = new Set<string>();
  for (const d of diagnostics) {
    const file = d.file.replace(/\\/g, '/');
    if (THIRD_PARTY.test(file)) {
      thirdParty += 1;
      continue;
    }
    const known = KNOWN_TYPE_DEFECTS.find((k) => k.file === file && k.code === d.code);
    if (known) {
      seenKnown.add(`${known.file}#${known.code}`);
      continue;
    }
    failures.push(`${tool}: ${file}: TS${d.code} ${d.message}`);
  }
  for (const k of KNOWN_TYPE_DEFECTS) {
    if (!seenKnown.has(`${k.file}#${k.code}`)) {
      failures.push(
        `${tool}: KNOWN_TYPE_DEFECTS lists ${k.file} TS${k.code}, which no longer reproduces; remove the entry`
      );
    }
  }
  return { failures, thirdParty, known: seenKnown.size };
}

async function runTool(cmd: string, args: string[], cwd: string): Promise<string> {
  try {
    const { stdout, stderr } = await execFileAsync(cmd, args, {
      cwd,
      env: process.env,
      maxBuffer: 64 * 1024 * 1024,
    });
    return `${stdout}${stderr}`;
  } catch (error) {
    const err = error as { stdout?: string; stderr?: string; message?: string };
    return `${err.stdout ?? ''}${err.stderr ?? err.message ?? String(error)}`;
  }
}

/**
 * Run tsc --noEmit (and svelte-check when `svelte` is set). Fails on any
 * Texuli or app diagnostic outside {@link KNOWN_TYPE_DEFECTS}. Does not add a
 * consumer-local `*.css` ambient — package types must suffice.
 */
export async function typecheckConsumer(
  consumerDir: string,
  options: { subpaths?: readonly ConsumerSubpath[]; svelte?: boolean } = {}
): Promise<{ thirdParty: number; known: number }> {
  const { svelteTsconfig, tscTsconfig } = writeConsumerTypecheckConfig(
    consumerDir,
    options.subpaths
  );

  // Guard: fixtures must not ship a local *.css ambient that would hide packaging bugs.
  for (const file of walkLocalDts(consumerDir)) {
    const text = readFileSync(file, 'utf8');
    if (/declare\s+module\s+['"]\*\.css['"]/.test(text)) {
      throw new Error(
        `Consumer fixture must not declare module '*.css' (${file}); package types must ship it`
      );
    }
  }

  assertPackedCssTypes(consumerDir);

  const failures: string[] = [];
  let thirdParty = 0;
  let known = 0;
  const judge = (tool: string, diagnostics: TypeDiagnostic[], output: string) => {
    if (options.subpaths) {
      const verdict = judgeDiagnostics(tool, diagnostics);
      failures.push(...verdict.failures);
      thirdParty += verdict.thirdParty;
      known = Math.max(known, verdict.known);
    } else if (diagnostics.length > 0) {
      failures.push(`${tool} failed:\n${output}`);
    }
  };

  if (options.svelte ?? true) {
    const output = await runTool(
      'npx',
      [
        '--no-install',
        'svelte-check',
        '--tsconfig',
        svelteTsconfig,
        '--threshold',
        'error',
        '--output',
        'machine-verbose',
      ],
      consumerDir
    );
    if (!/COMPLETED/.test(output)) failures.push(`svelte-check did not complete:\n${output}`);
    judge('svelte-check', parseSvelteCheckDiagnostics(output), output);
  }

  const output = await runTool(
    'npx',
    ['--no-install', 'tsc', '--noEmit', '-p', tscTsconfig],
    consumerDir
  );
  const tsc = parseTscDiagnostics(output);
  if (tsc.length === 0 && /error/i.test(output)) failures.push(`tsc failed:\n${output}`);
  judge('tsc', tsc, output);

  if (failures.length > 0) {
    throw new Error(`Type check failed (${failures.length}):\n${failures.join('\n')}`);
  }
  return { thirdParty, known };
}

function walkLocalDts(dir: string): string[] {
  const out: string[] = [];
  const skip = new Set(['node_modules', 'dist', 'build', '.svelte-kit']);
  const walk = (current: string) => {
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      if (skip.has(entry.name)) continue;
      const full = join(current, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name.endsWith('.d.ts')) out.push(full);
    }
  };
  walk(dir);
  return out;
}

function walkFiles(dir: string, suffix: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) return walkFiles(full, suffix);
    return entry.name.endsWith(suffix) ? [full] : [];
  });
}

/**
 * Every class and custom property each `css` subpath's packed stylesheet
 * defines must be in the app's built CSS: a stylesheet the build dropped
 * (or never resolved) fails here.
 */
export function assertBuiltCss(
  consumerDir: string,
  dist: string,
  subpaths: readonly ConsumerSubpath[]
): { checked: number; identifiers: number } {
  const built = walkFiles(dist, '.css')
    .map((file) => readFileSync(file, 'utf8'))
    .join('\n');
  const problems: string[] = [];
  let identifiers = 0;
  const css = subpaths.filter((sub) => sub.kind === 'css');
  for (const sub of css) {
    const root = join(consumerDir, 'node_modules', ...sub.pkg.split('/'));
    const manifest = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')) as {
      exports: Record<string, unknown>;
    };
    const target = runtimeTarget(manifest.exports[sub.subpath]) as string;
    const wanted = cssIdentifiers(readFileSync(join(root, target), 'utf8'));
    identifiers += wanted.length;
    if (wanted.length === 0)
      problems.push(`${sub.specifier}: no class or custom property to check`);
    const lost = wanted.filter((id) => !built.includes(id));
    if (lost.length > 0) {
      problems.push(
        `${sub.specifier}: ${lost.length} of ${wanted.length} identifiers missing from the built CSS (${lost.slice(0, 5).join(', ')})`
      );
    }
  }
  if (problems.length > 0) throw new Error(`Built CSS problems:\n${problems.join('\n')}`);
  return { checked: css.length, identifiers };
}

export interface BuiltConsumer {
  dir: string;
  dist: string;
  /** Tarball mode only: the surface checks' results. */
  surface?: {
    subpaths: ConsumerSubpath[];
    nodeExports: Record<string, number>;
    bins: string[];
    types: { thirdParty: number; known: number } | undefined;
  };
}

/**
 * Copy a fixture into a temp dir, point deps at tarballs (or at one exact
 * published registry version), npm install, check, build.
 */
export async function buildConsumer(
  consumer: ConsumerDef,
  tarballs: TarballMap,
  options?: {
    workRoot?: string;
    typecheck?: boolean;
    source?: { kind: 'tarballs' } | { kind: 'registry'; version: string };
  }
): Promise<BuiltConsumer> {
  const registry = options?.source?.kind === 'registry';
  const workRoot = options?.workRoot ?? join(REPO_ROOT, 'tmp/consumers');
  mkdirSync(workRoot, { recursive: true });
  const dir = mkdtempSync(join(workRoot, `${consumer.id}-`));
  const fixturesDir = join(REPO_ROOT, 'tests/consumers/fixtures');

  cpSync(join(fixturesDir, consumer.fixture), dir, { recursive: true });
  const shared = registry
    ? ['Smoke.svelte']
    : ['Smoke.svelte', 'Packages.svelte', 'Universe.svelte', 'Everything.svelte'];
  for (const file of shared) cpSync(join(fixturesDir, file), join(dir, file));

  // Pages import the shared root component; tarball mode swaps in Everything.svelte.
  const page = registry ? 'Smoke.svelte' : 'Everything.svelte';
  rewriteSmokeImport(join(dir, 'src/main.ts'), '../', page);
  rewriteSmokeImport(join(dir, 'src/pages/index.astro'), '../../', page);
  rewriteSmokeImport(join(dir, 'src/routes/+page.svelte'), '../../', page);

  const subpaths = registry ? undefined : consumerSubpaths(REPO_ROOT);
  if (subpaths) {
    writeFileSync(join(dir, 'universe.generated.ts'), universeModule(subpaths));
    if (consumer.framework === 'astro') {
      writeFileSync(join(dir, 'src/pages/subpaths.astro'), astroSubpathsPage(subpaths));
    }
  }

  const pkgPath = join(dir, 'package.json');
  writeFileSync(
    pkgPath,
    options?.source?.kind === 'registry'
      ? rewritePlaceholdersToVersion(readFileSync(pkgPath, 'utf8'), options.source.version)
      : rewritePlaceholders(readFileSync(pkgPath, 'utf8'), tarballs)
  );

  try {
    await execFileAsync('npm', installArgs(registry ? 'registry' : 'tarballs'), {
      cwd: dir,
      env: { ...process.env, npm_config_package_lock: 'true' },
      maxBuffer: 20 * 1024 * 1024,
    });
  } catch (error) {
    const err = error as { stdout?: string; stderr?: string };
    const notCached = /ENOTCACHED/.test(err.stderr ?? '');
    throw new Error(
      `${consumer.id}: npm install failed${notCached ? ' (a third-party dependency is not in the npm cache; tarball mode never fetches it)' : ''}:\n${err.stderr ?? ''}${err.stdout ?? ''}`
    );
  }

  if (options?.source?.kind === 'registry') {
    assertInstalledFromRegistry(dir, TEXULI_INSTALL_NAMES, options.source.version);
    if (consumer.id === 'astro-plain') {
      assertInstalledFromRegistry(dir, ASTRO_TRANSITIVE_PACKAGES, options.source.version);
    }
  } else {
    assertInstalledFromTarballs(dir, tarballs);
  }

  let surface: BuiltConsumer['surface'];
  if (subpaths) {
    const installed = assertSurfaceInstalled(dir, subpaths);
    const node = await nodeCheckConsumer(dir, nodeCheckSpecifiers(installed));
    surface = { subpaths, nodeExports: node.exports, bins: node.bins, types: undefined };
  }

  const svelteCheck = (TYPECHECK_FRAMEWORKS as readonly string[]).includes(consumer.framework);
  // Registry mode keeps the earlier rule (svelte-check + tsc in Vite and SvelteKit only).
  const shouldTypecheck = options?.typecheck ?? (subpaths ? true : svelteCheck);
  if (shouldTypecheck) {
    const types = await typecheckConsumer(dir, {
      ...(subpaths ? { subpaths } : {}),
      svelte: svelteCheck,
    });
    if (surface) surface.types = types;
  }

  await execFileAsync('npm', ['run', 'build'], {
    cwd: dir,
    env: process.env,
    maxBuffer: 64 * 1024 * 1024,
  });

  const distCandidates = [
    join(dir, 'dist'),
    join(dir, 'build'),
    join(dir, '.svelte-kit/output/client'),
  ];
  const dist = distCandidates.find((p) => existsSync(p)) ?? join(dir, 'dist');
  if (!existsSync(dist)) {
    throw new Error(`Build produced no dist for ${consumer.id} in ${dir}`);
  }
  return { dir, dist, ...(surface ? { surface } : {}) };
}

export async function run(cmd: string, args: string[], cwd: string): Promise<string> {
  const { stdout, stderr } = await execFileAsync(cmd, args, {
    cwd,
    env: process.env,
    maxBuffer: 20 * 1024 * 1024,
  });
  return `${stdout}${stderr}`;
}
