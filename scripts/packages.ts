/**
 * `pnpm verify:packages`: build, pack and check every publishable package.
 * Nothing is published here. The packed manifests are publish-ready: real
 * versions, intentional dependency ranges, and no `private` flag.
 *
 * For each workspace package under `packages/` (except {@link NEVER_PACKED}):
 * 1. **Build** `src/` with `@sveltejs/package` into `tmp/packages/stage/<dir>/dist`,
 *    with `rewriteRelativeImportExtensions`, so `./x.ts` imports become `./x.js`
 *    (declarations are rewritten the same way). A sibling `generated/typescript/`
 *    tree, when present, is compiled into the matching `dist/generated/typescript/`
 *    path and its imports are mapped into that tree. Any declaration diagnostic
 *    fails the package.
 * 2. **Manifest**: derive the published `package.json` from the source one.
 *    Every `./src/**.ts` export target maps to `./dist/**.js` (`types` to
 *    `.d.ts`), `.svelte` and `.css` keep their names, `workspace:` ranges
 *    become the exact workspace version, and `files` is `["dist"]`. There is
 *    no hand-written publish map to drift from the source exports.
 * 3. **Pack** with `npm pack` into `tmp/packages/tarballs/`, and record each
 *    tarball's SHA-256 in `tmp/packages/SHA256SUMS`.
 * 4. **Check** each tarball with publint (strict: warnings fail) and
 *    arethetypeswrong (ESM-only: CommonJS and `node10` resolution are out
 *    of scope, every other problem fails).
 *
 *   pnpm verify:packages                     every package
 *   pnpm verify:packages --filter core,tokens   only these (directory or package name)
 *   pnpm verify:packages --json              the report as JSON
 */
import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join, posix, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/** Workspace packages that are never packed: the examples registry is demo
 * code. (@texuli/editor left this list in PLAN_009 G17, publishable from 0.5.0;
 * @texuli/pages left it in 0.7.0, its first release with @texuli/document.) */
export const NEVER_PACKED: readonly string[] = ['@texuli/examples'];

/** attw resolution kinds outside the ESM-only support policy. */
export const IGNORED_RESOLUTIONS: readonly string[] = ['node10', 'node16-cjs'];

export type Json = string | number | boolean | null | Json[] | { [key: string]: Json };
export type Manifest = { [key: string]: Json };

export interface WorkspacePackage {
  /** Directory name under `packages/`. */
  dir: string;
  name: string;
  version: string;
  manifest: Manifest;
}

export interface PackageReport {
  name: string;
  dir: string;
  ok: boolean;
  tarball?: string;
  sha256?: string;
  bytes?: number;
  files?: number;
  /** Every problem, each prefixed with its source (`build`, `manifest`, `publint`, `attw`). */
  problems: string[];
  /** attw problems dropped by a named exception, counted per exception (never silent). */
  exceptions: Record<string, number>;
}

// ── manifest ─────────────────────────────────────────────────────────────

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

/**
 * The published path for a source export target. `types` targets become
 * declarations; other conditions become the emitted JavaScript. Returns an
 * error string for targets the build cannot produce.
 */
export function distTarget(target: string, condition: string): string {
  if (!target.startsWith('./src/')) {
    throw new Error(`export target outside src/: ${target}`);
  }
  const path = `./dist/${target.slice('./src/'.length)}`;
  if (/\.d\.ts$/.test(path)) return path;
  if (/\.ts$/.test(path)) return path.replace(/\.ts$/, condition === 'types' ? '.d.ts' : '.js');
  if (/\.svelte$/.test(path)) return condition === 'types' ? `${path}.d.ts` : path;
  if (/\.(css|json)$/.test(path)) return path;
  throw new Error(`unsupported export target: ${target}`);
}

/**
 * Map one export value. A bare `.css` subpath also gets a `types` condition
 * pointing at an `export {}` declaration, added to `stubs`, so TypeScript can
 * resolve the side-effect import (attw reports a CSS export without one as
 * `NoResolution`).
 */
