/**
 * The full design-system validator (ADR-032, PLAN_016 T-validator-core):
 * {@link checkDesignSystemFull} runs every check a design system and an optional prototype
 * can fail, in one call, and returns one report whose findings each carry a stable code, a
 * severity, an area, a path and a fix hint.
 *
 * - **Design system** (always): structure (the spec's closed schema), `extends` resolution,
 *   the allowed set against the merged catalog, the approval and its content-hash integrity,
 *   and the compile diagnostics: text, focus and non-text contrast (AA or AAA), target sizes,
 *   the data-viz palette (complete, distinct, readable on the background) and token
 *   completeness (every variable a reference compile emits). This is `checkDesignSystem`
 *   (the `ds check` report, embedded unchanged in `check`) plus the palette and token checks.
 * - **Prototype** (when given): every Svelte/TypeScript source and blueprint against the
 *   allow manifest (`locked-static.ts`) and, for a locked design system, every source against
 *   the CSS policy (`css-policy.ts`).
 *
 * Pure apart from resolving `texuli:<id>` bases from the theme library (as `ds check` does);
 * no browser, no file system, no network.
 */
import type { SpecCatalog } from '@texuli/spec';
import { mergeCatalogs } from '@texuli/spec/catalog-extensions';
import { compileDesignSystem } from '@texuli/tokens/design-system/compile-core';
import { contrastRatio } from '@texuli/tokens/palette';
import { checkLockedCssSource, LOCKED_CSS_CODES } from './css-policy.ts';
import {
  checkLockedUsage,
  LOCKED_STATIC_CODES,
  type LockedAllowManifest,
  type LockedCatalog,
  usageFromBlueprint,
  usageFromSource,
} from './locked-static.ts';
import {
  checkDesignSystem,
  DS_CHECK_LOCKED_CODES,
  type DsCheckLockedReport,
  serializeDsCheckReport,
} from './static.ts';
import type { DsCheckIssue, DsCheckMode } from './types.ts';
import { listUncheckedImports, type UncheckedImports } from './unscanned.ts';

export const DS_FULL_FORMAT = 'texuli/ds-validate';
export const DS_FULL_VERSION = 1;

export type DsFullSeverity = 'error' | 'warning' | 'info';

/** Where a finding comes from. */
export type DsFullArea =
  | 'structure'
  | 'extends'
  | 'allow'
  | 'approval'
  | 'contrast'
  | 'data-viz'
  | 'tokens'
  | 'catalog'
  | 'prototype-components'
  | 'prototype-css'
  | 'prototype-limits';

/** One finding: a stable code, its severity, its area, a path and a fix hint. */
export interface DsFullFinding {
  readonly code: string;
  readonly severity: DsFullSeverity;
  readonly area: DsFullArea;
  /** A JSON path in the document, or `file:line:column` / a JSON path in the prototype. */
  readonly path: string;
  readonly message: string;
  readonly hint: string;
  readonly variant?: string;
  readonly mode?: DsCheckMode;
  /** The page route of a render finding (0.17.3); part of the baseline key. */
  readonly route?: string;
  /** The viewport of a render finding, `<width>x<height>` (0.17.3); part of the baseline key. */
  readonly viewport?: string;
  /** The component of a prototype finding. */
  readonly component?: string;
  /** The value that failed (a variant, a class, a declaration). */
  readonly value?: string;
}

/** The prototype to check against the design system. */
export interface DsFullPrototype {
  /** Source files by path (Svelte, TypeScript, CSS). */
  readonly files?: Readonly<Record<string, string>>;
  /** Blueprints by name (`{ tree }` or a root node). */
  readonly blueprints?: Readonly<Record<string, unknown>>;
  /** Workspace package names the prototype may import (from the host monorepo). */
  readonly workspacePackages?: readonly string[];
  /**
   * When true, files under `workspace:<name>/` or `node_modules/<name>/` count as
   * a scan of that package (CLI `--scan-workspace` loads them).
   */
  readonly scanWorkspace?: boolean;
}

