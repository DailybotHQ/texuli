/**
 * `texuli-md/v1` AST → HTML (ADR-034). Every element is built with `el` from `core/markup` and
 * written by `serializeHtml`, so there is no raw-markup path: text and attribute values are
 * escaped, names are checked against `HTML_ELEMENTS`, and every `href` and `src` is a `MarkupUrl`
 * made by `linkUrl` / `imageUrl` at the caller's trust tier.
 *
 * Output rules (each is a loss rule a reader of this HTML must know):
 * - `html` nodes (raw HTML from Markdown) are never emitted as markup. `rawHtml: 'drop'` (default)
 *   removes them with an `html-dropped` diagnostic; `rawHtml: 'escape'` writes their source as
 *   text (a block becomes a `<p>`).
 * - A link whose URL the policy refuses renders its children without the `<a>` and reports
 *   `url-refused`; a refused image renders its `alt` text.
 * - `definition` nodes are not rendered: links in the tree already carry their URL.
 * - Footnote definitions move to one closing `<section data-footnotes>`, numbered in definition
 *   order; a reference to an unknown label stays the literal text `[^label]`.
 * - `code.meta` is not written; `code.fenced` is not visible in HTML.
 * - Every id the output carries starts with `idPrefix` (default `user-content-`), so untrusted
 *   content cannot clobber the host page's ids or globals.
 * - Trees deeper than `MARKDOWN_LIMITS.blockDepth + MARKDOWN_LIMITS.inlineDepth` keep their text
 *   below the cut as plain text (`depth-limit`); past `MARKDOWN_LIMITS.nodes` nodes the rest is
 *   left out (`node-limit`). A node of an unknown type is skipped (`unsupported-construct`).
 * - The writer never throws on a tree, whatever its shape.
 */
import { DiagnosticList } from '../html/diagnostics.ts';
import type {
  MarkdownDiagnostic,
  MarkdownDiagnosticCode,
  MdAlign,
  MdPosition,
  MdRoot,
} from '../markdown/ast.ts';
import { MARKDOWN_LIMITS } from '../markdown/ast.ts';
import {
  el,
  escapeMarkupText,
  imageUrl,
  linkUrl,
  type MarkupAttributeValue,
  type MarkupChild,
  type MarkupElement,
  type MarkupNode,
  serializeHtml,
} from '../markup/markup.ts';
import type { HrefTrust } from '../url/safe-href.ts';
import { resolveTrust } from '../url-policy/trust.ts';

export interface MarkdownHtmlOptions {
  /** URL policy tier for every `href` and `src`. Default `untrusted`; anything else than `developer` is `untrusted`. */
  trust?: HrefTrust;
  /** What to do with raw `html` nodes: `drop` (default) or `escape` (write the source as text). */
  rawHtml?: 'drop' | 'escape';
  /** Prefix of every id and fragment link the output carries. Default `user-content-`; reduced to `[a-z0-9-]`. */
  idPrefix?: string;
  /**
   * `rel` on links. Default `nofollow noopener noreferrer` at the `untrusted` tier and none at the
   * `developer` tier; `false` writes none.
   */
  linkRel?: string | false;
}

export interface MarkdownHtmlResult {
  /** The HTML fragment. */
  readonly html: string;
  readonly diagnostics: readonly MarkdownDiagnostic[];
}

export interface MarkdownMarkupResult {
  /** The fragment as `core/markup` nodes, for hosts that embed it in a larger markup tree. */
  readonly nodes: readonly MarkupNode[];
  readonly diagnostics: readonly MarkdownDiagnostic[];
}

/** Deepest nesting the writer renders as elements; deeper content is written as plain text. */
export const MARKDOWN_HTML_MAX_DEPTH = MARKDOWN_LIMITS.blockDepth + MARKDOWN_LIMITS.inlineDepth;

