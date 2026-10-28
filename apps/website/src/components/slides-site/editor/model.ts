/**
 * The deck editor's view model: the phase shown in the status line, the
 * diagnostics list items and small text helpers. Pure and synchronous, so
 * the unit tests read it without the deck engine.
 */

/** Checks run this long after typing stops (a seed change or tab switch checks at once). */
export const INPUT_DEBOUNCE_MS = 250;

export type EditorTab = 'json' | 'markdown';
export const EDITOR_TABS: readonly EditorTab[] = ['json', 'markdown'];

export type EditorPhase =
  | { kind: 'checking' }
  | { kind: 'painted'; warnings: number }
  | { kind: 'refused'; errors: number }
  | { kind: 'failed' };

/** One row of the diagnostics list. */
export interface EditorDiagnostic {
  /** Stable within one check (`code@path#n`). */
  key: string;
  code: string;
  severity: 'error' | 'warning';
  message: string;
  /** `$.slides[2].props.title`, or `$` for the document. */
  jsonPath: string;
  line?: number;
  column?: number;
  fix?: string;
}

/** The shape every deck check returns (JSON and Markdown alike). */
export interface DeckCheck {
  ok: boolean;
  /** The validated deck (only when `ok`). */
  deck?: unknown;
  diagnostics: EditorDiagnostic[];
}

/** A diagnostic as the engine reports it (the fields the editor reads). */
export interface EngineDiagnostic {
  code: string;
  severity: 'error' | 'warning';
  message: string;
  jsonPath: string;
  fix?: string;
  source?: { line: number; column: number };
}

/** Engine diagnostics → list rows, with the position from `locate` when the engine gave none. */
export function toEditorDiagnostics(
  issues: readonly EngineDiagnostic[],
  locate?: (jsonPath: string) => { line: number; column: number } | undefined
): EditorDiagnostic[] {
  return issues.map((issue, index) => {
    const at = issue.source ?? locate?.(issue.jsonPath);
    const row: EditorDiagnostic = {
      key: `${issue.code}@${issue.jsonPath}#${index}`,
      code: issue.code,
      severity: issue.severity,
      message: issue.message,
      jsonPath: issue.jsonPath || '$',
    };
    if (at) {
      row.line = at.line;
      row.column = at.column;
    }
    if (issue.fix) row.fix = issue.fix;
    return row;
  });
}

export function errorCount(diagnostics: readonly EditorDiagnostic[]): number {
  return diagnostics.filter((diagnostic) => diagnostic.severity === 'error').length;
}

/** The phase of a finished check. */
export function phaseOf(check: DeckCheck | null): EditorPhase {
  if (check === null) return { kind: 'checking' };
  const errors = errorCount(check.diagnostics);
  if (!check.ok || errors > 0) return { kind: 'refused', errors: Math.max(errors, 1) };
  return { kind: 'painted', warnings: check.diagnostics.length - errors };
}

const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;

/** The status line for a phase (announced politely). */
export function statusText(phase: EditorPhase, tab: EditorTab): string {
  const source = tab === 'json' ? 'JSON' : 'Markdown';
  switch (phase.kind) {
    case 'checking':
      return `Checking the ${source} deck…`;
    case 'painted':
      return phase.warnings === 0
        ? `The ${source} deck is valid and painted below.`
        : `The ${source} deck is valid and painted below, with ${plural(phase.warnings, 'warning', 'warnings')}.`;
    case 'refused':
      return `The ${source} deck has ${plural(phase.errors, 'error', 'errors')}: nothing is painted.`;
    case 'failed':
      return 'The deck engine could not be loaded.';
  }
}

/** `1 line` / `24 lines`. */
export function lineCount(text: string): number {
  if (text === '') return 1;
  let lines = 1;
  for (let i = 0; i < text.length; i++) if (text.charCodeAt(i) === 0x0a) lines++;
  return lines;
}

/** The position label of a diagnostic row (`line 3, column 7`), or `''`. */
export function positionText(diagnostic: Pick<EditorDiagnostic, 'line' | 'column'>): string {
  if (diagnostic.line === undefined) return '';
  return diagnostic.column === undefined
    ? `line ${diagnostic.line}`
    : `line ${diagnostic.line}, column ${diagnostic.column}`;
}

/** Offset of a 1-based line/column in `text` (for moving the caret to a diagnostic). */
export function offsetOf(text: string, line: number, column: number): number {
  let current = 1;
  let index = 0;
  while (current < line && index < text.length) {
    const next = text.indexOf('\n', index);
    if (next === -1) return text.length;
    index = next + 1;
    current++;
  }
  return Math.min(text.length, index + Math.max(0, column - 1));
}