function mapExport(
  value: unknown,
  condition: string,
  at: string,
  problems: string[],
  stubs: string[] = []
): Json {
  if (typeof value === 'string' && condition === 'subpath' && value.endsWith('.css')) {
    const css = mapExport(value, 'default', at, problems) as string;
    stubs.push(`${css}.d.ts`);
    return { types: `${css}.d.ts`, default: css };
  }
  if (typeof value === 'string') {
    try {
      return distTarget(value, condition);
    } catch (error) {
      problems.push(`manifest: ${at}: ${(error as Error).message}`);
      return value;
    }
  }
  if (isRecord(value)) {
    const out: { [key: string]: Json } = {};
    for (const [key, inner] of Object.entries(value)) {
      const next = key.startsWith('.') ? 'subpath' : key;
      out[key] = mapExport(inner, next, `${at}.${key}`, problems, stubs);
    }
    return out;
  }
  problems.push(`manifest: ${at}: unsupported export value`);
  return null;
}

function pinWorkspace(deps: unknown, versions: ReadonlyMap<string, string>, problems: string[]) {
  if (!isRecord(deps)) return undefined;
  const out: { [key: string]: Json } = {};
  for (const [name, range] of Object.entries(deps)) {
    if (typeof range !== 'string') continue;
    let pinned = range;
    if (range.startsWith('workspace:')) {
      const version = versions.get(name);
      if (version === undefined) problems.push(`manifest: ${name} is not a workspace package`);
      pinned = version ?? range;
    }
    // RELEASE.md "Workspace dependencies and consumers": no published
    // manifest may carry a workspace/link/file protocol or the 0.0.0
    // placeholder — packed ranges are real semver ranges only.
    if (/^(workspace|link|file):/.test(pinned) || pinned === '0.0.0') {
      problems.push(
        `manifest: ${name}: published range must be a real semver range, got "${pinned}"`
      );
    }
    out[name] = pinned;
  }
  return out;
}

/** Fields copied verbatim from the source manifest, in this order. `private`
 * is deliberately absent: the packed manifest is publish-ready, and npm
 * refuses to publish a package that carries `private: true`. */
const KEPT_FIELDS = [
  'name',
  'version',
  'description',
  'keywords',
  'homepage',
  'bugs',
  'license',
  'author',
  'repository',
  'type',
  'sideEffects',
] as const;

/**
 * The published `package.json` for `pkg`, derived from its source manifest,
 * plus any problems found deriving it.
 */
export function publishManifest(
  pkg: WorkspacePackage,
  versions: ReadonlyMap<string, string>
): { manifest: Manifest; problems: string[]; stubs: string[] } {
  const problems: string[] = [];
  const stubs: string[] = [];
  const source = pkg.manifest;
  const manifest: Manifest = {};
  for (const field of KEPT_FIELDS) {
    const value = source[field];
    if (value !== undefined) manifest[field] = value;
  }
  if (!isRecord(source.exports)) problems.push('manifest: no exports map');
  else manifest.exports = mapExport(source.exports, 'root', 'exports', problems, stubs);
  // Subpath imports (`#name`) point into src like exports do; map them to the
  // dist tree too, or a packed `import '#name'` would not resolve.
  if (isRecord(source.imports)) {
    manifest.imports = mapExport(source.imports, 'root', 'imports', problems, stubs);
  }
  if (isRecord(source.bin)) {
    const bin: { [key: string]: Json } = {};
    for (const [command, target] of Object.entries(source.bin)) {
      bin[command] = mapExport(target, 'default', `bin.${command}`, problems);
    }
    manifest.bin = bin;
  }
  manifest.files = ['dist'];
  for (const field of ['dependencies', 'peerDependencies', 'optionalDependencies'] as const) {
    const pinned = pinWorkspace(source[field], versions, problems);
    if (pinned && Object.keys(pinned).length > 0) manifest[field] = pinned;
  }
  if (isRecord(source.peerDependenciesMeta)) {
    manifest.peerDependenciesMeta = source.peerDependenciesMeta as Json;
  }
  if (source.engines !== undefined) manifest.engines = source.engines;
  return { manifest, problems, stubs };
}

/**
 * Fix specifiers in an emitted declaration file: relative `.ts` imports become
 * `.js` (TypeScript's `rewriteRelativeImportExtensions` only rewrites
 * JavaScript), and side-effect CSS imports (`import './x.css';`, which
 * svelte2tsx copies from component scripts) are dropped: a declaration
 * carries no styles, and the emitted JavaScript and Svelte files keep the
 * import.
 */
