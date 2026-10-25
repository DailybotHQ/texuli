/**
 * `pnpm size`: the size gate for every Texuli package entry and primitive.
 *
 * Each export subpath of each package (`@texuli/core`, `texuli`,
 * `@texuli/primitives/dialog`, …) is built on its own with Vite, as a consumer
 * would import it: `export * from '<entry>'`, minified, with `svelte` external
 * (every consumer already ships the Svelte runtime) and every other import,
 * workspace packages included, bundled in. The JavaScript is measured with
 * gzip (level 9) and brotli (quality 11), and the CSS the entry emits with
 * gzip. Each result is compared with `texuli.budgets.json`, and, where the
 * file names one, with the Protoyard package the entry replaces.
 *
 * The run fails when an entry is over budget, has no budget, or is larger than
 * its Protoyard baseline. Budgets only shrink by default: `--update` lowers
 * exact budgets to what was measured (rounded up), and never raises one
 * unless `--allow-grow` is passed too.
 *
 *   pnpm size                       measure, print the table, fail over budget
 *   pnpm size --filter primitives   only entries whose id contains "primitives"
 *   pnpm size --json                the results as JSON
 *   pnpm size --update              tighten exact budgets to the measured sizes
 *   pnpm size --update --allow-grow also raise budgets and add missing ones
 *   pnpm size --protoyard ../protoyard   re-measure the Protoyard baselines
 */
