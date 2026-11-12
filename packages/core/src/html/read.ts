/**
 * Untrusted HTML → `texuli-md/v1` AST (ADR-034). The tokenizer output goes through a tolerant tree
 * builder (implied end tags for `p`, `li`, `dt`/`dd`, table rows and cells; unmatched end tags
 * ignored; a depth cap) and then onto the AST's closed vocabulary. Nothing is ever parsed by a
 * browser, inserted into a DOM or evaluated; the result is plain data.
 *
 * Mapping (the allowlist): `p`, `h1`–`h6`, `blockquote`, `ul`/`ol`/`li`, `pre` (+ `code`), `hr`,
 * `table` rows and cells, `strong`/`b`, `em`/`i`, `del`/`s`/`strike`, `u`/`ins`, `code`/`kbd`/
 * `samp`/`tt`, `a`, `img`, `br`, spoilers (`span.spoiler`, `[data-spoiler]`, `tg-spoiler`),
 * mentions (`span[data-mention]`), task items (`li[data-task]` or a leading checkbox `input`) and
 * footnotes (`a[data-footnote-ref]`, `section[data-footnotes]`), which is the vocabulary
 * `core/markdown-html` writes, so its output reads back to the same tree.
 *
 * Loss rules:
 * - Dropped with their content (`html-dropped`): `script`, `style`, `iframe`, `svg`, `math`,
 *   `template`, `textarea`, `select`, `button`, `object`, `audio`, `video`, `canvas` and the rest of
 *   `RAW_DROPPED`; `plaintext` drops the rest of the input. Comments and doctypes are skipped.
 * - Every other element is transparent: its text is kept, its tag is not. Every attribute outside
 *   the mapping (event handlers, `style`, `srcset`, ids, classes…) is gone.
 * - A link whose URL the policy refuses at `trust` keeps its text (`url-refused`); a refused image
 *   becomes its `alt` text. Kept URLs are the policy's normalized form.
 * - Whitespace collapses as HTML renders it: a run with a line break becomes `\n` (a soft break),
 *   any other run one space; runs at block edges are trimmed. `pre` keeps its text exactly.
 * - Block content inside an inline element or a heading, cell or link is flattened to inline text.
 * - Inline formatting that spans block boundaries is closed at the block (no adoption agency).
 * - A table's first row is its header row; `caption` becomes a paragraph before the table.
 * - Every code block reads back fenced (`fenced: true`), with no `meta`.
 * - Nesting past `MARKDOWN_LIMITS.blockDepth` blocks or `MARKDOWN_LIMITS.inlineDepth` inlines is
 *   flattened to text (`depth-limit`); input past `maxSource` is cut (`source-truncated`); trees
 *   stop at `MARKDOWN_LIMITS.nodes` nodes (`node-limit`).
 * - The reader never throws on input.
 */
import {
  MARKDOWN_AST_VERSION,
  MARKDOWN_LIMITS,
  type MarkdownReadResult,
  type MdAlign,
  type MdBlock,
  type MdInline,
  type MdList,
  type MdListItem,
  type MdRoot,
  type MdTableRow,
} from '../markdown/ast.ts';
import { type HrefTrust, safeHref } from '../url/safe-href.ts';
import { safeImageSrc } from '../url-policy/safe-image-src.ts';
import { resolveTrust } from '../url-policy/trust.ts';
import { DiagnosticList } from './diagnostics.ts';
import { type HtmlAttributes, tokenizeHtml } from './tokenize.ts';

export interface HtmlReadOptions {
  /** URL policy tier for links and images. Default `untrusted`; anything else than `developer` is `untrusted`. */
  trust?: HrefTrust;
  /** Longest input read; may only lower `MARKDOWN_LIMITS.source`. */
  maxSource?: number;
  /** The id prefix `core/markdown-html` wrote (footnotes). Default `user-content-`. */
  idPrefix?: string;
}

/** Deepest element nesting the tree builder keeps; deeper start tags are read as transparent. */
export const HTML_MAX_ELEMENT_DEPTH = MARKDOWN_LIMITS.blockDepth + MARKDOWN_LIMITS.inlineDepth;

interface Element {
  readonly name: string;
  readonly attributes: HtmlAttributes;
  readonly children: Node[];
  readonly start: number;
}

type Node = Element | string;

