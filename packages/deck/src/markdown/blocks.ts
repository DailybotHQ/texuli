/**
 * The block reader: one slide's lines → a flat list of nodes with source
 * positions. It recognizes the dialect's block constructs (headings,
 * paragraphs, lists, quotes, pipe tables, image lines, rules, code and math
 * fences, `:::` directives, attribute comments and `Note:`), refuses HTML,
 * and keeps inline text as the Markdown string `@texuli/blocks` paints. One
 * pass; every loop advances at least one line.
 */
import { LINK_HREF_PATTERN, MEDIA_SRC_PATTERN } from '../model/shared.ts';
import { type Attr, readAttributes } from './attributes.ts';
import type { IssueSink } from './issues.ts';
import { DECK_MARKDOWN_LIMITS } from './limits.ts';
import type { Line } from './scan.ts';

export interface Src {
  line: number;
  column: number;
}

/** Attributes from an `.element` comment or a brace list, with where they were written. */
export interface Attrs {
  list: Attr[];
  src: Src;
}

interface Base {
  src: Src;
  /** `.element` attributes (trailing or on the next line). */
  attrs?: Attrs;
}

export interface ListItemNode {
  text: string;
  src: Src;
  attrs?: Attrs;
}

export interface TableRowNode {
  cells: string[];
  src: Src;
  attrs?: Attrs;
}

export type MdNode =
  | (Base & { kind: 'heading'; level: number; text: string })
  | (Base & { kind: 'paragraph'; text: string })
  | (Base & { kind: 'list'; ordered: boolean; items: ListItemNode[] })
  | (Base & { kind: 'quote'; text: string; cite?: string })
  | (Base & { kind: 'table'; header: string[]; rows: TableRowNode[] })
  | (Base & { kind: 'image'; alt: string; url: string; title?: string })
  | (Base & { kind: 'rule' })
  | (Base & {
      kind: 'code';
      lang?: string;
      highlights?: string[];
      brace?: Attrs;
      code: string;
    })
  | (Base & { kind: 'math'; tex: string })
  | (Base & {
      kind: 'directive';
      name: string;
      arg?: string;
      brace?: Attrs;
      /** JSON directives: the raw body and the line it starts on. */
      body?: string;
      bodyLine?: number;
      /** Region directives: the nodes inside. */
      children?: MdNode[];
    });

export interface SlideSource {
  nodes: MdNode[];
  /** `<!-- .slide: … -->` attributes, in order. */
  slideAttrs: Attr[];
  notes?: { text: string; src: Src };
}

/** Directives whose body is one JSON value. */
export const JSON_DIRECTIVES = new Set(['component', 'block', 'custom', 'props', 'slide', 'chart']);
/** Directives whose body is Markdown (layout regions). */
export const REGION_DIRECTIVES = new Set(['left', 'right', 'card', 'video']);