import { execFileSync } from 'node:child_process';
import { mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { brotliCompressSync, constants, gzipSync } from 'node:zlib';

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const BUDGETS_FILE = join(ROOT, 'texuli.budgets.json');

/** Budgets round up to this many bytes, so the next one-byte change does not fail. */
export const BUDGET_STEP = 64;

// ── entries ──────────────────────────────────────────────────────────────

export interface SizeEntry {
  /** `@texuli/core`, `@texuli/primitives/dialog`. */
  id: string;
  /** The package name. */
  packageName: string;
  /** `.` or `./dialog`. */
  subpath: string;
  /** The absolute file the export points at. */
  file: string;
  /** A stylesheet export (`./styles.css`): measured as CSS only. */
  css: boolean;
}

type ExportTarget = string | { [condition: string]: ExportTarget } | null;

/** The file an export resolves to for a browser bundle of Svelte source. */
export function exportFile(target: ExportTarget): string | null {
  if (typeof target === 'string') return target;
  if (!target || typeof target !== 'object') return null;
  for (const condition of ['svelte', 'browser', 'import', 'default']) {
    if (Object.hasOwn(target, condition)) {
      const file = exportFile(target[condition] ?? null);
      if (file) return file;
    }
  }
  return null;
}

function entryId(packageName: string, subpath: string): string {
  return subpath === '.' ? packageName : `${packageName}/${subpath.replace(/^\.\//, '')}`;
}

/**
 * Every measurable export of every package under `<root>/packages`: one entry
 * per subpath, the root (`.`) included. `./package.json`, wildcard subpaths
 * and types-only targets are skipped, as are packages listed in `ignore`.
 */
export async function discoverEntries(
  root: string,
  ignore: readonly string[] = []
): Promise<SizeEntry[]> {
  const packagesDir = join(root, 'packages');
  const entries: SizeEntry[] = [];
  const dirs = (await readdir(packagesDir, { withFileTypes: true }))
    .filter((dirent) => dirent.isDirectory())
    .map((dirent) => dirent.name)
    .sort();
  for (const dir of dirs) {
    let manifest: { name?: string; exports?: ExportTarget | Record<string, ExportTarget> };
    try {
      manifest = JSON.parse(await readFile(join(packagesDir, dir, 'package.json'), 'utf8'));
    } catch {
      continue;
    }
    const name = manifest.name;
    if (!name || ignore.includes(name) || manifest.exports === undefined) continue;
    const exportsMap =
      typeof manifest.exports === 'string' || isConditionMap(manifest.exports)
        ? { '.': manifest.exports as ExportTarget }
        : (manifest.exports as Record<string, ExportTarget>);
    for (const [subpath, target] of Object.entries(exportsMap)) {
      if (subpath === './package.json' || subpath.includes('*')) continue;
      const file = exportFile(target);
      if (!file || file.endsWith('.d.ts')) continue;
      entries.push({
        id: entryId(name, subpath),
        packageName: name,
        subpath,
        file: resolve(packagesDir, dir, file),
        css: file.endsWith('.css'),
      });
    }
  }
  return entries;
}

/** `{ "types": …, "default": … }` as a whole `exports` value (no subpath keys). */
function isConditionMap(value: unknown): boolean {
  return (
    typeof value === 'object' &&
    value !== null &&
    Object.keys(value).length > 0 &&
    Object.keys(value).every((key) => !key.startsWith('.'))
  );
}

// ── measuring ────────────────────────────────────────────────────────────

export interface SizeMeasure {
  /** Minified JavaScript bytes. */
  raw: number;
  gzip: number;
  brotli: number;
  /** Gzipped bytes of the CSS the entry emits (0 when it emits none). */
  cssGzip: number;
  /**
   * Gzipped bytes of the chunks the entry loads later with `import()`.
   * Reported, never budgeted: first paint does not pay for them.
   */
  lazyGzip: number;
}

export const gzipSize = (data: string | Uint8Array): number =>
  gzipSync(data, { level: 9 }).byteLength;

export const brotliSize = (data: string | Uint8Array): number =>
  brotliCompressSync(data, {
    params: { [constants.BROTLI_PARAM_QUALITY]: constants.BROTLI_MAX_QUALITY },
  }).byteLength;

/** `svelte` and its subpaths: the runtime every consumer already ships. */
export const isExternal = (id: string): boolean => id === 'svelte' || id.startsWith('svelte/');

/**
 * `.astro` sources (packages/astro) compile inside the consumer's Astro
 * build, not in a plain Vite library build. The tool therefore measures the
 * JS wrapper and stubs the `.astro` import, same honesty rule as the
 * `svelte` external: the runtime cost belongs to the consumer's pipeline.
 */
const astroSourceStub = {
  name: 'texuli-size-astro-stub',
  enforce: 'pre' as const,
  resolveId(id: string) {
    return id.endsWith('.astro') ? `\0astro-stub:${id}` : null;
  },
  load(id: string) {
    return id.startsWith('\0astro-stub:') ? 'export default {};' : null;
  },
};

/**
 * Builds one entry on its own, the way a consumer imports it, and measures
 * the output. Nothing is written into the repository: the build runs in a
 * temporary directory and keeps its output in memory.
 */
export async function measureEntry(entry: Pick<SizeEntry, 'file' | 'css'>): Promise<SizeMeasure> {
  const [{ build }, { svelte }] = await Promise.all([
    import('vite'),
    import('@sveltejs/vite-plugin-svelte'),
  ]);
  const dir = await mkdtemp(join(tmpdir(), 'texuli-size-'));
  try {
    const main = join(dir, 'entry.js');
    const specifier = JSON.stringify(entry.file);
    await writeFile(main, entry.css ? `import ${specifier};\n` : `export * from ${specifier};\n`);
    const result = await build({
      configFile: false,
      logLevel: 'silent',
      mode: 'production',
      root: dir,
      plugins: [svelte({ configFile: false }), astroSourceStub],
      build: {
        write: false,
        minify: true,
        target: 'es2022',
        cssCodeSplit: false,
        reportCompressedSize: false,
        lib: { entry: main, formats: ['es'], fileName: 'entry', cssFileName: 'entry' },
        rollupOptions: { external: isExternal },
      },
    });
    const outputs = (Array.isArray(result) ? result : [result]).flatMap((item) =>
      'output' in item ? item.output : []
    );
    // What importing the entry costs: the entry chunk and every chunk it
    // imports statically. Chunks reached only through import() load later.
    const chunks = new Map<
      string,
      { code: string; imports: readonly string[]; isEntry: boolean }
    >();
    let css = '';
    for (const file of outputs) {
      if (file.type === 'chunk') chunks.set(file.fileName, file);
      else if (file.fileName.endsWith('.css')) {
        css +=
          typeof file.source === 'string' ? file.source : new TextDecoder().decode(file.source);
      }
    }
    const initial = new Set<string>();
    const visit = (name: string) => {
      if (initial.has(name) || !chunks.has(name)) return;
      initial.add(name);
      for (const imported of chunks.get(name)?.imports ?? []) visit(imported);
    };
    for (const [name, chunk] of chunks) if (chunk.isEntry) visit(name);
    let js = '';
    let lazy = '';
    for (const [name, chunk] of chunks) {
      if (initial.has(name)) js += chunk.code;
      else lazy += chunk.code;
    }
    const bytes = new TextEncoder().encode(js);
    return {
      raw: bytes.byteLength,
      gzip: js ? gzipSize(bytes) : 0,
      brotli: js ? brotliSize(bytes) : 0,
      cssGzip: css ? gzipSize(css) : 0,
      lazyGzip: lazy ? gzipSize(lazy) : 0,
    };
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

// ── budgets ──────────────────────────────────────────────────────────────

export interface ProtoyardBaseline {
  /** The Protoyard import this entry replaces, e.g. `@protoyard/ui`. */
  specifier: string;
  /** Its measured gzip bytes, from `pnpm size --protoyard <dir>`. */
  gzip?: number;
  /** ISO date of that measurement. */
  measured?: string;
  /** The Protoyard commit it was measured at. */
  revision?: string;
}

export interface EntryBudget {
  /** Maximum gzip bytes of the entry's JavaScript. */
  gzip: number;
  /** Maximum brotli bytes of the entry's JavaScript. */
  brotli?: number;
  /** Maximum gzip bytes of the CSS the entry emits. */
  cssGzip?: number;
  protoyard?: ProtoyardBaseline;
  /** Why the budget is what it is (a design target, a provisional skeleton cap). */
  note?: string;
}

export interface BudgetsFile {
  $comment?: string;
  /** Package names that are not browser bundles (CLI and server tools). */
  ignore?: string[];
  /**
   * Exact entry ids, or a pattern ending in `/*` for every subpath of a
   * package (`@texuli/primitives/*`). An exact id wins over a pattern.
   */
  budgets: Record<string, EntryBudget>;
}

const isCount = (value: unknown): value is number =>
  typeof value === 'number' && Number.isInteger(value) && value >= 0;

/** Checks the file's shape and returns it typed; throws with every problem listed. */
export function parseBudgets(input: unknown): BudgetsFile {
  const problems: string[] = [];
  const file = input as BudgetsFile;
  if (typeof input !== 'object' || input === null) throw new Error('budgets: expected an object');
  if (typeof file.budgets !== 'object' || file.budgets === null) {
    throw new Error('budgets: expected a "budgets" object');
  }
  if (file.ignore !== undefined && !Array.isArray(file.ignore)) {
    problems.push('"ignore" must be an array of package names');
  }
  for (const [id, budget] of Object.entries(file.budgets)) {
    if (id.includes('*') && !id.endsWith('/*')) problems.push(`${id}: a pattern ends in "/*"`);
    if (!isCount(budget?.gzip)) problems.push(`${id}: "gzip" must be a whole number of bytes`);
    for (const key of ['brotli', 'cssGzip'] as const) {
      if (budget?.[key] !== undefined && !isCount(budget[key])) {
        problems.push(`${id}: "${key}" must be a whole number of bytes`);
      }
    }
    const baseline = budget?.protoyard;
    if (baseline !== undefined) {
      if (typeof baseline.specifier !== 'string' || !baseline.specifier.startsWith('@protoyard/')) {
        problems.push(`${id}: "protoyard.specifier" must name a @protoyard/* import`);
      }
      if (baseline.gzip !== undefined && !isCount(baseline.gzip)) {
        problems.push(`${id}: "protoyard.gzip" must be a whole number of bytes`);
      }
    }
  }
  if (problems.length > 0) throw new Error(`budgets:\n  ${problems.join('\n  ')}`);
  return file;
}

export async function loadBudgets(path = BUDGETS_FILE): Promise<BudgetsFile> {
  return parseBudgets(JSON.parse(await readFile(path, 'utf8')));
}

/** The budget that applies to an entry: its exact id, else its package pattern. */
export function budgetFor(
  id: string,
  budgets: BudgetsFile
): { key: string; budget: EntryBudget } | null {
  if (Object.hasOwn(budgets.budgets, id))
    return { key: id, budget: budgets.budgets[id] as EntryBudget };
  for (const [key, budget] of Object.entries(budgets.budgets)) {
    if (key.endsWith('/*') && id.startsWith(key.slice(0, -1))) return { key, budget };
  }
  return null;
}

// ── comparing ────────────────────────────────────────────────────────────

export type SizeStatus = 'ok' | 'over' | 'unbudgeted' | 'larger-than-protoyard';

export interface SizeRow {
  id: string;
  measure: SizeMeasure;
  /** The budget key that applied (`@texuli/primitives/*` for a pattern). */
  budgetKey: string | null;
  budget: EntryBudget | null;
  status: SizeStatus;
  /** One reason per failed limit. */
  problems: string[];
}

/** Budget ids no discovered entry matched exactly (planned entries, or typos). */
export function unmatchedBudgets(rows: readonly SizeRow[], budgets: BudgetsFile): string[] {
  const ids = new Set(rows.map((row) => row.id));
  return Object.keys(budgets.budgets).filter((key) => !key.endsWith('/*') && !ids.has(key));
}

export function compare(
  results: readonly { id: string; measure: SizeMeasure }[],
  budgets: BudgetsFile
): SizeRow[] {
  return results.map(({ id, measure }) => {
    const found = budgetFor(id, budgets);
    if (!found) {
      return {
        id,
        measure,
        budgetKey: null,
        budget: null,
        status: 'unbudgeted',
        problems: [`${id} has no budget in texuli.budgets.json`],
      };
    }
    const { key, budget } = found;
    const problems: string[] = [];
    if (measure.gzip > budget.gzip) problems.push(`gzip ${measure.gzip} B > ${budget.gzip} B`);
    if (budget.brotli !== undefined && measure.brotli > budget.brotli) {
      problems.push(`brotli ${measure.brotli} B > ${budget.brotli} B`);
    }
    if (budget.cssGzip !== undefined && measure.cssGzip > budget.cssGzip) {
      problems.push(`css gzip ${measure.cssGzip} B > ${budget.cssGzip} B`);
    }
    let status: SizeStatus = problems.length > 0 ? 'over' : 'ok';
    const baseline = budget.protoyard?.gzip;
    if (baseline !== undefined && measure.gzip > baseline) {
      problems.push(
        `gzip ${measure.gzip} B > ${budget.protoyard?.specifier} ${baseline} B (the Protoyard package it replaces)`
      );
      if (status === 'ok') status = 'larger-than-protoyard';
    }
    return { id, measure, budgetKey: key, budget, status, problems };
  });
}

// ── updating ─────────────────────────────────────────────────────────────

export const roundUp = (bytes: number, step = BUDGET_STEP): number =>
  Math.max(step, Math.ceil(bytes / step) * step);

export interface UpdateResult {
  budgets: BudgetsFile;
  /** `id: field old → new` lines. */
  changes: string[];
  /** Budgets that would have to grow (only applied with `allowGrow`). */
  refused: string[];
}

/**
 * Ratchets exact budgets toward the measured sizes. A budget above the
 * rounded-up measure shrinks to it. A budget below it (the entry is over) or
 * a missing one changes only with `allowGrow`. Pattern budgets are design
 * targets and never change here.
 */
export function updateBudgets(
  budgets: BudgetsFile,
  rows: readonly SizeRow[],
  options: { allowGrow?: boolean } = {}
): UpdateResult {
  const next: BudgetsFile = structuredClone(budgets);
  const changes: string[] = [];
  const refused: string[] = [];
  for (const row of rows) {
    const exact = row.budgetKey === row.id ? next.budgets[row.id] : undefined;
    if (!exact) {
      if (row.budgetKey !== null) continue;
      const created: EntryBudget = { gzip: roundUp(row.measure.gzip) };
      if (row.measure.cssGzip > 0) created.cssGzip = roundUp(row.measure.cssGzip);
      if (options.allowGrow) {
        next.budgets[row.id] = created;
        changes.push(`${row.id}: added gzip ${created.gzip} B`);
      } else refused.push(`${row.id}: no budget (add one with --allow-grow)`);
      continue;
    }
    for (const field of ['gzip', 'brotli', 'cssGzip'] as const) {
      const current = exact[field];
      if (current === undefined) continue;
      const target = roundUp(row.measure[field]);
      if (target < current) {
        exact[field] = target;
        changes.push(`${row.id}: ${field} ${current} → ${target} B`);
      } else if (row.measure[field] > current) {
        if (options.allowGrow) {
          exact[field] = target;
          changes.push(`${row.id}: ${field} ${current} → ${target} B (grown)`);
        } else refused.push(`${row.id}: ${field} would grow ${current} → ${target} B`);
      }
    }
  }
  return { budgets: next, changes, refused };
}

// ── reporting ────────────────────────────────────────────────────────────

const STATUS_LABEL: Record<SizeStatus, string> = {
  ok: 'ok',
  over: 'OVER',
  unbudgeted: 'NO BUDGET',
  'larger-than-protoyard': 'OVER PROTOYARD',
};

function kib(bytes: number): string {
  return bytes < 1024 ? `${bytes} B` : `${(bytes / 1024).toFixed(2)} KiB`;
}

/** A fixed-width table, one row per entry, sorted by id. */
export function formatTable(rows: readonly SizeRow[]): string {
  const header = [
    'entry',
    'gzip',
    'budget',
    'brotli',
    'css gzip',
    'lazy gzip',
    'protoyard',
    'status',
  ];
  const body = [...rows]
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((row) => [
      row.id,
      kib(row.measure.gzip),
      row.budget
        ? `${kib(row.budget.gzip)}${row.budgetKey !== row.id ? ` (${row.budgetKey})` : ''}`
        : '—',
      kib(row.measure.brotli),
      row.measure.cssGzip > 0 ? kib(row.measure.cssGzip) : '—',
      row.measure.lazyGzip > 0 ? kib(row.measure.lazyGzip) : '—',
      row.budget?.protoyard?.gzip !== undefined
        ? `${kib(row.budget.protoyard.gzip)} ${row.budget.protoyard.specifier}`
        : '—',
      STATUS_LABEL[row.status],
    ]);
  const widths = header.map((title, column) =>
    Math.max(title.length, ...body.map((cells) => (cells[column] ?? '').length))
  );
  const line = (cells: string[]) =>
    cells
      .map((cell, column) =>
        column === 0 ? cell.padEnd(widths[column] ?? 0) : cell.padStart(widths[column] ?? 0)
      )
      .join('  ')
      .trimEnd();
  return [line(header), line(widths.map((width) => '-'.repeat(width))), ...body.map(line)].join(
    '\n'
  );
}

// ── the command ──────────────────────────────────────────────────────────

export interface SizeOptions {
  root?: string;
  budgetsPath?: string;
  filter?: string;
  json?: boolean;
  update?: boolean;
  allowGrow?: boolean;
  /** A Protoyard checkout: re-measure every entry's `protoyard.specifier` there. */
  protoyard?: string;
  /** How many entries build at once. */
  concurrency?: number;
  log?: (line: string) => void;
}

export interface SizeRun {
  rows: SizeRow[];
  failed: SizeRow[];
  /** Exact budget ids with no entry (planned work, or a typo). */
  unmatched: string[];
  update?: UpdateResult;
  exitCode: 0 | 1;
}

async function mapLimit<T, R>(items: readonly T[], limit: number, run: (item: T) => Promise<R>) {
  const results: R[] = new Array(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const index = next++;
      results[index] = await run(items[index] as T);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

/** The short commit of a checkout, or undefined outside git. */
function gitRevision(dir: string): string | undefined {
  try {
    return execFileSync('git', ['-C', dir, 'rev-parse', '--short', 'HEAD'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    return undefined;
  }
}

/** Resolves `@protoyard/<pkg>[/<subpath>]` to its source file in a Protoyard checkout. */
export async function resolveProtoyard(
  protoyardRoot: string,
  specifier: string
): Promise<SizeEntry> {
  const entries = await discoverEntries(protoyardRoot);
  const found = entries.find((entry) => entry.id === specifier);
  if (!found) throw new Error(`${specifier} is not an export of ${protoyardRoot}/packages`);
  return found;
}

export async function runSize(options: SizeOptions = {}): Promise<SizeRun> {
  const root = options.root ?? ROOT;
  const budgetsPath = options.budgetsPath ?? join(root, 'texuli.budgets.json');
  const log = options.log ?? ((line: string) => console.log(line));
  let budgets = await loadBudgets(budgetsPath);

  if (options.protoyard) {
    const protoyardRoot = resolve(options.protoyard);
    const today = new Date().toISOString().slice(0, 10);
    const revision = gitRevision(protoyardRoot);
    for (const [key, budget] of Object.entries(budgets.budgets)) {
      if (!budget.protoyard) continue;
      const measured = await measureEntry(
        await resolveProtoyard(protoyardRoot, budget.protoyard.specifier)
      );
      budget.protoyard.gzip = measured.gzip;
      budget.protoyard.measured = today;
      if (revision) budget.protoyard.revision = revision;
      log(`protoyard ${budget.protoyard.specifier} (for ${key}): ${measured.gzip} B gzip`);
    }
    await writeFile(budgetsPath, `${JSON.stringify(budgets, null, 2)}\n`);
  }

  const entries = (await discoverEntries(root, budgets.ignore)).filter(
    (entry) => !options.filter || entry.id.includes(options.filter)
  );
  const measured = await mapLimit(entries, options.concurrency ?? 4, async (entry) => ({
    id: entry.id,
    measure: await measureEntry(entry),
  }));
  const rows = compare(measured, budgets);
  const failed = rows.filter((row) => row.status !== 'ok');
  const unmatched = options.filter ? [] : unmatchedBudgets(rows, budgets);
  const run: SizeRun = { rows, failed, unmatched, exitCode: failed.length > 0 ? 1 : 0 };

  if (options.update) {
    run.update = updateBudgets(budgets, rows, { allowGrow: options.allowGrow === true });
    budgets = run.update.budgets;
    if (run.update.changes.length > 0) {
      await writeFile(budgetsPath, `${JSON.stringify(budgets, null, 2)}\n`);
    }
    // With --allow-grow the file now holds every measured size: re-judge against it.
    if (options.allowGrow) {
      run.rows = compare(measured, budgets);
      run.failed = run.rows.filter((row) => row.status !== 'ok');
      run.exitCode = run.failed.length > 0 ? 1 : 0;
    }
  }

  if (options.json) {
    log(
      JSON.stringify(
        { rows: run.rows, unmatched: run.unmatched, update: run.update ?? null },
        null,
        2
      )
    );
    return run;
  }
  log(formatTable(run.rows));
  for (const row of run.failed) for (const problem of row.problems) log(`✗ ${row.id}: ${problem}`);
  if (run.unmatched.length > 0) {
    log(`Budgets with no entry yet (planned, or check the id): ${run.unmatched.join(', ')}`);
  }
  if (run.update) {
    for (const change of run.update.changes) log(`updated ${change}`);
    for (const refused of run.update.refused) log(`kept ${refused}`);
  }
  log(
    run.exitCode === 0
      ? `✓ ${run.rows.length} entries within budget (gzip -9, svelte external).`
      : `✗ ${run.failed.length} of ${run.rows.length} entries fail. Shrink the code; raise a budget only with --update --allow-grow and a reason.`
  );
  return run;
}

export function parseArgs(argv: readonly string[]): SizeOptions {
  const options: SizeOptions = {};
  for (let index = 0; index < argv.length; index++) {
    const arg = argv[index];
    const value = () => {
      const next = argv[++index];
      if (next === undefined || next.startsWith('--')) throw new Error(`${arg} needs a value`);
      return next;
    };
    switch (arg) {
      case '--filter':
        options.filter = value();
        break;
      case '--json':
        options.json = true;
        break;
      case '--update':
        options.update = true;
        break;
      case '--allow-grow':
        options.allowGrow = true;
        break;
      case '--protoyard':
        options.protoyard = value();
        break;
      case '--budgets':
        options.budgetsPath = resolve(value());
        break;
      default:
        throw new Error(`Unknown option ${arg}. See the header of scripts/size.ts.`);
    }
  }
  if (options.allowGrow && !options.update)
    throw new Error('--allow-grow only works with --update');
  return options;
}

const isMain =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  try {
    const run = await runSize(parseArgs(process.argv.slice(2)));
    process.exitCode = run.exitCode;
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 2;
  }
}
