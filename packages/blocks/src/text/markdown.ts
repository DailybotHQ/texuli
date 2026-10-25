import { safeHref } from '@texuli/core';

/**
 * Owned, closed Markdown subset for text blocks (T-blocks-text). It turns
 * already-validated block text into a small tree the Svelte renderers walk.
 * Nothing here produces HTML: raw tags stay literal text, every link goes
 * through `safeHref` (untrusted tier), and images render as their alt text
 * (pictures belong to the media family, which applies `safeImageSrc`).
 *
 * Supported: paragraphs, `#` headings, `-`/`*`/`+` and `1.` lists (nested by
 * indentation, `[ ]`/`[x]` task items), `>` quotes, fenced code, thematic
 * breaks; inline `**strong**`, `*em*`, `~~del~~`, `` `code` ``, `[text](href)`,
 * `<https://…>` autolinks, backslash escapes and hard breaks.
 */

export type MdInline =
  | { type: 'text'; text: string }
  | { type: 'code'; text: string }
  | { type: 'break' }
  | { type: 'strong' | 'em' | 'del'; children: MdInline[] }
  | { type: 'link'; href: string | undefined; children: MdInline[] };

export type MdListItem = { checked: boolean | null; children: MdBlock[] };

export type MdBlock =
  | { type: 'paragraph'; children: MdInline[] }
  | { type: 'heading'; level: 1 | 2 | 3 | 4 | 5 | 6; children: MdInline[] }
  | { type: 'list'; ordered: boolean; start: number; items: MdListItem[] }
  | { type: 'quote'; children: MdBlock[] }
  | { type: 'code'; lang: string | undefined; text: string }
  | { type: 'rule' };

export interface MdDocument {
  blocks: MdBlock[];
}

/** Nesting and size caps: hostile input degrades to literal text, never recursion blowups. */
export const MARKDOWN_LIMITS = /* @__PURE__ */ Object.freeze({
  /**
   * Longest source parsed, equal to the schema's markdown cap. Pathological
   * inline input stays under ~50 ms at this size.
   */
  source: 4_000,
  /** Nested quotes and lists. */
  blockDepth: 4,
  /** Nested emphasis and links. */
  inlineDepth: 6,
});

const FENCE = /^ {0,3}(`{3,}|~{3,})\s*([a-z][a-z0-9+-]{0,31})?\s*$/i;
const HEADING = /^ {0,3}(#{1,6})(?:[ \t]+(.*?))?[ \t]*#*[ \t]*$/;
const RULE = /^ {0,3}([-*_])(?:[ \t]*\1){2,}[ \t]*$/;
const QUOTE = /^ {0,3}> ?(.*)$/;
const BULLET = /^( {0,3})([-*+])[ \t]+(.*)$/;
const ORDERED = /^( {0,3})(\d{1,9})[.)][ \t]+(.*)$/;
const TASK = /^\[([ xX])\][ \t]+/;

/** Parses validated block text into the closed Markdown tree. */
export function parseMarkdown(source: string): MdDocument {
  const text = String(source).slice(0, MARKDOWN_LIMITS.source).replace(/\r\n?/g, '\n');
  return { blocks: parseBlocks(text.split('\n'), 0) };
}

function isBlank(line: string): boolean {
  return line.trim() === '';
}

function listMarker(line: string): { ordered: boolean; start: number; content: string } | null {
  const bullet = BULLET.exec(line);
  if (bullet) return { ordered: false, start: 1, content: bullet[3] ?? '' };
  const ordered = ORDERED.exec(line);
  if (ordered) return { ordered: true, start: Number(ordered[2]), content: ordered[3] ?? '' };
  return null;
}

/** True when `line` starts a block other than a paragraph continuation. */
function startsBlock(line: string): boolean {
  return (
    FENCE.test(line) ||
    HEADING.test(line) ||
    RULE.test(line) ||
    QUOTE.test(line) ||
    listMarker(line) !== null
  );
}

function parseBlocks(lines: readonly string[], depth: number): MdBlock[] {
  const blocks: MdBlock[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i] ?? '';
    if (isBlank(line)) {
      i += 1;
      continue;
    }

    const fence = FENCE.exec(line);
    if (fence) {
      const marker = fence[1] ?? '```';
      const body: string[] = [];
      i += 1;
      while (i < lines.length && !(lines[i] ?? '').trim().startsWith(marker)) {
        body.push(lines[i] ?? '');
        i += 1;
      }
      i += 1; // closing fence (or end of input)
      blocks.push({ type: 'code', lang: fence[2]?.toLowerCase(), text: body.join('\n') });
      continue;
    }

    const heading = HEADING.exec(line);
    if (heading) {
      const level = (heading[1] ?? '#').length as 1 | 2 | 3 | 4 | 5 | 6;
      blocks.push({ type: 'heading', level, children: parseInline(heading[2] ?? '', 0) });
      i += 1;
      continue;
    }

    if (RULE.test(line)) {
      blocks.push({ type: 'rule' });
      i += 1;
      continue;
    }

    if (QUOTE.test(line)) {
      const inner: string[] = [];
      while (i < lines.length && QUOTE.test(lines[i] ?? '')) {
        inner.push(QUOTE.exec(lines[i] ?? '')?.[1] ?? '');
        i += 1;
      }
      blocks.push(
        depth < MARKDOWN_LIMITS.blockDepth
          ? { type: 'quote', children: parseBlocks(inner, depth + 1) }
          : { type: 'paragraph', children: parseInline(inner.join('\n'), 0) }
      );
      continue;
    }

    const marker = listMarker(line);
    if (marker) {
      const parsed = parseList(lines, i, marker.ordered, marker.start, depth);
      blocks.push(parsed.block);
      i = parsed.next;
      continue;
    }

    const paragraph: string[] = [line];
    i += 1;
    while (i < lines.length && !isBlank(lines[i] ?? '') && !startsBlock(lines[i] ?? '')) {
      paragraph.push(lines[i] ?? '');
      i += 1;
    }
    blocks.push({ type: 'paragraph', children: parseInline(paragraph.join('\n'), 0) });
  }
  return blocks;
}

