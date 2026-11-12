/**
 * `writeMarkdown`: a `texuli-md/v1` tree as CommonMark 0.31.2 text with the GFM extensions
 * (tables, task items, strikethrough, footnotes). Round-trip stable at tree level: reading the
 * output with `parseMarkdown` gives the tree back for what the reader produces (the spec corpora
 * are the test). Text is escaped so it can never become markup: ASCII punctuation that could
 * open a construct is backslash-escaped, line starts that could open a block are escaped, and
 * leading or trailing spaces become character references. Raw `html` nodes are written as their
 * literal source (they were raw HTML in Markdown too). Nodes CommonMark cannot express
 * (`underline`, `spoiler`, `mention`) keep their text. Never throws; nesting deeper than
 * `MARKDOWN_LIMITS` is written as plain text, without recursion past the limits.
 */
import {
  MARKDOWN_LIMITS,
  type MdAlign,
  type MdBlock,
  type MdInline,
  type MdList,
  type MdNode,
  type MdRoot,
  type MdTable,
} from './ast.ts';

export interface MarkdownWriteOptions {
  /** Bullet for unordered lists (default `-`; adjacent lists alternate with `*`). */
  readonly bullet?: '-' | '*' | '+';
}

const isAlnum = (char: string | undefined) => char !== undefined && /[\p{L}\p{N}]/u.test(char);

/** Characters escaped wherever they appear in text. */
const ALWAYS = new Set(['\\', '`', '*', '_', '[', ']', '<', '~']);
/** Characters escaped at the start of a line, where they could open a block. */
const LINE_START = new Set(['#', '>', '-', '+', '=', ':', '|']);

interface InlineContext {
  /** Whether the next character written starts a line. */
  lineStart: boolean;
  /** Inside a table cell: `|` is escaped. */
  readonly table: boolean;
  /** Depth of inline containers written so far. */
  depth: number;
}

