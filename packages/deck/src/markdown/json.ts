/**
 * The owned bounded JSON reader for `:::` fence bodies. Strict RFC 8259
 * JSON with explicit bounds (size, depth, nodes, string length), no
 * prototype keys, no duplicate keys and finite numbers only. It records the
 * source offset of every value by its path, so model issues inside a
 * component's props point at the exact line and column.
 */
import { type PathSegment, toJsonPath } from '../schema/index.ts';
import { DECK_MARKDOWN_LIMITS } from './limits.ts';

export interface JsonReadOptions {
  /** Values this read may still produce (a document-wide budget). */
  nodes: number;
  maxDepth?: number;
  maxLength?: number;
}

export type JsonReadResult =
  | {
      ok: true;
      value: unknown;
      /** `toJsonPath(path)` (relative to the body) → UTF-16 offset of the value. */
      offsets: Map<string, number>;
      nodes: number;
    }
  | { ok: false; message: string; offset: number; limit: boolean; nodes: number };

const UNSAFE = new Set(['__proto__', 'constructor', 'prototype']);

class JsonError extends Error {
  readonly offset: number;
  readonly limit: boolean;
  constructor(message: string, offset: number, limit = false) {
    super(message);
    this.offset = offset;
    this.limit = limit;
  }
}

class Reader {
  readonly text: string;
  readonly maxDepth: number;
  readonly budget: number;
  readonly offsets = new Map<string, number>();
  i = 0;
  nodes = 0;

  constructor(text: string, budget: number, maxDepth: number) {
    this.text = text;
    this.budget = budget;
    this.maxDepth = maxDepth;
  }

  fail(message: string, limit = false): never {
    throw new JsonError(message, this.i, limit);
  }

  space(): void {
    while (this.i < this.text.length) {
      const c = this.text.charCodeAt(this.i);
      if (c === 0x20 || c === 0x0a || c === 0x09 || c === 0x0d) this.i++;
      else break;
    }
  }

  value(path: PathSegment[], depth: number): unknown {
    this.space();
    this.nodes++;
    if (this.nodes > this.budget) {
      this.fail(
        `JSON bodies hold at most ${DECK_MARKDOWN_LIMITS.jsonNodes} values per document.`,
        true
      );
    }
    if (depth > this.maxDepth) this.fail(`JSON nests at most ${this.maxDepth} levels.`, true);
    this.offsets.set(toJsonPath(path), this.i);
    const c = this.text[this.i];
    if (c === '{') return this.object(path, depth);
    if (c === '[') return this.array(path, depth);
    if (c === '"') return this.string();
    if (c === 't' && this.text.startsWith('true', this.i)) {
      this.i += 4;
      return true;
    }
    if (c === 'f' && this.text.startsWith('false', this.i)) {
      this.i += 5;
      return false;
    }
    if (c === 'n' && this.text.startsWith('null', this.i)) {
      this.i += 4;
      return null;
    }
    if (c === '-' || (c !== undefined && c >= '0' && c <= '9')) return this.number();
    return this.fail(c === undefined ? 'The JSON ends early.' : `Unexpected \`${c}\` in JSON.`);
  }

  object(path: PathSegment[], depth: number): Record<string, unknown> {
    this.i++;
    const out: Record<string, unknown> = {};
    this.space();
    if (this.text[this.i] === '}') {
      this.i++;
      return out;
    }
    for (;;) {
      this.space();
      if (this.text[this.i] !== '"') this.fail('A JSON key must be a "string".');
      const keyAt = this.i;
      const key = this.string();
      if (UNSAFE.has(key)) {
        this.i = keyAt;
        this.fail(`The key "${key}" is refused.`);
      }
      if (Object.hasOwn(out, key)) {
        this.i = keyAt;
        this.fail(`The key "${key.slice(0, 64)}" appears twice.`);
      }
      this.space();
      if (this.text[this.i] !== ':') this.fail('Expected `:` after a JSON key.');
      this.i++;
      out[key] = this.value([...path, key], depth + 1);
      this.space();
      const c = this.text[this.i];
      if (c === ',') {
        this.i++;
        continue;
      }
      if (c === '}') {
        this.i++;
        return out;
      }
      this.fail('Expected `,` or `}` in a JSON object.');
    }
  }

