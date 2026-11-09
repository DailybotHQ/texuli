/// <reference types="node" />
/**
 * `texuli ds check <file> [--json] [--render] [--mode light|dark|all]
 * [--variant <name>]… [--trust developer|untrusted] [--base <file>]…
 * [--sheet builtin|<page.html>] [--url <page>] [--known <file>] [--strict]
 * [--catalog <components.json>]`.
 *
 * Exit codes: 0 when every check passes, 1 on any refusal or render
 * finding, 2 when the check could not run (a bad flag, an unreadable file,
 * or a missing `--render` requirement).
 *
 * Locked design systems (ADR-032): the check reads the agent catalog and
 * refuses `allow` ids or values it does not list (`unknown-component`,
 * `unknown-variant`, `unknown-size`, `unknown-tone`, `unknown-density`,
 * `unknown-state`), and a recorded content hash that no longer matches
 * (`content-hash-mismatch`, `library-hash-mismatch`). It reports the allowed
 * set and the approval status as declared; it cannot prove who approved.
 */
import { readFile, stat } from 'node:fs/promises';
import type { DesignSystemAllowCatalog } from '@texuli/spec/design-system';
import { presetComponentsFromBuild } from '../ds-create/presets.ts';
import { loadOpsCatalog } from '../ops/catalog.ts';
import {
  DS_CHECK_BUILTIN_SHEET,
  DsCheckRequirementError,
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

/** The largest design-system file the CLI reads. */
export const DS_CHECK_MAX_BYTES = 1_000_000;

export const DS_CHECK_USAGE =
  'Usage: texuli ds check <file> [--json] [--render] [--mode light|dark|all] [--variant <name>]... [--trust developer|untrusted] [--base <file>]... [--sheet builtin|<page.html>] [--url <page>] [--known <file>] [--strict] [--catalog <components.json>]';

export interface DsCliArgs {
  command: 'check';
  file?: string;
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
  help: boolean;
}

/** Parse `ds <command> …` (the words after `texuli`); throws a `TypeError` on bad input. */
export function parseDsCliArgs(argv: readonly string[]): DsCliArgs {
  const [command, ...rest] = argv;
  const args: DsCliArgs = {
    command: 'check',
    json: false,
    render: false,
    bases: [],
    strict: false,
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
    if (arg === '--json') args.json = true;
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
    else if (arg.startsWith('-')) throw new TypeError(`Unknown ds check flag "${arg}".`);
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

export interface DsCliIo {
  stdout?: { write(chunk: string): unknown };
  stderr?: { write(chunk: string): unknown };
  cwd?: string;
}

export type DsCliResult =
  | { ok: true; report?: DsCheckReport }
  | { ok: false; error: string; report?: DsCheckReport };

/** A `--catalog` file: `{ components: [...] }` (the spec's `components.json` or a stub). */
function catalogOf(value: unknown, path: string): DesignSystemAllowCatalog {
  const components = (value as { components?: unknown } | null)?.components;
  if (!Array.isArray(components))
    throw new TypeError(`The catalog ${path} has no components list.`);
  return { components } as DesignSystemAllowCatalog;
}

/** The agent catalog as `checkDesignSystemAllow` reads it (axes and states per component). */
export async function loadAllowCatalog(): Promise<{
  components: ReturnType<typeof presetComponentsFromBuild>;
}> {
  const build = await loadOpsCatalog();
  return { components: presetComponentsFromBuild(build.catalog.entries) };
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
      `${DS_CHECK_USAGE}\n\nValidate, compile and check a design-system document: the spec's codes, the guarantees (aa-text, aa-focus, target-size) and the contrast report, for the base document and its high-contrast variant. --render also paints every agent-emittable catalog component under it in a headless browser and checks axe, the painted contrast and colors that do not follow the design system; known findings (none in the library; --known <file> adds your own) are listed and do not fail unless --strict.\n\n--render paints the conformance sheet that ships inside @texuli/tools (--sheet ${DS_CHECK_BUILTIN_SHEET}, the default; no bundler needed). --sheet <page.html> serves a page you built that installs @texuli/tools/ds-check/host, and --url <page> checks a page you serve. It needs "playwright" (or "@playwright/test") and "@axe-core/playwright" as dev dependencies of your project, and chromium (npx playwright install chromium); the static checks need neither.\n\nLocked design systems (ADR-032): the allow section is checked against the agent catalog, or --catalog <components.json> (unknown-component, unknown-variant, unknown-size, unknown-tone, unknown-density, unknown-state); the report lists the allowed set and the approval as declared, and refuses a recorded content hash that no longer matches (content-hash-mismatch, library-hash-mismatch). texuli ds hash prints the hashes. The check cannot prove who approved: a reviewed commit is the guarantee.\nExit 0 pass, 1 refusal or finding, 2 could not run.\n`
    );
    return { ok: true };
  }
  let report: DsCheckReport;
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
    report = await checkDesignSystem(doc, {
      file: args.file as string,
      bases,
      hashes: true,
      catalog:
        args.catalog === undefined
          ? await loadAllowCatalog()
          : catalogOf(await readJsonFile(args.catalog, 'The catalog'), args.catalog),
      ...(args.modes ? { modes: args.modes } : {}),
      ...(args.variants ? { variants: args.variants } : {}),
      ...(args.trust ? { trust: args.trust } : {}),
    });
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
      });
  } catch (error) {
    if (error instanceof DsCheckRequirementError) return cannotRun(error.message);
    return cannotRun(error instanceof Error ? error.message : String(error));
  }
  stdout.write(
    args.json
      ? `${JSON.stringify(serializeDsCheckReport(report), null, 2)}\n`
      : formatDsCheckReport(report)
  );
  if (!report.ok) {
    process.exitCode = 1;
    return { ok: false, error: `Refused: ${report.codes.join(', ')}`, report };
  }
  return { ok: true, report };
}
