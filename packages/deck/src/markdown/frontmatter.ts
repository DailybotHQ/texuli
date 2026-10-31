/**
 * The frontmatter: a closed key set with scalar values only (no YAML parser,
 * no lists, maps, anchors, tags or multi-line values). Values are typed by
 * key; the deck model validates them afterwards, and its issues map back to
 * the key's line.
 */
import { type PathSegment, toJsonPath } from '../schema/index.ts';
import type { IssueSink } from './issues.ts';
import type { Line } from './scan.ts';
import { trimBlankEnd } from './text.ts';

type Kind = 'string' | 'boolean' | 'int';

interface KeySpec {
  kind: Kind;
  /** Where the value goes in the deck. */
  path: readonly PathSegment[];
}

/** The closed frontmatter keys, in canonical (written) order. */
export const FRONTMATTER_KEYS: Readonly<Record<string, KeySpec>> = Object.freeze({
  title: { kind: 'string', path: ['meta', 'title'] },
  description: { kind: 'string', path: ['meta', 'description'] },
  author: { kind: 'string', path: ['meta', 'author'] },
  date: { kind: 'string', path: ['meta', 'date'] },
  locale: { kind: 'string', path: ['meta', 'locale'] },
  dir: { kind: 'string', path: ['meta', 'dir'] },
  theme: { kind: 'string', path: ['style', 'theme'] },
  themeMode: { kind: 'string', path: ['style', 'theme', 'mode'] },
  themeSeed: { kind: 'int', path: ['style', 'theme', 'seed'] },
  fontPair: { kind: 'string', path: ['style', 'fontPair'] },
  aspect: { kind: 'string', path: ['style', 'aspect'] },
  density: { kind: 'string', path: ['style', 'density'] },
  radius: { kind: 'string', path: ['style', 'radius'] },
  motion: { kind: 'string', path: ['style', 'motion'] },
  transition: { kind: 'string', path: ['style', 'transition'] },
  background: { kind: 'string', path: ['style', 'background'] },
  logo: { kind: 'string', path: ['style', 'logo'] },
  footer: { kind: 'string', path: ['style', 'footer'] },
  slideNumbers: { kind: 'boolean', path: ['style', 'slideNumbers'] },
  progress: { kind: 'string', path: ['style', 'progress'] },
  codeTheme: { kind: 'string', path: ['style', 'codeTheme'] },
  math: { kind: 'boolean', path: ['style', 'math'] },
  start: { kind: 'string', path: ['navigation', 'start'] },
  loop: { kind: 'boolean', path: ['navigation', 'loop'] },
  autoSlide: { kind: 'int', path: ['navigation', 'autoSlideMs'] },
  outlineTitle: { kind: 'string', path: ['outline', 'title'] },
  designSystem: { kind: 'string', path: ['designSystem', 'ref'] },
});

/** Kebab-case spellings accepted on input (the writer uses camelCase). */
const ALIASES: Readonly<Record<string, string>> = Object.freeze({
  'font-pair': 'fontPair',
  'slide-numbers': 'slideNumbers',
  'code-theme': 'codeTheme',
  'auto-slide': 'autoSlide',
  'theme-mode': 'themeMode',
  'theme-seed': 'themeSeed',
  'outline-title': 'outlineTitle',
  'design-system': 'designSystem',
});

export interface Frontmatter {
  /** Key → typed value, in the order read. */
  values: Map<string, string | number | boolean>;
  /** Key → line. */
  lines: Map<string, number>;
}

/** Runs on `trimBlankEnd(text)`: no trailing `[ \t]*` competes with the value. */
const KEY = /^([A-Za-z][A-Za-z0-9-]*)[ \t]*:(?:[ \t]+(.*))?$/;