const VOID = new Set(
  'area base br col embed hr img input link meta param source track wbr keygen'.split(' ')
);

/** Start tags that close an open `p` (the HTML "closes a p element" list). */
const CLOSES_P = new Set(
  (
    'address article aside blockquote center details dialog dir div dl fieldset figcaption figure ' +
    'footer form h1 h2 h3 h4 h5 h6 header hgroup hr li dd dt main menu nav ol p pre section ' +
    'summary table ul search'
  ).split(' ')
);

/** Elements an end tag search never crosses unless it names them. */
const SCOPE = new Set(['table', 'td', 'th', 'caption', 'html', 'body']);

const HEADINGS = new Set(['h1', 'h2', 'h3', 'h4', 'h5', 'h6']);

/** Elements read as blocks (everything else is inline). */
const BLOCK = new Set(
  (
    'address article aside blockquote body center details dialog dir div dl dd dt fieldset ' +
    'figcaption figure footer form h1 h2 h3 h4 h5 h6 header hgroup hr html legend li main menu ' +
    'nav ol p pre search section summary table caption thead tbody tfoot tr td th ul'
  ).split(' ')
);

const STRONG = new Set(['strong', 'b']);
const EMPHASIS = new Set(['em', 'i']);
const DELETE = new Set(['del', 's', 'strike']);
const UNDERLINE = new Set(['u', 'ins']);
const CODE = new Set(['code', 'kbd', 'samp', 'tt']);

type Rec = Record<string, unknown>;

/** Build a loose element tree from the tokens (the tolerant part). */
function buildTree(source: string, diagnostics: DiagnosticList): Element {
  const root: Element = { name: '#root', attributes: {}, children: [], start: 0 };
  const stack: Element[] = [root];
  /** Start tags past the depth cap, by name, so their end tags are ignored too. */
  const overflow = new Map<string, number>();
  let nodes = 0;
  let stopped = false;

  const current = () => stack[stack.length - 1] as Element;
  const popTo = (index: number) => {
    stack.length = index;
  };
  /** Index of the nearest open `name`, searching down to (not across) a `boundary` element. */
  const find = (names: ReadonlySet<string>, boundary: ReadonlySet<string>): number => {
    for (let i = stack.length - 1; i > 0; i -= 1) {
      const name = (stack[i] as Element).name;
      if (names.has(name)) return i;
      if (boundary.has(name)) return -1;
    }
    return -1;
  };
  const count = (): boolean => {
    if (stopped) return false;
    nodes += 1;
    if (nodes > MARKDOWN_LIMITS.nodes) {
      stopped = true;
      diagnostics.add(
        'node-limit',
        `More than ${MARKDOWN_LIMITS.nodes} nodes; the rest is left out.`
      );
      return false;
    }
    return true;
  };

  for (const token of tokenizeHtml(source)) {
    if (stopped) break;
    if (token.kind === 'text') {
      if (!count()) break;
      current().children.push(token.value);
      continue;
    }
    if (token.kind === 'dropped') {
      diagnostics.add('html-dropped', `<${token.name}> dropped with its content.`, {
        start: token.start,
        end: token.end,
      });
      continue;
    }
    if (token.kind === 'end') {
      const name = token.name;
      const pending = overflow.get(name) ?? 0;
      if (pending > 0) {
        overflow.set(name, pending - 1);
        continue;
      }
      if (name === 'br') {
        // `</br>` is read as `<br>`, as browsers do.
        if (count())
          current().children.push({ name: 'br', attributes: {}, children: [], start: token.start });
        continue;
      }
      const at = find(new Set([name]), SCOPE.has(name) ? new Set(['html']) : SCOPE);
      if (at > 0) popTo(at);
      continue;
    }
    // Start tag.
    const name = token.name;
    if (CLOSES_P.has(name)) {
      const p = find(new Set(['p']), SCOPE);
      if (p > 0) popTo(p);
    }
    if (HEADINGS.has(name) && HEADINGS.has(current().name)) stack.pop();
    if (name === 'li') {
      const li = find(new Set(['li']), new Set([...SCOPE, 'ul', 'ol', 'menu', 'dir']));
      if (li > 0) popTo(li);
    } else if (name === 'dt' || name === 'dd') {
      const item = find(new Set(['dt', 'dd']), new Set([...SCOPE, 'dl']));
      if (item > 0) popTo(item);
    } else if (name === 'td' || name === 'th') {
      const cell = find(new Set(['td', 'th']), new Set(['table', 'tr', 'html']));
      if (cell > 0) popTo(cell);
    } else if (name === 'tr') {
      const row = find(new Set(['tr']), new Set(['table', 'thead', 'tbody', 'tfoot', 'html']));
      if (row > 0) popTo(row);
    } else if (name === 'thead' || name === 'tbody' || name === 'tfoot') {
      const section = find(new Set(['thead', 'tbody', 'tfoot']), new Set(['table', 'html']));
      if (section > 0) popTo(section);
    }
    if (!count()) break;
    const element: Element = {
      name,
      attributes: token.attributes,
      children: [],
      start: token.start,
    };
    if (VOID.has(name)) {
      current().children.push(element);
      continue;
    }
    if (stack.length > HTML_MAX_ELEMENT_DEPTH) {
      if (!diagnostics.has('depth-limit'))
        diagnostics.add(
          'depth-limit',
          `Elements nested deeper than ${HTML_MAX_ELEMENT_DEPTH} levels are read as their text.`,
          { start: token.start, end: token.end }
        );
      if (!token.selfClosing) overflow.set(name, (overflow.get(name) ?? 0) + 1);
      continue;
    }
    current().children.push(element);
    // A self-closing flag on a non-void element is ignored in HTML.
    stack.push(element);
  }
  return root;
}

