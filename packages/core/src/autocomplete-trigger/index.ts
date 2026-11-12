/**
 * `@texuli/core/autocomplete-trigger`: the framework-free half of inline
 * autocomplete in a text field (`@mention`, `/command`, `:emoji`). It finds the
 * trigger the caret sits in, replaces it with the chosen insertion, and maps
 * keys onto the APG combobox "list autocomplete" moves. Every function is pure,
 * bounded (the scan looks back at most `maxQuery` characters) and never throws.
 */

export interface AutocompleteTrigger {
  /** One character that opens the trigger: `@`, `/`, `:`… */
  readonly char: string;
  /** Longest query read after the character (default 32, at most 64). */
  readonly maxQuery?: number;
  /** Shortest query that opens the list (default 0: the character alone opens it). */
  readonly minQuery?: number;
  /** Only at the start of the text or of a line, as a slash command is. */
  readonly lineStart?: boolean;
}

export interface AutocompleteMatch {
  readonly trigger: AutocompleteTrigger;
  /** The text typed after the trigger character, up to the caret. */
  readonly query: string;
  /** Index of the trigger character. */
  readonly start: number;
  /** The caret: the end of the query. */
  readonly end: number;
}

const MAX_QUERY = 64;

const isSpace = (code: number) =>
  code === 0x20 ||
  code === 0x09 ||
  code === 0x0a ||
  code === 0x0d ||
  code === 0x0c ||
  code === 0xa0;
/** Characters a trigger may follow besides whitespace: opening punctuation. */
const OPENERS = new Set(['(', '[', '{', '"', "'"]);

/**
 * The trigger the caret is in, or `null`. A trigger character counts when it
 * starts the text or follows whitespace or opening punctuation (or, with
 * `lineStart`, starts a line), and the query after it up to the caret holds no
 * whitespace and no other trigger character.
 */
export function findAutocompleteTrigger(
  text: unknown,
  caret: unknown,
  triggers: readonly AutocompleteTrigger[]
): AutocompleteMatch | null {
  if (typeof text !== 'string' || typeof caret !== 'number' || !Number.isInteger(caret))
    return null;
  if (caret < 1 || caret > text.length || !Array.isArray(triggers)) return null;
  const byChar = new Map<string, AutocompleteTrigger>();
  for (const trigger of triggers)
    if (
      trigger &&
      typeof trigger.char === 'string' &&
      trigger.char.length === 1 &&
      !byChar.has(trigger.char)
    )
      byChar.set(trigger.char, trigger);
  if (byChar.size === 0) return null;
  const longest = Math.max(
    ...[...byChar.values()].map((trigger) =>
      Math.min(MAX_QUERY, Math.max(0, trigger.maxQuery ?? 32))
    )
  );
  for (let i = caret - 1; i >= 0 && caret - 1 - i <= longest; i--) {
    const char = text.charAt(i);
    const code = text.charCodeAt(i);
    if (isSpace(code)) return null;
    const trigger = byChar.get(char);
    if (!trigger) continue;
    const query = text.slice(i + 1, caret);
    const max = Math.min(MAX_QUERY, Math.max(0, trigger.maxQuery ?? 32));
    if (query.length > max || query.length < Math.max(0, trigger.minQuery ?? 0)) return null;
    const before = i === 0 ? '' : text.charAt(i - 1);
    const boundary = trigger.lineStart
      ? before === '' || before === '\n'
      : before === '' || isSpace(text.charCodeAt(i - 1)) || OPENERS.has(before);
    return boundary ? { trigger, query, start: i, end: caret } : null;
  }
  return null;
}

/**
 * Replace the matched trigger and query with `insertion`, followed by one
 * space unless the next character already is whitespace. Returns the new text
 * and the caret after the insertion.
 */
export function applyAutocomplete(
  text: string,
  match: Pick<AutocompleteMatch, 'start' | 'end'>,
  insertion: string
): { readonly text: string; readonly caret: number } {
  const start = Math.max(0, Math.min(match.start, text.length));
  const end = Math.max(start, Math.min(match.end, text.length));
  const after = text.slice(end);
  const space = after.length > 0 && isSpace(after.charCodeAt(0)) ? '' : ' ';
  const next = text.slice(0, start) + insertion + space + after;
  return { text: next, caret: start + insertion.length + space.length };
}

export type AutocompleteKeyAction = 'next' | 'previous' | 'first' | 'last' | 'accept' | 'close';

/**
 * The list move for a key while the list is open (APG combobox, list
 * autocomplete): Down and Up move the active option (wrapping), Enter and Tab
 * accept it, Escape closes the list. Other keys (Home and End included) stay
 * with the text field. Returns `null` when the key is not the list's.
 */
export function autocompleteKeyAction(
  key: string,
  modifiers: {
    readonly altKey?: boolean;
    readonly shiftKey?: boolean;
    readonly ctrlKey?: boolean;
    readonly metaKey?: boolean;
  } = {}
): AutocompleteKeyAction | null {
  if (modifiers.ctrlKey || modifiers.metaKey) return null;
  switch (key) {
    case 'ArrowDown':
      return modifiers.altKey ? null : 'next';
    case 'ArrowUp':
      return modifiers.altKey ? null : 'previous';
    case 'PageDown':
      return 'last';
    case 'PageUp':
      return 'first';
    case 'Enter':
      return modifiers.shiftKey ? null : 'accept';
    case 'Tab':
      return modifiers.shiftKey ? null : 'accept';
    case 'Escape':
      return 'close';
    default:
      return null;
  }
}

/** The active index after a move among `count` options (wrapping; -1 when there are none). */
export function moveAutocompleteActive(
  active: number,
  count: number,
  action: 'next' | 'previous' | 'first' | 'last'
): number {
  if (!Number.isInteger(count) || count <= 0) return -1;
  const current = Number.isInteger(active) && active >= 0 && active < count ? active : -1;
  switch (action) {
    case 'first':
      return 0;
    case 'last':
      return count - 1;
    case 'next':
      return current < 0 || current === count - 1 ? 0 : current + 1;
    case 'previous':
      return current <= 0 ? count - 1 : current - 1;
  }
}