function scalar(raw: string): { value: string } | { error: string } {
  if (raw.startsWith('"')) {
    if (!raw.endsWith('"') || raw.length < 2) return { error: 'The quoted value never closes.' };
    const inner = raw.slice(1, -1);
    let out = '';
    for (let i = 0; i < inner.length; i++) {
      const c = inner[i];
      if (c === '\\') {
        const next = inner[i + 1];
        if (next === '"' || next === '\\') {
          out += next;
          i++;
          continue;
        }
        return { error: 'Only \\" and \\\\ escapes are read in a quoted value.' };
      }
      if (c === '"') return { error: 'Escape a " inside a quoted value as \\".' };
      out += c;
    }
    return { value: out };
  }
  if (raw.startsWith("'")) {
    if (!raw.endsWith("'") || raw.length < 2) return { error: 'The quoted value never closes.' };
    const inner = raw.slice(1, -1);
    if (/(?<!')'(?!')/.test(inner.replaceAll("''", ''))) {
      return { error: "Escape a ' inside a single-quoted value as ''." };
    }
    return { value: inner.replaceAll("''", "'") };
  }
  if (/^[[{|>&*!%@`]/.test(raw)) {
    return { error: 'Only scalar values: no lists, maps, blocks, anchors or tags.' };
  }
  return { value: raw };
}

/** Read the frontmatter lines. Unknown keys and non-scalar values are errors. */
export function readFrontmatter(lines: readonly Line[], sink: IssueSink): Frontmatter {
  const values = new Map<string, string | number | boolean>();
  const lineOf = new Map<string, number>();
  for (const line of lines) {
    const text = line.text;
    if (text.trim() === '' || text.trimStart().startsWith('#')) continue;
    const match = KEY.exec(trimBlankEnd(text));
    if (!match) {
      sink.report(
        'md-frontmatter-value',
        'A frontmatter line is `key: value`.',
        { line: line.n, column: 1 },
        [],
        'Write one scalar per line, e.g. `title: Quarterly review`.'
      );
      continue;
    }
    const written = match[1] ?? '';
    const key = Object.hasOwn(ALIASES, written) ? (ALIASES[written] ?? written) : written;
    const spec = Object.hasOwn(FRONTMATTER_KEYS, key) ? FRONTMATTER_KEYS[key] : undefined;
    const column = text.indexOf(':') + 2;
    if (!spec) {
      sink.report(
        'md-frontmatter-key',
        `Unknown frontmatter key "${written.slice(0, 40)}".`,
        { line: line.n, column: 1 },
        [],
        `Use one of: ${Object.keys(FRONTMATTER_KEYS).join(', ')}.`
      );
      continue;
    }
    if (values.has(key)) {
      sink.report('md-frontmatter-key', `"${key}" is set twice.`, { line: line.n, column: 1 });
      continue;
    }
    const raw = match[2] ?? '';
    if (raw === '') {
      sink.report('md-frontmatter-value', `"${key}" needs a value.`, { line: line.n, column });
      continue;
    }
    const read = scalar(raw);
    if ('error' in read) {
      sink.report('md-frontmatter-value', read.error, { line: line.n, column });
      continue;
    }
    let value: string | number | boolean = read.value;
    if (spec.kind === 'boolean') {
      if (read.value !== 'true' && read.value !== 'false') {
        sink.report('md-frontmatter-value', `"${key}" is true or false.`, { line: line.n, column });
        continue;
      }
      value = read.value === 'true';
    } else if (spec.kind === 'int') {
      if (!/^-?\d{1,10}$/.test(read.value)) {
        sink.report('md-frontmatter-value', `"${key}" is a whole number.`, {
          line: line.n,
          column,
        });
        continue;
      }
      value = Number(read.value);
    }
    values.set(key, value);
    lineOf.set(key, line.n);
  }
  return { values, lines: lineOf };
}

/** The JSON paths a frontmatter key's value lands on (for the source map). */
export function frontmatterPath(key: string): string {
  const spec = FRONTMATTER_KEYS[key];
  return spec ? toJsonPath(spec.path) : '$';
}

/** A frontmatter scalar written canonically: bare when unambiguous, else double-quoted. */
export function writeScalar(value: string | number | boolean): string {
  if (typeof value !== 'string') return String(value);
  if (
    value === '' ||
    value !== value.trim() ||
    /^[[{|>&*!%@`"'#]/.test(value) ||
    value === 'true' ||
    value === 'false' ||
    /^-?\d+$/.test(value) ||
    value.includes(': ') ||
    value.includes(' #')
  ) {
    return `"${value.replaceAll('\\', '\\\\').replaceAll('"', '\\"')}"`;
  }
  return value;
}