const isElement = (node: Node): node is Element => typeof node !== 'string';

/** The text of an element tree, without recursion (`br` becomes a newline). */
function textContent(node: Node): string {
  const out: string[] = [];
  const stack: Node[] = [node];
  while (stack.length > 0) {
    const current = stack.pop() as Node;
    if (typeof current === 'string') {
      out.push(current);
      continue;
    }
    if (current.name === 'br') out.push('\n');
    else if (current.name === 'img') out.push(current.attributes.alt ?? '');
    for (let i = current.children.length - 1; i >= 0; i -= 1)
      stack.push(current.children[i] as Node);
  }
  return out.join('');
}

function classes(element: Element): string[] {
  return (element.attributes.class ?? '').split(/\s+/).filter(Boolean);
}

/** Collapse an HTML whitespace run: `\n` when it holds a line break, else one space. */
function collapse(text: string): string {
  return text.replace(/[ \t\n\f\r]+/g, (run) => (run.includes('\n') ? '\n' : ' '));
}

function cleanIdPrefix(prefix: unknown): string {
  if (typeof prefix !== 'string') return 'user-content-';
  return prefix.toLowerCase().replace(/[^a-z0-9-]/g, '');
}

class Reader {
  private readonly trust: HrefTrust;
  private readonly idPrefix: string;
  private readonly footnotes: MdBlock[] = [];
  private readonly footnoteLabels = new Set<string>();

  private readonly diagnostics: DiagnosticList;

  constructor(options: HtmlReadOptions, diagnostics: DiagnosticList) {
    this.diagnostics = diagnostics;
    this.trust = resolveTrust(options.trust ?? 'untrusted');
    this.idPrefix = cleanIdPrefix(options.idPrefix ?? 'user-content-');
  }

  root(tree: Element): MdRoot {
    const children = this.flow(tree.children, 0);
    return {
      type: 'root',
      version: MARKDOWN_AST_VERSION,
      children: [...children, ...this.footnotes],
    };
  }

  /** Mixed content → blocks: runs of inline content become paragraphs. */
  private flow(children: readonly Node[], depth: number): MdBlock[] {
    const out: MdBlock[] = [];
    let run: Node[] = [];
    const flush = () => {
      if (run.length === 0) return;
      const inlines = finishInlines(this.inlines(run, 0));
      run = [];
      if (inlines.length > 0) out.push({ type: 'paragraph', children: inlines });
    };
    for (const child of children) {
      if (!isElement(child) || !BLOCK.has(child.name)) {
        run.push(child);
        continue;
      }
      flush();
      for (const block of this.block(child, depth)) out.push(block);
    }
    flush();
    return out;
  }

