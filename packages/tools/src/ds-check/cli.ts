/// <reference types="node" />
/**
 * `texuli ds check <file> [--locked] [--report] [--json] [--render] [--mode light|dark|all]
 * [--variant <name>]… [--trust developer|untrusted] [--base <file>]…
 * [--sheet builtin|<page.html>] [--url <page>] [--known <file>] [--strict]
 * [--catalog <components.json>] [--extensions <file>...]`.
 *
 * Exit codes: 0 when checks pass or `--locked --report` lists findings,
 * 1 on any refusal or render finding in enforce mode, 2 when the check could
 * not run (a bad flag, an unreadable file, or a missing `--render` requirement).
 *
 * Locked design systems (ADR-032): the check reads the agent catalog and
 * refuses `allow` ids or values it does not list (`unknown-component`,
 * `unknown-variant`, `unknown-size`, `unknown-tone`, `unknown-density`, `unknown-color`,
 * `unknown-state`), and a recorded content hash that no longer matches
 * (`content-hash-mismatch`, `library-hash-mismatch`). It reports the allowed
 * set and the approval status as declared; it cannot prove who approved.
 * `--extensions` merges host catalog extensions (`<ns>:<id>` ids, `mergeCatalogs`) into the
 * catalog first, so `allow` is checked as the host checks it; a refused extension is
 * reported as `catalog-extension` with the merge's code in the message.
 */
import { lstat, readdir, readFile, stat } from 'node:fs/promises';
import { extname, join, relative, resolve } from 'node:path';
import type { SpecCatalog } from '@texuli/spec';
import { CATALOG_EXTENSION_LIMITS } from '@texuli/spec/catalog-extensions';
import { loadSpecCatalog } from '../ops/catalog.ts';
import { compareDsReport, dsReportFingerprint } from './baseline.ts';
import { catalogExtensionIssues, loadMergedCatalog } from './extensions.ts';
import { checkDesignSystemFull, type DsFullReport } from './full.ts';
import { dsFindingScope, renderLockedDesignSystemCheck } from './locked-render.ts';
import {
  DS_CHECK_BUILTIN_SHEET,
  DsCheckRequirementError,
  type DsModuleLoader,
  parseKnownFindings,
  renderDesignSystemCheck,
} from './render.ts';
import {
  checkDesignSystem,
  type DsCheckLockedReport,
  type DsLockedReport,
  serializeDsCheckReport,
} from './static.ts';
import type { DsCheckMode, DsCheckReport } from './types.ts';
import { listImportSpecifiers, packageNameOf } from './unscanned.ts';

/** The largest design-system file the CLI reads. */
export const DS_CHECK_MAX_BYTES = 1_000_000;

/** Stable code when `--prototype` is a symlink (the root or an entry). */
export const DS_CHECK_PROTOTYPE_SYMLINK = 'prototype-symlink';

export const DS_CHECK_USAGE =
  'Usage: texuli ds check <file> [--locked [--report [--baseline <file>]] [--scope <id>]] [--prototype <dir> [--scan-workspace]] [--json] [--render] [--mode light|dark|all] [--variant <name>]... [--trust developer|untrusted] [--base <file>]... [--sheet builtin|<page.html>] [--url <page>] [--known <file>] [--strict] [--catalog <components.json>] [--extensions <file>...]';

export interface DsCliArgs {
  command: 'check';
  file?: string;
  locked: boolean;
  report: boolean;
  json: boolean;
  render: boolean;
  modes?: DsCheckMode[];
  variants?: string[];
  trust?: 'developer' | 'untrusted';
  bases: string[];
  /** The sheet `--render` paints: `builtin` (the default, inside `@texuli/tools`) or a built page. */
  sheet?: string;
  url?: string;
  /** A JSON file of known findings (`[{ component, element, property, reason }]`). */
  known?: string;
  strict: boolean;
  /** The catalog `allow` is checked against (default: the agent catalog `@texuli/tools` builds). */
  catalog?: string;
  /** Host catalog extension manifests merged into the catalog (`--extensions a.json b.json`). */
  extensions: string[];
  /** Source tree scanned as a locked prototype. */
  prototype?: string;
  /** With `--prototype`: also scan workspace packages the prototype imports. */
  scanWorkspace: boolean;
  /** With `--locked --report`: a previous JSON report to compare (exit 1 on new findings). */
  baseline?: string;
  /** With `--locked`: a host-chosen scope (such as a prototype id) set on every finding. */
  scope?: string;
  help: boolean;
}

