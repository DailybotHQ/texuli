/**
 * `loadUntrustedDeck`: load a deck from somewhere it could have been
 * tampered with (a share link, a pasted file, an embed message, agent
 * output). Ported from Protoyard's `untrusted.ts`; cheap checks run before
 * any deep work, so hostile input costs bounded time:
 *
 * 1. JSON text: UTF-8 size and nesting depth scanned on the text, then
 *    `JSON.parse`; a syntax error reports its line and column.
 * 2. A plain-data copy: no accessors, cycles, class instances, functions or
 *    prototype keys; hidden characters (controls, zero-width, bidi) are
 *    stripped with a `hidden-characters` warning.
 * 3. Counts: slides and nodes under the slides.
 * 4. `migrateDeck` when the input is an earlier shape, then `parseDeck`.
 *
 * Nothing here runs code, fetches or renders. Never throws.
 */
import {
  createDiagnostic,
  type DeckDiagnostic,
  MAX_DIAGNOSTICS,
  type PathSegment,
} from '../schema/index.ts';
import { DECK_MODEL_LIMITS } from './deck.ts';
import { type DeckSource, detectDeckShape, migrateDeck } from './migrate.ts';
import { type DeckParseResult, type ParseDeckOptions, parseDeck } from './parse.ts';
import { copyPlainData, utf8Length } from './plain.ts';

export interface UntrustedDeckLimits {
  /** UTF-8 bytes of the JSON (text, or the copy of parsed data). Default 1 MiB. */
  maxBytes: number;
  /** Object and array nesting. Default 32. */
  maxDepth: number;
  /** Objects and arrays under the slides, all slides together. Default 20,000. */
  maxNodes: number;
  /** Default 200. */
  maxSlides: number;
}

export const DEFAULT_UNTRUSTED_DECK_LIMITS: Readonly<UntrustedDeckLimits> = Object.freeze({
  maxBytes: 1024 * 1024,
  maxDepth: 32,
  maxNodes: 20_000,
  maxSlides: DECK_MODEL_LIMITS.slides,
});

export interface UntrustedDeckOptions extends Partial<UntrustedDeckLimits>, ParseDeckOptions {}

export interface UntrustedDeckResult extends DeckParseResult {
  /** The detected input shape; absent when the input never got that far. */
  from?: DeckSource;
}

function fail(issues: DeckDiagnostic[], truncated = false): UntrustedDeckResult {
  return { ok: false, issues, steps: [], truncated };
}

function single(code: string, message: string, fix: string, path: PathSegment[] = []) {
  return fail([createDiagnostic(code, message, path, { fix })]);
}

/** Nesting depth of JSON text, without parsing it; stops early past `limit`. */
export function jsonTextDepth(text: string, limit: number): number {
  let depth = 0;
  let max = 0;
  let inString = false;
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i);
    if (inString) {
      if (c === 0x5c) i++;
      else if (c === 0x22) inString = false;
    } else if (c === 0x22) inString = true;
    else if (c === 0x7b || c === 0x5b) {
      depth++;
      if (depth > max) {
        max = depth;
        if (max > limit) return max;
      }
    } else if (c === 0x7d || c === 0x5d) depth--;
  }
  return max;
}

/**
 * The offset of the first JSON syntax error in `text` (engines word their
 * `JSON.parse` errors differently, so the position comes from this scanner).
 * Call it only on text with bounded depth.
 */
export function jsonErrorOffset(text: string): number {
  let i = 0;
  const n = text.length;
  const space = () => {
    while (i < n) {
      const c = text[i];
      if (c === ' ' || c === '\t' || c === '\n' || c === '\r') i++;
      else break;
    }
  };
  const fail = (at: number): never => {
    throw at;
  };
  const string = () => {
    i++;
    while (i < n) {
      const c = text.charCodeAt(i);
      if (c === 0x22) {
        i++;
        return;
      }
      if (c < 0x20) fail(i);
      if (c === 0x5c) {
        const next = text[i + 1];
        if (next === 'u') {
          if (!/^[0-9a-fA-F]{4}$/.test(text.slice(i + 2, i + 6))) fail(i);
          i += 6;
        } else if (next !== undefined && '"\\/bfnrt'.includes(next)) i += 2;
        else fail(i);
      } else i++;
    }
    fail(n);
  };
  const number = () => {
    const match = /^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/.exec(text.slice(i, i + 400));
    if (!match || match[0].length === 0) fail(i);
    i += (match as RegExpExecArray)[0].length;
  };
  const value = (): void => {
    space();
    const c = text[i];
    if (c === '{') {
      i++;
      space();
      if (text[i] === '}') {
        i++;
        return;
      }
      for (;;) {
        space();
        if (text[i] !== '"') fail(i);
        string();
        space();
        if (text[i] !== ':') fail(i);
        i++;
        value();
        space();
        if (text[i] === ',') i++;
        else if (text[i] === '}') {
          i++;
          return;
        } else fail(i);
      }
    }
    if (c === '[') {
      i++;
      space();
      if (text[i] === ']') {
        i++;
        return;
      }
      for (;;) {
        value();
        space();
        if (text[i] === ',') i++;
        else if (text[i] === ']') {
          i++;
          return;
        } else fail(i);
      }
    }
    if (c === '"') {
      string();
      return;
    }
    if (c === '-' || (c !== undefined && c >= '0' && c <= '9')) {
      number();
      return;
    }
    for (const word of ['true', 'false', 'null']) {
      if (text.startsWith(word, i)) {
        i += word.length;
        return;
      }
    }
    fail(i);
  };
  try {
    value();
    space();
    return i < n ? i : -1;
  } catch (at) {
    return typeof at === 'number' ? at : 0;
  }
}