  private block(element: Element, depth: number): MdBlock[] {
    if (depth >= MARKDOWN_LIMITS.blockDepth) {
      this.diagnostics.add(
        'depth-limit',
        `Blocks nested deeper than ${MARKDOWN_LIMITS.blockDepth} levels are read as text.`,
        { start: element.start, end: element.start }
      );
      const value = collapse(textContent(element)).trim();
      return value === '' ? [] : [{ type: 'paragraph', children: [{ type: 'text', value }] }];
    }
    const next = depth + 1;
    switch (element.name) {
      case 'p': {
        const inlines = finishInlines(this.inlines(element.children, 0));
        return inlines.length > 0 ? [{ type: 'paragraph', children: inlines }] : [];
      }
      case 'h1':
      case 'h2':
      case 'h3':
      case 'h4':
      case 'h5':
      case 'h6':
        return [
          {
            type: 'heading',
            depth: Number(element.name[1]) as 1 | 2 | 3 | 4 | 5 | 6,
            children: finishInlines(this.inlines(element.children, 0)),
          },
        ];
      case 'hr':
        return [{ type: 'thematicBreak' }];
      case 'blockquote':
        return [{ type: 'blockquote', children: this.flow(element.children, next) }];
      case 'ul':
      case 'ol':
      case 'menu':
      case 'dir':
        return [this.list(element, next)];
      case 'li':
        // A stray item outside a list is read as a one-item list.
        return [this.list({ ...element, name: 'ul', children: [element] }, next)];
      case 'pre':
        return [this.code(element)];
      case 'table':
        return this.table(element);
      case 'section':
        if (Object.hasOwn(element.attributes, 'data-footnotes')) {
          this.footnoteSection(element, next);
          return [];
        }
        return this.flow(element.children, depth);
      default:
        // Transparent block containers (div, section, article, figure, dl, dt, dd…).
        return this.flow(element.children, depth);
    }
  }

  private list(element: Element, depth: number): MdList {
    const ordered = element.name === 'ol';
    const items: { item: Element; blocks: MdBlock[]; checked?: boolean; paragraphs: boolean }[] =
      [];
    let loose = false;
    for (const child of element.children) {
      // Content between items (text, stray elements) joins the previous item or is dropped.
      if (!isElement(child) || child.name !== 'li') {
        if (isElement(child) && (child.name === 'ul' || child.name === 'ol')) {
          const last = items[items.length - 1];
          if (last) last.blocks.push(...this.block(child, depth));
        }
        continue;
      }
      const { content, checked } = this.taskMarker(child);
      const paragraphs = content.some((node) => isElement(node) && node.name === 'p');
      if (paragraphs) loose = true;
      const entry = { item: child, blocks: this.flow(content, depth), paragraphs };
      items.push(checked === undefined ? entry : { ...entry, checked });
    }
    const children: MdListItem[] = items.map(({ blocks, checked }) => {
      const spread = loose && blocks.length > 1;
      return checked === undefined
        ? { type: 'listItem', spread, children: blocks }
        : { type: 'listItem', spread, checked, children: blocks };
    });
    if (!ordered) return { type: 'list', ordered: false, spread: loose, children };
    const raw = element.attributes.start ?? '';
    const start = /^-?[0-9]{1,9}$/.test(raw.trim()) ? Number(raw.trim()) : 1;
    return { type: 'list', ordered: true, start, spread: loose, children };
  }

  /** Read and remove a task marker: `li[data-task]` with its marker span, or a leading checkbox. */
  private taskMarker(item: Element): { content: Node[]; checked?: boolean } {
    let checked: boolean | undefined;
    const task = item.attributes['data-task'];
    if (task === 'checked' || task === 'unchecked') checked = task === 'checked';
    const strip = (nodes: readonly Node[], allowCheckbox: boolean): Node[] => {
      const out: Node[] = [];
      let leading = true;
      for (const node of nodes) {
        if (isElement(node)) {
          if (node.name === 'span' && classes(node).includes('task-list-marker')) continue;
          if (leading && allowCheckbox && node.name === 'input') {
            if ((node.attributes.type ?? '').toLowerCase() === 'checkbox' && checked === undefined)
              checked = Object.hasOwn(node.attributes, 'checked');
            continue;
          }
          if (leading && node.name === 'p') {
            out.push({ ...node, children: strip(node.children, allowCheckbox) });
            leading = false;
            continue;
          }
          leading = false;
        } else if (node.trim() !== '') leading = false;
        out.push(node);
      }
      return out;
    };
    const content = strip(item.children, true);
    return checked === undefined ? { content } : { content, checked };
  }

