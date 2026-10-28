/**
 * A bounded plain-data copy of untrusted input (ported from Protoyard's
 * `untrusted.ts` sanitizer). Only JSON data survives: own enumerable data
 * properties of plain objects and dense arrays, strings, finite numbers,
 * booleans and `null`. Accessors, class instances, functions, symbols,
 * cycles, prototype keys and anything past the depth or byte budget are
 * dropped and reported, never followed. Optionally strips characters that
 * hide or reorder text. Walked with an explicit stack, so hostile nesting
 * never costs native recursion. Never throws.
 */
import {
  createDiagnostic,
  type DeckDiagnostic,
  type PathSegment,
  UNSAFE_KEYS,
} from '../schema/index.ts';

export interface PlainCopyOptions {
  /** Containers along one path (the root object is depth 1). Default 64. */
  maxDepth?: number;
  /** An estimate of the JSON size in UTF-8 bytes; the copy stops past it. Default unbounded. */
  maxBytes?: number;
  /** Strip hidden characters from strings and keys (and report them). Default false. */
  strip?: boolean;
  /** Issues kept (default 200); later ones only set `truncated`. */
  maxIssues?: number;
}

export interface PlainCopyResult {
  /** The copy; `undefined` when the root itself was refused. */
  value: unknown;
  issues: DeckDiagnostic[];
  /** True when an error was reported (the copy is partial). */
  failed: boolean;
  truncated: boolean;
  /** Estimated UTF-8 JSON size of the copy. */
  bytes: number;
}

const UNSAFE = new Set(UNSAFE_KEYS);
/** How many strings get their own `hidden-characters` warning before one summary. */
const HIDDEN_REPORTS = 20;

/**
 * True for a character that can hide or reorder text: C0 and C1 controls
 * (except tab, LF and CR), U+061C, U+200B, U+200E, U+200F, the bidi
 * embeddings, overrides and isolates, U+2060 and the byte-order mark. ZWJ
 * and ZWNJ (U+200C, U+200D) stay: emoji sequences and several scripts need them.
 */
function isHidden(code: number): boolean {
  return (
    (code <= 0x1f && code !== 0x09 && code !== 0x0a && code !== 0x0d) ||
    (code >= 0x7f && code <= 0x9f) ||
    code === 0x061c ||
    code === 0x200b ||
    code === 0x200e ||
    code === 0x200f ||
    (code >= 0x202a && code <= 0x202e) ||
    code === 0x2060 ||
    (code >= 0x2066 && code <= 0x2069) ||
    code === 0xfeff
  );
}

/**
 * Remove hidden characters (see `isHidden`); U+2028 and U+2029 become a
 * space. Returns the string unchanged (same reference) when nothing is hidden.
 */
export function stripHiddenCharacters(value: string): string {
  let clean = true;
  for (let i = 0; i < value.length; i++) {
    const c = value.charCodeAt(i);
    if (isHidden(c) || c === 0x2028 || c === 0x2029) {
      clean = false;
      break;
    }
  }
  if (clean) return value;
  let out = '';
  for (let i = 0; i < value.length; i++) {
    const c = value.charCodeAt(i);
    if (c === 0x2028 || c === 0x2029) out += ' ';
    else if (!isHidden(c)) out += value[i];
  }
  return out;
}

/** UTF-8 byte length without allocating. */
export function utf8Length(value: string): number {
  let bytes = 0;
  for (let i = 0; i < value.length; i++) {
    const c = value.charCodeAt(i);
    if (c < 0x80) bytes += 1;
    else if (c < 0x800) bytes += 2;
    else if (c >= 0xd800 && c <= 0xdbff && i + 1 < value.length) {
      const next = value.charCodeAt(i + 1);
      if (next >= 0xdc00 && next <= 0xdfff) {
        bytes += 4;
        i++;
      } else bytes += 3;
    } else bytes += 3;
  }
  return bytes;
}

interface Frame {
  value: unknown;
  path: PathSegment[];
  depth: number;
  target: Record<PathSegment, unknown>;
  slot: PathSegment;
  ancestors: readonly object[];
}

function describe(value: unknown): string {
  if (typeof value === 'function') return 'a function';
  if (typeof value === 'symbol') return 'a symbol';
  if (typeof value === 'bigint') return 'a bigint';
  if (value === undefined) return 'undefined';
  return 'a non-plain object';
}

