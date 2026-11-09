/// <reference types="node" />
/**
 * `texuli ds check <file> [--locked] [--report] [--json] [--render] [--mode light|dark|all]
 * [--variant <name>]… [--trust developer|untrusted] [--base <file>]…
 * [--sheet builtin|<page.html>] [--url <page>] [--known <file>] [--strict]
 * [--catalog <components.json>]`.
 *
 * Exit codes: 0 when checks pass or `--locked --report` lists findings,
 * 1 on any refusal or render finding in enforce mode, 2 when the check could
 * not run (a bad flag, an unreadable file, or a missing `--render` requirement).
 *
 * Locked design systems (ADR-032): the check reads the agent catalog and
 * refuses `allow` ids or values it does not list (`unknown-component`,
 * `unknown-variant`, `unknown-size`, `unknown-tone`, `unknown-density`,
 * `unknown-state`), and a recorded content hash that no longer matches
 * (`content-hash-mismatch`, `library-hash-mismatch`). It reports the allowed
 * set and the approval status as declared; it cannot prove who approved.
 */
import { readFile, stat } from 'node:fs/promises';
import type { SpecCatalog } from '@texuli/spec';
import { presetComponentsFromBuild } from '../ds-create/presets.ts';
import { loadOpsCatalog } from '../ops/catalog.ts';
import { checkDesignSystemFull, type DsFullReport } from './full.ts';
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
  'Usage: texuli ds check <file> [--locked [--report]] [--json] [--render] [--mode light|dark|all] [--variant <name>]... [--trust developer|untrusted] [--base <file>]... [--sheet builtin|<page.html>] [--url <page>] [--known <file>] [--strict] [--catalog <components.json>]';

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
  if (args.report && !args.locked) throw new TypeError('Flag --report needs --locked.');
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
  const build = await loadOpsCatalog();
  return {
    catalogHash: build.hash,
    components: presetComponentsFromBuild(build.catalog.entries),
  } as unknown as SpecCatalog;
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
      `${DS_CHECK_USAGE}\n\nValidate, compile and check a design-system document: the spec's codes, the guarantees (aa-text, aa-focus, target-size) and the contrast report, for the base document and its high-contrast variant. --render also paints every agent-emittable catalog component under it in a headless browser and checks axe, the painted contrast and colors that do not follow the design system; known findings (none in the library; --known <file> adds your own) are listed and do not fail unless --strict.\n\n--locked runs the full locked-design-system checks and prints findings with counts by area, route and component. Add --report to keep the complete findings as a progress baseline while returning success; add --json for machine-readable output (including summary counts). Without --report, violations enforce exit 1. Exit 0 means clean or report-only, 1 means an enforced refusal/finding, 2 means the check could not run.\n\n--render paints the conformance sheet that ships inside @texuli/tools (--sheet ${DS_CHECK_BUILTIN_SHEET}, the default; no bundler needed). --sheet <page.html> serves a page you built that installs @texuli/tools/ds-check/host, and --url <page> checks a page you serve. It needs "playwright" (or "@playwright/test") and "@axe-core/playwright" as dev dependencies of your project, and chromium (npx playwright install chromium); the static checks need neither.\n\nLocked design systems (ADR-032): the allow section is checked against the agent catalog, or --catalog <components.json> (unknown-component, unknown-variant, unknown-size, unknown-tone, unknown-density, unknown-state); the report lists the allowed set and the approval as declared, and refuses a recorded content hash that no longer matches (content-hash-mismatch, library-hash-mismatch). texuli ds hash prints the hashes. The check cannot prove who approved: a reviewed commit is the guarantee.\n`
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
    const catalog =
      args.catalog === undefined
        ? await loadAllowCatalog()
        : catalogOf(await readJsonFile(args.catalog, 'The catalog'), args.catalog);
    if (args.locked) {
      let full = await checkDesignSystemFull(doc, {
        catalog,
        base: bases,
        file: args.file as string,
        hashes: true,
        ...(args.trust ? { trust: args.trust } : {}),
      });
      if (args.render && full.check.runs.some((run) => run.compiled)) {
        const known =
          args.known === undefined
            ? undefined
            : parseKnownFindings(await readJsonFile(args.known, 'The known findings'));
        const rendered = await renderDesignSystemCheck(full.check, {
          ...(args.url ? { url: args.url } : {}),
          ...(args.sheet ? { sheet: args.sheet } : {}),
          ...(known ? { known } : {}),
          ...(args.strict ? { strict: true } : {}),
          ...(args.modes ? { modes: args.modes } : {}),
          ...(io.cwd ? { cwd: io.cwd } : {}),
        });
        const renderFindings = rendered.errors.map((issue) => ({
          code: issue.code,
          severity: 'error' as const,
          area:
            issue.code === 'render-contrast'
              ? ('contrast' as const)
              : ('prototype-components' as const),
          path: issue.path,
          message: issue.message,
          hint: issue.hint ?? 'Fix the browser finding, then rerun the render check.',
          ...(issue.mode ? { mode: issue.mode } : {}),
          ...(issue.variant ? { variant: issue.variant } : {}),
        }));
        full = {
          ...full,
          ok: full.ok && rendered.ok,
          codes: [
            ...new Set([...full.codes, ...renderFindings.map((finding) => finding.code)]),
          ].sort(),
          summary: { ...full.summary, errors: full.summary.errors + renderFindings.length },
          findings: [...full.findings, ...renderFindings],
          check: rendered as DsFullReport['check'],
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
    }
  } catch (error) {
    if (error instanceof DsCheckRequirementError) return cannotRun(error.message);
    return cannotRun(error instanceof Error ? error.message : String(error));
  }
  const fullReport = args.locked;
  if (fullReport) {
    const lockedReport = report as DsFullReport;
    const output = { ...lockedReport, counts: dsFullCounts(lockedReport) };
    stdout.write(
      args.json ? `${JSON.stringify(output, null, 2)}\n` : formatDsFullReport(lockedReport)
    );
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