/** Parse `ds <command> …` (the words after `texuli`); throws a `TypeError` on bad input. */
export function parseDsCliArgs(argv: readonly string[]): DsCliArgs {
  const [command, ...rest] = argv;
  const args: DsCliArgs = {
    command: 'check',
    locked: false,
    report: false,
    json: false,
    render: false,
    bases: [],
    extensions: [],
    strict: false,
    scanWorkspace: false,
    help: false,
  };
  if (command === undefined || command === '--help' || command === '-h')
    return { ...args, help: true };
  if (command !== 'check')
    throw new TypeError(`Unknown ds command "${command}". ${DS_CHECK_USAGE}`);
  for (let index = 0; index < rest.length; index++) {
    const arg = rest[index] as string;
    const value = () => {
      const next = rest[++index];
      if (next === undefined || next.startsWith('--'))
        throw new TypeError(`Flag ${arg} needs a value.`);
      return next;
    };
    if (arg === '--help' || arg === '-h') return { ...args, help: true };
    if (arg === '--locked') args.locked = true;
    else if (arg === '--report') args.report = true;
    else if (arg === '--json') args.json = true;
    else if (arg === '--render') args.render = true;
    else if (arg === '--strict') args.strict = true;
    else if (arg === '--mode') {
      const mode = value();
      if (mode !== 'light' && mode !== 'dark' && mode !== 'all')
        throw new TypeError('Flag --mode is "light", "dark" or "all".');
      if (mode !== 'all') args.modes = [mode];
    } else if (arg === '--variant') {
      args.variants = [...(args.variants ?? []), value()];
    } else if (arg === '--trust') {
      const trust = value();
      if (trust !== 'developer' && trust !== 'untrusted')
        throw new TypeError('Flag --trust is "developer" or "untrusted".');
      args.trust = trust;
    } else if (arg === '--base') args.bases.push(value());
    else if (arg === '--sheet') args.sheet = value();
    else if (arg === '--url') args.url = value();
    else if (arg === '--known') args.known = value();
    else if (arg === '--catalog') args.catalog = value();
    else if (arg === '--prototype') args.prototype = value();
    else if (arg === '--scan-workspace') args.scanWorkspace = true;
    else if (arg === '--baseline') args.baseline = value();
    else if (arg === '--scope') {
      const scope = dsFindingScope(value());
      if (scope === undefined)
        throw new TypeError('Flag --scope needs a value without control characters.');
      args.scope = scope;
    } else if (arg === '--extensions') {
      // One or more files, up to the next flag; the flag may also repeat.
      const before = args.extensions.length;
      while (rest[index + 1] !== undefined && !(rest[index + 1] as string).startsWith('-'))
        args.extensions.push(rest[++index] as string);
      if (args.extensions.length === before) throw new TypeError('Flag --extensions needs a file.');
    } else if (arg.startsWith('-')) throw new TypeError(`Unknown ds check flag "${arg}".`);
    else if (args.file === undefined) args.file = arg;
    else throw new TypeError(`ds check takes one file; got "${args.file}" and "${arg}".`);
  }
  if (args.file === undefined) throw new TypeError(`ds check needs a file. ${DS_CHECK_USAGE}`);
  if (args.url !== undefined && !args.render) throw new TypeError('Flag --url needs --render.');
  if (args.sheet !== undefined && !args.render) throw new TypeError('Flag --sheet needs --render.');
  if (args.sheet !== undefined && args.url !== undefined)
    throw new TypeError('Flags --sheet and --url are exclusive: --url checks a page you serve.');
  if (args.strict && !args.render) throw new TypeError('Flag --strict needs --render.');
  if (args.known !== undefined && !args.render) throw new TypeError('Flag --known needs --render.');
  if (args.report && !args.locked) throw new TypeError('Flag --report needs --locked.');
  if (args.baseline !== undefined && (!args.locked || !args.report))
    throw new TypeError('Flag --baseline needs --locked --report.');
  if (args.scope !== undefined && !args.locked) throw new TypeError('Flag --scope needs --locked.');
  if (args.scanWorkspace && args.prototype === undefined)
    throw new TypeError('Flag --scan-workspace needs --prototype.');
  if (args.extensions.length > CATALOG_EXTENSION_LIMITS.extensions)
    throw new RangeError(
      `extension-oversize: --extensions takes at most ${CATALOG_EXTENSION_LIMITS.extensions} files; got ${args.extensions.length}.`
    );
  return args;
}