export interface DsFullOptions {
  /** The Texuli catalog (`packages/spec/catalog/components.json`). */
  readonly catalog: SpecCatalog;
  /** Host catalog extensions merged into it (`mergeCatalogs`, ids `<ns>:<id>`). */
  readonly extensions?: readonly unknown[];
  /** Bases for `extends: "id@x.y.z"`, keyed by `id@version` (or a resolver). */
  readonly base?: Readonly<Record<string, unknown>> | ((ref: string) => unknown | Promise<unknown>);
  /** The prototype to check (static components and the CSS policy). */
  readonly prototype?: DsFullPrototype;
  /** `untrusted` (default) or `developer` (accepts capped data URLs). */
  readonly trust?: 'developer' | 'untrusted';
  /** Refuse a stale recorded content hash (default true, as `texuli ds check`). */
  readonly hashes?: boolean;
  /** The file name to put in the report. */
  readonly file?: string;
}

export interface DsFullReport {
  readonly format: typeof DS_FULL_FORMAT;
  readonly version: typeof DS_FULL_VERSION;
  /** No finding of severity `error`. */
  readonly ok: boolean;
  readonly file?: string;
  readonly document: { id?: string; version?: string; name?: string };
  /** Distinct codes of the error findings, sorted. */
  readonly codes: string[];
  readonly summary: { readonly errors: number; readonly warnings: number; readonly info: number };
  /** Every finding, errors first, then warnings, then info; each group in check order. */
  readonly findings: DsFullFinding[];
  /** The `ds check` report (format `texuli/ds-check`, schema `ds-check-report`), as `--json` prints it. */
  readonly check: DsCheckLockedReport;
  /** The prototype part, when one was given. */
  readonly prototype?: {
    readonly files: number;
    readonly blueprints: number;
    /** Uses per catalog id. */
    readonly components: Readonly<Record<string, number>>;
    /**
     * Workspace packages and local modules imported from the prototype that
     * this check did not read. Empty when every such import was scanned.
     */
    readonly unchecked: UncheckedImports;
  };
}

/** Codes this validator adds to `ds check`'s. */
export const DS_FULL_CODES = [
  'dataviz-missing',
  'dataviz-duplicate',
  'dataviz-contrast',
  'token-missing',
  'catalog-extension',
] as const;

/** The most findings one report returns. */
export const DS_FULL_MAX_FINDINGS = 256;

/**
 * Bounds on an untrusted prototype. A file over `fileBytes` (UTF-8) is not scanned and gets
 * one `file-too-large` error; files past `files` or past `totalBytes` in all, and blueprints
 * past `blueprints`, are not scanned and get one `prototype-too-large` error each kind.
 * Scanning stops once the report holds `DS_FULL_MAX_FINDINGS` findings (`findings-capped`).
 * An unscanned file is an error, never a pass: the lock cannot be verified on it.
 */
export const DS_FULL_PROTOTYPE_LIMITS = Object.freeze({
  fileBytes: 512 * 1024,
  files: 500,
  totalBytes: 8 * 1024 * 1024,
  blueprints: 100,
});

/** The codes of the prototype bounds (raised on oversized input, not by a fixture document). */
export const DS_FULL_LIMIT_CODES = [
  'file-too-large',
  'prototype-too-large',
  'findings-capped',
] as const;

/** UTF-8 byte length, cheaply bounded: a string longer than `cap` code units is over `cap` bytes. */
function utf8Bytes(text: string, cap: number): number {
  if (text.length > cap) return text.length;
  return new TextEncoder().encode(text).length;
}

