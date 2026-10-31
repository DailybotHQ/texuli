/**
 * Lost spaces in `.astro` templates (PLAN_011 Final Review). Astro's HTML
 * compression drops whitespace that holds a line break where a text run meets
 * an inline element or an `{expression}`, instead of collapsing it to one
 * space as a browser would. So
 *
 *   Every one of the
 *   <strong>{themeCount}</strong> library themes
 *
 * ships as `the<strong>210</strong>` and reads "the210 library themes". The
 * same happens after an inline closing tag (`</code>` then a line starting
 * with a word) and on either side of an expression (`families:` then a line
 * starting with `{list}`). Svelte templates keep the space, so only `.astro`
 * files are scanned.
 *
 * {@link findLostSpaces} tokenizes the template (frontmatter, `<script>`,
 * `<style>` and comments skipped; tags read with their quotes and braces;
 * an expression read as one balanced `{...}`), then reports each such line
 * break between real text and an inline element or expression. Markup
 * inside an expression (`{items.map(...)}`) is not scanned.
 */

/** Phrasing elements whose edges join the text around them. */
export const INLINE_ELEMENTS: ReadonlySet<string> = new Set([
  'a',
  'abbr',
  'b',
  'cite',
  'code',
  'dfn',
  'em',
  'i',
  'kbd',
  'mark',
  'q',
  's',
  'samp',
  'small',
  'span',
  'strong',
  'sub',
  'sup',
  'time',
  'u',
  'var',
]);

export interface LostSpace {
  /** 1-based line where the line break that loses its space begins. */
  line: number;
  /** `before`: text, a line break, then an inline element or expression; `after`: the reverse. */
  side: 'before' | 'after';
  /** Offset range of the text run (in the whole source) that holds the line break. */
  start: number;
  end: number;
}

type Token =
  | { type: 'text'; start: number; end: number }
  | { type: 'open'; name: string; start: number; end: number; selfClosing: boolean }
  | { type: 'close'; name: string; start: number; end: number }
  | { type: 'expr'; start: number; end: number; inert: boolean }
  | { type: 'other'; start: number; end: number };

/** The template's start offset: after the `---` frontmatter fence, when there is one. */
function templateStart(source: string): number {
  const fence = /^---[ \t]*\r?\n/.exec(source);
  if (!fence) return 0;
  const close = /\r?\n---[ \t]*(?:\r?\n|$)/.exec(source.slice(fence[0].length));
  return close ? fence[0].length + close.index + close[0].length : 0;
}

/** The offset just past the `}` that balances the `{` at `open` (strings are not parsed). */
function braceEnd(source: string, open: number): number {
  let depth = 0;
  for (let i = open; i < source.length; i += 1) {
    const ch = source[i];
    if (ch === '{') depth += 1;
    else if (ch === '}') {
      depth -= 1;
      if (depth === 0) return i + 1;
    }
  }
  return source.length;
}

/** The offset just past the `>` that ends the tag at `open` (quotes and braces respected). */
function tagEnd(source: string, open: number): number {
  let i = open + 1;
  while (i < source.length) {
    const ch = source[i];
    if (ch === '"' || ch === "'") {
      const close = source.indexOf(ch, i + 1);
      i = close === -1 ? source.length : close + 1;
    } else if (ch === '{') i = braceEnd(source, i);
    else if (ch === '>') return i + 1;
    else i += 1;
  }
  return source.length;
}

/** An expression that renders nothing visible on its own: `{' '}` or a comment. */
function inertExpression(body: string): boolean {
  const inner = body.slice(1, -1).trim();
  return /^(['"`])\s*\1$/.test(inner) || /^\/\*[\s\S]*\*\/$/.test(inner);
}

function tokenize(source: string): Token[] {
  const tokens: Token[] = [];
  let i = templateStart(source);
  let text = i;
  const flushText = (end: number) => {
    if (end > text) tokens.push({ type: 'text', start: text, end });
  };
  while (i < source.length) {
    if (source.startsWith('<!--', i)) {
      flushText(i);
      const close = source.indexOf('-->', i + 4);
      const end = close === -1 ? source.length : close + 3;
      tokens.push({ type: 'other', start: i, end });
      i = text = end;
      continue;
    }
    if (source[i] === '<' && /[A-Za-z/]/.test(source[i + 1] ?? '')) {
      const closing = source[i + 1] === '/';
      const name = /^[A-Za-z][\w.:-]*/.exec(source.slice(i + (closing ? 2 : 1)))?.[0];
      if (name) {
        flushText(i);
        const end = tagEnd(source, i);
        if (closing) tokens.push({ type: 'close', name, start: i, end });
        else {
          const selfClosing = source[end - 2] === '/';
          tokens.push({ type: 'open', name, start: i, end, selfClosing });
          const raw = name.toLowerCase();
          if (!selfClosing && (raw === 'script' || raw === 'style')) {
            const close = source.toLowerCase().indexOf(`</${raw}`, end);
            const rawEnd = close === -1 ? source.length : tagEnd(source, close);
            tokens.push({ type: 'other', start: end, end: rawEnd });
            i = text = rawEnd;
            continue;
          }
        }
        i = text = end;
        continue;
      }
    }
    if (source[i] === '{') {
      flushText(i);
      const end = braceEnd(source, i);
      tokens.push({ type: 'expr', start: i, end, inert: inertExpression(source.slice(i, end)) });
      i = text = end;
      continue;
    }
    i += 1;
  }
  flushText(source.length);
  return tokens;
}

/** Text that starts with closing punctuation, or ends with opening punctuation. */
const CLOSING = /^[.,;:!?)\]}\u2019\u201d\u2026]/u;
const OPENING = /[([{\u2018\u201c'"/]$/u;

const lineOf = (source: string, offset: number) => source.slice(0, offset).split('\n').length;

/** Joins text on this side: an inline element edge or a visible expression. */
function joinsAfter(token: Token | undefined): boolean {
  if (!token) return false;
  if (token.type === 'close') return INLINE_ELEMENTS.has(token.name);
  return token.type === 'expr' && !token.inert;
}

function joinsBefore(token: Token | undefined): boolean {
  if (!token) return false;
  if (token.type === 'open') return !token.selfClosing && INLINE_ELEMENTS.has(token.name);
  return token.type === 'expr' && !token.inert;
}

/** Every line break in `source` (an `.astro` file) that Astro would drop between text and an inline neighbor. */
export function findLostSpaces(source: string): LostSpace[] {
  const tokens = tokenize(source);
  const found: LostSpace[] = [];
  for (const [index, token] of tokens.entries()) {
    if (token.type !== 'text') continue;
    const value = source.slice(token.start, token.end);
    if (!value.trim()) continue;
    const leading = /^\s*/.exec(value)?.[0] ?? '';
    const trailing = /\s*$/.exec(value)?.[0] ?? '';
    const words = value.trim();
    // Punctuation that hugs its neighbor (`(<code>`, `</code>.`) is meant to join.
    if (leading.includes('\n') && !CLOSING.test(words) && joinsAfter(tokens[index - 1])) {
      found.push({ line: lineOf(source, token.start), side: 'after', ...token });
    }
    if (trailing.includes('\n') && !OPENING.test(words) && joinsBefore(tokens[index + 1])) {
      const at = token.end - trailing.length;
      found.push({ line: lineOf(source, at), side: 'before', start: token.start, end: token.end });
    }
  }
  return found;
}