/** Escape plain text so it reads back as the same text. */
function escapeText(value: string, ctx: InlineContext, nextIsLink: boolean): string {
  let out = '';
  for (let i = 0; i < value.length; i++) {
    const c = value.charAt(i);
    if (c === '\n') {
      // A line ending at a line start or before another would end the paragraph: use a reference.
      if (ctx.lineStart || value.charAt(i + 1) === '\n') out += '&#10;';
      else out += '\n';
      ctx.lineStart = out.endsWith('\n');
      continue;
    }
    if (ctx.lineStart) {
      ctx.lineStart = false;
      if (c === ' ' || c === '\t') {
        out += c === ' ' ? '&#32;' : '&#9;';
        continue;
      }
      if (LINE_START.has(c)) {
        out += `\\${c}`;
        continue;
      }
      if (c >= '0' && c <= '9') {
        let j = i;
        while (j < value.length && value.charAt(j) >= '0' && value.charAt(j) <= '9') j++;
        const after = value.charAt(j);
        if (j - i <= 9 && (after === '.' || after === ')')) {
          out += `${value.slice(i, j)}\\${after}`;
          i = j;
          continue;
        }
      }
    }
    if (ALWAYS.has(c)) out += `\\${c}`;
    else if (c === '&' && /[A-Za-z0-9#]/.test(value.charAt(i + 1))) out += '\\&';
    else if (c === '|' && ctx.table) out += '\\|';
    else if (c === '!' && i === value.length - 1 && nextIsLink) out += '\\!';
    // GFM extended autolinks: break `www.`, `scheme://` and `local@domain`.
    else if (c === '.' && i >= 3 && value.slice(i - 3, i) === 'www') out += '\\.';
    else if (c === ':' && value.startsWith('//', i + 1) && /[A-Za-z]/.test(value.charAt(i - 1)))
      out += '\\:';
    else if (c === '@' && /[A-Za-z0-9.+_-]/.test(value.charAt(i - 1))) out += '\\@';
    else out += c;
  }
  return out;
}

/** Spaces and tabs at the ends of a paragraph or cell would be trimmed: write them as references. */
function protectEdges(text: string): string {
  let end = text.length;
  while (end > 0 && (text.charAt(end - 1) === ' ' || text.charAt(end - 1) === '\t')) end--;
  if (end === text.length) return text;
  let tail = '';
  for (let i = end; i < text.length; i++) tail += text.charAt(i) === ' ' ? '&#32;' : '&#9;';
  return text.slice(0, end) + tail;
}

/** A link destination: bare when it is safe, otherwise in `<...>`. */
function destination(url: string): string {
  let balance = 0;
  let bare = url.length > 0 && url.charAt(0) !== '<';
  for (let i = 0; i < url.length && bare; i++) {
    const c = url.charCodeAt(i);
    if (c <= 0x20 || c === 0x7f) bare = false;
    else if (c === 0x28) balance++;
    else if (c === 0x29 && --balance < 0) bare = false;
  }
  if (balance !== 0) bare = false;
  let out = '';
  for (let i = 0; i < url.length; i++) {
    const c = url.charAt(i);
    const code = url.charCodeAt(i);
    if (c === '\\') out += '\\\\';
    else if (c === '&' && /[A-Za-z0-9#]/.test(url.charAt(i + 1))) out += '\\&';
    else if (!bare && (c === '<' || c === '>')) out += `\\${c}`;
    else if (code < 0x20 || code === 0x7f) out += `&#${code};`;
    else out += c;
  }
  return bare ? out : `<${out}>`;
}

/** A link title in double quotes. */
function title(value: string): string {
  let out = '';
  for (let i = 0; i < value.length; i++) {
    const c = value.charAt(i);
    if (c === '"' || c === '\\') out += `\\${c}`;
    else if (c === '&' && /[A-Za-z0-9#]/.test(value.charAt(i + 1))) out += '\\&';
    else if (c === '\n') out += '&#10;';
    else out += c;
  }
  return `"${out}"`;
}

/** A code span: a backtick fence longer than any run inside, padded when the value needs it. */
function codeSpan(value: string): string {
  let longest = 0;
  let run = 0;
  for (let i = 0; i < value.length; i++) {
    run = value.charAt(i) === '`' ? run + 1 : 0;
    longest = Math.max(longest, run);
  }
  const fence = '`'.repeat(longest + 1);
  const allSpaces = /^ *$/.test(value);
  const pad =
    value.startsWith('`') ||
    value.endsWith('`') ||
    (!allSpaces && value.startsWith(' ') && value.endsWith(' '));
  return pad ? `${fence} ${value} ${fence}` : `${fence}${value}${fence}`;
}

type Delimiter = '*' | '_';

class Writer {
  private readonly bullet: '-' | '*' | '+';

  constructor(options: MarkdownWriteOptions) {
    this.bullet = options.bullet ?? '-';
  }

  // -------------------------------------------------------------------------
  // Inlines

  inlines(
    nodes: readonly MdInline[],
    ctx: InlineContext,
    outer: Delimiter | null = null,
    outerIntraword = false
  ): string {
    let out = '';
    let previous: Delimiter | null = outer;
    nodes.forEach((node, index) => {
      const next = nodes[index + 1];
      const touchesOuter = index === 0 || index === nodes.length - 1;
      switch (node.type) {
        case 'text':
          out += escapeText(node.value, ctx, next?.type === 'link');
          previous = null;
          return;
        case 'break':
          out += '\\\n';
          ctx.lineStart = true;
          previous = null;
          return;
        case 'inlineCode':
          out += codeSpan(node.value);
          break;
        case 'html':
          out += node.value;
          break;
        case 'footnoteReference':
          out += `[^${node.label}]`;
          break;
        case 'image':
          out += `![${escapeText(node.alt, { lineStart: false, table: ctx.table, depth: ctx.depth }, false)}](${destination(node.url)}${node.title ? ` ${title(node.title)}` : ''})`;
          break;
        case 'link': {
          const text = this.nested(node.children, ctx, null);
          out += `[${text}](${destination(node.url)}${node.title ? ` ${title(node.title)}` : ''})`;
          break;
        }
        case 'emphasis':
        case 'strong': {
          const avoid = (char: Delimiter) => previous === char || (touchesOuter && outer === char);
          const before = out.charAt(out.length - 1);
          const after = next?.type === 'text' ? next.value.charAt(0) : undefined;
          const intraword = isAlnum(before) || isAlnum(after) || (touchesOuter && outerIntraword);
          let char: Delimiter = '*';
          // Between word characters only `*` works: a run touching the outer one merges with it,
          // which reads back the same nesting (`***a***`, `******a******`).
          if (avoid('*') && !(touchesOuter && outer === '*' && outerIntraword)) {
            if (!avoid('_') && !isAlnum(before) && !isAlnum(after)) char = '_';
          }
          const mark = node.type === 'strong' ? char + char : char;
          out += mark + this.nested(node.children, ctx, char, intraword) + mark;
          ctx.lineStart = false;
          previous = char;
          return;
        }
        case 'delete':
          out += `~~${this.nested(node.children, ctx, null)}~~`;
          break;
        case 'underline':
        case 'spoiler':
          out += this.nested(node.children, ctx, outer);
          break;
        case 'mention': {
          const name =
            node.kind === 'everyone' || node.kind === 'here'
              ? node.kind
              : (node.label ?? node.id ?? '');
          out += escapeText(`@${name}`, ctx, false);
          break;
        }
        default:
          break;
      }
      ctx.lineStart = false;
      previous = null;
    });
    return out;
  }

  /** Children of an inline container; past the depth limit they are written as plain text. */
  private nested(
    children: readonly MdInline[],
    ctx: InlineContext,
    outer: Delimiter | null,
    intraword = false
  ): string {
    if (ctx.depth >= MARKDOWN_LIMITS.inlineDepth) {
      return escapeText(plainText(children), ctx, false);
    }
    ctx.depth++;
    const out = this.inlines(children, ctx, outer, intraword);
    ctx.depth--;
    return out;
  }

  private phrasing(nodes: readonly MdInline[], table = false): string {
    return protectEdges(this.inlines(nodes, { lineStart: true, table, depth: 0 }));
  }

  // -------------------------------------------------------------------------
  // Blocks

  blocks(nodes: readonly MdBlock[], separator: string, depth: number): string {
    const parts: string[] = [];
    let previous: MdBlock | undefined;
    let lastBullet: string | undefined;
    let lastDelimiter: string | undefined;
    let fenceNext = false;
    nodes.forEach((node, index) => {
      let text: string;
      const following = nodes[index + 1];
      if (node.type === 'list') {
        // An indented code block right after a list must stay outside its last item: widen the
        // items' content indent past the code's, or fence the code when that cannot work.
        let minWidth = 0;
        fenceNext = false;
        if (following?.type === 'code' && !following.fenced) {
          const spaces = Math.max(
            0,
            ...following.value
              .split('\n')
              .filter((line) => line !== '')
              .map((line) => /^ */.exec(line)?.[0].length ?? 0)
          );
          minWidth = 5 + spaces;
          const widest = node.ordered
            ? `${(node.start ?? 1) + node.children.length - 1}.`.length
            : 1;
          const startsWithCode = node.children.some(
            (item) => item.children[0]?.type === 'code' && !item.children[0].fenced
          );
          if (minWidth > widest + 4 || startsWithCode) {
            minWidth = 0;
            fenceNext = true;
          }
        }
        // Two adjacent lists of the same kind would merge: alternate the marker.
        const sameKind = previous?.type === 'list' && previous.ordered === node.ordered;
        if (node.ordered) {
          const delimiter = sameKind && lastDelimiter === '.' ? ')' : '.';
          text = this.list(node, depth, delimiter, minWidth);
          lastDelimiter = delimiter;
        } else {
          const bullet =
            sameKind && lastBullet === this.bullet
              ? this.bullet === '*'
                ? '-'
                : '*'
              : this.bullet;
          text = this.list(node, depth, bullet, minWidth);
          lastBullet = bullet;
        }
      } else if (node.type === 'code' && !node.fenced && previous?.type === 'list' && fenceNext) {
        text = this.block({ ...node, fenced: true }, depth);
      } else text = this.block(node, depth);
      parts.push(text);
      previous = node;
    });
    return parts.join(separator);
  }

  private block(node: MdBlock, depth: number): string {
    if (depth > MARKDOWN_LIMITS.blockDepth * 2) return '';
    switch (node.type) {
      case 'paragraph':
        return this.phrasing(node.children);
      case 'heading':
        return this.heading(node.depth, node.children);
      case 'thematicBreak':
        return '***';
      case 'code':
        return node.fenced
          ? this.fenced(node.value, node.lang, node.meta)
          : this.indented(node.value);
      case 'html':
        return node.value;
      case 'blockquote': {
        const inner = this.blocks(node.children, '\n\n', depth + 1);
        return prefixLines(inner, '> ', '>');
      }
      case 'list':
        return this.list(node, depth, node.ordered ? '.' : this.bullet);
      case 'table':
        return this.table(node);
      case 'definition':
        // The label is kept as written (escapes included), so it is written back unchanged.
        return `[${node.label}]: ${destination(node.url) || '<>'}${node.title !== undefined ? ` ${title(node.title)}` : ''}`;
      case 'footnoteDefinition': {
        const inner = this.blocks(node.children, '\n\n', depth + 1);
        const first = node.children[0];
        const head = `[^${node.label}]:`;
        if (inner === '') return head;
        if (first?.type === 'paragraph') return `${head} ${indentLines(inner, '    ', true)}`;
        return `${head}\n${indentLines(inner, '    ', false)}`;
      }
      default:
        return '';
    }
  }

  private heading(depth: number, children: readonly MdInline[]): string {
    const text = this.phrasing(children);
    if (text.includes('\n') && depth <= 2) return `${text}\n${(depth === 1 ? '=' : '-').repeat(3)}`;
    let content = text.replace(/\n/g, '&#10;');
    // A trailing run of `#` would be read as the closing sequence.
    const hashes = /#+$/.exec(content);
    if (hashes) content = `${content.slice(0, hashes.index)}\\${content.slice(hashes.index)}`;
    return content === '' ? '#'.repeat(depth) : `${'#'.repeat(depth)} ${content}`;
  }

  private fenced(value: string, lang?: string, meta?: string): string {
    const info = [lang, meta].filter(Boolean).join(' ');
    const char = info.includes('`') ? '~' : '`';
    let longest = 0;
    let run = 0;
    for (let i = 0; i < value.length; i++) {
      run = value.charAt(i) === char ? run + 1 : 0;
      longest = Math.max(longest, run);
    }
    const fence = char.repeat(Math.max(3, longest + 1));
    let escaped = '';
    for (let i = 0; i < info.length; i++) {
      const c = info.charAt(i);
      if (c === '\\' && /[!-/:-@[-`{-~]/.test(info.charAt(i + 1))) escaped += '\\\\';
      else if (c === '&' && /[A-Za-z0-9#]/.test(info.charAt(i + 1))) escaped += '\\&';
      else escaped += c;
    }
    return `${fence}${escaped}\n${value === '' ? '' : `${value}\n`}${fence}`;
  }

  private indented(value: string): string {
    return value
      .split('\n')
      .map((line) => (line === '' ? '' : `    ${line}`))
      .join('\n');
  }

  /**
   * `minWidth`: the content indent every item needs (an indented code block that follows the
   * list must not read as a continuation of its last item).
   */
  private list(node: MdList, depth: number, marker: string, minWidth = 0): string {
    const tight = !node.spread;
    const items = node.children.map((item, index) => {
      const bullet = node.ordered ? `${(node.start ?? 1) + index}${marker}` : marker;
      const width = Math.max(bullet.length + 1, minWidth);
      let inner = this.blocks(item.children, tight || !item.spread ? '\n' : '\n\n', depth + 1);
      if (item.checked !== undefined && item.children[0]?.type === 'paragraph')
        inner = `[${item.checked ? 'x' : ' '}] ${inner}`;
      if (inner === '') return bullet;
      return `${bullet}${' '.repeat(width - bullet.length)}${indentLines(inner, ' '.repeat(width), true)}`;
    });
    return items.join(tight ? '\n' : '\n\n');
  }

  private table(node: MdTable): string {
    const columns = node.align.length;
    const row = (cells: readonly string[]) => `| ${cells.join(' | ')} |`;
    const lines: string[] = [];
    node.children.forEach((tableRow, index) => {
      const cells: string[] = [];
      for (let i = 0; i < columns; i++) {
        const cell = tableRow.children[i];
        // GFM reads `\|` as `|` before inline parsing, also inside code spans: escape every pipe.
        const text = cell ? this.phrasing(cell.children, true).replace(/\n/g, ' ') : '';
        cells.push(text.replace(/(^|[^\\])\|/g, '$1\\|').replace(/(^|[^\\])\|/g, '$1\\|'));
      }
      lines.push(row(cells));
      if (index === 0) lines.push(row(node.align.map(alignMarker)));
    });
    return lines.join('\n');
  }
}

function alignMarker(align: MdAlign): string {
  return align === 'left' ? ':--' : align === 'center' ? ':-:' : align === 'right' ? '--:' : '---';
}

/** Prefix every line (`empty` for blank lines). */
function prefixLines(text: string, prefix: string, empty: string): string {
  if (text === '') return empty;
  return text
    .split('\n')
    .map((line) => (line === '' ? empty : prefix + line))
    .join('\n');
}

/** Indent every line but the first (when `skipFirst`), leaving blank lines empty. */
function indentLines(text: string, indent: string, skipFirst: boolean): string {
  return text
    .split('\n')
    .map((line, index) => (line === '' || (skipFirst && index === 0) ? line : indent + line))
    .join('\n');
}

/** The text of inline nodes, without markup and without recursion. */
function plainText(nodes: readonly MdInline[]): string {
  let out = '';
  const stack: MdNode[] = [...nodes].reverse();
  while (stack.length > 0) {
    const node = stack.pop() as MdNode;
    if (node.type === 'text' || node.type === 'inlineCode') out += node.value;
    else if (node.type === 'break') out += '\n';
    else if (node.type === 'image') out += node.alt;
    if ('children' in node) stack.push(...[...(node.children as MdNode[])].reverse());
  }
  return out;
}

/**
 * Write a `texuli-md/v1` tree as CommonMark with GFM extensions. Never throws: a value that is
 * not a tree writes as an empty string.
 */
export function writeMarkdown(
  tree: MdRoot | null | undefined,
  options: MarkdownWriteOptions = {}
): string {
  try {
    if (tree?.type !== 'root' || !Array.isArray(tree.children)) return '';
    const text = new Writer(options).blocks(tree.children, '\n\n', 0);
    return text === '' ? '' : `${text}\n`;
  } catch {
    return '';
  }
}