async function readJsonFile(path: string, what: string): Promise<unknown> {
  const info = await stat(path);
  if (!info.isFile()) throw new TypeError(`${what} ${path} is not a regular file.`);
  if (info.size > DS_CHECK_MAX_BYTES)
    throw new RangeError(`${what} ${path} exceeds ${DS_CHECK_MAX_BYTES} bytes; nothing was read.`);
  const text = await readFile(path, 'utf8');
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new SyntaxError(`${what} ${path} is not valid JSON.`);
  }
}

/** The locked-design-system lines of the summary: allowed set, approval and hashes (ADR-032). */
export function formatLockedReport(locked: DsLockedReport): string[] {
  const lines: string[] = [];
  lines.push(
    locked.locked
      ? `  locked: ${locked.allowed.length} components allowed${locked.catalogChecked ? ' (checked against the catalog)' : ''}`
      : '  not locked: no allow section'
  );
  if (locked.library.length > 0) lines.push(`  library: ${locked.library.join(', ')}`);
  const { approval } = locked;
  const declared = [
    approval.version ? `version ${approval.version}` : '',
    approval.approvedBy ? `declared by ${approval.approvedBy}` : '',
    approval.approvedAt ? `at ${approval.approvedAt}` : '',
  ].filter(Boolean);
  lines.push(`  approval: ${approval.status}${declared.length ? ` (${declared.join(', ')})` : ''}`);
  lines.push(
    `  content hash ${approval.contentHash}: ${
      approval.matches === undefined
        ? 'none recorded'
        : approval.matches
          ? 'matches the approval'
          : 'does not match the approval'
    }`
  );
  for (const entry of locked.entries)
    if (entry.matches !== undefined)
      lines.push(
        `  library ${entry.id ?? '?'}: ${entry.status ?? 'unknown'}, hash ${entry.matches ? 'matches' : 'does not match'}`
      );
  return lines;
}

/** The human summary `ds check` prints without `--json`. */
export function formatDsCheckReport(report: DsCheckReport | DsCheckLockedReport): string {
  const name = [report.document.id, report.document.version].filter(Boolean).join('@');
  const lines = [`${report.ok ? 'PASS' : 'FAIL'} ${name || report.file || 'design system'}`];
  for (const run of report.runs) {
    const label = run.variant ? `variant ${run.variant}` : 'base';
    if (!run.ok && run.modes.length === 0) {
      lines.push(`  ${label}: refused`);
      continue;
    }
    for (const mode of run.modes) {
      const pairs = run.contrast[mode] ?? [];
      lines.push(
        `  ${label} ${mode}: ${pairs.filter((p) => p.pass).length}/${pairs.length} contrast pairs pass`
      );
    }
    lines.push(
      `  ${label}: ${run.adjustments.length} solver adjustments, ${run.warnings.length} warnings`
    );
    for (const warning of run.warnings)
      lines.push(`    warning ${warning.path}: ${warning.message}`);
  }
  for (const run of report.render?.runs ?? [])
    lines.push(
      `  render ${run.variant ?? 'base'} ${run.mode}: ${run.components.length} components, ${run.checked} elements, ${run.axe.length} axe, ${run.pairs.filter((p) => !p.pass).length} contrast, ${run.literals.length} literal findings (${run.known.length} known)`
    );
  if ('locked' in report) lines.push(...formatLockedReport(report.locked));
  for (const error of report.errors)
    lines.push(
      `  ${error.code} ${error.path}${error.variant ? ` (variant ${error.variant})` : ''}${error.mode ? ` [${error.mode}]` : ''}: ${error.message}${error.hint ? ` ${error.hint}` : ''}`
    );
  return `${lines.join('\n')}\n`;
}