const HEADING = /^ {0,3}(#{1,6})(?:[ \t]+(.*?))?[ \t]*$/;
const RULE = /^ {0,3}(?:\*[ \t]*){3,}$|^ {0,3}(?:_[ \t]*){3,}$/;
const BULLET = /^( {0,3})([-*+])[ \t]+(.*)$/;
const ORDERED = /^( {0,3})(\d{1,9})([.)])[ \t]+(.*)$/;
const QUOTE = /^ {0,3}>[ ]?(.*)$/;
const FENCE = /^( {0,3})(`{3,}|~{3,})(.*)$/;
const MATH_OPEN = /^ {0,3}\$\$[ \t]*$/;
const MATH_LINE = /^ {0,3}\$\$(.+)\$\$[ \t]*$/;
const DIRECTIVE = /^ {0,3}:::[ \t]*([A-Za-z][A-Za-z0-9-]*)?(.*)$/;
const DIRECTIVE_CLOSE = /^ {0,3}:::[ \t]*$/;
const NOTE = /^(?:Notes?|notes?):(?:[ \t]?(.*))?$/;
/**
 * Notes lines the writer escapes with a leading `\`: separators and fence
 * openers, which the slide splitter would otherwise read.
 */
export const NOTE_ESCAPED = /^\\(?=-{2,}[ \t]*$| {0,3}(?::::|`{3}|~{3}|\$\$))/;
const IMAGE_LINE = /^ {0,3}!\[([^\]]*)\]\(\s*<?([^\s<>]*)>?(?:\s+"([^"]*)")?\s*\)[ \t]*$/;
const TABLE_ROW = /^ {0,3}\|/;
const ALIGN_ROW = /^ {0,3}\|?[ \t]*:?-+:?[ \t]*(?:\|[ \t]*:?-+:?[ \t]*)*\|?[ \t]*$/;
const HTML_LINE = /^ {0,3}<[A-Za-z/!?]/;
const AUTOLINK = /^ {0,3}<(?:https?:\/\/|mailto:)/i;
const LINE_SPEC = /^\d{1,4}(?:-\d{1,4})?(?:,\d{1,4}(?:-\d{1,4})?)*$/;
const LANG = /^[a-z][a-z0-9+-]{0,31}$/;

const LINK_HREF = new RegExp(LINK_HREF_PATTERN, 'u');
const MEDIA_SRC = new RegExp(MEDIA_SRC_PATTERN, 'u');

/** True for an HTML tag at the start of a line (comments and autolinks are not tags). */
function isHtmlLine(text: string): boolean {
  return HTML_LINE.test(text) && !text.trimStart().startsWith('<!--') && !AUTOLINK.test(text);
}

/** Split a trailing `<!-- .element: … -->` off a line. */
function trailingElement(text: string): { text: string; attrs: string; column: number } | null {
  const at = text.lastIndexOf('<!--');
  if (at <= 0) return null;
  const tail = /^<!--[ \t]*\.element:(.*)-->[ \t]*$/.exec(text.slice(at));
  if (!tail || (tail[1] ?? '').includes('-->')) return null;
  return {
    text: text.slice(0, at).replace(/[ \t]+$/, ''),
    attrs: tail[1] ?? '',
    column: at + 1 + text.slice(at).indexOf(':') + 1,
  };
}

class Reader {
  readonly lines: Line[];
  readonly sink: IssueSink;
  i = 0;
  slideAttrs: Attr[] = [];
  notes: { text: string; src: Src } | undefined;

  constructor(lines: Line[], sink: IssueSink) {
    this.lines = lines;
    this.sink = sink;
  }

  src(line: Line, column = 1): Src {
    return { line: line.n, column };
  }

  /** Read element attributes from comment text at `line`/`column`. */
  elementAttrs(text: string, line: number, column: number): Attrs {
    return { list: readAttributes(text, line, column, this.sink), src: { line, column } };
  }

  /** Read nodes until the end, or until a bare `:::` when `inRegion`. */
  nodes(depth: number, inRegion: boolean): { nodes: MdNode[]; closed: boolean } {
    const out: MdNode[] = [];
    while (this.i < this.lines.length) {
      const line = this.lines[this.i] as Line;
      const text = line.text;
      if (text.trim() === '') {
        this.i++;
        continue;
      }
      if (DIRECTIVE_CLOSE.test(text)) {
        this.i++;
        if (inRegion) return { nodes: out, closed: true };
        this.sink.report('md-region-unknown', 'A `:::` closes nothing.', this.src(line));
        continue;
      }
      if (!inRegion) {
        const note = NOTE.exec(text);
        if (note) {
          this.readNotes(note[1] ?? '', line);
          return { nodes: out, closed: false };
        }
      }
      const trimmed = text.trimStart();
      if (trimmed.startsWith('<!--')) {
        this.comment(line, out, inRegion);
        continue;
      }
      if (isHtmlLine(text)) {
        const iframe = /^<\/?iframe\b/i.test(trimmed);
        this.sink.report(
          iframe ? 'md-iframe-refused' : 'md-html-refused',
          iframe ? 'iframes are refused.' : 'Raw HTML is refused; this line renders nothing.',
          this.src(line, text.length - trimmed.length + 1),
          [],
          iframe
            ? 'Place a catalog component with `::: component <id>` instead.'
            : 'Use Markdown, a `layout` with `:::` regions, or `::: component <id>`.'
        );
        this.i++;
        continue;
      }
      const node = this.block(depth);
      if (node) out.push(node);
    }
    if (inRegion) return { nodes: out, closed: false };
    return { nodes: out, closed: true };
  }