function parseList(
  lines: readonly string[],
  from: number,
  ordered: boolean,
  start: number,
  depth: number
): { block: MdBlock; next: number } {
  const items: MdListItem[] = [];
  let i = from;
  while (i < lines.length) {
    const marker = listMarker(lines[i] ?? '');
    if (!marker || marker.ordered !== ordered) break;
    const body: string[] = [marker.content];
    i += 1;
    // Continuation: indented lines (nested lists, wrapped text) and lazy
    // paragraph lines that do not start another block.
    while (i < lines.length) {
      const next = lines[i] ?? '';
      if (isBlank(next)) {
        const after = lines[i + 1] ?? '';
        if (/^ {2,}\S/.test(after)) {
          body.push('');
          i += 1;
          continue;
        }
        break;
      }
      if (/^ {2,}\S/.test(next)) {
        body.push(next.replace(/^ {2,4}/, ''));
        i += 1;
        continue;
      }
      if (startsBlock(next)) break;
      body.push(next);
      i += 1;
    }
    let checked: boolean | null = null;
    const task = TASK.exec(body[0] ?? '');
    if (task) {
      checked = task[1] !== ' ';
      body[0] = (body[0] ?? '').slice(task[0].length);
    }
    const children =
      depth < MARKDOWN_LIMITS.blockDepth
        ? parseBlocks(body, depth + 1)
        : [{ type: 'paragraph' as const, children: parseInline(body.join('\n'), 0) }];
    items.push({ checked, children });
  }
  return { block: { type: 'list', ordered, start, items }, next: i };
}

const ESCAPABLE = /[\\`*_{}[\]()#+\-.!~<>|]/;

/** Parses inline Markdown; `depth` caps nested emphasis and links. */
export function parseInline(source: string, depth: number, inLink = false): MdInline[] {
  const out: MdInline[] = [];
  let buffer = '';
  const flush = () => {
    if (buffer) out.push({ type: 'text', text: buffer });
    buffer = '';
  };
  let i = 0;
  while (i < source.length) {
    const ch = source[i] ?? '';

    if (ch === '\\') {
      const next = source[i + 1] ?? '';
      if (next === '\n') {
        flush();
        out.push({ type: 'break' });
        i += 2;
        continue;
      }
      if (ESCAPABLE.test(next)) {
        buffer += next;
        i += 2;
        continue;
      }
    }

    if (ch === '\n') {
      if (/ {2,}$/.test(buffer)) {
        buffer = buffer.replace(/ +$/, '');
        flush();
        out.push({ type: 'break' });
      } else {
        buffer += '\n';
      }
      i += 1;
      continue;
    }

    if (ch === '`') {
      const run = /^`+/.exec(source.slice(i))?.[0] ?? '`';
      const close = source.indexOf(run, i + run.length);
      if (close !== -1) {
        flush();
        const code = source.slice(i + run.length, close).replace(/\n/g, ' ');
        out.push({
          type: 'code',
          text: code.length > 2 && /^ .* $/.test(code) ? code.slice(1, -1) : code,
        });
        i = close + run.length;
        continue;
      }
      buffer += run;
      i += run.length;
      continue;
    }

    if (depth < MARKDOWN_LIMITS.inlineDepth) {
      const emphasis = matchEmphasis(source, i);
      if (emphasis) {
        flush();
        out.push({
          type: emphasis.type,
          children: parseInline(
            source.slice(emphasis.innerStart, emphasis.innerEnd),
            depth + 1,
            inLink
          ),
        });
        i = emphasis.end;
        continue;
      }

      if (ch === '!' && source[i + 1] === '[') {
        const image = matchLink(source, i + 1);
        if (image) {
          // Images are not loaded from text blocks: keep the alt text only.
          buffer += source.slice(image.labelStart, image.labelEnd);
          i = image.end;
          continue;
        }
      }

      if (ch === '[' && !inLink) {
        const link = matchLink(source, i);
        if (link) {
          flush();
          out.push({
            type: 'link',
            href: safeHref(link.href),
            children: parseInline(source.slice(link.labelStart, link.labelEnd), depth + 1, true),
          });
          i = link.end;
          continue;
        }
      }

      if (ch === '<' && !inLink) {
        const auto = /^<((?:https?:\/\/|mailto:)[^\s<>]+)>/i.exec(source.slice(i));
        if (auto?.[1]) {
          flush();
          out.push({
            type: 'link',
            href: safeHref(auto[1]),
            children: [{ type: 'text', text: auto[1] }],
          });
          i += auto[0].length;
          continue;
        }
      }
    }

    buffer += ch;
    i += 1;
  }
  flush();
  return out;
}