/** 1-based line and column (UTF-16 units) of `offset` in `text`. */
export function lineColumn(text: string, offset: number): { line: number; column: number } {
  let line = 1;
  let start = 0;
  const end = Math.min(Math.max(0, offset), text.length);
  for (let i = 0; i < end; i++) {
    if (text.charCodeAt(i) === 0x0a) {
      line++;
      start = i + 1;
    }
  }
  return { line, column: end - start + 1 };
}

/** Objects and arrays under the slides (or a tree's children), counted iteratively. */
function countNodes(root: Record<string, unknown>, stopAt: number): number {
  const stack: unknown[] = [root.slides, root.children];
  if (root.props !== null && typeof root.props === 'object') {
    stack.push((root.props as Record<string, unknown>).slides);
  }
  let count = 0;
  while (stack.length > 0 && count <= stopAt) {
    const node = stack.pop();
    if (node === null || typeof node !== 'object') continue;
    count++;
    if (Array.isArray(node)) for (const child of node) stack.push(child);
    else for (const key of Object.keys(node)) stack.push((node as Record<string, unknown>)[key]);
  }
  return count;
}

function slideCount(root: Record<string, unknown>): number {
  const props = root.props;
  const lists = [
    root.slides,
    root.children,
    props !== null && typeof props === 'object'
      ? (props as Record<string, unknown>).slides
      : undefined,
  ];
  return Math.max(0, ...lists.map((list) => (Array.isArray(list) ? list.length : 0)));
}

/**
 * Load a deck from JSON text or parsed data that may be hostile. On success
 * `deck` is a fresh validated v2 copy; earlier shapes are migrated first.
 */
export function loadUntrustedDeck(
  input: unknown,
  options: UntrustedDeckOptions = {}
): UntrustedDeckResult {
  try {
    return load(input, options);
  } catch {
    return single(
      'invalid-input',
      'The deck could not be read.',
      'Pass JSON text or plain JSON data.'
    );
  }
}

function load(input: unknown, options: UntrustedDeckOptions): UntrustedDeckResult {
  const limits = { ...DEFAULT_UNTRUSTED_DECK_LIMITS };
  for (const key of ['maxBytes', 'maxDepth', 'maxNodes', 'maxSlides'] as const) {
    const value = options[key];
    if (typeof value === 'number' && Number.isFinite(value) && value > 0) limits[key] = value;
  }
  const maxIssues =
    options.maxIssues !== undefined && options.maxIssues > 0 ? options.maxIssues : MAX_DIAGNOSTICS;
  let data: unknown = input;

  if (typeof input === 'string') {
    const bytes = utf8Length(input);
    if (bytes > limits.maxBytes) {
      return single(
        'too-large',
        `The deck is ${bytes} bytes; the limit is ${limits.maxBytes}.`,
        'Shorten notes or media, or split the deck.'
      );
    }
    if (jsonTextDepth(input, limits.maxDepth) > limits.maxDepth) {
      return single(
        'too-deep',
        `The deck nests deeper than ${limits.maxDepth} levels.`,
        'Flatten nested blocks or props.'
      );
    }
    try {
      data = JSON.parse(input);
    } catch {
      const offset = jsonErrorOffset(input);
      const at = lineColumn(input, offset < 0 ? input.length : offset);
      return fail([
        createDiagnostic(
          'invalid-json',
          `The deck is not valid JSON (line ${at.line}, column ${at.column}).`,
          [],
          { fix: 'Fix the JSON syntax at that position.', source: at }
        ),
      ]);
    }
  }

  const copy = copyPlainData(data, {
    maxDepth: limits.maxDepth,
    maxBytes: limits.maxBytes,
    strip: true,
    maxIssues,
  });
  if (copy.failed) return fail(copy.issues, copy.truncated);
  const root = copy.value;
  if (root === null || typeof root !== 'object' || Array.isArray(root)) {
    return single(
      'invalid-input',
      'A deck is a JSON object.',
      'Pass {"formatVersion": 2, "meta": {"title": "…"}, "slides": […]}.'
    );
  }
  const record = root as Record<string, unknown>;
  const slides = slideCount(record);
  if (slides > limits.maxSlides) {
    return single(
      'too-many',
      `The deck has ${slides} slides; the limit is ${limits.maxSlides}.`,
      'Split it into several decks.',
      ['slides']
    );
  }
  if (countNodes(record, limits.maxNodes) > limits.maxNodes) {
    return single(
      'too-many',
      `The slides hold more than ${limits.maxNodes} objects and arrays.`,
      'Use fewer or simpler blocks.',
      ['slides']
    );
  }

  const issues: DeckDiagnostic[] = [...copy.issues];
  const from = detectDeckShape(record);
  let deck: unknown = record;
  if (from !== 'v2') {
    const migration = migrateDeck(record);
    deck = migration.deck;
    issues.push(...migration.issues.slice(0, Math.max(0, maxIssues - issues.length)));
  }
  const parsed = parseDeck(deck, { ...options, maxIssues: Math.max(1, maxIssues - issues.length) });
  const all = [...issues, ...parsed.issues].slice(0, maxIssues);
  const errors = all.some((issue) => issue.severity === 'error');
  const result: UntrustedDeckResult = {
    ok: parsed.ok && !errors,
    issues: all,
    steps: parsed.steps,
    truncated:
      parsed.truncated || copy.truncated || issues.length + parsed.issues.length > maxIssues,
    from,
  };
  if (result.ok && parsed.deck !== undefined) result.deck = parsed.deck;
  return result;
}