  readNotes(first: string, line: Line): void {
    const parts = [first];
    for (this.i++; this.i < this.lines.length; this.i++) {
      parts.push((this.lines[this.i] as Line).text);
    }
    const text = parts
      .map((part) => part.replace(NOTE_ESCAPED, ''))
      .join('\n')
      .replace(/\s+$/, '');
    this.notes = { text, src: this.src(line) };
  }

  comment(line: Line, out: MdNode[], inRegion: boolean): void {
    const text = line.text.trim();
    const kind = /^<!--[ \t]*\.(slide|element):/.exec(text);
    if (kind) {
      const close = text.lastIndexOf('-->');
      const head = kind[0].length;
      const column = line.text.indexOf('<!--') + 1;
      if (close < head || !text.endsWith('-->')) {
        this.sink.report(
          'md-attr-value',
          `An \`.${kind[1]}\` comment must open and close on one line.`,
          this.src(line, column)
        );
        this.i++;
        return;
      }
      const body = text.slice(head, close);
      const bodyColumn = column + head;
      if (kind[1] === 'slide') {
        if (inRegion) {
          this.sink.report(
            'md-attr-value',
            '`.slide` attributes belong at the top level of a slide, not inside a region.',
            this.src(line, column)
          );
        } else this.slideAttrs.push(...readAttributes(body, line.n, bodyColumn, this.sink));
      } else {
        const target = out[out.length - 1];
        if (!target) {
          this.sink.report(
            'md-element-orphan',
            'This `.element` comment has no element before it.',
            this.src(line, column),
            [],
            'Put it at the end of the element’s line, or on the line right after the element.'
          );
        } else this.attach(target, this.elementAttrs(body, line.n, bodyColumn));
      }
      this.i++;
      return;
    }
    // A plain comment: dropped, possibly over several lines.
    for (let j = this.i; j < this.lines.length; j++) {
      const candidate = (this.lines[j] as Line).text;
      const from = j === this.i ? candidate.indexOf('<!--') + 4 : 0;
      if (candidate.indexOf('-->', from) !== -1) {
        this.i = j + 1;
        return;
      }
    }
    this.sink.report(
      'md-comment-unclosed',
      'This comment never closes; the rest of the slide was dropped.',
      this.src(line, line.text.indexOf('<!--') + 1),
      [],
      'Close the comment with `-->`.'
    );
    this.i = this.lines.length;
  }

  attach(target: MdNode, attrs: Attrs): void {
    if (target.attrs) {
      target.attrs.list.push(...attrs.list);
      return;
    }
    target.attrs = attrs;
  }

  /** Take a trailing element comment off the current line's text. */
  stripTrailing(line: Line): { text: string; attrs?: Attrs } {
    const tail = trailingElement(line.text);
    if (!tail) return { text: line.text };
    return { text: tail.text, attrs: this.elementAttrs(tail.attrs, line.n, tail.column) };
  }