/** Counts carried alongside JSON so a saved report can serve as a progress baseline. */
export function dsFullCounts(report: DsFullReport) {
  const areas: Record<string, { errors: number; warnings: number; info: number }> = {};
  const routes: Record<string, number> = {};
  for (const finding of report.findings) {
    let count = areas[finding.area];
    if (!count) {
      count = { errors: 0, warnings: 0, info: 0 };
      areas[finding.area] = count;
    }
    if (finding.severity === 'error') count.errors += 1;
    else if (finding.severity === 'warning') count.warnings += 1;
    else count.info += 1;
    const route = /^route:([^/#?]+)/.exec(finding.path)?.[1];
    if (route) routes[route] = (routes[route] ?? 0) + 1;
  }
  return {
    errors: report.summary.errors,
    warnings: report.summary.warnings,
    info: report.summary.info,
    areas,
    routes,
    components: report.prototype?.components ?? {},
  };
}

/** Readable full report; the paired JSON output includes the same progress counts. */
export function formatDsFullReport(report: DsFullReport): string {
  const label = [report.document.id, report.document.version].filter(Boolean).join('@');
  const counts = dsFullCounts(report);
  const lines = [
    `REPORT ${label || report.file || 'design system'}`,
    `  findings: ${counts.errors} errors, ${counts.warnings} warnings, ${counts.info} info`,
  ];
  for (const [area, count] of Object.entries(counts.areas).sort(([a], [b]) => a.localeCompare(b)))
    lines.push(
      `  area ${area}: ${count.errors} errors, ${count.warnings} warnings, ${count.info} info`
    );
  for (const [route, count] of Object.entries(counts.routes).sort(([a], [b]) => a.localeCompare(b)))
    lines.push(`  route ${route}: ${count} findings`);
  for (const [component, count] of Object.entries(counts.components).sort(([a], [b]) =>
    a.localeCompare(b)
  ))
    lines.push(`  component ${component}: ${count} uses`);
  const unchecked = report.prototype?.unchecked;
  if (unchecked && unchecked.count > 0)
    lines.push(
      `  unchecked: ${unchecked.count} import(s) not scanned (${unchecked.imports.join(', ')})`
    );
  for (const finding of report.findings)
    lines.push(
      `  ${finding.severity.toUpperCase()} ${finding.code} ${finding.path}: ${finding.message} Hint: ${finding.hint}`
    );
  lines.push('  Save the JSON output to keep this violation baseline and compare later runs.');
  return `${lines.join('\n')}\n`;
}

export interface DsCliIo {
  stdout?: { write(chunk: string): unknown };
  stderr?: { write(chunk: string): unknown };
  cwd?: string;
  /** How `--render` loads Playwright and axe (default: from the project in `cwd`); tests stub the browser here. */
  load?: DsModuleLoader;
}

export type DsCliReport = DsCheckReport | DsFullReport;
export type DsCliResult =
  | { ok: true; report?: DsCliReport }
  | { ok: false; error: string; report?: DsCliReport };

/** A `--catalog` file: `{ components: [...] }` (the spec's `components.json` or a stub). */
function catalogOf(value: unknown, path: string): SpecCatalog {
  const components = (value as { components?: unknown } | null)?.components;
  if (!Array.isArray(components))
    throw new TypeError(`The catalog ${path} has no components list.`);
  return value as unknown as SpecCatalog;
}

/** The spec catalog projection needed by the locked checker, built from bundled manifests. */
export async function loadAllowCatalog(): Promise<SpecCatalog> {
  return loadSpecCatalog();
}

function refusePrototypeSymlink(name: string): never {
  throw new TypeError(`${DS_CHECK_PROTOTYPE_SYMLINK}: Prototype symlinks are refused: ${name}.`);
}

function parseWorkspaceGlobs(yaml: string): string[] {
  const globs: string[] = [];
  let inPackages = false;
  for (const line of yaml.split('\n')) {
    if (/^packages:\s*$/.test(line)) {
      inPackages = true;
      continue;
    }
    if (!inPackages) continue;
    const item = /^\s+-\s+['"]?([^'"#\n]+?)['"]?\s*(?:#.*)?$/.exec(line);
    if (item) globs.push((item[1] as string).trim());
    else if (/^\S/.test(line) && !line.startsWith('#')) break;
  }
  return globs;
}

async function packageNameAt(directory: string): Promise<string | undefined> {
  try {
    const info = await lstat(join(directory, 'package.json'));
    if (info.isSymbolicLink() || !info.isFile()) return;
    const raw = JSON.parse(await readFile(join(directory, 'package.json'), 'utf8')) as {
      name?: unknown;
    };
    return typeof raw.name === 'string' ? raw.name : undefined;
  } catch {
    return;
  }
}

/** Workspace package name → directory, walking up from `start` for pnpm-workspace.yaml or workspaces. */
async function discoverWorkspacePackages(start: string): Promise<Map<string, string>> {
  const found = new Map<string, string>();
  let dir = resolve(start);
  let root: string | undefined;
  let globs: string[] = [];
  for (let i = 0; i < 8; i++) {
    try {
      const yaml = await readFile(join(dir, 'pnpm-workspace.yaml'), 'utf8');
      root = dir;
      globs = parseWorkspaceGlobs(yaml);
      break;
    } catch {
      // not this directory
    }
    try {
      const pkg = JSON.parse(await readFile(join(dir, 'package.json'), 'utf8')) as {
        workspaces?: unknown;
      };
      const listed = pkg.workspaces;
      const names = Array.isArray(listed)
        ? listed.filter((item): item is string => typeof item === 'string')
        : Array.isArray((listed as { packages?: unknown } | undefined)?.packages)
          ? ((listed as { packages: unknown[] }).packages.filter(
              (item): item is string => typeof item === 'string'
            ) as string[])
          : [];
      if (names.length > 0) {
        root = dir;
        globs = names;
        break;
      }
    } catch {
      // not this directory
    }
    const parent = resolve(dir, '..');
    if (parent === dir) break;
    dir = parent;
  }
  if (!root) return found;
  for (const glob of globs) {
    const star = glob.endsWith('/*') ? glob.slice(0, -2) : glob;
    const parent = join(root, star);
    try {
      const entries = glob.endsWith('/*')
        ? await readdir(parent, { withFileTypes: true })
        : [{ name: '', isDirectory: () => true, isSymbolicLink: () => false }];
      for (const entry of entries) {
        if (entry.isSymbolicLink?.() || !entry.isDirectory()) continue;
        const directory = glob.endsWith('/*') ? join(parent, entry.name) : parent;
        const name = await packageNameAt(directory);
        if (name && !found.has(name)) found.set(name, directory);
      }
    } catch {
      // missing glob
    }
  }
  return found;
}

/** Read a bounded prototype tree without following symlinks or executing source files. */
async function readPrototypeDirectory(path: string, options: { scanWorkspace?: boolean } = {}) {
  const root = resolve(path);
  const files: Record<string, string> = {};
  const blueprints: Record<string, unknown> = {};
  let totalBytes = 0;
  const walk = async (directory: string, keyRoot: string, keyPrefix: string): Promise<void> => {
    const entries = await readdir(directory, { withFileTypes: true });
    for (const entry of entries) {
      const absolute = resolve(directory, entry.name);
      const rel = relative(keyRoot, absolute).split('\\').join('/');
      const name = keyPrefix ? `${keyPrefix}${rel}` : rel;
      if (entry.isSymbolicLink()) refusePrototypeSymlink(name);
      if (entry.isDirectory()) {
        if (['node_modules', 'dist', '.git', 'coverage'].includes(entry.name)) continue;
        await walk(absolute, keyRoot, keyPrefix);
        continue;
      }
      if (!entry.isFile()) continue;
      const extension = extname(entry.name).toLowerCase();
      if (
        !['.svelte', '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.css', '.json'].includes(
          extension
        )
      )
        continue;
      if (Object.keys(files).length + Object.keys(blueprints).length >= 500)
        throw new RangeError('The prototype has more than 500 source files.');
      const info = await stat(absolute);
      if (info.size > 512 * 1024) {
        if (extension === '.json')
          throw new RangeError(`Prototype JSON ${name} exceeds the 512 KB scan limit.`);
        const marker = ' '.repeat(512 * 1024 + 1);
        totalBytes += marker.length;
        if (totalBytes > 8 * 1024 * 1024)
          throw new RangeError('The prototype source exceeds 8 MB.');
        files[name] = marker;
        continue;
      }
      totalBytes += info.size;
      if (totalBytes > 8 * 1024 * 1024) throw new RangeError('The prototype source exceeds 8 MB.');
      const text = await readFile(absolute, 'utf8');
      if (extension === '.json') {
        try {
          const value = JSON.parse(text) as unknown;
          if (typeof value === 'object' && value !== null && 'tree' in value)
            blueprints[name] = value;
        } catch {
          // JSON files which are not blueprint fixtures are not part of the source scan.
        }
      } else {
        files[name] = text;
      }
    }
  };
  const rootInfo = await lstat(root);
  if (rootInfo.isSymbolicLink()) refusePrototypeSymlink(path);
  if (!rootInfo.isDirectory()) throw new TypeError(`Prototype ${path} is not a directory.`);
  await walk(root, root, '');
  const workspaces = await discoverWorkspacePackages(root);
  if (options.scanWorkspace) {
    const imported = new Set<string>();
    for (const text of Object.values(files))
      for (const spec of listImportSpecifiers(text)) {
        const pkg = packageNameOf(spec);
        if (pkg) imported.add(pkg);
      }
    for (const pkg of imported) {
      const directory = workspaces.get(pkg);
      if (!directory) continue;
      await walk(directory, directory, `workspace:${pkg}/`);
    }
  }
  return { files, blueprints, workspacePackages: [...workspaces.keys()] };
}

/** Run `texuli ds …`; sets `process.exitCode` (1 refusal, 2 could not run); never throws. */
export async function runDsCli(argv: readonly string[], io: DsCliIo = {}): Promise<DsCliResult> {
  const stdout = io.stdout ?? process.stdout;
  const stderr = io.stderr ?? process.stderr;
  const cannotRun = (message: string): DsCliResult => {
    stderr.write(`${message}\n`);
    process.exitCode = 2;
    return { ok: false, error: message };
  };
  let args: DsCliArgs;
  try {
    args = parseDsCliArgs(argv);
  } catch (error) {
    return cannotRun(error instanceof Error ? error.message : String(error));
  }
  if (args.help) {
    stdout.write(
      `${DS_CHECK_USAGE}\n\nValidate, compile and check a design-system document: the spec's codes, the guarantees (aa-text, aa-focus, target-size) and the contrast report, for the base document and its high-contrast variant. --render also paints every agent-emittable catalog component under it in a headless browser and checks axe, the painted contrast and colors that do not follow the design system; known findings (none in the library; --known <file> adds your own) are listed and do not fail unless --strict.\n\n--locked runs the full locked-design-system checks and prints findings with counts by area, route and component. Add --report to keep the complete findings as a progress baseline while returning success; add --json for machine-readable output (including summary counts). --baseline <file> compares the report to a saved one; --scope <id> sets a host-chosen scope (such as a prototype id) on every finding, so one baseline keeps several prototypes apart. Without --report, violations enforce exit 1. Exit 0 means clean or report-only, 1 means an enforced refusal/finding, 2 means the check could not run.\n\n--render paints the conformance sheet that ships inside @texuli/tools (--sheet ${DS_CHECK_BUILTIN_SHEET}, the default; no bundler needed). --sheet <page.html> serves a page you built that installs @texuli/tools/ds-check/host, and --url <page> checks a page you serve. It needs "playwright" (or "@playwright/test") and "@axe-core/playwright" as dev dependencies of your project, and chromium (npx playwright install chromium); the static checks need neither.\n\nLocked design systems (ADR-032): the allow section is checked against the agent catalog, or --catalog <components.json> (unknown-component, unknown-variant, unknown-size, unknown-tone, unknown-density, unknown-color, unknown-state); the report lists the allowed set and the approval as declared, and refuses a recorded content hash that no longer matches (content-hash-mismatch, library-hash-mismatch). texuli ds hash prints the hashes. --extensions <file>... merges host catalog extension manifests (format texuli/catalog-extension, ids <ns>:<id>) into the catalog first, so allow keys such as acme:kpi-strip are checked as the host checks them; a refused extension is left out whole and reported as catalog-extension, with the merge's code (extension-format, extension-namespace, extension-collision, …) in the message. The check cannot prove who approved: a reviewed commit is the guarantee.\n`
    );
    return { ok: true };
  }
  let report: DsCheckReport | DsFullReport;
  try {
    const doc = await readJsonFile(args.file as string, 'The design system');
    const bases: Record<string, unknown> = {};
    for (const path of args.bases) {
      const base = await readJsonFile(path, 'The base');
      const record = base as { id?: unknown; version?: unknown };
      if (typeof record?.id !== 'string' || typeof record.version !== 'string')
        throw new TypeError(`The base ${path} has no id and version.`);
      bases[`${record.id}@${record.version}`] = base;
    }
    const texuli =
      args.catalog === undefined
        ? await loadAllowCatalog()
        : catalogOf(await readJsonFile(args.catalog, 'The catalog'), args.catalog);
    // Host extensions: read as JSON (never executed), checked and merged by mergeCatalogs.
    const extensions: unknown[] = [];
    for (const path of args.extensions)
      extensions.push(await readJsonFile(path, 'The catalog extension'));
    const merged = await loadMergedCatalog(extensions, { catalog: texuli });
    const catalog = merged.catalog;
    if (args.locked || args.prototype !== undefined) {
      const prototype =
        args.prototype === undefined
          ? undefined
          : await readPrototypeDirectory(args.prototype, { scanWorkspace: args.scanWorkspace });
      let full = await checkDesignSystemFull(doc, {
        catalog: texuli,
        ...(extensions.length > 0 ? { extensions } : {}),
        base: bases,
        file: args.file as string,
        hashes: true,
        ...(prototype
          ? {
              prototype: {
                files: prototype.files,
                blueprints: prototype.blueprints,
                workspacePackages: prototype.workspacePackages,
                scanWorkspace: args.scanWorkspace,
              },
            }
          : {}),
        ...(args.trust ? { trust: args.trust } : {}),
      });
      // The full report keeps a serialized check (no compiled variables), so the
      // render check compiles the runs again to paint them.
      const live = args.render
        ? await checkDesignSystem(doc, {
            file: args.file as string,
            bases,
            catalog,
            ...(args.modes ? { modes: args.modes } : {}),
            ...(args.variants ? { variants: args.variants } : {}),
            ...(args.trust ? { trust: args.trust } : {}),
          })
        : undefined;
      if (live?.runs.some((run) => run.compiled)) {
        const known =
          args.known === undefined
            ? undefined
            : parseKnownFindings(await readJsonFile(args.known, 'The known findings'));
        // The locked render check: chart, map and canvas marks are exempt from the
        // per-pixel literal check, and a page you serve (--url) is mapped against allow.
        const allow =
          doc !== null && typeof doc === 'object' && !Array.isArray(doc)
            ? (doc as { allow?: unknown }).allow
            : undefined;
        const { report: rendered, locked } = await renderLockedDesignSystemCheck(
          live,
          allow !== null && typeof allow === 'object' && !Array.isArray(allow)
            ? { allow: allow as Record<string, unknown> }
            : undefined,
          {
            ...(args.url ? { url: args.url } : {}),
            ...(args.sheet ? { sheet: args.sheet } : {}),
            ...(known ? { known } : {}),
            ...(args.strict ? { strict: true } : {}),
            ...(args.modes ? { modes: args.modes } : {}),
            ...(io.cwd ? { cwd: io.cwd } : {}),
            ...(io.load ? { load: io.load } : {}),
            ...(args.scope ? { scope: args.scope } : {}),
          }
        );
        const renderFindings = locked.errors.map((issue) => ({
          code: issue.code,
          severity: 'error' as const,
          area:
            issue.code === 'render-contrast'
              ? ('contrast' as const)
              : ('prototype-components' as const),
          path: issue.path,
          message: issue.message,
          hint:
            issue.hint ??
            (issue.code === 'unmapped'
              ? 'Build the control from an allowed catalog component.'
              : issue.code === 'not-allowed'
                ? 'Use a component the allow set lists, or ask the design reviewer to allow it.'
                : 'Fix the browser finding, then rerun the render check.'),
          ...(issue.mode ? { mode: issue.mode } : {}),
          ...(issue.variant ? { variant: issue.variant } : {}),
          ...(issue.route ? { route: issue.route } : {}),
          ...(issue.viewport ? { viewport: issue.viewport } : {}),
          // The mapper names the catalog id a finding is about (not-allowed,
          // render-disabled-value); it is part of the baseline key (0.17.4).
          ...(issue.source ? { component: issue.source } : {}),
        }));
        full = {
          ...full,
          ok: full.ok && locked.ok,
          codes: [
            ...new Set([...full.codes, ...renderFindings.map((finding) => finding.code)]),
          ].sort(),
          summary: { ...full.summary, errors: full.summary.errors + renderFindings.length },
          findings: [...full.findings, ...renderFindings],
          check: {
            ...full.check,
            ok: full.check.ok && locked.ok,
            codes: [...new Set([...full.check.codes, ...locked.codes])].sort(),
            errors: [...full.check.errors, ...locked.errors],
            ...(rendered.render ? { render: rendered.render } : {}),
          },
        };
      }
      report = full;
    } else {
      report = await checkDesignSystem(doc, {
        file: args.file as string,
        bases,
        hashes: true,
        catalog,
        ...(args.modes ? { modes: args.modes } : {}),
        ...(args.variants ? { variants: args.variants } : {}),
        ...(args.trust ? { trust: args.trust } : {}),
      });
      const refused = catalogExtensionIssues(merged, args.extensions);
      if (refused.length > 0) {
        const errors = [...refused, ...report.errors];
        report = {
          ...report,
          ok: false,
          errors,
          codes: [...new Set(errors.map((e) => e.code))].sort(),
        };
      }
      const known =
        args.known === undefined
          ? undefined
          : parseKnownFindings(await readJsonFile(args.known, 'The known findings'));
      if (args.render && report.runs.some((run) => run.compiled))
        report = await renderDesignSystemCheck(report, {
          ...(args.url ? { url: args.url } : {}),
          ...(args.sheet ? { sheet: args.sheet } : {}),
          ...(known ? { known } : {}),
          ...(args.strict ? { strict: true } : {}),
          ...(args.modes ? { modes: args.modes } : {}),
          ...(io.cwd ? { cwd: io.cwd } : {}),
          ...(io.load ? { load: io.load } : {}),
        });
    }
  } catch (error) {
    if (error instanceof DsCheckRequirementError) return cannotRun(error.message);
    return cannotRun(error instanceof Error ? error.message : String(error));
  }
  const fullReport = args.locked;
  if (fullReport) {
    // --scope labels every finding (static and render), so one baseline file can hold the
    // findings of several prototypes without merging their keys (0.17.4).
    const scoped = report as DsFullReport;
    const lockedReport: DsFullReport = args.scope
      ? {
          ...scoped,
          findings: scoped.findings.map((finding) => ({ ...finding, scope: args.scope })),
        }
      : scoped;
    const compare =
      args.baseline === undefined
        ? undefined
        : compareDsReport(await readJsonFile(args.baseline, 'The baseline'), lockedReport);
    const output = {
      ...lockedReport,
      counts: dsFullCounts(lockedReport),
      fingerprint: compare?.fingerprint ?? dsReportFingerprint(lockedReport),
      ...(compare ? { compare } : {}),
    };
    stdout.write(
      args.json ? `${JSON.stringify(output, null, 2)}\n` : formatDsFullReport(lockedReport)
    );
    if (compare && !compare.ok) {
      process.exitCode = 1;
      return {
        ok: false,
        error: `Baseline regression: ${compare.added.map((item) => item.code).join(', ') || 'new findings'}`,
        report,
      };
    }
  } else {
    const checkReport = report as DsCheckReport;
    stdout.write(
      args.json
        ? `${JSON.stringify(serializeDsCheckReport(checkReport), null, 2)}\n`
        : formatDsCheckReport(checkReport)
    );
  }
  const ok = fullReport
    ? (report as DsFullReport).ok && (report as DsFullReport).check.ok
    : (report as DsCheckReport).ok;
  if (!ok && !args.report) {
    process.exitCode = 1;
    return { ok: false, error: `Refused: ${report.codes.join(', ')}`, report };
  }
  if (args.report) process.exitCode = 0;
  return { ok: true, report };
}