/** Copy `input` as plain JSON data; see the module comment for what is dropped. */
export function copyPlainData(input: unknown, options: PlainCopyOptions = {}): PlainCopyResult {
  const maxDepth = options.maxDepth ?? 64;
  const maxBytes = options.maxBytes ?? Number.POSITIVE_INFINITY;
  const maxIssues = options.maxIssues ?? 200;
  const strip = options.strip === true;
  const issues: DeckDiagnostic[] = [];
  let failed = false;
  let truncated = false;
  let stopped = false;
  let bytes = 0;
  let hiddenReports = 0;
  let hiddenStrings = 0;

  const report = (
    code: string,
    message: string,
    path: readonly PathSegment[],
    fix: string,
    severity: 'error' | 'warning' = 'error'
  ): void => {
    if (severity === 'error') failed = true;
    if (issues.length >= maxIssues) {
      truncated = true;
      return;
    }
    issues.push(createDiagnostic(code, message, path, { severity, fix }));
  };

  const text = (value: string, path: PathSegment[]): string => {
    if (!strip) return value;
    const clean = stripHiddenCharacters(value);
    if (clean !== value) {
      hiddenStrings++;
      if (hiddenReports < HIDDEN_REPORTS) {
        hiddenReports++;
        report(
          'hidden-characters',
          `Removed ${value.length - clean.length} hidden or reordering character(s).`,
          path,
          'Remove control, zero-width and bidi characters from the source.',
          'warning'
        );
      }
    }
    return clean;
  };

  const holder: Record<PathSegment, unknown> = {};
  const stack: Frame[] = [
    { value: input, path: [], depth: 0, target: holder, slot: 'root', ancestors: [] },
  ];
  while (stack.length > 0) {
    const frame = stack.pop() as Frame;
    if (bytes > maxBytes) {
      if (!stopped) {
        stopped = true;
        report(
          'too-large',
          `The deck is larger than ${maxBytes} bytes of JSON.`,
          [],
          'Shorten notes, media or blocks, or split the deck.'
        );
      }
      break;
    }
    const value = frame.value;
    switch (typeof value) {
      case 'string': {
        const clean = text(value, frame.path);
        bytes += utf8Length(clean) + 2;
        frame.target[frame.slot] = clean;
        continue;
      }
      case 'number':
        if (!Number.isFinite(value)) {
          report(
            'not-finite',
            'NaN and Infinity are not JSON data.',
            frame.path,
            'Use a finite number.'
          );
          continue;
        }
        bytes += String(value).length;
        frame.target[frame.slot] = value;
        continue;
      case 'boolean':
        bytes += value ? 4 : 5;
        frame.target[frame.slot] = value;
        continue;
      case 'object':
        break;
      default:
        report(
          'invalid-input',
          `Received ${describe(value)}, which is not JSON data.`,
          frame.path,
          'Pass JSON text or plain JSON data.'
        );
        continue;
    }
    if (value === null) {
      bytes += 4;
      frame.target[frame.slot] = null;
      continue;
    }
    if (frame.ancestors.includes(value)) {
      report(
        'cycle',
        'The value contains itself (a cyclic reference).',
        frame.path,
        'Pass acyclic data.'
      );
      continue;
    }
    if (frame.depth >= maxDepth) {
      report(
        'too-deep',
        `The deck nests deeper than ${maxDepth} levels.`,
        frame.path,
        'Flatten nested blocks or props.'
      );
      continue;
    }
    let isArray: boolean;
    let keys: string[];
    try {
      isArray = Array.isArray(value);
      if (!isArray) {
        const proto = Object.getPrototypeOf(value);
        if (proto !== null && Object.getPrototypeOf(proto) !== null) {
          report(
            'invalid-input',
            'Objects must be plain JSON objects (no class instances).',
            frame.path,
            'Pass JSON text or plain objects.'
          );
          continue;
        }
        if (Object.getOwnPropertySymbols(value).length > 0) {
          report('invalid-input', 'Symbol keys are not JSON data.', frame.path, 'Pass JSON data.');
        }
      }
      keys = isArray ? [] : Object.keys(value);
    } catch {
      report('invalid-input', 'The value could not be read.', frame.path, 'Pass JSON data.');
      continue;
    }
    const ancestors = [...frame.ancestors, value];
    const depth = frame.depth + 1;
    const children: Frame[] = [];
    const read = (key: PathSegment, path: PathSegment[]): { ok: boolean; value?: unknown } => {
      try {
        const descriptor = Object.getOwnPropertyDescriptor(value, key);
        if (descriptor && 'value' in descriptor) return { ok: true, value: descriptor.value };
        report(
          'invalid-input',
          descriptor
            ? 'Accessor properties are not data; use a plain value.'
            : 'Arrays must be dense (no holes).',
          path,
          'Pass JSON data.'
        );
      } catch {
        report('invalid-input', 'The property could not be read.', path, 'Pass JSON data.');
      }
      return { ok: false };
    };
    if (isArray) {
      let length = 0;
      try {
        length = (value as unknown[]).length;
      } catch {
        report('invalid-input', 'The array could not be read.', frame.path, 'Pass JSON data.');
        continue;
      }
      const out: unknown[] = [];
      frame.target[frame.slot] = out;
      bytes += 2 + Math.max(0, length - 1);
      for (let i = 0; i < length && bytes <= maxBytes; i++) {
        const path = [...frame.path, i];
        const child = read(i, path);
        if (!child.ok) continue;
        children.push({
          value: child.value,
          path,
          depth,
          target: out as unknown as Record<PathSegment, unknown>,
          slot: children.length,
          ancestors,
        });
      }
    } else {
      const out: Record<string, unknown> = {};
      frame.target[frame.slot] = out;
      bytes += 2;
      for (const rawKey of keys) {
        const path = [...frame.path, rawKey];
        if (UNSAFE.has(rawKey)) {
          report(
            'unsafe-key',
            `The key ${JSON.stringify(rawKey)} is not allowed.`,
            path,
            'Remove the key.'
          );
          continue;
        }
        const child = read(rawKey, path);
        if (!child.ok) continue;
        if (child.value === undefined) continue; // JSON drops undefined values
        const key = text(rawKey, path);
        if (UNSAFE.has(key)) {
          report(
            'unsafe-key',
            `The key ${JSON.stringify(key)} is not allowed.`,
            path,
            'Remove the key.'
          );
          continue;
        }
        bytes += utf8Length(key) + 4;
        children.push({ value: child.value, path, depth, target: out, slot: key, ancestors });
      }
    }
    // Reverse, so children are visited (and reported) in document order.
    for (let i = children.length - 1; i >= 0; i--) stack.push(children[i] as Frame);
  }
  if (hiddenStrings > hiddenReports) {
    report(
      'hidden-characters',
      `Hidden characters were removed from ${hiddenStrings - hiddenReports} more string(s).`,
      [],
      'Remove control, zero-width and bidi characters from the source.',
      'warning'
    );
  }
  return { value: holder.root, issues, failed, truncated, bytes };
}