const DEFAULT_ID_PREFIX = 'user-content-';
const UNTRUSTED_REL = 'nofollow noopener noreferrer';
const LANG = /^[A-Za-z0-9_+#.-]{1,64}$/;

type Rec = Record<string, unknown>;

const isRecord = (value: unknown): value is Rec => typeof value === 'object' && value !== null;
const str = (value: unknown): string => (typeof value === 'string' ? value : '');
const kids = (node: Rec): readonly unknown[] =>
  Array.isArray(node.children) ? (node.children as unknown[]) : [];

function positionOf(node: Rec): MdPosition | undefined {
  const p = node.position;
  if (!isRecord(p) || typeof p.start !== 'number' || typeof p.end !== 'number') return undefined;
  return { start: p.start, end: p.end };
}

/** Plain text of a subtree, collected without recursion (used past the depth cut). */
function plainText(node: unknown): string {
  const out: string[] = [];
  const stack: unknown[] = [node];
  let seen = 0;
  while (stack.length > 0 && seen < MARKDOWN_LIMITS.nodes) {
    const current = stack.pop();
    seen += 1;
    if (!isRecord(current)) continue;
    if (current.type === 'text' || current.type === 'inlineCode' || current.type === 'code')
      out.push(str(current.value));
    else if (current.type === 'image') out.push(str(current.alt));
    else if (current.type === 'break') out.push('\n');
    const children = kids(current);
    for (let i = children.length - 1; i >= 0; i -= 1) stack.push(children[i]);
  }
  return out.join('');
}

/** Whether rendered children hold no element and no non-empty text. */
function isEmptyContent(children: readonly MarkupChild[]): boolean {
  const stack: MarkupChild[] = [...children];
  while (stack.length > 0) {
    const child = stack.pop();
    if (child === null || child === undefined || child === false || child === '') continue;
    if (Array.isArray(child)) stack.push(...child);
    else return false;
  }
  return true;
}

/** An id-safe form of a footnote label: percent-encoded, so `decodeURIComponent` reads it back. */
export function footnoteIdPart(label: string): string {
  // A lone surrogate makes encodeURIComponent throw; read it as U+FFFD first (T-md-security F5).
  const wellFormed = label.replace(
    /[\ud800-\udbff](?![\udc00-\udfff])|(?<![\ud800-\udbff])[\udc00-\udfff]/g,
    '\ufffd'
  );
  return encodeURIComponent(wellFormed).replace(
    /[!'()*]/g,
    (c) => `%${c.charCodeAt(0).toString(16)}`
  );
}

function cleanPrefix(prefix: unknown): string {
  if (typeof prefix !== 'string') return DEFAULT_ID_PREFIX;
  return prefix.toLowerCase().replace(/[^a-z0-9-]/g, '');
}

const ALIGN: Record<string, string> = { left: 'left', center: 'center', right: 'right' };

class Writer {
  private readonly trust: HrefTrust;
  private readonly rawHtml: 'drop' | 'escape';
  private readonly idPrefix: string;
  private readonly rel: string | undefined;
  private readonly diagnosticList = new DiagnosticList();
  readonly diagnostics = {
    add: (code: MarkdownDiagnosticCode, message: string, node?: Rec) =>
      this.diagnosticList.add(code, message, node ? positionOf(node) : undefined),
    finish: () => this.diagnosticList.finish(),
  };
  private nodes = 0;
  private stopped = false;
  /** Footnote label → 1-based number, in definition order. */
  private readonly footnoteNumbers = new Map<string, number>();
  private readonly footnoteDefinitions: Rec[] = [];

  constructor(options: MarkdownHtmlOptions) {
    this.trust = resolveTrust(options.trust ?? 'untrusted');
    this.rawHtml = options.rawHtml === 'escape' ? 'escape' : 'drop';
    this.idPrefix = cleanPrefix(options.idPrefix ?? DEFAULT_ID_PREFIX);
    const rel =
      options.linkRel === undefined
        ? this.trust === 'untrusted'
          ? UNTRUSTED_REL
          : undefined
        : options.linkRel === false
          ? undefined
          : String(options.linkRel);
    this.rel = rel === '' ? undefined : rel;
  }

  render(tree: unknown): MarkupChild[] {
    if (!isRecord(tree) || tree.type !== 'root') {
      this.diagnostics.add('unsupported-construct', 'The tree is not a texuli-md/v1 root.');
      return [];
    }
    this.collectFootnotes(tree);
    const out = this.blocks(kids(tree), 1);
    const section = this.footnoteSection();
    if (section) out.push(section, '\n');
    return out;
  }

  /** Find footnote definitions anywhere in the tree (iteratively), keeping definition order. */
  private collectFootnotes(tree: Rec): void {
    const stack: unknown[] = [...kids(tree)].reverse();
    let seen = 0;
    while (stack.length > 0 && seen < MARKDOWN_LIMITS.nodes) {
      const node = stack.pop();
      seen += 1;
      if (!isRecord(node)) continue;
      if (node.type === 'footnoteDefinition') {
        const label = str(node.label);
        if (!this.footnoteNumbers.has(label)) {
          this.footnoteNumbers.set(label, this.footnoteNumbers.size + 1);
          this.footnoteDefinitions.push(node);
        }
        continue;
      }
      const children = kids(node);
      for (let i = children.length - 1; i >= 0; i -= 1) stack.push(children[i]);
    }
  }

  private footnoteSection(): MarkupElement | null {
    if (this.footnoteDefinitions.length === 0) return null;
    const items: MarkupChild[] = ['\n'];
    for (const definition of this.footnoteDefinitions) {
      const id = footnoteIdPart(str(definition.label));
      const backref = linkUrl(`#${this.idPrefix}fnref-${id}`, this.trust);
      const back = backref
        ? el(
            'a',
            { href: backref, 'data-footnote-backref': true, 'aria-label': 'Back to reference' },
            '↩'
          )
        : null;
      const content = this.blocks(kids(definition), 2);
      items.push(el('li', { id: `${this.idPrefix}fn-${id}` }, '\n', content, back), '\n');
    }
    return el(
      'section',
      { 'data-footnotes': true, class: 'footnotes' },
      '\n',
      el('ol', {}, items),
      '\n'
    );
  }

  /** Count a node; false once past the node limit. */
  private take(node: Rec): boolean {
    if (this.stopped) return false;
    this.nodes += 1;
    if (this.nodes > MARKDOWN_LIMITS.nodes) {
      this.stopped = true;
      this.diagnostics.add(
        'node-limit',
        `The tree has more than ${MARKDOWN_LIMITS.nodes} nodes; the rest is left out.`,
        node
      );
      return false;
    }
    return true;
  }

  /**
   * Blocks of a container in the CommonMark reference layout: each block starts on its own line
   * and is followed by a newline. In a tight list item a paragraph is written as its bare inline
   * content.
   */
  private blocks(children: readonly unknown[], depth: number, tight = false): MarkupChild[] {
    const out: MarkupChild[] = [];
    for (const child of children) {
      if (!isRecord(child)) continue;
      const rendered = this.block(child, depth, tight);
      if (rendered === null) continue;
      if (tight && child.type === 'paragraph') {
        out.push(rendered);
        continue;
      }
      if (tight && (out.length === 0 || out[out.length - 1] !== '\n')) out.push('\n');
      out.push(rendered, '\n');
    }
    return out;
  }

  private block(node: Rec, depth: number, tight: boolean): MarkupChild | null {
    if (!this.take(node)) return null;
    if (depth > MARKDOWN_HTML_MAX_DEPTH) {
      this.diagnostics.add(
        'depth-limit',
        `Content nested deeper than ${MARKDOWN_HTML_MAX_DEPTH} levels is written as plain text.`,
        node
      );
      return el('p', {}, plainText(node));
    }
    const next = depth + 1;
    switch (node.type) {
      case 'paragraph': {
        const content = this.inlines(kids(node), next);
        // A paragraph whose content was all dropped (raw HTML, refused images without alt) writes
        // nothing, not `<p></p>`, so the output reads back to the same layout (T-md-security).
        if (isEmptyContent(content)) return null;
        return tight ? content : el('p', {}, content);
      }
      case 'heading': {
        const level = typeof node.depth === 'number' ? Math.trunc(node.depth) : 1;
        const clamped = Math.min(6, Math.max(1, Number.isFinite(level) ? level : 1));
        return el(`h${clamped}`, {}, this.inlines(kids(node), next));
      }
      case 'thematicBreak':
        return el('hr');
      case 'blockquote':
        return el('blockquote', {}, '\n', this.blocks(kids(node), next));
      case 'list':
        return this.list(node, next);
      case 'code':
        return this.code(node);
      case 'html':
        return this.rawBlock(node);
      case 'table':
        return this.table(node, next);
      case 'definition':
        return null;
      case 'footnoteDefinition':
        // Written in the closing footnotes section.
        return null;
      default:
        this.diagnostics.add(
          'unsupported-construct',
          `Unknown block node ${JSON.stringify(String(node.type)).slice(0, 80)} skipped.`,
          node
        );
        return null;
    }
  }

  private list(node: Rec, depth: number): MarkupElement {
    const ordered = node.ordered === true;
    const items = kids(node).filter(isRecord);
    const loose = node.spread === true || items.some((item) => item.spread === true);
    const attributes: Record<string, MarkupAttributeValue> = {};
    if (ordered && typeof node.start === 'number' && Number.isSafeInteger(node.start)) {
      if (node.start !== 1) attributes.start = node.start;
    }
    const out: MarkupChild[] = ['\n'];
    for (const item of items) {
      if (!this.take(item)) break;
      out.push(this.listItem(item, depth + 1, loose), '\n');
    }
    return el(ordered ? 'ol' : 'ul', attributes, out);
  }

  private listItem(item: Rec, depth: number, loose: boolean): MarkupElement {
    const attributes: Record<string, MarkupAttributeValue> = {};
    const content: MarkupChild[] = [];
    if (typeof item.checked === 'boolean') {
      attributes.class = 'task-list-item';
      attributes['data-task'] = item.checked ? 'checked' : 'unchecked';
      content.push(el('span', { class: 'task-list-marker' }, item.checked ? '☑' : '☐'), ' ');
    }
    const children = kids(item);
    if (loose) {
      // An item whose blocks all wrote nothing reads back the same tight or loose: write it alike.
      const blocks = this.blocks(children, depth);
      if (blocks.length > 0) content.push('\n', blocks);
    } else content.push(this.blocks(children, depth, true));
    return el('li', attributes, content);
  }

  private code(node: Rec): MarkupElement {
    const value = str(node.value);
    const lang = str(node.lang);
    const attributes: Record<string, MarkupAttributeValue> = {};
    if (lang !== '' && LANG.test(lang)) attributes.class = `language-${lang}`;
    return el('pre', {}, el('code', attributes, value === '' ? '' : `${value}\n`));
  }

  private rawBlock(node: Rec): MarkupChild | null {
    if (this.rawHtml === 'escape') return el('p', {}, str(node.value).replace(/\n+$/, ''));
    this.diagnostics.add('html-dropped', 'Raw HTML block dropped.', node);
    return null;
  }

  private table(node: Rec, depth: number): MarkupElement {
    const align = Array.isArray(node.align) ? (node.align as readonly MdAlign[]) : [];
    const rows = kids(node).filter(isRecord);
    const row = (r: Rec, cell: 'th' | 'td'): MarkupElement => {
      const cells: MarkupChild[] = ['\n'];
      kids(r)
        .filter(isRecord)
        .forEach((c, index) => {
          if (!this.take(c)) return;
          const a = align[index];
          const attributes: Record<string, MarkupAttributeValue> = {};
          if (typeof a === 'string' && ALIGN[a]) attributes.align = ALIGN[a];
          cells.push(el(cell, attributes, this.inlines(kids(c), depth + 2)), '\n');
        });
      return el('tr', {}, cells);
    };
    const [head, ...body] = rows;
    const parts: MarkupChild[] = ['\n'];
    if (head && this.take(head)) parts.push(el('thead', {}, '\n', row(head, 'th'), '\n'), '\n');
    if (body.length > 0) {
      const bodyRows: MarkupChild[] = ['\n'];
      for (const r of body) {
        if (!this.take(r)) break;
        bodyRows.push(row(r, 'td'), '\n');
      }
      parts.push(el('tbody', {}, bodyRows), '\n');
    }
    return el('table', {}, parts);
  }

  private inlines(children: readonly unknown[], depth: number): MarkupChild[] {
    const out: MarkupChild[] = [];
    for (const child of children) {
      if (!isRecord(child)) continue;
      const rendered = this.inline(child, depth);
      if (rendered !== null) out.push(rendered);
    }
    return out;
  }

  private inline(node: Rec, depth: number): MarkupChild | null {
    if (!this.take(node)) return null;
    if (depth > MARKDOWN_HTML_MAX_DEPTH) {
      this.diagnostics.add(
        'depth-limit',
        `Content nested deeper than ${MARKDOWN_HTML_MAX_DEPTH} levels is written as plain text.`,
        node
      );
      return plainText(node);
    }
    const next = depth + 1;
    switch (node.type) {
      case 'text':
        return str(node.value);
      case 'emphasis':
        return el('em', {}, this.inlines(kids(node), next));
      case 'strong':
        return el('strong', {}, this.inlines(kids(node), next));
      case 'delete':
        return el('del', {}, this.inlines(kids(node), next));
      case 'underline':
        return el('u', {}, this.inlines(kids(node), next));
      case 'spoiler':
        return el(
          'span',
          { class: 'spoiler', 'data-spoiler': true },
          this.inlines(kids(node), next)
        );
      case 'inlineCode':
        return el('code', {}, str(node.value));
      case 'break':
        return [el('br'), '\n'];
      case 'link':
        return this.link(node, next);
      case 'image':
        return this.image(node);
      case 'footnoteReference':
        return this.footnoteReference(node);
      case 'mention':
        return this.mention(node);
      case 'html':
        if (this.rawHtml === 'escape') return str(node.value);
        this.diagnostics.add('html-dropped', 'Raw inline HTML dropped.', node);
        return null;
      default:
        this.diagnostics.add(
          'unsupported-construct',
          `Unknown inline node ${JSON.stringify(String(node.type)).slice(0, 80)} skipped.`,
          node
        );
        return null;
    }
  }

  private link(node: Rec, depth: number): MarkupChild {
    const content = this.inlines(kids(node), depth);
    const href = linkUrl(str(node.url), this.trust);
    if (!href) {
      this.diagnostics.add('url-refused', 'Link URL refused by the URL policy; label kept.', node);
      return content;
    }
    const attributes: Record<string, MarkupAttributeValue> = { href };
    const title = str(node.title);
    if (title !== '') attributes.title = title;
    if (this.rel) attributes.rel = this.rel;
    return el('a', attributes, content);
  }

  private image(node: Rec): MarkupChild {
    const alt = str(node.alt);
    const src = imageUrl(str(node.url), this.trust);
    if (!src) {
      this.diagnostics.add(
        'url-refused',
        'Image URL refused by the URL policy; alt text kept.',
        node
      );
      return alt;
    }
    const attributes: Record<string, MarkupAttributeValue> = { src, alt };
    const title = str(node.title);
    if (title !== '') attributes.title = title;
    return el('img', attributes);
  }

  private footnoteReference(node: Rec): MarkupChild {
    const label = str(node.label);
    const number = this.footnoteNumbers.get(label);
    const href =
      number === undefined
        ? null
        : linkUrl(`#${this.idPrefix}fn-${footnoteIdPart(label)}`, this.trust);
    if (number === undefined || !href) return `[^${label}]`;
    return el(
      'sup',
      {},
      el(
        'a',
        {
          href,
          id: `${this.idPrefix}fnref-${footnoteIdPart(label)}`,
          'data-footnote-ref': true,
        },
        String(number)
      )
    );
  }

  private mention(node: Rec): MarkupElement {
    const kind = str(node.kind);
    const id = str(node.id);
    const label = str(node.label);
    const known = ['user', 'channel', 'role', 'everyone', 'here'].includes(kind) ? kind : 'user';
    const shown =
      known === 'everyone' || known === 'here'
        ? `@${known}`
        : `${known === 'channel' ? '#' : '@'}${label || id}`;
    const attributes: Record<string, MarkupAttributeValue> = { 'data-mention': known };
    if (id !== '') attributes['data-mention-id'] = id;
    return el('span', attributes, shown);
  }
}

/**
 * Render a `texuli-md/v1` tree as `core/markup` nodes (the fragment's top-level nodes, with the
 * newline text nodes between blocks).
 */
export function markdownTreeToMarkup(
  tree: MdRoot,
  options: MarkdownHtmlOptions = {}
): MarkdownMarkupResult {
  const writer = new Writer(options);
  const wrapper = el('div', {}, writer.render(tree as unknown));
  return { nodes: wrapper.children, diagnostics: writer.diagnostics.finish() };
}

/** Render a `texuli-md/v1` tree as a safe HTML fragment. Never throws on a tree. */
export function markdownTreeToHtml(
  tree: MdRoot,
  options: MarkdownHtmlOptions = {}
): MarkdownHtmlResult {
  const { nodes, diagnostics } = markdownTreeToMarkup(tree, options);
  let html = '';
  for (const node of nodes) {
    html += node.kind === 'text' ? escapeMarkupText(node.value) : serializeHtml(node);
  }
  return { html, diagnostics };
}
