/**
 * Clipboard HTML import (EDITOR_ARCHITECTURE section 8). An owned string
 * tokenizer reads tags, a few attributes, text and character references, and
 * an allowlist maps them onto the closed editor vocabulary. It never builds a
 * DOM, never inserts markup anywhere, and runs in time linear in the input.
 * The loose tree it builds goes through `loadEditorDocument` at the
 * `untrusted` tier, so the document caps, text cleaning and the URL policy
 * apply exactly as for any other untrusted document.
 */

/** Caps on the raw clipboard string, before the document caps apply. */
export const PASTE_LIMITS = Object.freeze({
  /** Characters of clipboard HTML or text read; the rest is dropped. */
  source: 1_000_000,
  /** Nested lists and quotes kept (the document depth); deeper ones flatten into the deepest. */
  containers: 4,
  /** Open marks tracked per kind; deeper repeats change nothing. */
  marks: 64,
});

type Attributes = { href?: string; type?: string; checked?: boolean; alt?: string };

/** One token of the clipboard string. */
export type HtmlToken =
  | { kind: 'text'; text: string }
  | { kind: 'open'; name: string; attrs: Attributes; selfClosing: boolean }
  | { kind: 'close'; name: string };

const NAMED: Readonly<Record<string, string>> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: String.fromCharCode(0xa0),
  ndash: String.fromCharCode(0x2013),
  mdash: String.fromCharCode(0x2014),
  hellip: String.fromCharCode(0x2026),
  lsquo: String.fromCharCode(0x2018),
  rsquo: String.fromCharCode(0x2019),
  ldquo: String.fromCharCode(0x201c),
  rdquo: String.fromCharCode(0x201d),
  bull: String.fromCharCode(0x2022),
  middot: String.fromCharCode(0xb7),
  copy: String.fromCharCode(0xa9),
  reg: String.fromCharCode(0xae),
  trade: String.fromCharCode(0x2122),
};

const REPLACEMENT = String.fromCharCode(0xfffd);

/** Decode character references. Unknown names stay literal text. */
export function decodeEntities(text: string): string {
  if (!text.includes('&')) return text;
  return text.replace(/&(#[0-9]{1,8}|#[xX][0-9a-fA-F]{1,7}|[a-zA-Z]{2,8});?/g, (whole, ref) => {
    if (ref[0] !== '#') return Object.hasOwn(NAMED, ref) ? (NAMED[ref] as string) : whole;
    const code =
      ref[1] === 'x' || ref[1] === 'X' ? parseInt(ref.slice(2), 16) : Number(ref.slice(1));
    if (
      !Number.isFinite(code) ||
      code === 0 ||
      code > 0x10ffff ||
      (code >= 0xd800 && code <= 0xdfff)
    )
      return REPLACEMENT;
    return String.fromCodePoint(code);
  });
}

/** Elements dropped together with everything inside them. */
const DROPPED = new Set([
  'script',
  'style',
  'template',
  'textarea',
  'title',
  'noscript',
  'iframe',
  'object',
  'svg',
  'math',
  'head',
  'select',
  'button',
]);

const isNameStart = (char: string | undefined) =>
  char !== undefined && ((char >= 'a' && char <= 'z') || (char >= 'A' && char <= 'Z'));

const NAME_END = /[\s/>]/;

function readAttributes(
  source: string,
  from: number
): { attrs: Attributes; end: number; selfClosing: boolean } {
  const attrs: Attributes = {};
  let i = from;
  let selfClosing = false;
  while (i < source.length) {
    const char = source[i] as string;
    if (char === '>') return { attrs, end: i + 1, selfClosing };
    if (char === '/' || /\s/.test(char)) {
      selfClosing = char === '/';
      i += 1;
      continue;
    }
    selfClosing = false;
    let nameEnd = i;
    while (nameEnd < source.length && !/[\s/>=]/.test(source[nameEnd] as string)) nameEnd += 1;
    const name = source.slice(i, nameEnd).toLowerCase();
    i = nameEnd;
    while (i < source.length && /\s/.test(source[i] as string)) i += 1;
    let value: string | null = null;
    if (source[i] === '=') {
      i += 1;
      while (i < source.length && /\s/.test(source[i] as string)) i += 1;
      const quote = source[i];
      if (quote === '"' || quote === "'") {
        const close = source.indexOf(quote, i + 1);
        const stop = close === -1 ? source.length : close;
        value = source.slice(i + 1, stop);
        i = stop + 1;
      } else {
        let stop = i;
        while (stop < source.length && !/[\s>]/.test(source[stop] as string)) stop += 1;
        value = source.slice(i, stop);
        i = stop;
      }
    }
    const decoded = value === null ? '' : decodeEntities(value.slice(0, 4096));
    if (name === 'href' && value !== null) attrs.href = decoded.trim();
    else if (name === 'type') attrs.type = decoded.trim().toLowerCase();
    else if (name === 'checked') attrs.checked = true;
    else if (name === 'alt') attrs.alt = decoded;
  }
  return { attrs, end: source.length, selfClosing };
}