const SPEC_STRUCTURE = new Set([
  'unknown-key',
  'invalid-type',
  'invalid-value',
  'required',
  'format-version',
  'url-refused',
  'inline-bytes',
]);
const EXTENDS = new Set(['extends-range', 'extends-cycle', 'extends-depth']);
const CONTRAST = new Set(['aa-text', 'aa-focus', 'target-size', 'aa-non-text']);
const ALLOW = new Set([
  'unknown-component',
  'unknown-variant',
  'unknown-size',
  'unknown-tone',
  'unknown-density',
  'unknown-color',
  'unknown-state',
]);

/** The fix hint of a code that arrived without one. */
const HINTS: Readonly<Record<string, string>> = {
  'unknown-key': 'Remove the key; the hint of the schema lists the allowed ones.',
  'invalid-type': 'Give the value the type the schema names at this path.',
  'invalid-value': 'Fix the value at this path (a pattern, an enum or a range).',
  required: 'Add the required field.',
  'format-version': 'Migrate the document (texuli ds validate migrates older versions).',
  'url-refused': 'Use a same-origin relative path, never a remote or data: URL at untrusted trust.',
  'inline-bytes': 'Move the asset to a file, or shrink it below the inline cap.',
  'extends-range': 'Extend an exact id@x.y.z or texuli:<theme>, never a range.',
  'extends-cycle': 'Break the extends loop.',
  'extends-depth': 'Flatten the extends chain to at most 4 levels.',
  'aa-text': 'Unpin the failing color or pick a darker or lighter pin.',
  'aa-focus': 'Make the focus ring wider or pick a ring color that stands out.',
  'target-size': 'Raise the control size to at least accessibility.targetMin.',
  'aa-non-text': 'Leave the fill derived, or pin one with 3:1 against its container.',
  'unknown-component': 'Use a catalog id (or add the host extension that declares it).',
  'unknown-variant': 'Use a variant the catalog lists for this component.',
  'unknown-size': 'Use a size the catalog lists for this component.',
  'unknown-tone': 'Use a tone the catalog lists for this component.',
  'unknown-density': 'Use a density the catalog lists for this component.',
  'unknown-color': 'Use a category color the catalog lists for this component.',
  'unknown-state': 'Use a state the catalog lists for this component.',
  'approval-invalid':
    'Keep status "draft" until a reviewer runs texuli ds approve, which records approvedBy, approvedAt and the content hash.',
  'content-hash-mismatch': 'Review the change, then re-approve (texuli ds approve).',
  'library-hash-mismatch': 'Review the entry, then re-approve it.',
  'not-allowed': 'Use a component the allow set lists, or ask the design reviewer to allow it.',
  'dynamic-value': 'Use a literal value so the lock can be checked, or rely on the render check.',
};
const hintOf = (code: string, hint?: string) =>
  hint ??
  HINTS[code] ??
  (code.endsWith('-not-allowed')
    ? 'Use an allowed value.'
    : 'See the code in docs/DESIGN_SYSTEMS.md.');