  array(path: PathSegment[], depth: number): unknown[] {
    this.i++;
    const out: unknown[] = [];
    this.space();
    if (this.text[this.i] === ']') {
      this.i++;
      return out;
    }
    for (;;) {
      out.push(this.value([...path, out.length], depth + 1));
      this.space();
      const c = this.text[this.i];
      if (c === ',') {
        this.i++;
        continue;
      }
      if (c === ']') {
        this.i++;
        return out;
      }
      this.fail('Expected `,` or `]` in a JSON array.');
    }
  }

  string(): string {
    const start = this.i;
    this.i++;
    let out = '';
    let run = this.i;
    while (this.i < this.text.length) {
      const c = this.text.charCodeAt(this.i);
      if (c === 0x22) {
        out += this.text.slice(run, this.i);
        this.i++;
        return out;
      }
      if (c < 0x20) this.fail('Control characters must be escaped in JSON strings.');
      if (c === 0x5c) {
        out += this.text.slice(run, this.i);
        const e = this.text[this.i + 1];
        const simple: Record<string, string> = {
          '"': '"',
          '\\': '\\',
          '/': '/',
          b: '\b',
          f: '\f',
          n: '\n',
          r: '\r',
          t: '\t',
        };
        if (e !== undefined && Object.hasOwn(simple, e)) {
          out += simple[e];
          this.i += 2;
        } else if (e === 'u') {
          const hex = this.text.slice(this.i + 2, this.i + 6);
          if (!/^[0-9a-fA-F]{4}$/.test(hex)) this.fail('A \\u escape needs four hex digits.');
          out += String.fromCharCode(Number.parseInt(hex, 16));
          this.i += 6;
        } else this.fail('Invalid escape in a JSON string.');
        run = this.i;
        continue;
      }
      this.i++;
    }
    this.i = start;
    return this.fail('A JSON string never closes.');
  }

  number(): number {
    const match = /^-?(?:0|[1-9][0-9]*)(?:\.[0-9]+)?(?:[eE][+-]?[0-9]+)?/.exec(
      this.text.slice(this.i, this.i + 400)
    );
    if (!match) this.fail('Invalid JSON number.');
    const value = Number(match[0]);
    if (!Number.isFinite(value)) this.fail('JSON numbers must be finite.');
    this.i += match[0].length;
    return value;
  }
}

/** Read one JSON value from a fence body. Never throws. */
export function readJson(text: string, options: JsonReadOptions): JsonReadResult {
  const maxLength = options.maxLength ?? DECK_MARKDOWN_LIMITS.jsonBody;
  if (text.length > maxLength) {
    return {
      ok: false,
      message: `A JSON body is at most ${maxLength} characters.`,
      offset: maxLength,
      limit: true,
      nodes: 0,
    };
  }
  const reader = new Reader(
    text,
    options.nodes,
    options.maxDepth ?? DECK_MARKDOWN_LIMITS.jsonDepth
  );
  try {
    const value = reader.value([], 0);
    reader.space();
    if (reader.i < text.length) reader.fail('Unexpected text after the JSON value.');
    return { ok: true, value, offsets: reader.offsets, nodes: reader.nodes };
  } catch (error) {
    if (error instanceof JsonError) {
      return {
        ok: false,
        message: error.message,
        offset: error.offset,
        limit: error.limit,
        nodes: reader.nodes,
      };
    }
    return {
      ok: false,
      message: 'The JSON could not be read.',
      offset: 0,
      limit: false,
      nodes: reader.nodes,
    };
  }
}