/**
 * Tokenize clipboard HTML. Comments, doctypes and processing instructions are
 * skipped; `script`, `style`, `template` and the other `DROPPED` elements are
 * skipped with their content; a `<` that starts no tag is text.
 */
export function tokenizeHtml(html: string): HtmlToken[] {
  const tokens: HtmlToken[] = [];
  const lower = html.toLowerCase();
  let i = 0;
  let textStart = 0;
  const flushText = (end: number) => {
    if (end > textStart)
      tokens.push({ kind: 'text', text: decodeEntities(html.slice(textStart, end)) });
  };
  while (i < html.length) {
    const lt = html.indexOf('<', i);
    if (lt === -1) break;
    const next = html[lt + 1];
    if (next === '!' || next === '?') {
      flushText(lt);
      const isComment = html.startsWith('<!--', lt);
      const close = isComment ? html.indexOf('-->', lt + 4) : html.indexOf('>', lt + 2);
      i = close === -1 ? html.length : close + (isComment ? 3 : 1);
      textStart = i;
      continue;
    }
    if (next === '/' && isNameStart(html[lt + 2])) {
      flushText(lt);
      let end = lt + 2;
      while (end < html.length && !NAME_END.test(html[end] as string)) end += 1;
      const name = lower.slice(lt + 2, end);
      const close = html.indexOf('>', end);
      i = close === -1 ? html.length : close + 1;
      textStart = i;
      tokens.push({ kind: 'close', name });
      continue;
    }
    if (isNameStart(next)) {
      flushText(lt);
      let end = lt + 1;
      while (end < html.length && !NAME_END.test(html[end] as string)) end += 1;
      const name = lower.slice(lt + 1, end);
      const { attrs, end: after, selfClosing } = readAttributes(html, end);
      i = after;
      if (DROPPED.has(name) && !selfClosing) {
        const close = lower.indexOf(`</${name}`, i);
        if (close === -1) i = html.length;
        else {
          const gt = html.indexOf('>', close);
          i = gt === -1 ? html.length : gt + 1;
        }
      } else if (!DROPPED.has(name)) tokens.push({ kind: 'open', name, attrs, selfClosing });
      textStart = i;
      continue;
    }
    i = lt + 1;
  }
  flushText(html.length);
  return tokens;
}

// ── building the loose document ─────────────────────────────────────────

type RawMark = { type: 'strong' | 'em' | 'strike' | 'code' } | { type: 'link'; href: string };
type RawInline = { type: 'text'; text: string; marks: RawMark[] } | { type: 'break' };
type RawText =
  | { type: 'paragraph'; content: RawInline[] }
  | { type: 'heading'; level: number; content: RawInline[] }
  | { type: 'code'; text: string };
type RawItem = { checked?: boolean; blocks: RawBlock[] };
type RawList = {
  type: 'list';
  kind: 'bullet' | 'ordered' | 'todo';
  start?: number;
  items: RawItem[];
};
type RawQuote = { type: 'quote'; blocks: RawBlock[] };
/** The loose block shape handed to `loadEditorDocument`. */
export type RawBlock = RawText | RawList | RawQuote | { type: 'divider' };

type Container =
  | { kind: 'root'; blocks: RawBlock[] }
  | { kind: 'quote'; node: RawQuote }
  | { kind: 'list'; node: RawList }
  | { kind: 'item'; node: RawItem };

