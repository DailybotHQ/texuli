/**
 * The one issue shape of the deck engine (model-v2 §3.9): JSON validation, the
 * Markdown dialect, lint and the untrusted loader all report `DeckDiagnostic`.
 * This module owns the shape, the path formats and the schema kit's own codes.
 */

/** One step of a path: an object key or an array index. */
export type PathSegment = string | number;

export type DiagnosticSeverity = 'error' | 'warning';

/** A source span, set by the Markdown dialect (line and column are 1-based). */
export interface DiagnosticSource {
  line: number;
  column: number;
  endLine?: number;
  endColumn?: number;
}

/**
 * One issue. `path` is canonical; `jsonPath` (`$.slides[2].props.title`) and
 * `pointer` (RFC 6901, `/slides/2/props/title`) are derived from it. The model
 * narrows `Code` and `Rule` to its documented unions.
 */
export interface DeckDiagnostic<Code extends string = string, Rule extends string = string> {
  code: Code;
  severity: DiagnosticSeverity;
  path: PathSegment[];
  jsonPath: string;
  pointer: string;
  message: string;
  /** An actionable hint. */
  fix?: string;
  slideId?: string;
  source?: DiagnosticSource;
  /** Lint only: the rule that raised the issue. */
  rule?: Rule;
}

/** The schema kit's own stable codes (kebab-case; the model adds its own). */
export const SCHEMA_CODES = Object.freeze({
  invalidType: 'invalid-type',
  required: 'required',
  unknownKey: 'unknown-key',
  tooShort: 'too-short',
  tooLong: 'too-long',
  tooFew: 'too-few',
  tooMany: 'too-many',
  outOfRange: 'out-of-range',
  notInteger: 'not-integer',
  notFinite: 'not-finite',
  pattern: 'pattern',
  reserved: 'reserved',
  enum: 'enum',
  unknownKind: 'unknown-kind',
  unsafeText: 'unsafe-text',
  unsafeKey: 'unsafe-key',
  tooDeep: 'too-deep',
  cycle: 'cycle',
  tooLarge: 'too-large',
  invalidInput: 'invalid-input',
} as const);

export type SchemaCode = (typeof SCHEMA_CODES)[keyof typeof SCHEMA_CODES];

/** At most this many diagnostics are kept by default; the rest set `truncated`. */
export const MAX_DIAGNOSTICS = 200;

const IDENTIFIER = /^[A-Za-z_$][A-Za-z0-9_$]*$/;

/** `['slides', 2, 'props', 'title']` → `$.slides[2].props.title`; odd keys use `['…']`. */
export function toJsonPath(path: readonly PathSegment[]): string {
  let out = '$';
  for (const segment of path) {
    if (typeof segment === 'number') out += `[${segment}]`;
    else if (IDENTIFIER.test(segment)) out += `.${segment}`;
    else out += `['${segment.replaceAll('\\', '\\\\').replaceAll("'", "\\'")}']`;
  }
  return out;
}

/** RFC 6901 JSON Pointer: `~` → `~0`, `/` → `~1`; the root is `''`. */
export function toPointer(path: readonly PathSegment[]): string {
  let out = '';
  for (const segment of path) {
    out += `/${String(segment).replaceAll('~', '~0').replaceAll('/', '~1')}`;
  }
  return out;
}

export interface DiagnosticExtra {
  severity?: DiagnosticSeverity;
  fix?: string;
  slideId?: string;
  source?: DiagnosticSource;
  rule?: string;
}

/** Build a diagnostic with both derived path forms (the path is copied). */
export function createDiagnostic<Code extends string>(
  code: Code,
  message: string,
  path: readonly PathSegment[],
  extra: DiagnosticExtra = {}
): DeckDiagnostic<Code> {
  const diagnostic: DeckDiagnostic<Code> = {
    code,
    severity: extra.severity ?? 'error',
    path: [...path],
    jsonPath: toJsonPath(path),
    pointer: toPointer(path),
    message,
  };
  if (extra.fix !== undefined) diagnostic.fix = extra.fix;
  if (extra.slideId !== undefined) diagnostic.slideId = extra.slideId;
  if (extra.source !== undefined) diagnostic.source = { ...extra.source };
  if (extra.rule !== undefined) diagnostic.rule = extra.rule;
  return diagnostic;
}

/**
 * One line for logs, CLIs and agent feedback:
 * `error unknown-key at $.style.colour (3:5): Unknown key "colour". Fix: …`.
 */
export function formatDiagnostic(diagnostic: DeckDiagnostic): string {
  const where = diagnostic.source ? ` (${diagnostic.source.line}:${diagnostic.source.column})` : '';
  const fix = diagnostic.fix ? ` Fix: ${diagnostic.fix}` : '';
  return `${diagnostic.severity} ${diagnostic.code} at ${diagnostic.jsonPath}${where}: ${diagnostic.message}${fix}`;
}