  block(depth: number): MdNode | null {
    const line = this.lines[this.i] as Line;
    const text = line.text;

    const fence = FENCE.exec(text);
    if (fence && !((fence[2] ?? '').startsWith('`') && (fence[3] ?? '').includes('`'))) {
      return this.code(line, fence[1]?.length ?? 0, fence[2] ?? '```', fence[3] ?? '');
    }
    const mathLine = MATH_LINE.exec(text);
    if (mathLine) {
      this.i++;
      return { kind: 'math', tex: (mathLine[1] ?? '').trim(), src: this.src(line) };
    }
    if (MATH_OPEN.test(text)) return this.math(line);

    const directive = DIRECTIVE.exec(text);
    if (directive && /^ {0,3}:::/.test(text)) {
      return this.directive(line, directive[1] ?? '', directive[2] ?? '', depth);
    }

    const { text: content, attrs } = this.stripTrailing(line);

    const heading = HEADING.exec(content);
    if (heading) {
      this.i++;
      const value = heading[2] ?? '';
      const node: MdNode = {
        kind: 'heading',
        level: (heading[1] ?? '#').length,
        text: this.inline(value, line, content.indexOf(value) + 1),
        src: this.src(line),
      };
      if (/(?<!\\)(?:\*|_|`|\[)/.test(value)) {
        this.sink.report(
          'md-heading-inline',
          'Headings are plain text: Markdown inside a heading shows literally.',
          this.src(line),
          [],
          'Remove the emphasis, or escape it with a backslash.'
        );
      }
      if (attrs) node.attrs = attrs;
      return node;
    }
    if (RULE.test(content)) {
      this.i++;
      const node: MdNode = { kind: 'rule', src: this.src(line) };
      if (attrs) node.attrs = attrs;
      return node;
    }
    const image = IMAGE_LINE.exec(content);
    if (image) {
      this.i++;
      const url = image[2] ?? '';
      this.checkUrl(url, true, line, content.indexOf('](') + 3);
      const node: MdNode = { kind: 'image', alt: image[1] ?? '', url, src: this.src(line) };
      if (image[3] !== undefined) node.title = image[3];
      if (attrs) node.attrs = attrs;
      return node;
    }
    if (QUOTE.test(content)) return this.quote();
    if (BULLET.test(content) || ORDERED.test(content)) return this.list();
    if (TABLE_ROW.test(content) && ALIGN_ROW.test(this.lines[this.i + 1]?.text ?? '')) {
      return this.table();
    }
    return this.paragraph();
  }

  /** True when `text` starts a block other than a paragraph continuation. */
  startsBlock(text: string): boolean {
    return (
      text.trim() === '' ||
      FENCE.test(text) ||
      MATH_OPEN.test(text) ||
      MATH_LINE.test(text) ||
      /^ {0,3}:::/.test(text) ||
      HEADING.test(text) ||
      RULE.test(text) ||
      QUOTE.test(text) ||
      BULLET.test(text) ||
      ORDERED.test(text) ||
      TABLE_ROW.test(text) ||
      text.trimStart().startsWith('<!--') ||
      isHtmlLine(text) ||
      NOTE.test(text) ||
      IMAGE_LINE.test(text)
    );
  }

  paragraph(): MdNode {
    const first = this.lines[this.i] as Line;
    const parts: string[] = [];
    let attrs: Attrs | undefined;
    while (this.i < this.lines.length) {
      const line = this.lines[this.i] as Line;
      if (parts.length > 0 && this.startsBlock(line.text)) break;
      const stripped = this.stripTrailing(line);
      if (stripped.attrs) attrs = stripped.attrs;
      parts.push(
        this.inline(stripped.text.trim(), line, line.text.length - line.text.trimStart().length + 1)
      );
      this.i++;
      if (stripped.attrs) break;
    }
    const node: MdNode = { kind: 'paragraph', text: parts.join('\n'), src: this.src(first) };
    if (attrs) node.attrs = attrs;
    return node;
  }

  quote(): MdNode {
    const first = this.lines[this.i] as Line;
    const parts: string[] = [];
    let attrs: Attrs | undefined;
    while (this.i < this.lines.length) {
      const line = this.lines[this.i] as Line;
      const stripped = this.stripTrailing(line);
      const match = QUOTE.exec(stripped.text);
      if (!match) break;
      if (stripped.attrs) attrs = stripped.attrs;
      parts.push(this.inline(match[1] ?? '', line, stripped.text.indexOf('>') + 2));
      this.i++;
    }
    let cite: string | undefined;
    const last = parts[parts.length - 1] ?? '';
    const citeMatch = /^(?:—|--|-)[ \t]+(.+)$/.exec(last);
    if (citeMatch && parts.length > 1) {
      cite = citeMatch[1];
      parts.pop();
      while (parts.length > 0 && (parts[parts.length - 1] ?? '').trim() === '') parts.pop();
    }
    const node: MdNode = { kind: 'quote', text: parts.join('\n'), src: this.src(first) };
    if (cite !== undefined) node.cite = cite;
    if (attrs) node.attrs = attrs;
    return node;
  }

  list(): MdNode {
    const first = this.lines[this.i] as Line;
    const ordered = ORDERED.test(this.stripTrailing(first).text);
    const items: ListItemNode[] = [];
    while (this.i < this.lines.length) {
      const line = this.lines[this.i] as Line;
      const stripped = this.stripTrailing(line);
      const bullet = BULLET.exec(stripped.text);
      const numbered = ORDERED.exec(stripped.text);
      const match = ordered ? numbered : bullet;
      if (!match || RULE.test(stripped.text)) break;
      const content = (ordered ? match[4] : match[3]) ?? '';
      const markerWidth = match[0].length - content.length;
      const indent = markerWidth;
      const body: string[] = [this.inline(content, line, markerWidth + 1)];
      this.i++;
      // Continuation: indented lines (nested lists, wrapped text), and lazy
      // lines that start no other block.
      while (this.i < this.lines.length) {
        const next = (this.lines[this.i] as Line).text;
        if (next.trim() === '') {
          const after = this.lines[this.i + 1]?.text ?? '';
          if (/^ {2,}\S/.test(after)) {
            body.push('');
            this.i++;
            continue;
          }
          break;
        }
        if (/^ {2,}\S/.test(next) && !DIRECTIVE_CLOSE.test(next)) {
          const spaces = next.length - next.trimStart().length;
          const cut = Math.min(spaces, markerWidth);
          body.push(this.inline(next.slice(cut), this.lines[this.i] as Line, cut + 1));
          this.i++;
          continue;
        }
        if (this.startsBlock(next)) break;
        body.push(this.inline(next.trim(), this.lines[this.i] as Line, 1));
        this.i++;
      }
      const item: ListItemNode = { text: body.join('\n'), src: this.src(line, indent + 1) };
      if (stripped.attrs) item.attrs = stripped.attrs;
      items.push(item);
    }
    return { kind: 'list', ordered, items, src: this.src(first) };
  }

  table(): MdNode {
    const first = this.lines[this.i] as Line;
    const header = splitCells(this.stripTrailing(first).text).map((cell) =>
      this.inline(cell, first, 1)
    );
    this.i += 2;
    const rows: TableRowNode[] = [];
    while (this.i < this.lines.length) {
      const line = this.lines[this.i] as Line;
      const stripped = this.stripTrailing(line);
      if (!TABLE_ROW.test(stripped.text)) break;
      const row: TableRowNode = {
        cells: splitCells(stripped.text).map((cell) => this.inline(cell, line, 1)),
        src: this.src(line),
      };
      if (stripped.attrs) row.attrs = stripped.attrs;
      rows.push(row);
      this.i++;
    }
    return { kind: 'table', header, rows, src: this.src(first) };
  }

  code(line: Line, indent: number, marker: string, info: string): MdNode {
    this.i++;
    const char = marker[0] ?? '`';
    const body: string[] = [];
    let closed = false;
    while (this.i < this.lines.length) {
      const text = (this.lines[this.i] as Line).text;
      const close = /^ {0,3}(`{3,}|~{3,})[ \t]*$/.exec(text);
      if (close?.[1] !== undefined && close[1][0] === char && close[1].length >= marker.length) {
        this.i++;
        closed = true;
        break;
      }
      const spaces = text.length - text.trimStart().length;
      body.push(text.slice(Math.min(spaces, indent)));
      this.i++;
    }
    if (!closed) {
      this.sink.report(
        'md-code-unclosed',
        'This code fence never closes; it runs to the end of the slide.',
        this.src(line, indent + 1),
        [],
        `Close it with a ${marker} line.`
      );
    }
    const node: MdNode = { kind: 'code', code: body.join('\n'), src: this.src(line, indent + 1) };
    this.codeInfo(node as MdNode & { kind: 'code' }, info, line, indent + marker.length + 1);
    return node;
  }

  codeInfo(node: MdNode & { kind: 'code' }, info: string, line: Line, column: number): void {
    let rest = info;
    let at = column;
    const skip = () => {
      const trimmed = rest.replace(/^[ \t]+/, '');
      at += rest.length - trimmed.length;
      rest = trimmed;
    };
    skip();
    const lang = /^[^\s[{]+/.exec(rest)?.[0];
    if (lang !== undefined) {
      if (LANG.test(lang)) node.lang = lang;
      else {
        this.sink.report(
          'md-code-info',
          `"${lang.slice(0, 32)}" is not a language id; it was dropped.`,
          { line: line.n, column: at },
          [],
          'Use a lowercase id such as ts, js, py or sql.'
        );
      }
      rest = rest.slice(lang.length);
      at += lang.length;
      skip();
    }
    if (rest.startsWith('[')) {
      const end = rest.indexOf(']');
      if (end === -1) {
        this.sink.report('md-code-steps', 'The `[` of the highlight steps never closes.', {
          line: line.n,
          column: at,
        });
        rest = '';
      } else {
        this.codeSteps(node, rest.slice(1, end), line.n, at);
        rest = rest.slice(end + 1);
        at += end + 1;
        skip();
      }
    }
    if (rest.startsWith('{') && rest.trimEnd().endsWith('}')) {
      const inner = rest.trimEnd().slice(1, -1);
      node.brace = {
        list: readAttributes(inner, line.n, at + 1, this.sink, true),
        src: { line: line.n, column: at },
      };
      rest = '';
    }
    if (rest.trim() !== '') {
      this.sink.report(
        'md-code-info',
        'Unread text after the code fence language; it was dropped.',
        { line: line.n, column: at },
        [],
        'Write ```lang [1-2|4-6] {filename="x.ts"}.'
      );
    }
  }

  codeSteps(node: MdNode & { kind: 'code' }, raw: string, line: number, column: number): void {
    let steps = raw;
    const offset = /^\s*\d+\s*:/.exec(steps);
    if (offset) {
      this.sink.report(
        'md-code-offset-unsupported',
        'A `[n: …]` line offset is not supported; it was dropped.',
        { line, column }
      );
      steps = steps.slice(offset[0].length);
    }
    const parts = steps.split('|').map((part) => part.replace(/\s+/g, ''));
    if (parts.length > DECK_MARKDOWN_LIMITS.codeSteps) {
      this.sink.report(
        'md-code-steps',
        `A code fence has at most ${DECK_MARKDOWN_LIMITS.codeSteps} highlight steps.`,
        { line, column }
      );
      return;
    }
    for (const part of parts) {
      if (!LINE_SPEC.test(part)) {
        this.sink.report(
          'md-code-steps',
          `"${part.slice(0, 40)}" is not a line range list such as 1-2,4.`,
          { line, column },
          [],
          'Write steps as [1-2|4-6|8].'
        );
        return;
      }
    }
    if (parts.length > 0 && !(parts.length === 1 && parts[0] === '')) node.highlights = parts;
  }

  math(line: Line): MdNode {
    this.i++;
    const body: string[] = [];
    let closed = false;
    while (this.i < this.lines.length) {
      const text = (this.lines[this.i] as Line).text;
      this.i++;
      if (MATH_OPEN.test(text)) {
        closed = true;
        break;
      }
      body.push(text);
    }
    if (!closed) {
      this.sink.report(
        'md-math-unclosed',
        'This `$$` block never closes; it runs to the end of the slide.',
        this.src(line),
        [],
        'Close it with a `$$` line.'
      );
    }
    return { kind: 'math', tex: body.join('\n').trim(), src: this.src(line) };
  }

  directive(line: Line, name: string, rest: string, depth: number): MdNode {
    const column = line.text.indexOf(':::') + 1;
    const src = this.src(line, column);
    this.i++;
    let tail = rest.trim();
    let brace: Attrs | undefined;
    const braceAt = tail.indexOf('{');
    if (braceAt !== -1 && tail.endsWith('}')) {
      const inner = tail.slice(braceAt + 1, -1);
      const innerColumn = line.text.indexOf('{', column) + 2;
      brace = {
        list: readAttributes(inner, line.n, innerColumn, this.sink, true),
        src: { line: line.n, column: innerColumn - 1 },
      };
      tail = tail.slice(0, braceAt).trim();
    }
    const node: MdNode & { kind: 'directive' } = { kind: 'directive', name, src };
    if (tail !== '') node.arg = tail;
    if (brace) node.brace = brace;

    if (JSON_DIRECTIVES.has(name)) {
      const body: string[] = [];
      let closed = false;
      const bodyLine = this.lines[this.i]?.n ?? line.n + 1;
      while (this.i < this.lines.length) {
        const text = (this.lines[this.i] as Line).text;
        this.i++;
        if (DIRECTIVE_CLOSE.test(text)) {
          closed = true;
          break;
        }
        body.push(text);
      }
      if (!closed) this.unclosed(name, src);
      node.body = body.join('\n');
      node.bodyLine = bodyLine;
      return node;
    }
    if (REGION_DIRECTIVES.has(name)) {
      if (depth + 1 >= DECK_MARKDOWN_LIMITS.directiveDepth) {
        this.sink.report(
          'md-directive-depth',
          'A region cannot hold another region.',
          src,
          [],
          'Close the outer region first; regions only hold Markdown and JSON fences.'
        );
      }
      const inner = this.nodes(depth + 1, true);
      if (!inner.closed) this.unclosed(name, src);
      node.children = inner.nodes;
      return node;
    }
    this.sink.report(
      'md-region-unknown',
      name === ''
        ? 'A `:::` directive needs a name.'
        : `Unknown directive "::: ${name.slice(0, 32)}".`,
      src,
      [],
      'Use a region (left, right, card, video) or a fence (component, block, chart, custom, props, slide).'
    );
    // Skip to its closer so its body is not read as slide content.
    while (this.i < this.lines.length) {
      const text = (this.lines[this.i] as Line).text;
      this.i++;
      if (DIRECTIVE_CLOSE.test(text)) break;
    }
    return node;
  }

  unclosed(name: string, src: Src): void {
    this.sink.report(
      'md-region-unclosed',
      `"::: ${name}" never closes before the end of the slide.`,
      src,
      [],
      'Close it with a `:::` line.'
    );
  }

  /**
   * Check inline Markdown: raw HTML tags (outside code spans) are reported and
   * escaped so they stay text; link and image URLs get the syntax check;
   * images inside text are flagged (they render as alt text).
   */
  inline(text: string, line: Line, column: number): string {
    if (!text.includes('<') && !text.includes('](')) return text;
    let out = '';
    let i = 0;
    let start = 0;
    // A run length with no closer, or a missing `)`, stays missing further on:
    // remembering it keeps the scan linear on hostile input.
    const unmatched = new Set<number>();
    let lastBracket = -1;
    while (i < text.length) {
      const c = text[i];
      if (c === '`') {
        let run = 1;
        while (text[i + run] === '`') run++;
        const close = unmatched.has(run) ? -1 : text.indexOf('`'.repeat(run), i + run);
        if (close === -1) unmatched.add(run);
        i = close === -1 ? i + run : close + run;
        continue;
      }
      if (c === '\\') {
        i += 2;
        continue;
      }
      if (c === '<' && /[A-Za-z/!?]/.test(text[i + 1] ?? '')) {
        const auto = /^<(?:https?:\/\/|mailto:)[^\s<>]*>/i.exec(text.slice(i, i + 2100));
        if (auto) {
          this.checkUrl(auto[0].slice(1, -1), false, line, column + i + 1);
          i += auto[0].length;
          continue;
        }
        const iframe = /^<\/?iframe\b/i.test(text.slice(i, i + 8));
        this.sink.report(
          iframe ? 'md-iframe-refused' : 'md-html-refused',
          iframe ? 'iframes are refused.' : 'Inline HTML is refused; the tag stays literal text.',
          { line: line.n, column: column + i },
          [],
          'Use Markdown emphasis, links and code instead of tags.'
        );
        out += `${text.slice(start, i)}\\<`;
        i++;
        start = i;
        continue;
      }
      if (c === ']' && text[i + 1] === '(') {
        // The destination: up to whitespace, `)` or `>` (each character read once).
        let j = i + 2;
        while (text[j] === ' ' || text[j] === '<') j++;
        const from = j;
        while (j < text.length && j - from < 2100 && !/[\s)<>]/.test(text[j] ?? '')) j++;
        const url = text.slice(from, j);
        const isImage = lastBracket > 0 && text[lastBracket - 1] === '!';
        if (isImage) {
          this.sink.report(
            'md-inline-image',
            'An image inside text renders as its alt text only.',
            { line: line.n, column: column + lastBracket - 1 },
            [],
            'Put the image on its own line.'
          );
        }
        this.checkUrl(url, isImage, line, column + from);
        i = Math.max(j, i + 2);
        continue;
      }
      if (c === '[') lastBracket = i;
      i++;
    }
    return start === 0 ? text : out + text.slice(start);
  }

  checkUrl(url: string, media: boolean, line: Line, column: number): void {
    if (url === '') return;
    const ok = media ? MEDIA_SRC.test(url) : LINK_HREF.test(url);
    if (ok) return;
    this.sink.report(
      'md-url-refused',
      media
        ? 'Media must be an https: URL, a relative path (no .. or .svg), a base64 data: raster or video, or an avatar: id.'
        : 'Links must be https:, mailto:, a #fragment or a relative path.',
      { line: line.n, column },
      [],
      'Use an allowed URL; javascript:, data:text/html and protocol-relative URLs are refused.'
    );
  }
}

/** Split a pipe-table row into trimmed cells (`\|` stays inside a cell). */
export function splitCells(row: string): string[] {
  let text = row.trim();
  if (text.startsWith('|')) text = text.slice(1);
  if (text.endsWith('|') && !text.endsWith('\\|')) text = text.slice(0, -1);
  const cells: string[] = [];
  let current = '';
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '\\' && text[i + 1] === '|') {
      current += '\\|';
      i++;
    } else if (c === '|') {
      cells.push(current.trim());
      current = '';
    } else current += c;
  }
  cells.push(current.trim());
  return cells;
}

/** Read one slide's lines into nodes, slide attributes and notes. */
export function readSlide(lines: Line[], sink: IssueSink): SlideSource {
  const reader = new Reader(lines, sink);
  const { nodes } = reader.nodes(0, false);
  const out: SlideSource = { nodes, slideAttrs: reader.slideAttrs };
  if (reader.notes) out.notes = reader.notes;
  return out;
}