const BOUNDARY = new Set([
  'p',
  'div',
  'section',
  'article',
  'header',
  'footer',
  'main',
  'aside',
  'nav',
  'figure',
  'figcaption',
  'table',
  'thead',
  'tbody',
  'tfoot',
  'tr',
  'td',
  'th',
  'caption',
  'dl',
  'dt',
  'dd',
  'address',
  'details',
  'summary',
  'form',
  'fieldset',
  'legend',
  'center',
]);

const MARKS: Readonly<Record<string, 'strong' | 'em' | 'strike' | 'code'>> = {
  b: 'strong',
  strong: 'strong',
  i: 'em',
  em: 'em',
  s: 'strike',
  del: 'strike',
  strike: 'strike',
  code: 'code',
};

const COLLAPSE = /[ \t\n\r\f]+/g;

/** What the HTML builder found, for diagnostics and the paste announcement. */
export interface HtmlImportStats {
  /** Text blocks, lists, quotes and dividers produced before the document caps. */
  blocks: number;
  /** Characters of source dropped past `PASTE_LIMITS.source`. */
  truncated: boolean;
}

/**
 * Map clipboard HTML onto loose editor blocks (not yet validated: pass them
 * to `loadEditorDocument`). `maxBlocks` stops the build early so a flood of
 * empty elements costs nothing past the document cap.
 */
