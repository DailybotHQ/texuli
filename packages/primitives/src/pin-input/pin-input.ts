/**
 * One-time-code logic, free of the DOM: which values are allowed, how a paste
 * is cleaned, and what each visual cell shows.
 */

/** Whole-value patterns (regular-expression sources) for `pattern`. */
export const REGEXP_ONLY_DIGITS = '^\\d+$';
export const REGEXP_ONLY_CHARS = '^[a-zA-Z]+$';
export const REGEXP_ONLY_DIGITS_AND_CHARS = '^[a-zA-Z0-9]+$';

/** Longest code the input accepts, whatever `maxlength` asks for. */
export const MAX_PIN_LENGTH = 32;

export interface PinRules {
  maxlength: number;
  /** A whole-value regular-expression source; omitted means any characters. */
  pattern?: string | undefined;
}

/** The effective length limit: a whole number from 1 to {@link MAX_PIN_LENGTH}. */
export function clampLength(maxlength: number): number {
  return Number.isFinite(maxlength)
    ? Math.min(MAX_PIN_LENGTH, Math.max(1, Math.trunc(maxlength)))
    : 6;
}

function compile(pattern: string | undefined): RegExp | null {
  if (!pattern) return null;
  try {
    return new RegExp(pattern);
  } catch {
    // An invalid pattern accepts nothing rather than everything.
    return /$^/;
  }
}

/** Whether `value` may be the input's value: within the length and matching the pattern. */
export function acceptsValue(value: string, rules: PinRules): boolean {
  if (value.length > clampLength(rules.maxlength)) return false;
  if (value === '') return true;
  const regex = compile(rules.pattern);
  return regex === null || regex.test(value);
}

/**
 * The code a paste would leave, or `null` to refuse it. `transform` cleans the
 * clipboard text first (default: remove whitespace, so "123 456" pastes);
 * the result replaces `selection` of `current` and is cut to `maxlength`.
 */
export function pastedValue(
  current: string,
  clipboard: string,
  selection: { start: number; end: number },
  rules: PinRules,
  transform: (text: string) => string = (text) => text.replace(/\s+/g, '')
): string | null {
  let text: string;
  try {
    text = transform(clipboard);
  } catch {
    return null;
  }
  if (typeof text !== 'string' || text === '') return null;
  const start = Math.max(0, Math.min(selection.start, current.length));
  const end = Math.max(start, Math.min(selection.end, current.length));
  const next = (current.slice(0, start) + text + current.slice(end)).slice(
    0,
    clampLength(rules.maxlength)
  );
  return acceptsValue(next, rules) ? next : null;
}

/** What one visual cell shows. */
export interface PinCell {
  /** The character, `null` when empty (masked as `•`). */
  char: string | null;
  /** The cell the next character goes into (or the selected one), while focused. */
  isActive: boolean;
  /** Active and empty, with a collapsed selection: draw a caret. */
  hasFakeCaret: boolean;
}

export function pinCells(
  value: string,
  rules: PinRules & { mask?: boolean },
  selection: { start: number; end: number } | null
): PinCell[] {
  const length = clampLength(rules.maxlength);
  const chars = [...value];
  return Array.from({ length }, (_, index) => {
    const raw = chars[index];
    const char = raw === undefined ? null : rules.mask ? '•' : raw;
    let isActive = false;
    if (selection) {
      const { start, end } = selection;
      isActive =
        start === end ? index === Math.min(start, length - 1) : index >= start && index < end;
    }
    return {
      char,
      isActive,
      hasFakeCaret: isActive && char === null && selection?.start === selection?.end,
    };
  });
}
