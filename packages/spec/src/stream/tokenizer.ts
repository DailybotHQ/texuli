/**
 * An incremental JSON tokenizer for untrusted streams (ADR-014). Text
 * arrives in chunks split anywhere (inside a string, an escape, a number, a
 * literal or a UTF-16 surrogate pair); the tokenizer reports each value as
 * it closes. One pass over every code unit, no backtracking and no
 * recursion, so the time is linear in the input and the memory is bounded
 * by the byte budget and the depth cap. Framework-free: no DOM, no Node.
 *
 * It refuses, at a UTF-8 byte offset: malformed JSON, input over the byte
 * budget, containers nested past the depth cap, duplicate keys and the
 * prototype keys (`__proto__`, `constructor`, `prototype`). After an error
 * it reports nothing more.
 */

/** Why a stream stopped. Tokenizer codes, plus the codes a stream reader adds. */
export type StreamErrorCode =
  | 'bad-json'
  | 'too-large'
  | 'too-deep'
  | 'duplicate-key'
  | 'prototype-key'
  | 'truncated'
  | 'aborted'
  | 'connection';

export interface StreamError {
  code: StreamErrorCode;
  /** UTF-8 byte offset of the refused input (the bytes read so far for a reader error). */
  offset: number;
  message: string;
}

export type JsonScalar = string | number | boolean | null;

/** One closed token. `offset` is the UTF-8 byte offset where it starts. */
export type JsonStreamEvent =
  | { type: 'open'; kind: 'object' | 'array'; offset: number }
  | { type: 'key'; key: string; offset: number }
  | { type: 'value'; value: JsonScalar; offset: number }
  | { type: 'close'; kind: 'object' | 'array'; offset: number };

export interface JsonTokenizerOptions {
  /** UTF-8 bytes the whole stream may take. Default {@link DEFAULT_STREAM_MAX_BYTES}. */
  maxBytes?: number;
  /** Containers that may nest. Default {@link DEFAULT_STREAM_MAX_DEPTH}. */
  maxDepth?: number;
}

export interface JsonTokenizer {
  /** Feed the next chunk; returns the tokens that closed inside it. */
  write(chunk: string): JsonStreamEvent[];
  /** No more input: closes a trailing top-level number or literal, or reports `truncated`. */
  end(): JsonStreamEvent[];
  /** UTF-8 bytes read so far. */
  readonly bytes: number;
  /** Open containers right now. */
  readonly depth: number;
  /** The first error, or `null`. */
  readonly error: StreamError | null;
  /** `true` once `end()` accepted one complete JSON value. */
  readonly done: boolean;
}

/** Default byte budget: the catalog's default tree cap (256 KiB) plus 8 KiB of whitespace. */
export const DEFAULT_STREAM_MAX_BYTES = 256 * 1024 + 8 * 1024;
/** Default depth cap: the catalog's value-depth guard. */
export const DEFAULT_STREAM_MAX_DEPTH = 128;
/** Keys refused anywhere in a stream. */
export const STREAM_PROTOTYPE_KEYS: readonly string[] = Object.freeze([
  '__proto__',
  'constructor',
  'prototype',
]);

const PROTOTYPE_KEYS = new Set(STREAM_PROTOTYPE_KEYS);
const NUMBER = /^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?$/;
const LITERALS: Readonly<Record<string, { text: string; value: JsonScalar }>> = {
  t: { text: 'true', value: true },
  f: { text: 'false', value: false },
  n: { text: 'null', value: null },
};
const ESCAPES: Readonly<Record<string, string>> = {
  '"': '"',
  '\\': '\\',
  '/': '/',
  b: '\b',
  f: '\f',
  n: '\n',
  r: '\r',
  t: '\t',
};

/** What the parser expects next. */
type Expect =
  | 'value' // a value (top level, after `:` or after `,` in an array)
  | 'value-or-close' // right after `[`
  | 'key' // after `,` in an object
  | 'key-or-close' // right after `{`
  | 'colon'
  | 'comma-or-close'
  | 'after'; // the top-level value closed: whitespace only

type Lexeme = 'none' | 'string' | 'number' | 'literal';

interface Frame {
  kind: 'object' | 'array';
  keys: Set<string> | null;
}

const isWhitespace = (code: number) =>
  code === 0x20 || code === 0x0a || code === 0x0d || code === 0x09;