  private code(element: Element): MdBlock {
    const significant = element.children.filter((n) => !(typeof n === 'string' && n.trim() === ''));
    const only = significant.length === 1 ? significant[0] : undefined;
    let lang: string | undefined;
    if (only !== undefined && isElement(only) && only.name === 'code') {
      for (const name of classes(only)) {
        const match = /^(?:language|lang)-(.+)$/.exec(name);
        if (match?.[1]) {
          lang = match[1];
          break;
        }
      }
    }
    let value = textContent(
      only !== undefined && isElement(only) && only.name === 'code' ? only : element
    );
    if (value.startsWith('\n')) value = value.slice(1);
    if (value.endsWith('\n')) value = value.slice(0, -1);
    return lang === undefined
      ? { type: 'code', value, fenced: true }
      : { type: 'code', lang, value, fenced: true };
  }

  private table(element: Element): MdBlock[] {
    const rows: Element[] = [];
    const before: MdBlock[] = [];
    const visit = (node: Element) => {
      for (const child of node.children) {
        if (!isElement(child)) continue;
        if (child.name === 'tr') rows.push(child);
        else if (child.name === 'thead' || child.name === 'tbody' || child.name === 'tfoot')
          visit(child);
        else if (child.name === 'caption') {
          const inlines = finishInlines(this.inlines(child.children, 0));
          if (inlines.length > 0) before.push({ type: 'paragraph', children: inlines });
        } else if (child.name === 'td' || child.name === 'th') {
          // Cells without a row: one implied row.
          rows.push({ name: 'tr', attributes: {}, children: [child], start: child.start });
        }
      }
    };
    visit(element);
    if (rows.length === 0) return before;
    const align: MdAlign[] = [];
    const tableRows: MdTableRow[] = rows.map((row, rowIndex) => {
      const cells = row.children.filter(
        (c): c is Element => isElement(c) && (c.name === 'td' || c.name === 'th')
      );
      if (rowIndex === 0) for (const cell of cells) align.push(cellAlign(cell.attributes));
      return {
        type: 'tableRow',
        children: cells.map((cell) => ({
          type: 'tableCell',
          children: finishInlines(this.inlines(cell.children, 0)),
        })),
      };
    });
    return [...before, { type: 'table', align, children: tableRows }];
  }

  private footnoteSection(section: Element, depth: number): void {
    const prefix = `${this.idPrefix}fn-`;
    const visit = (node: Element) => {
      for (const child of node.children) {
        if (!isElement(child)) continue;
        if (child.name === 'li') {
          const id = child.attributes.id ?? '';
          if (!id.startsWith(prefix)) continue;
          const label = decodeLabel(id.slice(prefix.length));
          if (label === undefined || this.footnoteLabels.has(label)) continue;
          this.footnoteLabels.add(label);
          this.footnotes.push({
            type: 'footnoteDefinition',
            label,
            children: this.flow(child.children, depth),
          });
        } else if (child.name === 'ol' || child.name === 'ul') visit(child);
      }
    };
    visit(section);
  }

  private inlines(children: readonly Node[], depth: number): MdInline[] {
    const out: MdInline[] = [];
    for (const child of children) {
      if (typeof child === 'string') {
        out.push({ type: 'text', value: collapse(child) });
        continue;
      }
      for (const inline of this.inline(child, depth)) out.push(inline);
    }
    return out;
  }

  private inline(element: Element, depth: number): MdInline[] {
    if (depth >= MARKDOWN_LIMITS.inlineDepth) {
      this.diagnostics.add(
        'depth-limit',
        `Inline elements nested deeper than ${MARKDOWN_LIMITS.inlineDepth} levels are read as text.`,
        { start: element.start, end: element.start }
      );
      return [{ type: 'text', value: collapse(textContent(element)) }];
    }
    const next = depth + 1;
    const name = element.name;
    const inner = () => this.inlines(element.children, next);
    if (STRONG.has(name)) return [{ type: 'strong', children: inner() }];
    if (EMPHASIS.has(name)) return [{ type: 'emphasis', children: inner() }];
    if (DELETE.has(name)) return [{ type: 'delete', children: inner() }];
    if (UNDERLINE.has(name)) return [{ type: 'underline', children: inner() }];
    if (CODE.has(name)) return [{ type: 'inlineCode', value: textContent(element) }];
    if (name === 'tg-spoiler') return [{ type: 'spoiler', children: inner() }];
    if (name === 'br') return [{ type: 'break' }];
    if (name === 'img') return this.image(element);
    if (name === 'a') return this.link(element, next);
    if (name === 'input') return [];
    if (name === 'span') {
      const cls = classes(element);
      if (cls.includes('task-list-marker')) return [];
      if (Object.hasOwn(element.attributes, 'data-mention')) return [this.mention(element)];
      if (
        Object.hasOwn(element.attributes, 'data-spoiler') ||
        cls.includes('spoiler') ||
        cls.includes('tg-spoiler')
      )
        return [{ type: 'spoiler', children: inner() }];
    }
    // Blocks inside inline content are flattened onto their own line; every other element is
    // transparent.
    if (BLOCK.has(name))
      return [{ type: 'text', value: '\n' }, ...inner(), { type: 'text', value: '\n' }];
    return inner();
  }