function areaOf(issue: DsCheckIssue): DsFullArea {
  if (EXTENDS.has(issue.code) || issue.path.startsWith('$.extends') || issue.source)
    return 'extends';
  if (CONTRAST.has(issue.code)) return 'contrast';
  if (ALLOW.has(issue.code)) return 'allow';
  if (
    issue.code === 'approval-invalid' ||
    issue.path.startsWith('$.approval') ||
    (DS_CHECK_LOCKED_CODES as readonly string[]).includes(issue.code)
  )
    return 'approval';
  if (SPEC_STRUCTURE.has(issue.code)) return 'structure';
  return 'structure';
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

let reference: ReadonlySet<string> | undefined;
/** Every variable a reference compile emits (a minimal document), per mode. */
function referenceVariables(): ReadonlySet<string> {
  if (reference) return reference;
  const compiled = compileDesignSystem({
    format: 'texuli/design-system',
    formatVersion: 1,
    id: 'reference',
    version: '1.0.0',
    name: 'Reference',
    color: { brand: { seed: '#4f46e5' } },
  });
  reference = new Set(compiled.ok ? Object.keys(compiled.vars.light ?? {}) : []);
  return reference;
}

const DATAVIZ = [
  ...Array.from({ length: 8 }, (_, i) => `--tx-chart-${i + 1}`),
  ...Array.from({ length: 9 }, (_, i) => `--tx-chart-sequential-${i + 1}`),
  ...Array.from({ length: 9 }, (_, i) => `--tx-chart-diverging-${i + 1}`),
];

function ratio(a: string | undefined, b: string | undefined): number | undefined {
  if (!a || !b) return undefined;
  try {
    return contrastRatio(a, b);
  } catch {
    return undefined;
  }
}

/**
 * The data-viz and token findings of one compiled run's variables: every variable a
 * reference compile emits is present (`token-missing`, `dataviz-missing`), the categorical
 * chart colors are distinct (`dataviz-duplicate`) and hold 3:1 on the background
 * (`dataviz-contrast`).
 */
export function compiledFindings(
  vars: Partial<Record<DsCheckMode, Record<string, string>>>,
  variant: string | undefined
): DsFullFinding[] {
  const out: DsFullFinding[] = [];
  const at = variant ? { variant } : {};
  const expected = referenceVariables();
  for (const mode of Object.keys(vars) as DsCheckMode[]) {
    const map = vars[mode] ?? {};
    const missing = [...expected].filter((name) => !Object.hasOwn(map, name));
    for (const name of missing.slice(0, 32))
      out.push({
        code: DATAVIZ.includes(name) ? 'dataviz-missing' : 'token-missing',
        severity: 'error',
        area: DATAVIZ.includes(name) ? 'data-viz' : 'tokens',
        path: `$.compiled.vars.${mode}["${name}"]`,
        message: `${name} is missing in ${mode} mode.`,
        hint: 'Recompile with the current compiler; a cached compile from an older version lacks it.',
        mode,
        ...at,
      });
    const categorical = DATAVIZ.slice(0, 8)
      .map((name) => map[name])
      .filter((v): v is string => !!v);
    const seen = new Map<string, number>();
    categorical.forEach((value, index) => {
      const key = value.toLowerCase();
      const first = seen.get(key);
      if (first !== undefined)
        out.push({
          code: 'dataviz-duplicate',
          severity: 'warning',
          area: 'data-viz',
          path: `$.color.dataViz.${mode}.categorical[${index}]`,
          message: `Chart color ${index + 1} repeats chart color ${first + 1} in ${mode} mode (${value}).`,
          hint: 'Give every categorical color its own hue so series stay distinguishable.',
          value,
          mode,
          ...at,
        });
      else seen.set(key, index);
    });
    const background = map['--tx-background'];
    categorical.forEach((value, index) => {
      const r = ratio(value, background);
      if (r !== undefined && r < 3)
        out.push({
          code: 'dataviz-contrast',
          severity: 'warning',
          area: 'data-viz',
          path: `$.color.dataViz.${mode}.categorical[${index}]`,
          message: `Chart color ${index + 1} (${value}) is ${r.toFixed(2)}:1 on the background in ${mode} mode, below 3:1.`,
          hint: 'Pick a darker or lighter categorical color, or label the series directly.',
          value,
          mode,
          ...at,
        });
    });
  }
  return out;
}

/** The deepest a document may nest before the validator refuses it unread (the spec walks 16). */
export const DS_FULL_MAX_DEPTH = 64;

/** True when `value` nests deeper than `max` objects or arrays (iterative: never overflows). */
export function depthExceeds(value: unknown, max: number): boolean {
  const stack: [unknown, number][] = [[value, 0]];
  let seen = 0;
  while (stack.length > 0) {
    const [node, depth] = stack.pop() as [unknown, number];
    if (node === null || typeof node !== 'object') continue;
    if (depth > max) return true;
    if (++seen > 200_000) return true;
    for (const child of Object.values(node as Record<string, unknown>))
      stack.push([child, depth + 1]);
  }
  return false;
}

function refusedReport(
  doc: unknown,
  findings: DsFullFinding[],
  options: DsFullOptions
): DsFullReport {
  const record = isRecord(doc) ? doc : {};
  const text = (v: unknown) => (typeof v === 'string' ? v.slice(0, 120) : undefined);
  const document = {
    ...(text(record.id) ? { id: text(record.id) } : {}),
    ...(text(record.version) ? { version: text(record.version) } : {}),
    ...(text(record.name) ? { name: text(record.name) } : {}),
  };
  const refusal: DsFullFinding = {
    code: 'invalid-value',
    severity: 'error',
    area: 'structure',
    path: '$',
    message: `The document nests deeper than ${DS_FULL_MAX_DEPTH} levels or holds too many values; it was not read.`,
    hint: 'A design-system document is a few levels deep: remove the nested data.',
  };
  const all = [...findings.filter((f) => f.severity === 'error'), refusal];
  const check = {
    format: 'texuli/ds-check',
    version: 1,
    ok: false,
    document,
    codes: ['invalid-value'],
    errors: [
      { code: refusal.code, path: refusal.path, message: refusal.message, hint: refusal.hint },
    ],
    runs: [],
  } as unknown as DsCheckLockedReport;
  return {
    format: DS_FULL_FORMAT,
    version: DS_FULL_VERSION,
    ok: false,
    ...(options.file ? { file: options.file } : {}),
    document,
    codes: [...new Set(all.map((f) => f.code))].sort(),
    summary: { errors: all.length, warnings: 0, info: 0 },
    findings: all,
    check,
  };
}

/**
 * Run every check over a design system and, optionally, a prototype; one report with every
 * finding (stable code, severity, area, path, fix hint). Never throws on JSON values.
 */
export async function checkDesignSystemFull(
  doc: unknown,
  options: DsFullOptions
): Promise<DsFullReport> {
  const findings: DsFullFinding[] = [];

  // The catalog: Texuli's, with the host extensions merged.
  const merged = mergeCatalogs(options.catalog, options.extensions ?? []);
  for (const issue of merged.issues)
    findings.push({
      code: 'catalog-extension',
      severity: 'error',
      area: 'catalog',
      path: issue.path,
      message: `${issue.code}: ${issue.message}`,
      hint: 'Fix the extension; an extension with a refused component is left out whole.',
    });
  const catalog = merged.catalog;

  // The design system: structure, extends, allow, approval, compile (ds check).
  // A document too deep for the hash and the compile fails closed with a finding.
  if (depthExceeds(doc, DS_FULL_MAX_DEPTH)) return refusedReport(doc, findings, options);
  const raw = await checkDesignSystem(doc, {
    catalog,
    trust: options.trust ?? 'untrusted',
    hashes: options.hashes ?? true,
    ...(options.base ? { bases: options.base } : {}),
    ...(options.file ? { file: options.file } : {}),
  });
  const check = raw as DsCheckLockedReport;
  for (const issue of check.errors)
    findings.push({
      code: issue.code,
      severity: 'error',
      area: areaOf(issue),
      path: issue.path,
      message: issue.message,
      hint: hintOf(issue.code, issue.hint),
      ...(issue.variant ? { variant: issue.variant } : {}),
      ...(issue.mode ? { mode: issue.mode } : {}),
    });

  // Compile diagnostics the check does not refuse: compiler warnings, the palette, the tokens.
  for (const run of check.runs) {
    const variant = run.variant ?? undefined;
    for (const warning of run.warnings)
      findings.push({
        code: warning.code ?? 'compile-warning',
        severity: 'warning',
        area: warning.code === 'aa-non-text' ? 'contrast' : 'tokens',
        path: warning.path,
        message: warning.message,
        hint: hintOf(
          warning.code ?? 'compile-warning',
          'Review the value the compiler changed or dropped.'
        ),
        ...(variant ? { variant } : {}),
        ...(warning.mode ? { mode: warning.mode } : {}),
      });
    for (const adjustment of run.adjustments)
      findings.push({
        code: 'color-adjusted',
        severity: 'info',
        area: 'contrast',
        path: adjustment.path,
        message: `${adjustment.variable} moved from ${adjustment.from} to ${adjustment.to} in ${adjustment.mode} mode: ${adjustment.reason}`,
        hint: 'Pin the color you want only if it holds the contrast target; otherwise keep the solver’s.',
        mode: adjustment.mode,
        ...(variant ? { variant } : {}),
      });
    if (run.compiled) findings.push(...compiledFindings(run.compiled.vars, variant));
  }

  // The prototype: components and props against the allow manifest, then the CSS policy,
  // within the bounds of DS_FULL_PROTOTYPE_LIMITS (untrusted input).
  let prototype: DsFullReport['prototype'];
  if (options.prototype) {
    const limits = DS_FULL_PROTOTYPE_LIMITS;
    const files = isRecord(options.prototype.files) ? options.prototype.files : {};
    const blueprints = isRecord(options.prototype.blueprints) ? options.prototype.blueprints : {};
    const lockedCatalog = catalog as unknown as LockedCatalog;
    const allowManifest: LockedAllowManifest =
      isRecord(doc) && isRecord(doc.allow)
        ? { allow: doc.allow as LockedAllowManifest['allow'] }
        : {};
    const full = () => findings.length >= DS_FULL_MAX_FINDINGS;
    const limit = (
      code: (typeof DS_FULL_LIMIT_CODES)[number],
      path: string,
      message: string,
      hint: string
    ) =>
      findings.push({
        code,
        severity: code === 'findings-capped' ? 'warning' : 'error',
        area: 'prototype-limits',
        path,
        message,
        hint,
      });

    // Which files are read: in path order, each under the per-file cap, within the count
    // and total-bytes caps.
    const scan: { path: string; text: string }[] = [];
    let total = 0;
    let skipped = 0;
    for (const path of Object.keys(files).sort()) {
      const text = files[path];
      if (typeof text !== 'string') continue;
      const bytes = utf8Bytes(text, limits.fileBytes);
      if (bytes > limits.fileBytes) {
        limit(
          'file-too-large',
          path,
          `${path} is over ${limits.fileBytes} bytes; it was not scanned.`,
          'Split the file: a locked prototype is checked file by file, and an unscanned file cannot pass.'
        );
        continue;
      }
      if (scan.length >= limits.files || total + bytes > limits.totalBytes) {
        skipped += 1;
        continue;
      }
      total += bytes;
      scan.push({ path, text });
    }
    if (skipped > 0)
      limit(
        'prototype-too-large',
        'files',
        `${skipped} file(s) were not scanned: at most ${limits.files} files and ${limits.totalBytes} bytes per check.`,
        'Check the prototype in parts, or remove generated and vendored files from the input.'
      );
    const blueprintNames = Object.keys(blueprints).sort();
    if (blueprintNames.length > limits.blueprints)
      limit(
        'prototype-too-large',
        'blueprints',
        `${blueprintNames.length - limits.blueprints} blueprint(s) were not checked: at most ${limits.blueprints} per check.`,
        'Check the blueprints in parts.'
      );

    const components: Record<string, number> = {};
    const record = (used: ReturnType<typeof checkLockedUsage>) => {
      for (const [id, count] of Object.entries(used.components))
        components[id] = (components[id] ?? 0) + count;
      for (const [list, severity] of [
        [used.errors, 'error'],
        [used.warnings, 'warning'],
      ] as const)
        for (const issue of list)
          findings.push({
            code: issue.code,
            severity,
            area: 'prototype-components',
            path: issue.path,
            message: issue.message,
            hint: hintOf(issue.code, issue.hint),
            component: issue.component,
            ...(issue.value !== undefined ? { value: issue.value } : {}),
          });
    };
    const units: (() => void)[] = [
      ...scan
        .filter(({ path }) => /\.(svelte|[cm]?[jt]sx?)$/.test(path))
        .map(
          ({ path, text }) =>
            () =>
              record(
                checkLockedUsage(usageFromSource(path, text, lockedCatalog), {
                  catalog: lockedCatalog,
                  allowManifest,
                })
              )
        ),
      ...blueprintNames.slice(0, limits.blueprints).map(
        (name) => () =>
          record(
            checkLockedUsage(
              usageFromBlueprint(blueprints[name]).map((usage) => ({
                ...usage,
                location: { path: `${name}#${usage.location.path ?? '$'}` },
              })),
              { catalog: lockedCatalog, allowManifest }
            )
          )
      ),
      ...(allowManifest.allow
        ? scan.map(({ path, text }) => () => {
            for (const issue of checkLockedCssSource(text, path).errors)
              findings.push({
                code: issue.code,
                severity: 'error',
                area: 'prototype-css',
                path: issue.path,
                message: issue.message,
                hint: 'Locked prototypes use layout utilities on the token scale only; style through the design system’s components.',
                value: issue.value,
              });
          })
        : []),
    ];
    for (const [index, unit] of units.entries()) {
      if (full()) {
        limit(
          'findings-capped',
          'prototype',
          `The report reached ${DS_FULL_MAX_FINDINGS} findings; ${units.length - index} remaining check(s) of the prototype did not run.`,
          'Fix the findings shown and check again.'
        );
        break;
      }
      unit();
    }
    prototype = {
      files: Object.keys(files).length,
      blueprints: blueprintNames.length,
      components,
      unchecked: listUncheckedImports(files, {
        workspacePackages: options.prototype.workspacePackages,
        scanWorkspace: options.prototype.scanWorkspace,
      }),
    };
  }

  const rank: Record<DsFullSeverity, number> = { error: 0, warning: 1, info: 2 };
  // The cap notice always survives the cut, last.
  const notice = findings.find((f) => f.code === 'findings-capped');
  const ordered = [
    ...findings
      .filter((f) => f !== notice)
      .map((finding, index) => ({ finding, index }))
      .sort((a, b) => rank[a.finding.severity] - rank[b.finding.severity] || a.index - b.index)
      .map((entry) => entry.finding)
      .slice(0, DS_FULL_MAX_FINDINGS - (notice ? 1 : 0)),
    ...(notice ? [notice] : []),
  ];
  const errors = ordered.filter((f) => f.severity === 'error');
  return {
    format: DS_FULL_FORMAT,
    version: DS_FULL_VERSION,
    ok: findings.every((f) => f.severity !== 'error'),
    ...(options.file ? { file: options.file } : {}),
    document: check.document,
    codes: [...new Set(errors.map((f) => f.code))].sort(),
    summary: {
      errors: findings.filter((f) => f.severity === 'error').length,
      warnings: findings.filter((f) => f.severity === 'warning').length,
      info: findings.filter((f) => f.severity === 'info').length,
    },
    findings: ordered,
    check: serializeDsCheckReport(check) as DsCheckLockedReport,
    ...(prototype ? { prototype } : {}),
  };
}

/** Every code a full report can carry, by area (for docs and tests). */
export const DS_FULL_KNOWN_CODES: Readonly<Record<string, readonly string[]>> = Object.freeze({
  validator: DS_FULL_CODES,
  locked: DS_CHECK_LOCKED_CODES,
  prototypeComponents: [...LOCKED_STATIC_CODES, 'dynamic-value'],
  prototypeCss: LOCKED_CSS_CODES,
  prototypeLimits: DS_FULL_LIMIT_CODES,
});