export function createJsonTokenizer(options: JsonTokenizerOptions = {}): JsonTokenizer {
  const maxBytes = options.maxBytes ?? DEFAULT_STREAM_MAX_BYTES;
  const maxDepth = options.maxDepth ?? DEFAULT_STREAM_MAX_DEPTH;
  const stack: Frame[] = [];
  let expect: Expect = 'value';
  let lexeme: Lexeme = 'none';
  // The token being read, as chunks joined at its close (strings) or text.
  let parts: string[] = [];
  let tokenStart = 0;
  let stringIsKey = false;
  // Escape state inside a string: 0 none, 1 after `\`, 2–5 reading `\u` hex digits.
  let escaping = 0;
  let hex = 0;
  let literal: { text: string; value: JsonScalar } | null = null;
  let bytes = 0;
  // A high surrogate counted as 3 bytes; a low one right after it adds 1 (4 in all).
  let pendingHigh = false;
  let error: StreamError | null = null;
  let done = false;
  let ended = false;

  const fail = (code: StreamErrorCode, offset: number, message: string) => {
    error = { code, offset, message };
  };

  /** Bytes of one UTF-16 code unit, given the unit before it. */
  const unitBytes = (code: number): number => {
    if (code < 0x80) {
      pendingHigh = false;
      return 1;
    }
    if (code < 0x800) {
      pendingHigh = false;
      return 2;
    }
    if (code >= 0xd800 && code <= 0xdbff) {
      pendingHigh = true;
      return 3;
    }
    if (code >= 0xdc00 && code <= 0xdfff && pendingHigh) {
      pendingHigh = false;
      return 1;
    }
    pendingHigh = false;
    return 3;
  };

  /** A value closed: move the container state on. */
  const closedValue = () => {
    const top = stack[stack.length - 1];
    expect = top ? 'comma-or-close' : 'after';
  };

  function emitScalar(events: JsonStreamEvent[], value: JsonScalar): void {
    events.push({ type: 'value', value, offset: tokenStart });
    closedValue();
  }

  function finishNumber(events: JsonStreamEvent[]): boolean {
    const text = parts.join('');
    parts = [];
    lexeme = 'none';
    if (!NUMBER.test(text)) {
      fail('bad-json', tokenStart, `"${text.slice(0, 32)}" is not a JSON number.`);
      return false;
    }
    emitScalar(events, Number(text));
    return true;
  }

  function finishString(events: JsonStreamEvent[]): boolean {
    const text = parts.join('');
    parts = [];
    lexeme = 'none';
    if (!stringIsKey) {
      emitScalar(events, text);
      return true;
    }
    if (PROTOTYPE_KEYS.has(text)) {
      fail('prototype-key', tokenStart, `The key "${text}" is not allowed.`);
      return false;
    }
    const frame = stack[stack.length - 1] as Frame;
    const keys = frame.keys as Set<string>;
    if (keys.has(text)) {
      fail('duplicate-key', tokenStart, `The key "${text.slice(0, 64)}" appears twice.`);
      return false;
    }
    keys.add(text);
    events.push({ type: 'key', key: text, offset: tokenStart });
    expect = 'colon';
    return true;
  }

  /** Start a value at `chunk[i]`; returns `false` on error. */
  function startValue(events: JsonStreamEvent[], char: string, offset: number): boolean {
    if (char === '{' || char === '[') {
      if (stack.length >= maxDepth) {
        fail('too-deep', offset, `Values nest deeper than ${maxDepth} levels.`);
        return false;
      }
      const kind = char === '{' ? 'object' : 'array';
      stack.push({ kind, keys: kind === 'object' ? new Set() : null });
      events.push({ type: 'open', kind, offset });
      expect = kind === 'object' ? 'key-or-close' : 'value-or-close';
      return true;
    }
    tokenStart = offset;
    if (char === '"') {
      lexeme = 'string';
      stringIsKey = false;
      parts = [];
      escaping = 0;
      return true;
    }
    if (char === '-' || (char >= '0' && char <= '9')) {
      lexeme = 'number';
      parts = [char];
      return true;
    }
    const found = LITERALS[char];
    if (found) {
      lexeme = 'literal';
      literal = found;
      parts = [char];
      return true;
    }
    fail('bad-json', offset, `Unexpected "${char}" where a value should start.`);
    return false;
  }

  function closeContainer(events: JsonStreamEvent[], kind: 'object' | 'array', offset: number) {
    stack.pop();
    events.push({ type: 'close', kind, offset });
    closedValue();
  }

  function run(chunk: string, events: JsonStreamEvent[]): void {
    const length = chunk.length;
    let i = 0;
    while (i < length && error === null) {
      const code = chunk.charCodeAt(i);

      // ── Inside a string: copy runs of plain characters at once ──
      if (lexeme === 'string') {
        if (escaping === 0) {
          let j = i;
          while (j < length) {
            const c = chunk.charCodeAt(j);
            if (c === 0x22 || c === 0x5c || c < 0x20) break;
            bytes += unitBytes(c);
            j += 1;
          }
          if (bytes > maxBytes) {
            fail('too-large', maxBytes, `The stream is over its ${maxBytes}-byte budget.`);
            return;
          }
          if (j > i) parts.push(chunk.slice(i, j));
          i = j;
          if (i >= length) return;
          const c = chunk.charCodeAt(i);
          const at = bytes;
          bytes += unitBytes(c);
          i += 1;
          if (c === 0x22) finishString(events);
          else if (c === 0x5c) escaping = 1;
          else fail('bad-json', at, 'Control characters must be escaped inside strings.');
          continue;
        }
        const at = bytes;
        bytes += unitBytes(code);
        i += 1;
        const char = chunk[i - 1] as string;
        if (escaping === 1) {
          if (char === 'u') {
            escaping = 2;
            hex = 0;
          } else if (Object.hasOwn(ESCAPES, char)) {
            parts.push(ESCAPES[char] as string);
            escaping = 0;
          } else {
            fail('bad-json', at, `"\\${char}" is not a JSON escape.`);
          }
          continue;
        }
        // Reading the four hex digits of `\u`.
        if (!/^[0-9a-fA-F]$/.test(char)) {
          fail('bad-json', at, 'A "\\u" escape needs four hex digits.');
          continue;
        }
        hex = hex * 16 + Number.parseInt(char, 16);
        escaping += 1;
        if (escaping === 6) {
          // A pair of `\u` escapes forms a surrogate pair by concatenation, as JSON.parse does.
          parts.push(String.fromCharCode(hex));
          escaping = 0;
        }
        continue;
      }

      // ── Numbers and literals end at the first character that is not theirs ──
      if (lexeme === 'number') {
        const char = chunk[i] as string;
        if (
          (char >= '0' && char <= '9') ||
          char === '.' ||
          char === 'e' ||
          char === 'E' ||
          char === '+' ||
          char === '-'
        ) {
          bytes += 1;
          pendingHigh = false;
          if (bytes > maxBytes) {
            fail('too-large', maxBytes, `The stream is over its ${maxBytes}-byte budget.`);
            return;
          }
          parts.push(char);
          i += 1;
          continue;
        }
        if (!finishNumber(events)) return;
        // Fall through: this character is read as structure below.
      } else if (lexeme === 'literal') {
        const current = literal as { text: string; value: JsonScalar };
        const at = bytes;
        const length0 = parts.length;
        const char = chunk[i] as string;
        if (current.text[length0] !== char) {
          fail('bad-json', at, `Unexpected "${char}" in "${current.text}".`);
          return;
        }
        bytes += unitBytes(code);
        parts.push(char);
        i += 1;
        if (parts.length === current.text.length) {
          parts = [];
          lexeme = 'none';
          literal = null;
          emitScalar(events, current.value);
        }
        continue;
      }

      // ── Structure ──
      const at = bytes;
      bytes += unitBytes(chunk.charCodeAt(i));
      if (bytes > maxBytes) {
        fail('too-large', maxBytes, `The stream is over its ${maxBytes}-byte budget.`);
        return;
      }
      const char = chunk[i] as string;
      i += 1;
      if (isWhitespace(chunk.charCodeAt(i - 1))) continue;
      switch (expect) {
        case 'after':
          fail('bad-json', at, `Unexpected "${char}" after the end of the value.`);
          return;
        case 'value':
          if (!startValue(events, char, at)) return;
          break;
        case 'value-or-close':
          if (char === ']') closeContainer(events, 'array', at);
          else if (!startValue(events, char, at)) return;
          break;
        case 'key':
        case 'key-or-close':
          if (char === '}' && expect === 'key-or-close') {
            closeContainer(events, 'object', at);
          } else if (char === '"') {
            tokenStart = at;
            lexeme = 'string';
            stringIsKey = true;
            parts = [];
            escaping = 0;
          } else {
            fail('bad-json', at, `Expected a key in double quotes, got "${char}".`);
            return;
          }
          break;
        case 'colon':
          if (char !== ':') {
            fail('bad-json', at, `Expected ":" after a key, got "${char}".`);
            return;
          }
          expect = 'value';
          break;
        case 'comma-or-close': {
          const top = stack[stack.length - 1] as Frame;
          if (char === ',') expect = top.kind === 'object' ? 'key' : 'value';
          else if (char === (top.kind === 'object' ? '}' : ']'))
            closeContainer(events, top.kind, at);
          else {
            fail(
              'bad-json',
              at,
              `Expected "," or "${top.kind === 'object' ? '}' : ']'}", got "${char}".`
            );
            return;
          }
          break;
        }
      }
    }
  }

  return {
    write(chunk) {
      const events: JsonStreamEvent[] = [];
      if (error !== null || ended || typeof chunk !== 'string' || chunk.length === 0) return events;
      run(chunk, events);
      return events;
    },
    end() {
      const events: JsonStreamEvent[] = [];
      if (error !== null || ended) return events;
      ended = true;
      if (lexeme === 'number') finishNumber(events);
      if (error !== null) return events;
      if (lexeme !== 'none' || stack.length > 0 || expect !== 'after') {
        fail('truncated', bytes, 'The stream ended before the value was complete.');
        return events;
      }
      done = true;
      return events;
    },
    get bytes() {
      return bytes;
    },
    get depth() {
      return stack.length;
    },
    get error() {
      return error;
    },
    get done() {
      return done;
    },
  };
}
