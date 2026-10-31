/// <reference types="node" />
/**
 * `texuli ds check <file> [--json] [--render] [--mode light|dark|all]
 * [--variant <name>]… [--trust developer|untrusted] [--base <file>]…
 * [--url <page>] [--known <file>] [--strict]`.
 *
 * Exit codes: 0 when every check passes, 1 on any refusal or render
 * finding, 2 when the check could not run (a bad flag, an unreadable file,
 * or a missing `--render` requirement).
 */
import { readFile, stat } from 'node:fs/promises';
import { DsCheckRequirementError, parseKnownFindings, renderDesignSystemCheck } from './render.ts';
import { checkDesignSystem, serializeDsCheckReport } from './static.ts';
import type { DsCheckMode, DsCheckReport } from './types.ts';

/** The largest design-system file the CLI reads. */
export const DS_CHECK_MAX_BYTES = 1_000_000;

export const DS_CHECK_USAGE =
  'Usage: texuli ds check <file> [--json] [--render] [--mode light|dark|all] [--variant <name>]... [--trust developer|untrusted] [--base <file>]... [--url <page>] [--known <file>] [--strict]';

export interface DsCliArgs {
  command: 'check';
  file?: string;
  json: boolean;
  render: boolean;
  modes?: DsCheckMode[];
  variants?: string[];
  trust?: 'developer' | 'untrusted';
  bases: string[];
  url?: string;
  /** A JSON file of known findings (`[{ component, element, property, reason }]`). */
  known?: string;
  strict: boolean;
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
    else if (arg === '--url') args.url = value();
    else if (arg === '--known') args.known = value();
    else if (arg.startsWith('-')) throw new TypeError(`Unknown ds check flag "${arg}".`);
    else if (args.file === undefined) args.file = arg;
    else throw new TypeError(`ds check takes one file; got "${args.file}" and "${arg}".`);
  }
  if (args.file === undefined) throw new TypeError(`ds check needs a file. ${DS_CHECK_USAGE}`);
  if (args.url !== undefined && !args.render) throw new TypeError('Flag --url needs --render.');
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

/** The human summary `ds check` prints without `--json`. */
export function formatDsCheckReport(report: DsCheckReport): string {
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
      `${DS_CHECK_USAGE}\n\nValidate, compile and check a design-system document: the spec's codes, the guarantees (aa-text, aa-focus, target-size) and the contrast report, for the base document and its high-contrast variant. --render also paints every agent-emittable catalog component under it in a headless browser (Playwright) and checks axe, the painted contrast and colors that do not follow the design system; known findings (none in the library; --known <file> adds your own) are listed and do not fail unless --strict.\nExit 0 pass, 1 refusal or finding, 2 could not run.\n`
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
