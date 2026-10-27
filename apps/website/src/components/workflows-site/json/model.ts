/**
 * Pure helpers for the JSON live preview island: parsing with a located
 * error, JSON paths for diagnostics, and the status copy. No validator, no
 * player and no DOM here, so the island's first load stays small; the
 * validator lives in `validate.ts` and is imported lazily.
 */

/** Typing pauses this long before the draft is validated again. */
export const INPUT_DEBOUNCE_MS = 250;

/** Where a diagnostic came from. */
export type DiagnosticSource = 'json' | 'state' | 'validator' | 'player';

/** One row in the diagnostics list. Every field is shown as text. */
export interface PreviewDiagnostic {
  key: string;
  source: DiagnosticSource;
  severity: 'error' | 'warning';
  code: string;
  message: string;
  /** A JSON path into the edited document (`$.tree.children[0].props.title`). */
  path: string;
}

/** What the draft's root is, which decides how node paths become JSON paths. */
export type DraftRootKind = 'envelope' | 'tree' | 'array';

export type ParsedText =
  | { ok: true; value: unknown }
  | { ok: false; diagnostic: PreviewDiagnostic };

/** The number of lines in the editor (an empty editor has one). */
export function lineCount(text: string): number {
  let lines = 1;
  for (let index = 0; index < text.length; index += 1) {
    if (text.charCodeAt(index) === 10) lines += 1;
  }
  return lines;
}

/** 1-based line and column of a character offset. */
export function lineColumnAt(text: string, offset: number): { line: number; column: number } {
  const clamped = Math.max(0, Math.min(offset, text.length));
  let line = 1;
  let start = 0;
  for (let index = 0; index < clamped; index += 1) {
    if (text.charCodeAt(index) === 10) {
      line += 1;
      start = index + 1;
    }
  }
  return { line, column: clamped - start + 1 };
}

/**
 * `JSON.parse` with a located error. Engines word the error differently;
 * when the message carries a character position, the line and column are
 * computed from it, otherwise the engine's message is shown as is.
 */
export function parseJsonText(text: string): ParsedText {
  try {
    return { ok: true, value: JSON.parse(text) };
  } catch (cause) {
    const raw = cause instanceof Error ? cause.message : 'Invalid JSON.';
    const position = /position (\d+)/.exec(raw);
    let message = raw;
    if (position) {
      const { line, column } = lineColumnAt(text, Number(position[1]));
      // Some engines already append "(line l column c)"; say it once, up front.
      const detail = raw.replace(/\s*\(line \d+ column \d+\)/, '');
      message = `Line ${line}, column ${column}: ${detail}`;
    } else if (text.trim() === '') {
      message = 'The editor is empty: paste or pick a blueprint.';
    }
    return {
      ok: false,
      diagnostic: {
        key: 'json:bad-json',
        source: 'json',
        severity: 'error',
        code: 'bad-json',
        message,
        path: '$',
      },
    };
  }
}

/** The draft's root kind: a blueprint envelope, a bare node, or an array of nodes. */
export function rootKindOf(value: unknown): DraftRootKind {
  if (Array.isArray(value)) return 'array';
  if (
    typeof value === 'object' &&
    value !== null &&
    (value as Record<string, unknown>).format === 'texuli-blueprint'
  ) {
    return 'envelope';
  }
  return 'tree';
}

const ENVELOPE_FIELDS = /^(state|flow|status|tier|activatedBy|spec|catalog|format|version)\b/;

/**
 * A validator or player path as a JSON path into the edited document.
 * Node paths (`0.children.1.props.title`) start at the root node; envelope
 * paths (`$.status`) and declaration paths (`state.tasks`) are already
 * rooted at the document. Numeric segments become `[n]`.
 */
export function toJsonPath(path: string, root: DraftRootKind): string {
  if (path === '' || path === '$') return '$';
  if (path.startsWith('$')) return path;
  const segments = path.split('.');
  const bracket = (parts: readonly string[]) =>
    parts.map((part) => (/^\d+$/.test(part) ? `[${part}]` : `.${part}`)).join('');
  if (root === 'envelope' && ENVELOPE_FIELDS.test(path)) {
    return `$${bracket(segments)}`;
  }
  const [first, ...rest] = segments;
  if (first !== undefined && /^\d+(\[\d+\])*$/.test(first)) {
    if (root === 'array') return `$${bracket(segments)}`;
    if (root === 'envelope') return `$.tree${bracket(rest)}`;
    return `$${bracket(rest)}`;
  }
  return `$${bracket(segments)}`;
}

/** Errors only: warnings never stop a paint. */
export function errorCount(diagnostics: readonly PreviewDiagnostic[]): number {
  return diagnostics.filter((d) => d.severity === 'error').length;
}

/** "1 problem", "3 problems". */
export function problems(count: number): string {
  return count === 1 ? '1 problem' : `${count} problems`;
}

/** The phase of the preview, shown as a status line and announced politely. */
export type PreviewPhase =
  | { kind: 'checking' }
  | { kind: 'refused'; errors: number }
  | { kind: 'painted'; warnings: number };

export function statusText(phase: PreviewPhase): string {
  switch (phase.kind) {
    case 'checking':
      return 'Checking the blueprint…';
    case 'refused':
      return `Not rendered: ${problems(phase.errors)}.`;
    case 'painted':
      return phase.warnings === 0
        ? 'Rendered: the blueprint passed validation.'
        : `Rendered with ${phase.warnings === 1 ? '1 warning' : `${phase.warnings} warnings`}.`;
  }
}

/** Collapse duplicates (same source, code and path), keeping the first. */
export function dedupe(diagnostics: readonly PreviewDiagnostic[]): PreviewDiagnostic[] {
  const seen = new Set<string>();
  const out: PreviewDiagnostic[] = [];
  for (const diagnostic of diagnostics) {
    if (seen.has(diagnostic.key)) continue;
    seen.add(diagnostic.key);
    out.push(diagnostic);
  }
  return out;
}

export function diagnosticKey(source: DiagnosticSource, code: string, path: string): string {
  return `${source}:${code}@${path}`;
}