  private link(element: Element, depth: number): MdInline[] {
    const attributes = element.attributes;
    if (Object.hasOwn(attributes, 'data-footnote-backref')) return [];
    if (Object.hasOwn(attributes, 'data-footnote-ref')) {
      const href = attributes.href ?? '';
      const prefix = `#${this.idPrefix}fn-`;
      const label = href.startsWith(prefix) ? decodeLabel(href.slice(prefix.length)) : undefined;
      if (label !== undefined) return [{ type: 'footnoteReference', label }];
    }
    const children = this.inlines(element.children, depth);
    if (!Object.hasOwn(attributes, 'href')) return children;
    const url = safeHref(attributes.href, this.trust);
    if (url === undefined) {
      this.diagnostics.add('url-refused', 'Link URL refused by the URL policy; text kept.', {
        start: element.start,
        end: element.start,
      });
      return children;
    }
    const title = attributes.title;
    return [
      title !== undefined && title !== ''
        ? { type: 'link', url, title, children }
        : { type: 'link', url, children },
    ];
  }

  private image(element: Element): MdInline[] {
    const attributes = element.attributes;
    const alt = attributes.alt ?? '';
    const url = safeImageSrc(attributes.src ?? '', this.trust);
    if (url === undefined) {
      this.diagnostics.add('url-refused', 'Image URL refused by the URL policy; alt text kept.', {
        start: element.start,
        end: element.start,
      });
      return alt === '' ? [] : [{ type: 'text', value: alt }];
    }
    const title = attributes.title;
    return [
      title !== undefined && title !== ''
        ? { type: 'image', url, alt, title }
        : { type: 'image', url, alt },
    ];
  }

