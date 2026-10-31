/**
 * The shapes `texuli ds check` reports (T-ds-conformance). Shared by the
 * static check (Node), the render driver (Node) and the in-page host
 * (browser), so this file imports types only.
 */
import type {
  CompiledDesignSystem,
  DesignSystemAdjustment,
  DesignSystemPairResult,
  DesignSystemTargetResult,
  DesignSystemWarning,
} from '@texuli/tokens/design-system/compile';

/** The report's format tag and version: bumped only on a breaking change of the shape. */
export const DS_CHECK_FORMAT = 'texuli/ds-check';
export const DS_CHECK_VERSION = 1;

export type DsCheckMode = 'light' | 'dark';

/** The attribute that names the catalog component a subtree of the sheet renders. */
export const DS_CHECK_COMPONENT_ATTRIBUTE = 'data-ds-check-component';
/** The global the render driver reads (`window.texuliDsCheck`). */
export const DS_CHECK_GLOBAL = 'texuliDsCheck';

/** A pair the host measures: the compiler's report entry for it. */
export interface DsInspectPair {
  foreground: string;
  background: string;
  kind: 'text' | 'ui' | 'focus';
  required: number;
  ratio: number;
}

/**
 * A refusal: one of the spec's stable codes (`unknown-key`, `invalid-type`,
 * `invalid-value`, `required`, `format-version`, `extends-range`,
 * `extends-cycle`, `extends-depth`, `url-refused`, `inline-bytes`) or a
 * guarantee code (`aa-text`, `aa-focus`, `target-size`), with its JSON path.
 * Render findings use `render-axe`, `render-contrast`, `render-literal` and
 * `render-empty`.
 */
export interface DsCheckIssue {
  code: string;
  path: string;
  message: string;
  hint?: string;
  /** Where it was found when not in the document itself: an `extends` ref, `variant:<name>` or `patch:<i>`. */
  source?: string;
  /** The variant being checked when the issue came from a variant run. */
  variant?: string;
  mode?: DsCheckMode;
  /** The failing contrast pairs of an `aa-text` or `aa-focus` refusal. */
  pairs?: DesignSystemPairResult[];
}

/** One compiled selection: the base document, or one of its variants. */
export interface DsCheckRun {
  /** `null` for the base document. */
  variant: string | null;
  ok: boolean;
  modes: DsCheckMode[];
  hash?: string;
  /** The compiled report: every pair, adjustment and warning. */
  contrast: Partial<Record<DsCheckMode, DesignSystemPairResult[]>>;
  adjustments: DesignSystemAdjustment[];
  warnings: DesignSystemWarning[];
  inlineBytes: number;
  targets: DesignSystemTargetResult[];
  /** The compiled design system, when it compiled (not printed by the CLI's `--json`). */
  compiled?: CompiledDesignSystem;
}

/** One contrast pair measured in the browser, from the computed colors. */
export interface DsRenderPair {
  foreground: string;
  background: string;
  kind: 'text' | 'ui' | 'focus';
  required: number;
  /** The ratio the browser paints (computed colors, composited). */
  ratio: number;
  /** The ratio the compiler reported for the same pair. */
  reported: number;
  pass: boolean;
}

/** A painted color that did not follow the design system's variables. */
export interface DsRenderLiteral {
  /** The catalog id of the component that painted it (`data-ds-check-component`). */
  component: string;
  /** A short selector of the element. */
  element: string;
  property: string;
  value: string;
}

/** A render finding of the library that is known and tracked: it does not fail a run. */
export interface DsKnownFinding {
  /** A catalog id, or `*` for any component. */
  component: string;
  /** A prefix of the element description (`section.tx-player-layout`). */
  element: string;
  /** A prefix of the property (`border` matches every border side). */
  property: string;
  reason: string;
}

/** What the in-page host measured in one scope, for one mode. */
export interface DsInspectResult {
  /** The components the sheet painted. */
  components: string[];
  pairs: DsRenderPair[];
  literals: DsRenderLiteral[];
  /** Elements with painted colors that were compared. */
  checked: number;
}

/** One render of the sheet: a variant in a mode. */
export interface DsRenderRun extends DsInspectResult {
  variant: string | null;
  mode: DsCheckMode;
  /** axe violations inside the scope (`rule (impact): targets`). */
  axe: string[];
  /** Literal findings that match a known finding (they do not fail the run), with its reason. */
  known: (DsRenderLiteral & { reason: string })[];
  ok: boolean;
}

export interface DsRenderReport {
  ok: boolean;
  url: string;
  runs: DsRenderRun[];
}

/** The whole report: `--json` prints it (without the compiled maps). */
export interface DsCheckReport {
  format: typeof DS_CHECK_FORMAT;
  version: typeof DS_CHECK_VERSION;
  ok: boolean;
  /** The checked file, when the CLI read one. */
  file?: string;
  document: { id?: string; version?: string; name?: string };
  /** The distinct codes of `errors`, sorted. */
  codes: string[];
  errors: DsCheckIssue[];
  runs: DsCheckRun[];
  render?: DsRenderReport;
}
