/**
 * The static half of `texuli ds check` (T-ds-conformance): validate,
 * resolve `extends`, compile the base document and its variants, and
 * re-check the ADR-022 guarantees over the compiled variables. Pure apart
 * from the lazy library-theme load for `extends: "texuli:<id>"`; never
 * throws on a JSON value.
 *
 * Locked design systems (ADR-032): with a `catalog`, the `allow` section and
 * `library[].composes` are checked against it (`checkDesignSystemAllow`:
 * `unknown-component`, `unknown-variant`, `unknown-size`, `unknown-tone`,
 * `unknown-density`, `unknown-state`). Every check reports `locked`: the
 * allowed set, the approval status and whether each recorded content hash
 * still matches; with `hashes`, a stored hash that does not match is refused
 * (`content-hash-mismatch`, `library-hash-mismatch`). The check cannot prove
 * who approved: a reviewed commit is the guarantee.
 */

import { checkDesignSystemAllow, type DesignSystemAllowCatalog } from '@texuli/spec/design-system';
import {
  type CompiledDesignSystem,
  checkDesignSystemIndicators,
  compileDesignSystem,
  type DesignSystemCompileIssue,
  loadLibraryBase,
} from '@texuli/tokens/design-system/compile';
import {
  checkDesignSystemGuarantees,
  DESIGN_SYSTEM_LIMITS,
} from '@texuli/tokens/design-system/validate';
import { hashReport } from '../ds-create/approve.ts';
import {
  DS_CHECK_FORMAT,
  DS_CHECK_VERSION,
  type DsCheckIssue,
  type DsCheckMode,
  type DsCheckReport,
  type DsCheckRun,
} from './types.ts';

/** The variant `ds check` adds on its own when the document declares it. */
export const HIGH_CONTRAST_VARIANT = 'high-contrast';

export interface DsCheckOptions {
  /** The modes to check (default: every mode the document compiles). */
  modes?: readonly DsCheckMode[];
  /**
   * The variants to check besides the base document. Default: the
   * `high-contrast` variant when the document declares one. A name the
   * document does not declare is refused as `invalid-value` at `$.variants`.
   */
  variants?: readonly string[];
  /** `untrusted` (default) refuses every `data:` URL; `developer` accepts capped ones. */
  trust?: 'developer' | 'untrusted';
  /**
   * Bases for `extends: "id@x.y.z"`: documents keyed by `id@version`, or a
   * function. `texuli:<id>` loads from the theme library unless this returns one.
   */
  bases?: Readonly<Record<string, unknown>> | ((ref: string) => unknown | Promise<unknown>);
  /** The file name to put in the report. */
  file?: string;
  /**
   * The catalog the `allow` section is checked against (ADR-032): the spec
   * catalog, or any `{ components: [{ id, axes?, states? }] }`. Omitted: the
   * allowed set is reported but not checked for catalog membership.
   */
  catalog?: DesignSystemAllowCatalog;
  /**
   * Refuse a recorded content hash that no longer matches (`content-hash-mismatch`,
   * `library-hash-mismatch`). `texuli ds check` sets it; `ds.validate` (and so `ds approve`,
   * which replaces a stale approval) does not: a stale approval is not a malformed document.
   * The hashes are reported in `locked` either way.
   */
  hashes?: boolean;
}

/** Codes the locked-design-system checks raise besides the spec's allow codes. */
export const DS_CHECK_LOCKED_CODES = ['content-hash-mismatch', 'library-hash-mismatch'] as const;

/** The approval and the allowed set of a design system, as `ds check` reports them. */
export interface DsLockedReport {
  /** True when the document has an `allow` section (only allowed components may be used). */
  locked: boolean;
  /** The allowed catalog ids, sorted (empty when not locked). */
  allowed: string[];
  /** The library entry ids, in document order. */
  library: string[];
  /** Whether `allow` was checked against a catalog. */
  catalogChecked: boolean;
  approval: {
    /** `none` when the document has no `approval` record. */
    status: 'approved' | 'draft' | 'none' | 'unknown';
    version?: string;
    /** As declared: the check cannot prove who approved. */
    approvedBy?: string;
    approvedAt?: string;
    /** The content hash of the document as written. */
    contentHash: string;
    /** The hash the approval records, if any. */
    stored?: string;
    /** `true`/`false` when a hash is recorded; absent when none is. */
    matches?: boolean;
  };
  /** Each library entry's approval and hash. */
  entries: {
    id?: string;
    status?: string;
    contentHash: string;
    stored?: string;
    matches?: boolean;
  }[];
}

/** A `ds check` report with the locked-design-system section. */
export type DsCheckLockedReport = DsCheckReport & { locked: DsLockedReport };