function matchEmphasis(
  source: string,
  at: number
): { type: 'strong' | 'em' | 'del'; innerStart: number; innerEnd: number; end: number } | null {
  const candidates: { marker: string; type: 'strong' | 'em' | 'del' }[] = [
    { marker: '**', type: 'strong' },
    { marker: '__', type: 'strong' },
    { marker: '~~', type: 'del' },
    { marker: '*', type: 'em' },
    { marker: '_', type: 'em' },
  ];
  for (const { marker, type } of candidates) {
    if (!source.startsWith(marker, at)) continue;
    const innerStart = at + marker.length;
    const first = source[innerStart] ?? '';
    if (first === '' || /\s/.test(first)) continue;
    // `_` inside a word (snake_case) is literal.
    if (marker[0] === '_' && /[\p{L}\p{N}]/u.test(source[at - 1] ?? '')) continue;
    let close = source.indexOf(marker, innerStart + 1);
    while (close !== -1) {
      const before = source[close - 1] ?? '';
      const after = source[close + marker.length] ?? '';
      const doubled = marker.length === 1 && after === marker;
      const midWord = marker[0] === '_' && /[\p{L}\p{N}]/u.test(after);
      if (!/\s/.test(before) && before !== '\\' && !doubled && !midWord) break;
      close = source.indexOf(marker, close + (doubled ? 2 : 1));
    }
    if (close === -1) continue;
    return { type, innerStart, innerEnd: close, end: close + marker.length };
  }
  return null;
}

function matchLink(
  source: string,
  at: number
): { labelStart: number; labelEnd: number; href: string; end: number } | null {
  let level = 0;
  let labelEnd = -1;
  for (let j = at; j < source.length; j += 1) {
    const c = source[j];
    if (c === '\\') {
      j += 1;
      continue;
    }
    if (c === '[') level += 1;
    else if (c === ']') {
      level -= 1;
      if (level === 0) {
        labelEnd = j;
        break;
      }
    } else if (c === '\n' && source[j + 1] === '\n') return null;
  }
  if (labelEnd === -1 || source[labelEnd + 1] !== '(') return null;
  const target = /^\(\s*<?((?:[^\s()<>]|\([^\s()<>]*\))*)>?(?:\s+"[^"\n]*")?\s*\)/.exec(
    source.slice(labelEnd + 1)
  );
  if (!target) return null;
  return {
    labelStart: at + 1,
    labelEnd,
    href: target[1] ?? '',
    end: labelEnd + 1 + target[0].length,
  };
}

/** Plain text of an inline tree (for accessible names and summaries). */
export function inlineText(nodes: readonly MdInline[]): string {
  let text = '';
  for (const node of nodes) {
    if (node.type === 'text' || node.type === 'code') text += node.text;
    else if (node.type === 'break') text += '\n';
    else text += inlineText(node.children);
  }
  return text;
}

/**
 * Distinct heading levels used anywhere in the tree, ascending. Renderers map
 * them onto consecutive outline levels (`##` then `####` become h3 then h4).
 */
export function headingLevels(blocks: readonly MdBlock[]): number[] {
  const found = new Set<number>();
  const visit = (items: readonly MdBlock[]) => {
    for (const block of items) {
      if (block.type === 'heading') found.add(block.level);
      else if (block.type === 'quote') visit(block.children);
      else if (block.type === 'list') for (const item of block.items) visit(item.children);
    }
  };
  visit(blocks);
  return [...found].sort((a, b) => a - b);
}
