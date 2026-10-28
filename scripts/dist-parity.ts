/**
 * Dist parity: a consumer bundle built from the packed `dist/` must be no
 * bigger than the same bundle built from the workspace sources.
 *
 * Two throwaway consumer apps import the same representative entry
 * ({@link PARITY_ENTRY}: styled components, chart families, the block family
 * loaders and the slides stage):
 *
 * - `src`: every workspace package linked the way `link:` or `workspace:`
 *   dependencies are (`node_modules/<name>` → `packages/<dir>`);
 * - `dist`: every package as npm installs it: the svelte-package output plus
 *   the publish manifest from `publishManifest`, built with the same
 *   `buildPackage` that `pnpm verify:packages` packs (declarations skipped,
 *   they never reach a bundle), or, with `--tarballs`, extracted from
 *   `tmp/packages/tarballs/`.
 *
 * Both are built with Vite in production mode, minified, with `svelte`
 * external (the runtime is the same in both), and every emitted chunk and
 * stylesheet is measured raw and with gzip (level 9). The dist build passes
 * when its totals stay within {@link PARITY_TOLERANCE} of the source build
 * and it emits no more files.
 *
 *   pnpm exec tsx scripts/dist-parity.ts             build both, print the table
 *   pnpm exec tsx scripts/dist-parity.ts --tarballs  use the packed tarballs
 *   pnpm exec tsx scripts/dist-parity.ts --json      the report as JSON
 */