const text = (value: unknown, max = 200): string | undefined =>
  typeof value === 'string' ? value.slice(0, max) : undefined;

/** The allowed set, the approval and the hash checks of a document (ADR-032). */
export function lockedReport(
  input: unknown,
  catalogChecked: boolean
): { report: DsLockedReport; errors: DsCheckIssue[] } {
  const doc = isRecord(input) ? input : {};
  const hashes = hashReport(input);
  const record = isRecord(doc.approval) ? doc.approval : undefined;
  const status = !record
    ? 'none'
    : record.status === 'approved' || record.status === 'draft'
      ? record.status
      : 'unknown';
  const library = Array.isArray(doc.library) ? doc.library.slice(0, 64) : [];
  const errors: DsCheckIssue[] = [];
  if (hashes.matches === false)
    errors.push({
      code: 'content-hash-mismatch',
      path: '$.approval.contentHash',
      message: 'The recorded content hash does not match the document: it changed after approval.',
      hint: 'Review the change, then re-approve (texuli ds approve) to record the new hash.',
    });
  hashes.library.slice(0, 64).forEach((entry, index) => {
    if (entry.matches === false)
      errors.push({
        code: 'library-hash-mismatch',
        path: `$.library[${index}].approval.contentHash`,
        message: 'The recorded content hash does not match this library entry.',
        hint: 'Review the entry, then re-approve it.',
      });
  });
  return {
    report: {
      locked: isRecord(doc.allow),
      allowed: isRecord(doc.allow)
        ? Object.keys(doc.allow)
            .filter((id) => !['__proto__', 'constructor', 'prototype'].includes(id))
            .sort()
            .slice(0, 256)
        : [],
      library: library
        .map((entry) => (isRecord(entry) ? text(entry.id, 48) : undefined))
        .filter((id): id is string => id !== undefined),
      catalogChecked,
      approval: {
        status,
        ...(record && text(record.version, 64) ? { version: text(record.version, 64) } : {}),
        ...(record && text(record.approvedBy) ? { approvedBy: text(record.approvedBy) } : {}),
        ...(record && text(record.approvedAt, 64)
          ? { approvedAt: text(record.approvedAt, 64) }
          : {}),
        contentHash: hashes.contentHash,
        ...(hashes.stored !== undefined ? { stored: hashes.stored, matches: hashes.matches } : {}),
      },
      entries: hashes.library.slice(0, 64).map((entry, index) => {
        const raw = library[index];
        const entryStatus = isRecord(raw) ? text(raw.status, 32) : undefined;
        return {
          ...(entry.id ? { id: entry.id } : {}),
          ...(entryStatus ? { status: entryStatus } : {}),
          contentHash: entry.contentHash,
          ...(entry.stored !== undefined ? { stored: entry.stored, matches: entry.matches } : {}),
        };
      }),
    },
    errors,
  };
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** A compiler issue as a report issue, tagged with the variant it came from. */
export function toIssue(issue: DesignSystemCompileIssue, variant: string | null): DsCheckIssue {
  return {
    code: issue.code,
    path: issue.path,
    message: issue.message,
    ...(issue.hint ? { hint: issue.hint } : {}),
    ...(issue.source ? { source: issue.source } : {}),
    ...(variant ? { variant } : {}),
    ...(issue.mode ? { mode: issue.mode } : {}),
    ...(issue.pairs ? { pairs: issue.pairs } : {}),
  };
}

/**
 * Load every base of the `extends` chain up front, so the synchronous
 * compiler can follow it: `bases` first, then the theme library for
 * `texuli:<id>`. A base nothing provides is `undefined` (the compiler
 * refuses it with a hint).
 */
export async function loadDesignSystemBases(
  input: unknown,
  bases: DsCheckOptions['bases']
): Promise<Map<string, unknown>> {
  const lookup = async (ref: string): Promise<unknown> => {
    if (typeof bases === 'function') return bases(ref);
    return bases && Object.hasOwn(bases, ref) ? bases[ref] : undefined;
  };
  const loaded = new Map<string, unknown>();
  let next = isRecord(input) ? input.extends : undefined;
  for (let hop = 0; typeof next === 'string' && !loaded.has(next); hop++) {
    if (hop > DESIGN_SYSTEM_LIMITS.extendsDepth) break;
    const ref = next;
    let base: unknown;
    try {
      base = await lookup(ref);
      if (base === undefined && ref.startsWith('texuli:')) base = await loadLibraryBase(ref);
    } catch {
      base = undefined;
    }
    loaded.set(ref, base);
    next = isRecord(base) ? base.extends : undefined;
  }
  return loaded;
}

function emptyRun(variant: string | null): DsCheckRun {
  return {
    variant,
    ok: false,
    modes: [],
    contrast: {},
    adjustments: [],
    warnings: [],
    inlineBytes: 0,
    targets: [],
  };
}

function runOf(variant: string | null, compiled: CompiledDesignSystem): DsCheckRun {
  return {
    variant,
    ok: true,
    modes: [...compiled.modes],
    hash: compiled.hash,
    contrast: compiled.report.contrast,
    adjustments: compiled.report.adjustments,
    warnings: compiled.report.warnings,
    inlineBytes: compiled.report.inlineBytes,
    targets: compiled.report.targets,
    compiled,
  };
}

/** Every distinct code of a list, sorted. */
export function issueCodes(issues: readonly DsCheckIssue[]): string[] {
  return [...new Set(issues.map((issue) => issue.code))].sort();
}

/**
 * Check a design-system document statically: the spec's validation, the
 * `extends` chain, the compile of the base and each variant, the
 * guarantees re-checked over the compiled variables (`aa-text`,
 * `aa-focus`, `target-size`), and the blocking non-text indicators
 * (`aa-non-text`, such as the sidebar's active fill on the sidebar). `ok`
 * is false on any refusal.
 */
export async function checkDesignSystem(
  input: unknown,
  options: DsCheckOptions = {}
): Promise<DsCheckLockedReport> {
  const errors: DsCheckIssue[] = [];
  const runs: DsCheckRun[] = [];
  const doc = isRecord(input) ? input : {};
  const document = {
    ...(typeof doc.id === 'string' ? { id: doc.id } : {}),
    ...(typeof doc.version === 'string' ? { version: doc.version } : {}),
    ...(typeof doc.name === 'string' ? { name: doc.name } : {}),
  };
  const loaded = await loadDesignSystemBases(input, options.bases);
  const resolve = (ref: string) => loaded.get(ref);
  const trust = options.trust ?? 'untrusted';
  const compileOptions = {
    resolve,
    trust,
    ...(options.modes ? { modes: options.modes } : {}),
  };

  const base = compileDesignSystem(input, compileOptions);
  if (!base.ok) {
    errors.push(...base.errors.map((issue) => toIssue(issue, null)));
    runs.push(emptyRun(null));
  } else {
    runs.push(runOf(null, base));
    const declared = isRecord(doc.variants) ? Object.keys(doc.variants) : [];
    const wanted =
      options.variants ?? (declared.includes(HIGH_CONTRAST_VARIANT) ? [HIGH_CONTRAST_VARIANT] : []);
    for (const variant of wanted) {
      if (!declared.includes(variant)) {
        errors.push({
          code: 'invalid-value',
          path: '$.variants',
          message: `The document declares no variant "${variant}".`,
          hint: declared.length
            ? `Declared variants: ${declared.join(', ')}.`
            : 'The document declares no variants.',
        });
        continue;
      }
      const compiled = compileDesignSystem(input, { ...compileOptions, variant });
      if (!compiled.ok) {
        errors.push(...compiled.errors.map((issue) => toIssue(issue, variant)));
        runs.push(emptyRun(variant));
      } else runs.push(runOf(variant, compiled));
    }
  }

  // The guarantees, re-checked over what the compiler emitted: a compiled map
  // that passes compile but fails here is a compiler bug, and is refused too.
  // Then the blocking non-text indicators (aa-non-text, WCAG 1.4.11): the
  // compiler only warns about them, the check refuses them.
  for (const run of runs) {
    if (!run.compiled) continue;
    for (const issue of [
      ...checkDesignSystemGuarantees(run.compiled),
      ...checkDesignSystemIndicators(run.compiled),
    ]) {
      errors.push(toIssue(issue, run.variant));
      run.ok = false;
    }
  }

  // Locked design systems (ADR-032): catalog membership of `allow`, then the
  // approval's content hashes.
  if (options.catalog) {
    for (const issue of checkDesignSystemAllow(input, options.catalog).errors)
      errors.push({ code: issue.code, path: issue.path, message: issue.message });
  }
  const locked = lockedReport(input, options.catalog !== undefined);
  if (options.hashes) errors.push(...locked.errors);

  return {
    format: DS_CHECK_FORMAT,
    version: DS_CHECK_VERSION,
    ok: errors.length === 0,
    ...(options.file ? { file: options.file } : {}),
    document,
    codes: issueCodes(errors),
    errors,
    runs,
    locked: locked.report,
  };
}

/** The report as JSON-ready data: the compiled maps left out. */
export function serializeDsCheckReport(report: DsCheckReport): DsCheckReport {
  return {
    ...report,
    runs: report.runs.map(({ compiled: _compiled, ...run }) => run),
  };
}