export function htmlToBlocks(
  html: string,
  maxBlocks = Number.POSITIVE_INFINITY
): { blocks: RawBlock[]; stats: HtmlImportStats } {
  const truncated = html.length > PASTE_LIMITS.source;
  const tokens = tokenizeHtml(truncated ? html.slice(0, PASTE_LIMITS.source) : html);
  const root: Container = { kind: 'root', blocks: [] };
  const stack: Container[] = [root];
  /** Lists and quotes skipped past `PASTE_LIMITS.containers`, so their close tags are ignored too. */
  const skipped = { list: 0, quote: 0 };
  let produced = 0;
  let current: RawText | null = null;
  let pre = 0;
  /** HTML drops one newline right after `<pre>`. */
  let preFresh = false;
  let space = true;
  const counts = { strong: 0, em: 0, strike: 0, code: 0 };
  const links: (string | null)[] = [];
  let linkOverflow = 0;

  const top = () => stack[stack.length - 1] as Container;
  const append = (block: RawBlock) => {
    let target = top();
    if (target.kind === 'list') {
      const item: RawItem = { blocks: [] };
      target.node.items.push(item);
      target = { kind: 'item', node: item };
      stack.push(target);
    }
    produced += 1;
    if (target.kind === 'root') target.blocks.push(block);
    else target.node.blocks.push(block);
  };
  const flush = () => {
    if (!current) return;
    if (current.type !== 'code') {
      const last = current.content.at(-1);
      if (last?.type === 'text') {
        last.text = last.text.replace(/ +$/, '');
        if (last.text === '') current.content.pop();
      }
    }
    const empty = current.type === 'code' ? current.text === '' : current.content.length === 0;
    if (!empty) append(current);
    current = null;
    space = true;
  };
  const ensure = (): RawText => {
    if (!current) current = { type: 'paragraph', content: [] };
    return current;
  };
  const marks = (): RawMark[] => {
    const out: RawMark[] = [];
    const href = links.findLast((link) => link !== null);
    if (href) out.push({ type: 'link', href });
    for (const type of ['strong', 'em', 'strike', 'code'] as const)
      if (counts[type] > 0) out.push({ type });
    return out;
  };
  const text = (value: string) => {
    if (value === '') return;
    const block = ensure();
    if (block.type === 'code') {
      block.text += preFresh ? value.replace(/^\n/, '') : value;
      preFresh = false;
      return;
    }
    let collapsed = value.replace(COLLAPSE, ' ');
    if (space) collapsed = collapsed.replace(/^ /, '');
    if (collapsed === '') return;
    space = collapsed.endsWith(' ');
    block.content.push({ type: 'text', text: collapsed, marks: marks() });
  };
  const openContainer = (container: Container): boolean => {
    if (container.kind !== 'item') {
      const depth = stack.filter((entry) => entry.kind === 'list' || entry.kind === 'quote').length;
      if (depth >= PASTE_LIMITS.containers) {
        skipped[container.kind as 'list' | 'quote'] += 1;
        return false;
      }
    }
    if (container.kind === 'item') {
      let list = top();
      if (list.kind !== 'list') {
        const implicit: RawList = { type: 'list', kind: 'bullet', items: [] };
        append(implicit);
        list = { kind: 'list', node: implicit };
        stack.push(list);
      }
      list.node.items.push(container.node);
    } else if (container.kind === 'list' || container.kind === 'quote') append(container.node);
    stack.push(container);
    return true;
  };
  const closeContainer = (kind: 'list' | 'quote' | 'item') => {
    if (kind !== 'item' && skipped[kind] > 0) {
      skipped[kind] -= 1;
      return;
    }
    const at = stack.findLastIndex((entry) => entry.kind === kind);
    if (at > 0) stack.length = at;
  };

  for (const token of tokens) {
    if (produced >= maxBlocks) break;
    if (token.kind === 'text') {
      text(token.text);
      continue;
    }
    const { name } = token;
    if (token.kind === 'close') {
      if (name === 'pre') {
        if (pre > 0) pre -= 1;
        if (pre === 0) flush();
      } else if (pre > 0) continue;
      else if (/^h[1-6]$/.test(name) || BOUNDARY.has(name)) flush();
      else if (name === 'li') {
        flush();
        closeContainer('item');
      } else if (name === 'ul' || name === 'ol') {
        flush();
        closeContainer('list');
      } else if (name === 'blockquote') {
        flush();
        closeContainer('quote');
      } else if (name === 'a') {
        if (linkOverflow > 0) linkOverflow -= 1;
        else links.pop();
      } else if (Object.hasOwn(MARKS, name)) {
        const type = MARKS[name] as keyof typeof counts;
        if (counts[type] > 0) counts[type] -= 1;
      }
      continue;
    }
    if (name === 'br') {
      if (current?.type === 'code') current.text += '\n';
      else {
        ensure();
        (current as RawText & { content: RawInline[] }).content.push({ type: 'break' });
        space = true;
      }
      continue;
    }
    if (name === 'img') {
      if (token.attrs.alt) text(token.attrs.alt);
      continue;
    }
    if (pre > 0) {
      if (name === 'pre') pre += 1;
      continue;
    }
    if (name === 'pre') {
      flush();
      current = { type: 'code', text: '' };
      pre = 1;
      preFresh = true;
    } else if (/^h[1-6]$/.test(name)) {
      flush();
      current = { type: 'heading', level: Number(name[1]), content: [] };
    } else if (BOUNDARY.has(name)) flush();
    else if (name === 'ul' || name === 'ol') {
      flush();
      if (!token.selfClosing)
        openContainer({
          kind: 'list',
          node: { type: 'list', kind: name === 'ol' ? 'ordered' : 'bullet', items: [] },
        });
    } else if (name === 'li') {
      flush();
      if (top().kind === 'item') closeContainer('item');
      openContainer({ kind: 'item', node: { blocks: [] } });
    } else if (name === 'blockquote') {
      flush();
      if (!token.selfClosing) openContainer({ kind: 'quote', node: { type: 'quote', blocks: [] } });
    } else if (name === 'hr') {
      flush();
      append({ type: 'divider' });
    } else if (name === 'input' && token.attrs.type === 'checkbox') {
      const item = stack.findLast((entry) => entry.kind === 'item');
      const list = stack.findLast((entry) => entry.kind === 'list');
      if (item?.kind === 'item' && list?.kind === 'list') {
        list.node.kind = 'todo';
        item.node.checked = token.attrs.checked === true;
      }
    } else if (name === 'a' && !token.selfClosing) {
      if (links.length < PASTE_LIMITS.marks) links.push(token.attrs.href ?? null);
      else linkOverflow += 1;
    } else if (Object.hasOwn(MARKS, name) && !token.selfClosing) {
      const type = MARKS[name] as keyof typeof counts;
      if (counts[type] < PASTE_LIMITS.marks) counts[type] += 1;
    }
  }
  flush();
  for (const entry of stack) {
    if (entry.kind === 'list')
      entry.node.items = entry.node.items.filter((item) => item.blocks.length > 0);
  }
  return { blocks: root.blocks, stats: { blocks: produced, truncated } };
}
