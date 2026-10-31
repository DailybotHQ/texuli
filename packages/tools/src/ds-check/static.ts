/**
 * The static half of `texuli ds check` (T-ds-conformance): validate,
 * resolve `extends`, compile the base document and its variants, and
 * re-check the ADR-022 guarantees over the compiled variables. Pure apart
 * from the lazy library-theme load for `extends: "texuli:<id>"`; never
 * throws on a JSON value.
 */
import {
  type CompiledDesignSystem,
  compileDesignSystem,
  type DesignSystemCompileIssue,
  loadLibraryBase,
} from '@texuli/tokens/design-system/compile';
import {
  checkDesignSystemGuarantees,
  DESIGN_SYSTEM_LIMITS,
} from '@texuli/tokens/design-system/validate';
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
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

function toIssue(issue: DesignSystemCompileIssue, variant: string | null): DsCheckIssue {
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

/** Load every base of the chain up front, so the synchronous compiler can follow it. */
async function loadBases(
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
 * `extends` chain, the compile of the base and each variant, and the
 * guarantees re-checked over the compiled variables (`aa-text`,
 * `aa-focus`, `target-size`). `ok` is false on any refusal.
 */
export async function checkDesignSystem(
  input: unknown,
  options: DsCheckOptions = {}
): Promise<DsCheckReport> {
  const errors: DsCheckIssue[] = [];
  const runs: DsCheckRun[] = [];
  const doc = isRecord(input) ? input : {};
  const document = {
    ...(typeof doc.id === 'string' ? { id: doc.id } : {}),
    ...(typeof doc.version === 'string' ? { version: doc.version } : {}),
    ...(typeof doc.name === 'string' ? { name: doc.name } : {}),
  };
  const loaded = await loadBases(input, options.bases);
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
  for (const run of runs) {
    if (!run.compiled) continue;
    for (const issue of checkDesignSystemGuarantees(run.compiled)) {
      errors.push(toIssue(issue, run.variant));
      run.ok = false;
    }
  }

  return {
    format: DS_CHECK_FORMAT,
    version: DS_CHECK_VERSION,
    ok: errors.length === 0,
    ...(options.file ? { file: options.file } : {}),
    document,
    codes: issueCodes(errors),
    errors,
    runs,
  };
}

/** The report as JSON-ready data: the compiled maps left out. */
export function serializeDsCheckReport(report: DsCheckReport): DsCheckReport {
  return {
    ...report,
    runs: report.runs.map(({ compiled: _compiled, ...run }) => run),
  };
}