  private mention(element: Element): MdInline {
    const raw = element.attributes['data-mention'] ?? '';
    const kind =
      (['user', 'channel', 'role', 'everyone', 'here'] as const).find((k) => k === raw) ?? 'user';
    if (kind === 'everyone' || kind === 'here') return { type: 'mention', kind };
    const id = element.attributes['data-mention-id'];
    const shown = collapse(textContent(element)).trim().replace(/^[@#]/, '');
    const label = shown !== '' && shown !== id ? shown : undefined;
    const node: Rec = { type: 'mention', kind };
    if (id !== undefined && id !== '') node.id = id;
    if (label !== undefined) node.label = label;
    return node as unknown as MdInline;
  }
}

function decodeLabel(part: string): string | undefined {
  try {
    return decodeURIComponent(part);
  } catch {
    return undefined;
  }
}

function cellAlign(attributes: HtmlAttributes): MdAlign {
  const direct = (attributes.align ?? '').trim().toLowerCase();
  if (direct === 'left' || direct === 'center' || direct === 'right') return direct;
  const style = /text-align\s*:\s*(left|center|right)\b/i.exec(attributes.style ?? '');
  return style?.[1] ? (style[1].toLowerCase() as MdAlign) : null;
}

type InlineParent = Extract<MdInline, { children: readonly MdInline[] }>;

const hasChildren = (node: MdInline): node is InlineParent =>
  'children' in node && Array.isArray((node as InlineParent).children);

/**
 * Normalize a paragraph-level inline list: merge adjacent text, collapse whitespace across element
 * boundaries (a run after a space or a hard break is dropped), trim the edges (also inside the
 * first and last formatting node), and drop empty text and empty formatting. Recurses only as deep
 * as the inline tree, which the reader caps.
 */
function finishInlines(nodes: readonly MdInline[]): MdInline[] {
  const merged = mergeText(nodes);
  collapseAcross(merged, { space: true });
  trimEdge(merged, 'start');
  trimEdge(merged, 'end');
  return dropEmpty(merged);
}

function mergeText(nodes: readonly MdInline[]): MdInline[] {
  const out: MdInline[] = [];
  for (const node of nodes) {
    const last = out[out.length - 1];
    if (node.type === 'text' && last?.type === 'text') {
      out[out.length - 1] = { type: 'text', value: last.value + node.value };
      continue;
    }
    if (node.type === 'break' && last?.type === 'text')
      out[out.length - 1] = { type: 'text', value: last.value.replace(/[ \n]+$/, '') };
    out.push(
      hasChildren(node) ? ({ ...node, children: mergeText(node.children) } as MdInline) : node
    );
  }
  return out;
}

/** Walk the text in document order; `state.space` is whether the last character shown was a space. */
function collapseAcross(nodes: MdInline[], state: { space: boolean }): void {
  for (let i = 0; i < nodes.length; i += 1) {
    const node = nodes[i] as MdInline;
    if (node.type === 'text') {
      let value = node.value.replace(/[ \n]{2,}/g, (run) => (run.includes('\n') ? '\n' : ' '));
      if (state.space) value = value.replace(/^[ \n]+/, '');
      nodes[i] = { type: 'text', value };
      if (value !== '') state.space = /[ \n]$/.test(value);
      continue;
    }
    if (node.type === 'break') {
      state.space = true;
      continue;
    }
    if (hasChildren(node)) {
      const children = [...node.children];
      collapseAcross(children, state);
      nodes[i] = { ...node, children } as MdInline;
      continue;
    }
    state.space = false;
  }
}

function trimEdge(nodes: MdInline[], edge: 'start' | 'end'): void {
  let list = nodes;
  // Walk into the first (or last) formatting node until a text or leaf is reached.
  for (let guard = 0; guard < MARKDOWN_LIMITS.inlineDepth + 2; guard += 1) {
    const index = edge === 'start' ? 0 : list.length - 1;
    const node = list[index];
    if (node === undefined) return;
    if (node.type === 'text') {
      const value =
        edge === 'start' ? node.value.replace(/^[ \n]+/, '') : node.value.replace(/[ \n]+$/, '');
      list[index] = { type: 'text', value };
      if (value !== '') return;
      list.splice(index, 1);
      continue;
    }
    if (!hasChildren(node)) return;
    const children = [...node.children];
    list[index] = { ...node, children } as MdInline;
    list = children;
  }
}

function dropEmpty(nodes: readonly MdInline[]): MdInline[] {
  const out: MdInline[] = [];
  for (const node of nodes) {
    if (node.type === 'text' && node.value === '') continue;
    if (hasChildren(node)) {
      const children = dropEmpty(node.children);
      if (children.length === 0) continue;
      out.push({ ...node, children } as MdInline);
    } else out.push(node);
  }
  return out;
}

/**
 * Read untrusted HTML into a `texuli-md/v1` tree. Never throws: a non-string input gives an empty
 * tree with an `unsupported-construct` diagnostic.
 */
export function htmlToMarkdownTree(
  html: string,
  options: HtmlReadOptions = {}
): MarkdownReadResult {
  const diagnostics = new DiagnosticList();
  const empty: MdRoot = { type: 'root', version: MARKDOWN_AST_VERSION, children: [] };
  if (typeof html !== 'string') {
    diagnostics.add('unsupported-construct', 'HTML input is not a string.');
    return { tree: empty, diagnostics: diagnostics.finish() };
  }
  const limit =
    typeof options.maxSource === 'number' && options.maxSource >= 0
      ? Math.min(Math.floor(options.maxSource), MARKDOWN_LIMITS.source)
      : MARKDOWN_LIMITS.source;
  let source = html;
  if (source.length > limit) {
    source = source.slice(0, limit);
    diagnostics.add('source-truncated', `HTML input cut at ${limit} characters.`, {
      start: limit,
      end: html.length,
    });
  }
  const tree = buildTree(source, diagnostics);
  const root = new Reader(options, diagnostics).root(tree);
  return { tree: root, diagnostics: diagnostics.finish() };
}