import { execFile } from 'node:child_process';
import { existsSync, mkdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { availableParallelism } from 'node:os';
import { dirname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';
import { buildPackage, publishManifest, readWorkspace, type WorkspacePackage } from './packages.ts';

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/**
 * Largest allowed growth of the dist build over the source build, as a
 * fraction, for the raw and the gzip totals. Measured 2026-10-28 the two
 * builds differ by under 0.05 % (the dist build is the smaller one); 2 %
 * leaves room for emit noise and still catches a packaging regression such
 * as lost tree-shaking (sideEffects) or a duplicated package.
 */
export const PARITY_TOLERANCE = 0.02;

/** Packages the entry imports; their workspace dependencies come along. */
export const PARITY_ROOTS: readonly string[] = [
  'texuli',
  '@texuli/charts',
  '@texuli/blocks',
  '@texuli/slides',
];

/** The consumer entry: what an app shell, a dashboard card and a deck import. */
export const PARITY_ENTRY = `export { Button } from 'texuli/button';
export { Card } from 'texuli/card';
export { Checkbox } from 'texuli/choice';
export { Dialog } from 'texuli/dialog';
export { Gauge, Sparkline } from '@texuli/charts/compact';
export { Sparkline as SparklineLite } from '@texuli/charts/sparkline-lite';
export { BarChart, LineChart } from '@texuli/charts/cartesian';
export {
  loadDataFamily,
  loadMediaFamily,
  loadStructureFamily,
  loadTextFamily,
} from '@texuli/blocks';
export { DeckStage } from '@texuli/slides/stage';
`;

/** `roots` and every workspace package they depend on, transitively. */
export function dependencyClosure(
  all: readonly WorkspacePackage[],
  roots: readonly string[]
): WorkspacePackage[] {
  const byName = new Map(all.map((pkg) => [pkg.name, pkg]));
  const seen = new Set<string>();
  const visit = (name: string) => {
    const pkg = byName.get(name);
    if (!pkg || seen.has(name)) return;
    seen.add(name);
    const deps = pkg.manifest.dependencies;
    if (deps && typeof deps === 'object' && !Array.isArray(deps)) {
      for (const dep of Object.keys(deps)) visit(dep);
    }
  };
  for (const root of roots) visit(root);
  return all.filter((pkg) => seen.has(pkg.name));
}

function run(command: string, args: readonly string[], cwd: string): Promise<string> {
  return new Promise((done, fail) => {
    execFile(command, [...args], { cwd, maxBuffer: 64 * 1024 * 1024 }, (error, stdout, stderr) => {
      if (error) fail(new Error(`${command} ${args.join(' ')}: ${stderr || error.message}`));
      else done(stdout);
    });
  });
}

/** Run `task` over `items`, at most `limit` at a time. */
async function pool<T>(items: readonly T[], limit: number, task: (item: T) => Promise<void>) {
  const queue = [...items];
  const workers = Array.from({ length: Math.min(limit, queue.length) }, async () => {
    for (let item = queue.shift(); item !== undefined; item = queue.shift()) await task(item);
  });
  await Promise.all(workers);
}

export interface ParityConsumers {
  src: string;
  dist: string;
  packages: string[];
}

/**
 * Write the two consumer apps under `out` (replacing what is there). The
 * `dist` packages are copies, never links, so their imports resolve inside
 * the consumer's `node_modules` exactly as an npm install would.
 */
export async function prepareConsumers(options: {
  root?: string;
  out: string;
  tarballs?: boolean;
  concurrency?: number;
}): Promise<ParityConsumers> {
  const root = options.root ?? ROOT;
  const all = readWorkspace(root);
  const versions = new Map(all.map((pkg) => [pkg.name, pkg.version]));
  const packages = dependencyClosure(all, PARITY_ROOTS);
  rmSync(options.out, { recursive: true, force: true });
  const consumers = { src: join(options.out, 'src'), dist: join(options.out, 'dist') };
  for (const dir of Object.values(consumers)) {
    mkdirSync(join(dir, 'node_modules', '@texuli'), { recursive: true });
    symlinkSync(join(root, 'node_modules', 'svelte'), join(dir, 'node_modules', 'svelte'), 'dir');
    writeFileSync(join(dir, 'entry.js'), PARITY_ENTRY);
  }
  for (const pkg of packages) {
    symlinkSync(
      join(root, 'packages', pkg.dir),
      join(consumers.src, 'node_modules', pkg.name),
      'dir'
    );
  }
  const problems: string[] = [];
  await pool(packages, options.concurrency ?? availableParallelism(), async (pkg) => {
    const target = join(consumers.dist, 'node_modules', pkg.name);
    if (options.tarballs) {
      const tarball = join(
        root,
        'tmp',
        'packages',
        'tarballs',
        `${pkg.name.replace(/^@/, '').replace('/', '-')}-${pkg.version}.tgz`
      );
      if (!existsSync(tarball)) {
        problems.push(`${pkg.name}: no tarball ${tarball} (run pnpm verify:packages)`);
        return;
      }
      mkdirSync(target, { recursive: true });
      await run('tar', ['-xzf', tarball, '-C', target, '--strip-components=1'], root);
      return;
    }
    const built = await buildPackage(pkg, root, target, { types: false });
    problems.push(...built.map((problem) => `${pkg.name}: ${problem}`));
    const derived = publishManifest(pkg, versions);
    problems.push(...derived.problems.map((problem) => `${pkg.name}: ${problem}`));
    writeFileSync(join(target, 'package.json'), `${JSON.stringify(derived.manifest, null, 2)}\n`);
  });
  if (problems.length > 0)
    throw new Error(`dist parity staging failed:\n  ${problems.join('\n  ')}`);
  return { ...consumers, packages: packages.map((pkg) => pkg.name) };
}

export interface ParityFile {
  /** Emitted file name. */
  file: string;
  /** Stable key across both builds: the smallest package-relative module the file holds. */
  key: string;
  raw: number;
  gzip: number;
}

export interface ParityBuild {
  files: ParityFile[];
  raw: number;
  gzip: number;
}

/**
 * `<root>/packages/<dir>/src/a/b.ts` and `node_modules/@texuli/<dir>/dist/a/b.js`
 * both become `@texuli/<dir>/a/b`, so chunks pair up across the two builds.
 * The consumer's own entry is `entry`; virtual modules lose their `\0`.
 */
export function moduleKey(id: string, names: ReadonlyMap<string, string>, root = ROOT): string {
  const path = (id.split('?')[0] ?? id).split(sep).join('/').replace(/^\0/, '');
  const packages = `${root.split(sep).join('/')}/packages/`;
  const installed = path.match(/\/node_modules\/((?:@[^/]+\/)?[^/]+)\/(.*)$/);
  let key = path;
  if (installed) key = `${installed[1]}/${installed[2]}`;
  else if (path.startsWith(packages)) {
    const [dir = '', ...rest] = path.slice(packages.length).split('/');
    key = `${names.get(dir) ?? dir}/${rest.join('/')}`;
  } else if (path.endsWith('/entry.js')) key = 'entry';
  return key.replace(/\/(?:src|dist)\//, '/').replace(/\.(?:ts|js)$/, '');
}

/** Build one consumer app and measure every emitted chunk and stylesheet. */
export async function bundleConsumer(dir: string, root = ROOT): Promise<ParityBuild> {
  const [{ build }, { svelte }] = await Promise.all([
    import('vite'),
    import('@sveltejs/vite-plugin-svelte'),
  ]);
  const names = new Map(readWorkspace(root).map((pkg) => [pkg.dir, pkg.name]));
  // Vitest runs with NODE_ENV=test, which compiles Svelte's development output.
  const previous = process.env.NODE_ENV;
  process.env.NODE_ENV = 'production';
  try {
    const result = await build({
      configFile: false,
      logLevel: 'silent',
      mode: 'production',
      root: dir,
      plugins: [svelte({ configFile: false })],
      build: {
        write: false,
        minify: true,
        target: 'es2022',
        cssCodeSplit: true,
        reportCompressedSize: false,
        rollupOptions: {
          input: join(dir, 'entry.js'),
          preserveEntrySignatures: 'strict',
          external: (id: string) => id === 'svelte' || id.startsWith('svelte/'),
        },
      },
    });
    const outputs = (Array.isArray(result) ? result : [result]).flatMap((item) =>
      'output' in item ? item.output : []
    );
    const files: ParityFile[] = outputs.map((file) => {
      const body = file.type === 'chunk' ? file.code : file.source;
      const bytes = typeof body === 'string' ? new TextEncoder().encode(body) : body;
      const modules =
        file.type === 'chunk'
          ? file.moduleIds
          : outputs.flatMap((chunk) =>
              chunk.type === 'chunk' && chunk.viteMetadata?.importedCss.has(file.fileName)
                ? chunk.moduleIds.filter((id) => id.includes('.css') || id.includes('type=style'))
                : []
            );
      const keys = modules.map((id) => moduleKey(id, names, root)).sort();
      const ext = file.fileName.endsWith('.css') ? 'css' : 'js';
      return {
        file: file.fileName,
        key: `${keys[0] ?? file.name ?? file.fileName} (${ext})`,
        raw: bytes.byteLength,
        gzip: gzipSync(bytes, { level: 9 }).byteLength,
      };
    });
    files.sort((a, b) => a.key.localeCompare(b.key));
    return {
      files,
      raw: files.reduce((sum, file) => sum + file.raw, 0),
      gzip: files.reduce((sum, file) => sum + file.gzip, 0),
    };
  } finally {
    if (previous === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previous;
  }
}

export interface ParityResult {
  ok: boolean;
  /** dist ÷ src, raw bytes. */
  rawRatio: number;
  /** dist ÷ src, gzip bytes. */
  gzipRatio: number;
  problems: string[];
}

/** Compare the two builds against {@link PARITY_TOLERANCE}. */
export function compareParity(
  src: ParityBuild,
  dist: ParityBuild,
  tolerance = PARITY_TOLERANCE
): ParityResult {
  const rawRatio = dist.raw / src.raw;
  const gzipRatio = dist.gzip / src.gzip;
  const problems: string[] = [];
  const pct = (ratio: number) => `${((ratio - 1) * 100).toFixed(2)} %`;
  if (rawRatio > 1 + tolerance) {
    problems.push(`dist raw ${dist.raw} B is ${pct(rawRatio)} over src ${src.raw} B`);
  }
  if (gzipRatio > 1 + tolerance) {
    problems.push(`dist gzip ${dist.gzip} B is ${pct(gzipRatio)} over src ${src.gzip} B`);
  }
  if (dist.files.length > src.files.length) {
    const keys = new Set(src.files.map((file) => file.key));
    const extra = dist.files.filter((file) => !keys.has(file.key)).map((file) => file.key);
    problems.push(
      `dist emits ${dist.files.length} files, src ${src.files.length}${extra.length ? ` (only in dist: ${extra.join(', ')})` : ''}`
    );
  }
  return { ok: problems.length === 0, rawRatio, gzipRatio, problems };
}

/** The per-file table: one row per key, src and dist side by side. */
export function formatParity(src: ParityBuild, dist: ParityBuild, result: ParityResult): string {
  const rows = new Map<string, { src?: ParityFile; dist?: ParityFile }>();
  for (const file of src.files) rows.set(file.key, { ...rows.get(file.key), src: file });
  for (const file of dist.files) rows.set(file.key, { ...rows.get(file.key), dist: file });
  const cell = (file?: { raw: number; gzip: number }) =>
    (file ? `${file.raw} / ${file.gzip}` : '-').padStart(18);
  const width = Math.max(...[...rows.keys()].map((key) => key.length), 5);
  const lines = [
    `${'file'.padEnd(width)} ${'src raw / gzip'.padStart(18)} ${'dist raw / gzip'.padStart(18)}`,
  ];
  for (const [key, row] of [...rows].sort(([a], [b]) => a.localeCompare(b))) {
    lines.push(`${key.padEnd(width)} ${cell(row.src)} ${cell(row.dist)}`);
  }
  lines.push(`${'TOTAL'.padEnd(width)} ${cell(src)} ${cell(dist)}`);
  lines.push(
    `dist/src: raw ${result.rawRatio.toFixed(4)}, gzip ${result.gzipRatio.toFixed(4)}; tolerance ${PARITY_TOLERANCE * 100} %; ${result.ok ? 'OK' : `FAIL: ${result.problems.join('; ')}`}`
  );
  return lines.join('\n');
}

/** Stage, build and compare. */
export async function runParity(
  options: { root?: string; out?: string; tarballs?: boolean } = {}
): Promise<{ src: ParityBuild; dist: ParityBuild; result: ParityResult }> {
  const root = options.root ?? ROOT;
  const out = options.out ?? join(root, 'tmp', 'dist-parity');
  const consumers = await prepareConsumers({
    root,
    out,
    ...(options.tarballs === undefined ? {} : { tarballs: options.tarballs }),
  });
  const src = await bundleConsumer(consumers.src, root);
  const dist = await bundleConsumer(consumers.dist, root);
  return { src, dist, result: compareParity(src, dist) };
}

async function main(): Promise<number> {
  const args = process.argv.slice(2);
  for (const arg of args) {
    if (arg !== '--tarballs' && arg !== '--json') throw new Error(`Unknown option: ${arg}`);
  }
  const { src, dist, result } = await runParity({ tarballs: args.includes('--tarballs') });
  if (args.includes('--json')) console.log(JSON.stringify({ src, dist, result }, null, 2));
  else console.log(formatParity(src, dist, result));
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