export function rewriteDeclarationSpecifiers(text: string): string {
  return text
    .replace(/^import\s*(['"])\.\.?\/[^'"\n]+\.css\1;?[ \t]*\r?\n/gm, '')
    .replace(
      /((?:from|import)\s*\(?\s*)(['"])(\.\.?\/[^'"\n]+?)(?<!\.d)\.ts\2/g,
      (_match, head: string, quote: string, path: string) => `${head}${quote}${path}.js${quote}`
    );
}

/** Point source imports from the sibling generated tree at its packed dist path. */
export function rewriteGeneratedTypeScriptSpecifiers(text: string): string {
  return text.replace(
    /((?:from|import)\s*\(?\s*)(['"])\.\.\/generated\/typescript\//g,
    '$1$2./generated/typescript/'
  );
}

/** Root ambient filename shipped so consumers resolve side-effect CSS imports. */
export const CSS_MODULES_DTS = 'css-modules.d.ts';

/** Body of {@link CSS_MODULES_DTS}: ambient `*.css` for library `.svelte` scripts. */
export const CSS_MODULES_DTS_SOURCE = "declare module '*.css';\n";

/** Colocated stub next to every shipped `.css` file (`import './x.css'` resolves). */
export const CSS_FILE_DTS_SOURCE = 'export {};\n';

/**
 * Relative `/// <reference path>` target from `fromFile` to `toFile`, always
 * starting with `./` or `../` so TypeScript treats it as a path reference.
 */
export function referencePathTo(fromFile: string, toFile: string): string {
  let rel = relative(dirname(fromFile), toFile).replace(/\\/g, '/');
  if (!rel.startsWith('.')) rel = `./${rel}`;
  return rel;
}

/**
 * Make packed declarations self-sufficient for side-effect CSS imports inside
 * shipped `.svelte` sources (consumers run svelte-check/tsc without their own
 * `*.css` ambient):
 *
 * 1. Every `*.css` file gets a sibling `*.css.d.ts` (`export {}`) when missing.
 * 2. Root {@link CSS_MODULES_DTS} ambient is written when the package ships CSS.
 * 3. Every entry `index.d.ts` and every `*.svelte.d.ts` gets
 *    `/// <reference path="…/css-modules.d.ts" />` so importing a subpath
 *    pulls the ambient into the consumer program.
 *
 * No-op when `dist` has no `.css` files.
 */
export function ensureCssTypeDeclarations(dist: string): {
  cssFiles: number;
  stubsWritten: number;
  referencesAdded: number;
  ambient: boolean;
} {
  if (!existsSync(dist)) {
    return { cssFiles: 0, stubsWritten: 0, referencesAdded: 0, ambient: false };
  }
  const files = walkFiles(dist);
  const cssFiles = files.filter((file) => file.endsWith('.css') && !file.endsWith('.css.d.ts'));
  if (cssFiles.length === 0) {
    return { cssFiles: 0, stubsWritten: 0, referencesAdded: 0, ambient: false };
  }

  let stubsWritten = 0;
  for (const css of cssFiles) {
    const stub = `${css}.d.ts`;
    if (!existsSync(stub)) {
      writeFileSync(stub, CSS_FILE_DTS_SOURCE);
      stubsWritten += 1;
    }
  }

  const ambientFile = join(dist, CSS_MODULES_DTS);
  writeFileSync(ambientFile, CSS_MODULES_DTS_SOURCE);

  let referencesAdded = 0;
  const refreshed = walkFiles(dist);
  for (const file of refreshed) {
    if (!file.endsWith('.d.ts')) continue;
    if (file === ambientFile) continue;
    if (file.endsWith('.css.d.ts')) continue;
    const base = file.split(/[/\\]/).pop() ?? '';
    const isEntryIndex = base === 'index.d.ts';
    const isSvelteDts = base.endsWith('.svelte.d.ts');
    if (!isEntryIndex && !isSvelteDts) continue;

    const path = referencePathTo(file, ambientFile);
    const marker = `/// <reference path="${path}" />`;
    let text = readFileSync(file, 'utf8');
    if (text.includes(CSS_MODULES_DTS)) continue;
    // Drop a stale reference to another css ambient and prepend ours.
    text = text.replace(/^\/\/\/\s*<reference\s+path="[^"]*css[^"]*"\s*\/>\s*\r?\n/gm, '');
    writeFileSync(file, `${marker}\n${text}`);
    referencesAdded += 1;
  }

  return {
    cssFiles: cssFiles.length,
    stubsWritten,
    referencesAdded,
    ambient: true,
  };
}

// ── workspace ────────────────────────────────────────────────────────────

/** Every packable workspace package, sorted by directory. */
export function readWorkspace(root = ROOT): WorkspacePackage[] {
  const dirs = readdirSync(join(root, 'packages'), { withFileTypes: true })
    .filter(
      (entry) =>
        entry.isDirectory() && existsSync(join(root, 'packages', entry.name, 'package.json'))
    )
    .map((entry) => entry.name)
    .sort();
  return dirs.map((dir) => {
    const manifest = JSON.parse(
      readFileSync(join(root, 'packages', dir, 'package.json'), 'utf8')
    ) as Manifest;
    return {
      dir,
      name: String(manifest.name),
      version: String(manifest.version),
      manifest,
    };
  });
}

/** The packages to pack: not {@link NEVER_PACKED}, and matching `filters` when given. */
export function selectPackages(
  all: readonly WorkspacePackage[],
  filters: readonly string[]
): WorkspacePackage[] {
  const packable = all.filter((pkg) => !NEVER_PACKED.includes(pkg.name));
  if (filters.length === 0) return packable;
  const unknown = filters.filter((f) => !packable.some((p) => p.dir === f || p.name === f));
  if (unknown.length > 0) throw new Error(`Unknown package: ${unknown.join(', ')}`);
  return packable.filter((pkg) => filters.includes(pkg.dir) || filters.includes(pkg.name));
}

// ── build, pack, check ───────────────────────────────────────────────────

function run(
  command: string,
  args: readonly string[],
  cwd: string
): Promise<{ code: number; output: string }> {
  return new Promise((done) => {
    execFile(command, [...args], { cwd, maxBuffer: 64 * 1024 * 1024 }, (error, stdout, stderr) => {
      const code = error ? (typeof error.code === 'number' ? error.code : 1) : 0;
      done({ code, output: `${stdout}${stderr}` });
    });
  });
}

function walkFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);
    return entry.isDirectory() ? walkFiles(full) : [full];
  });
}

/**
 * Parse `npm pack --json` stdout. npm may print warnings before/after the JSON
 * array; take the outermost `[`…`]` slice.
 */
export function parseNpmPackJson(
  output: string
): { filename: string; entryCount: number } | undefined {
  const start = output.indexOf('[');
  const end = output.lastIndexOf(']');
  if (start < 0 || end < start) return undefined;
  try {
    const list = JSON.parse(output.slice(start, end + 1)) as Array<{
      filename?: string;
      entryCount?: number;
    }>;
    const first = list[0];
    if (!first?.filename) return undefined;
    return { filename: first.filename, entryCount: first.entryCount ?? 0 };
  } catch {
    return undefined;
  }
}

/** Lines of svelte-package output that are diagnostics (it does not fail on them). */
export function declarationDiagnostics(output: string): string[] {
  return output
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => /^- /.test(line) || /\berror\b|TS\d{4}/i.test(line))
    .map((line) => line.replace(/^- /, ''));
}

/**
 * Compile generated TypeScript that lives beside `src/` into its matching
 * `dist/` path. Spec declarations refer to `../generated/typescript/*.js`, so
 * the packed package must ship both JavaScript and declarations there.
 */
export async function compileGeneratedTypeScript(
  sourceDir: string,
  outputDir: string,
  root = ROOT
): Promise<string[]> {
  if (!existsSync(sourceDir)) return [];
  const sources = walkFiles(sourceDir).filter((file) => file.endsWith('.ts'));
  if (sources.length === 0) return [];
  mkdirSync(outputDir, { recursive: true });
  const { code, output } = await run(
    'pnpm',
    [
      'exec',
      'tsc',
      '--target',
      'ES2022',
      '--module',
      'ESNext',
      '--moduleResolution',
      'Bundler',
      '--strict',
      '--declaration',
      '--rewriteRelativeImportExtensions',
      '--rootDir',
      sourceDir,
      '--outDir',
      outputDir,
      ...sources,
    ],
    root
  );
  if (code === 0) {
    for (const file of walkFiles(outputDir).filter((path) => path.endsWith('.d.ts'))) {
      writeFileSync(file, rewriteDeclarationSpecifiers(readFileSync(file, 'utf8')));
    }
    return [];
  }
  return [`build: generated TypeScript compile failed: ${output.trim().slice(0, 2000)}`];
}

/**
 * The manifest svelte-package reads while it builds: the source one without
 * conditional subpath imports.
 *
 * svelte-package turns every `#name` entry of `imports` into a build-time
 * alias, and for a conditional entry it takes the `default` target. A
 * `{ browser, default }` pair such as `@texuli/slides`' `#deck-ssr` would be
 * resolved once, at pack time, to its server file: every packed browser
 * bundle would then import the server-only preload. Without those entries
 * svelte-package keeps the `#name` specifier, and the packed manifest maps
 * `imports` to the dist tree ({@link publishManifest}), so the consumer's
 * bundler picks the condition, as it does from source. Plain string entries
 * stay: one target, so resolving them early changes nothing.
 */
export function svelteToolManifest(manifest: Manifest): Manifest {
  const imports = manifest.imports;
  if (!isRecord(imports)) return manifest;
  const kept = Object.fromEntries(
    Object.entries(imports).filter(([, target]) => typeof target === 'string')
  );
  const { imports: _dropped, ...rest } = manifest;
  return Object.keys(kept).length > 0 ? { ...rest, imports: kept } : rest;
}

/**
 * Build `pkg`'s `src/` with svelte-package into `<stage>/dist`, exactly as it
 * is packed. `types: false` skips the declarations (the emitted JavaScript and
 * Svelte files are the same), for checks that only bundle the output, such as
 * the dist-parity check (`scripts/dist-parity.ts`).
 *
 * svelte-package runs in a scratch folder under the stage that holds
 * {@link svelteToolManifest} as its `package.json` (it reads the manifest of
 * its working directory), with the package's `src/` as an absolute input; its
 * `.svelte-kit/` scratch output stays in that folder too.
 */
export async function buildPackage(
  pkg: WorkspacePackage,
  root: string,
  stage: string,
  options: { types?: boolean } = {}
): Promise<string[]> {
  const types = options.types ?? true;
  const packageDir = join(root, 'packages', pkg.dir);
  rmSync(stage, { recursive: true, force: true });
  mkdirSync(stage, { recursive: true });
  const tsconfig = join(stage, 'tsconfig.build.json');
  writeFileSync(
    tsconfig,
    JSON.stringify({
      extends: join(packageDir, 'tsconfig.json'),
      compilerOptions: {
        rewriteRelativeImportExtensions: true,
        allowImportingTsExtensions: false,
        noEmit: false,
      },
      include: [join(packageDir, 'src')],
    })
  );
  const dist = join(stage, 'dist');
  const cwd = join(stage, '.svelte-package');
  mkdirSync(cwd);
  writeFileSync(
    join(cwd, 'package.json'),
    `${JSON.stringify(svelteToolManifest(pkg.manifest), null, 2)}\n`
  );
  const { code, output } = await run(
    join(ROOT, 'node_modules', '.bin', 'svelte-package'),
    [
      '--input',
      join(packageDir, 'src'),
      '--output',
      dist,
      '--tsconfig',
      tsconfig,
      ...(types ? [] : ['--no-types']),
    ],
    cwd
  );
  rmSync(tsconfig);
  rmSync(cwd, { recursive: true, force: true });
  const problems = declarationDiagnostics(output).map((line) => `build: ${line}`);
  if (code !== 0)
    problems.push(`build: svelte-package exited ${code}: ${output.trim().slice(0, 2000)}`);
  if (!existsSync(dist)) return [...problems, 'build: no dist emitted'];
  problems.push(
    ...(await compileGeneratedTypeScript(
      join(packageDir, 'generated', 'typescript'),
      join(dist, 'generated', 'typescript'),
      root
    ))
  );
  const generatedDist = join(dist, 'generated', 'typescript');
  for (const file of walkFiles(dist).filter(
    (path) => path.endsWith('.js') || path.endsWith('.d.ts')
  )) {
    let text = readFileSync(file, 'utf8');
    if (file.endsWith('.d.ts')) text = rewriteDeclarationSpecifiers(text);
    if (existsSync(generatedDist)) text = rewriteGeneratedTypeScriptSpecifiers(text);
    writeFileSync(file, text);
  }
  // Self-sufficient CSS types for consumers (no local *.css ambient required).
  ensureCssTypeDeclarations(dist);
  return problems;
}

async function publintProblems(tarball: Buffer): Promise<string[]> {
  const { publint } = await import('publint');
  const { formatMessage } = await import('publint/utils');
  const data = tarball.buffer.slice(
    tarball.byteOffset,
    tarball.byteOffset + tarball.byteLength
  ) as ArrayBuffer;
  const result = await publint({ pack: { tarball: data }, strict: true, level: 'suggestion' });
  return result.messages.map(
    (message) => `publint ${message.type}: ${formatMessage(message, result.pkg) ?? message.code}`
  );
}

/**
 * The one named attw exception, `svelte-component-declaration` (the same one
 * Protoyard uses). TypeScript's `node16` mode never resolves `./X.svelte`: it
 * looks for `X.d.svelte.ts`, while svelte-package emits `X.svelte.d.ts`, which
 * bundler resolution, Vite and svelte-check read. Only that problem is
 * dropped, and only when the component and its declaration are both in the
 * tarball, so a missing declaration still fails. Drops are counted.
 */
export const SVELTE_COMPONENT_EXCEPTION = 'svelte-component-declaration';

export interface AttwProblemLike {
  kind: string;
  resolutionOption?: string;
  moduleSpecifier?: string;
  fileName?: string;
}

export function isSvelteComponentDeclarationProblem(
  problem: AttwProblemLike,
  packageName: string,
  files: ReadonlySet<string>
): boolean {
  if (problem.kind !== 'InternalResolutionError' || problem.resolutionOption !== 'node16')
    return false;
  const specifier = problem.moduleSpecifier ?? '';
  if (!/^\.\.?\/[^?#]*\.svelte$/.test(specifier)) return false;
  const prefix = `/node_modules/${packageName}/`;
  if (!problem.fileName?.startsWith(prefix)) return false;
  const from = posix.dirname(problem.fileName.slice(prefix.length));
  const component = posix.normalize(posix.join(from, specifier));
  if (component.startsWith('../')) return false;
  return files.has(component) && files.has(`${component}.d.ts`);
}

async function attwProblems(
  tarball: Buffer,
  exceptions: Record<string, number>
): Promise<string[]> {
  const attw = await import('@arethetypeswrong/core');
  const pkg = attw.createPackageFromTarballData(new Uint8Array(tarball));
  const result = await attw.checkPackage(pkg);
  if (result.types === false) return ['attw: the package ships no types'];
  const prefix = `/node_modules/${result.packageName}/`;
  const files = new Set(
    pkg
      .listFiles()
      .filter((file) => file.startsWith(prefix))
      .map((file) => file.slice(prefix.length))
  );
  return result.problems
    .filter(
      (problem) =>
        !('resolutionKind' in problem) || !IGNORED_RESOLUTIONS.includes(problem.resolutionKind)
    )
    .filter((problem) => {
      const excepted = isSvelteComponentDeclarationProblem(
        problem as AttwProblemLike,
        result.packageName,
        files
      );
      if (excepted)
        exceptions[SVELTE_COMPONENT_EXCEPTION] = (exceptions[SVELTE_COMPONENT_EXCEPTION] ?? 0) + 1;
      return !excepted;
    })
    .map((problem) => {
      const where = 'entrypoint' in problem ? ` ${problem.entrypoint}` : '';
      const kind = 'resolutionKind' in problem ? ` (${problem.resolutionKind})` : '';
      const detail = problem as AttwProblemLike;
      const site =
        detail.moduleSpecifier !== undefined
          ? ` ${detail.fileName ?? ''} imports "${detail.moduleSpecifier}" (${detail.resolutionOption ?? ''})`
          : '';
      return `attw ${problem.kind}${where}${kind}${site}`;
    });
}

/** Build, pack and check every selected package. */
export async function verifyPackages(
  options: { root?: string; filters?: readonly string[] } = {}
): Promise<{ ok: boolean; out: string; packages: PackageReport[] }> {
  const root = options.root ?? ROOT;
  const all = readWorkspace(root);
  const versions = new Map(all.map((pkg) => [pkg.name, pkg.version]));
  const selected = selectPackages(all, options.filters ?? []);
  const out = join(root, 'tmp', 'packages');
  const tarballs = join(out, 'tarballs');
  mkdirSync(tarballs, { recursive: true });
  const license = join(root, 'LICENSE');

  const reports: PackageReport[] = [];
  for (const pkg of selected) {
    const stage = join(out, 'stage', pkg.dir);
    const problems = await buildPackage(pkg, root, stage);
    const derived = publishManifest(pkg, versions);
    problems.push(...derived.problems);
    for (const stub of derived.stubs) writeFileSync(join(stage, stub), 'export {};\n');
    writeFileSync(join(stage, 'package.json'), `${JSON.stringify(derived.manifest, null, 2)}\n`);
    const readme = join(root, 'packages', pkg.dir, 'README.md');
    if (existsSync(readme)) cpSync(readme, join(stage, 'README.md'));
    else problems.push('manifest: no README.md');
    const ownLicense = join(root, 'packages', pkg.dir, 'LICENSE');
    cpSync(existsSync(ownLicense) ? ownLicense : license, join(stage, 'LICENSE'));

    const report: PackageReport = {
      name: pkg.name,
      dir: pkg.dir,
      ok: false,
      problems,
      exceptions: {},
    };
    const packed = await run('npm', ['pack', '--json', '--pack-destination', tarballs], stage);
    if (packed.code !== 0) {
      problems.push(`pack: npm pack exited ${packed.code}: ${packed.output.trim().slice(0, 500)}`);
    } else {
      const info = parseNpmPackJson(packed.output);
      if (info) {
        const file = join(tarballs, info.filename);
        const bytes = readFileSync(file);
        report.tarball = relative(root, file);
        report.sha256 = createHash('sha256').update(bytes).digest('hex');
        report.bytes = bytes.byteLength;
        report.files = info.entryCount;
        problems.push(
          ...(await publintProblems(bytes)),
          ...(await attwProblems(bytes, report.exceptions))
        );
      } else {
        problems.push(
          `pack: could not parse npm pack --json output: ${packed.output.trim().slice(0, 500)}`
        );
      }
    }
    report.ok = problems.length === 0;
    reports.push(report);
  }

  const sums = reports
    .filter((r) => r.sha256 && r.tarball)
    .map(
      (r) => `${r.sha256}  ${relative(join(root, 'tmp', 'packages'), join(root, r.tarball ?? ''))}`
    );
  writeFileSync(join(out, 'SHA256SUMS'), `${sums.join('\n')}\n`);
  writeFileSync(join(out, 'report.json'), `${JSON.stringify(reports, null, 2)}\n`);
  return { ok: reports.every((r) => r.ok), out: relative(root, out), packages: reports };
}

// ── CLI ──────────────────────────────────────────────────────────────────

export function parseArgs(argv: readonly string[]): { filters: string[]; json: boolean } {
  const filters: string[] = [];
  let json = false;
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i] as string;
    if (arg === '--json') json = true;
    else if (arg === '--filter') {
      const value = argv[++i];
      if (!value) throw new Error('--filter needs a package');
      filters.push(
        ...value
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean)
      );
    } else throw new Error(`Unknown option: ${arg}`);
  }
  return { filters, json };
}

async function main(): Promise<number> {
  const args = parseArgs(process.argv.slice(2));
  const result = await verifyPackages({ filters: args.filters });
  if (args.json) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    for (const pkg of result.packages) {
      const size =
        pkg.bytes === undefined ? '' : ` ${(pkg.bytes / 1024).toFixed(1)} KiB, ${pkg.files} files`;
      console.log(
        `${pkg.ok ? '✓' : '✗'} ${pkg.name}${size}${pkg.sha256 ? ` sha256 ${pkg.sha256}` : ''}`
      );
      for (const problem of pkg.problems) console.log(`    ${problem}`);
      for (const [name, count] of Object.entries(pkg.exceptions)) {
        console.log(`    exception ${name}: ${count} attw problem(s) dropped`);
      }
    }
    console.log(
      `${result.ok ? 'All packages pass' : 'Packaging failed'}; tarballs and SHA256SUMS in ${result.out}/`
    );
  }
  return result.ok ? 0 : 1;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().then(
    (code) => {
      process.exitCode = code;
    },
    (error: unknown) => {
      console.error(error instanceof Error ? error.message : String(error));
      process.exitCode = 1;
    }
  );
}
