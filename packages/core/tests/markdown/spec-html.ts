/**
 * Test-only HTML writer in the reference renderers' exact shape (commonmark.js, and cmark-gfm
 * for the GFM extensions), so the spec suites can compare the AST against their expected HTML.
 * Raw HTML passes through here because the specs expect it; the product writer
 * (`core/markdown-html`, ADR-016) escapes or drops it.
 */
import type {
  MdBlock,
  MdFootnoteDefinition,
  MdInline,
  MdList,
  MdNode,
  MdRoot,
  MdTable,
} from '../../src/markdown/ast.ts';

const escapeXml = (text: string) =>
  text.replace(/[&<>"]/g, (c) =>
    c === '&' ? '&amp;' : c === '<' ? '&lt;' : c === '>' ? '&gt;' : '&quot;'
  );

const KEEP = /[A-Za-z0-9;/?:@&=+$,\-_.!~*'()#]/;

/** Percent-encode a destination like the reference renderer (mdurl `encode`, escapes kept). */
export function encodeUrl(url: string): string {
  let out = '';
  for (let i = 0; i < url.length; i++) {
    const c = url.charAt(i);
    const code = url.charCodeAt(i);
    if (c === '%' && /^[0-9a-fA-F]{2}$/.test(url.slice(i + 1, i + 3))) {
      out += url.slice(i, i + 3);
      i += 2;
    } else if (code < 0x80 && KEEP.test(c)) out += c;
    else if (code >= 0xd800 && code <= 0xdbff) {
      const low = url.charCodeAt(i + 1);
      if (low >= 0xdc00 && low <= 0xdfff) {
        out += encodeURIComponent(url.slice(i, i + 2));
        i++;
      } else out += '%EF%BF%BD';
    } else if (code >= 0xdc00 && code <= 0xdfff) out += '%EF%BF%BD';
    else out += encodeURIComponent(c);
  }
  return out;
}

export interface SpecHtmlOptions {
  /** Task checkbox markup: `spec` (GFM spec.txt) or `cmark` (cmark-gfm extensions.txt). */
  readonly checkbox?: 'spec' | 'cmark';
  /** Apply the GFM tag filter to raw HTML (`<title>`, `<script>`… become text). */
  readonly tagFilter?: boolean;
  /** cmark-gfm writes no `<strong>` directly inside another `<strong>` (a renderer rule). */
  readonly flatStrong?: boolean;
}

const TAG_FILTER =
  /<(?=\/?(?:title|textarea|style|xmp|iframe|noembed|noframes|script|plaintext)(?:[\s/>]|$))/gi;

interface FootnoteState {
  /** Definitions by label, in document order. */
  readonly definitions: Map<string, MdFootnoteDefinition>;
  /** Labels in order of first reference, with how many times each was referenced. */
  readonly order: string[];
  readonly counts: Map<string, number>;
}

class Writer {
  out = '';
  readonly options: SpecHtmlOptions;
  readonly footnotes: FootnoteState;
  constructor(options: SpecHtmlOptions, footnotes: FootnoteState) {
    this.options = options;
    this.footnotes = footnotes;
  }
  cr(): void {
    if (this.out !== '' && !this.out.endsWith('\n')) this.out += '\n';
  }
  raw(html: string): void {
    this.out += this.options.tagFilter ? html.replace(TAG_FILTER, '&lt;') : html;
  }
}

function inlines(w: Writer, nodes: readonly MdInline[], inStrong = false): void {
  for (const node of nodes) {
    switch (node.type) {
      case 'text':
        w.out += escapeXml(node.value);
        break;
      case 'break':
        w.out += '<br />';
        w.cr();
        break;
      case 'emphasis':
        w.out += '<em>';
        inlines(w, node.children);
        w.out += '</em>';
        break;
      case 'strong': {
        const tag = !(inStrong && w.options.flatStrong);
        if (tag) w.out += '<strong>';
        inlines(w, node.children, true);
        if (tag) w.out += '</strong>';
        break;
      }
      case 'delete':
        w.out += '<del>';
        inlines(w, node.children);
        w.out += '</del>';
        break;
      case 'inlineCode':
        w.out += `<code>${escapeXml(node.value)}</code>`;
        break;
      case 'html':
        w.raw(node.value);
        break;
      case 'link':
        w.out += `<a href="${escapeXml(encodeUrl(node.url))}"${node.title ? ` title="${escapeXml(node.title)}"` : ''}>`;
        inlines(w, node.children);
        w.out += '</a>';
        break;
      case 'image':
        w.out += `<img src="${escapeXml(encodeUrl(node.url))}" alt="${escapeXml(node.alt)}"${node.title ? ` title="${escapeXml(node.title)}"` : ''} />`;
        break;
      case 'footnoteReference': {
        const key = node.label.toUpperCase();
        let index = w.footnotes.order.indexOf(key);
        if (index < 0) {
          w.footnotes.order.push(key);
          index = w.footnotes.order.length - 1;
        }
        const count = (w.footnotes.counts.get(key) ?? 0) + 1;
        w.footnotes.counts.set(key, count);
        const id = encodeUrl(node.label);
        w.out += `<sup class="footnote-ref"><a href="#fn-${id}" id="fnref-${id}${count > 1 ? `-${count}` : ''}" data-footnote-ref>${index + 1}</a></sup>`;
        break;
      }
      default:
        break;
    }
  }
}

function blocks(w: Writer, nodes: readonly MdBlock[], tight: boolean): void {
  for (const node of nodes) block(w, node, tight);
}

function block(w: Writer, node: MdBlock, tight: boolean): void {
  switch (node.type) {
    case 'paragraph':
      if (tight) inlines(w, node.children);
      else {
        w.cr();
        w.out += '<p>';
        inlines(w, node.children);
        w.out += '</p>';
        w.cr();
      }
      break;
    case 'heading':
      w.cr();
      w.out += `<h${node.depth}>`;
      inlines(w, node.children);
      w.out += `</h${node.depth}>`;
      w.cr();
      break;
    case 'thematicBreak':
      w.cr();
      w.out += '<hr />';
      w.cr();
      break;
    case 'code':
      w.cr();
      w.out += `<pre><code${node.lang ? ` class="language-${escapeXml(node.lang)}"` : ''}>`;
      w.out += escapeXml(node.value === '' ? '' : `${node.value}\n`);
      w.out += '</code></pre>';
      w.cr();
      break;
    case 'html':
      w.cr();
      w.raw(node.value);
      w.cr();
      break;
    case 'blockquote':
      w.cr();
      w.out += '<blockquote>';
      w.cr();
      blocks(w, node.children, false);
      w.cr();
      w.out += '</blockquote>';
      w.cr();
      break;
    case 'list':
      list(w, node);
      break;
    case 'table':
      table(w, node);
      break;
    default:
      // Definitions render nothing; footnote definitions move to the end.
      break;
  }
}

function checkbox(w: Writer, checked: boolean): string {
  if (w.options.checkbox === 'spec')
    return `<input${checked ? ' checked=""' : ''} disabled="" type="checkbox"> `;
  return `<input type="checkbox"${checked ? ' checked=""' : ''} disabled="" /> `;
}

function list(w: Writer, node: MdList): void {
  const tag = node.ordered ? 'ol' : 'ul';
  w.cr();
  w.out +=
    node.ordered && node.start !== undefined && node.start !== 1
      ? `<ol start="${node.start}">`
      : `<${tag}>`;
  w.cr();
  for (const item of node.children) {
    w.out += '<li>';
    if (item.checked !== undefined) w.out += checkbox(w, item.checked);
    blocks(w, item.children, !node.spread);
    w.out += '</li>';
    w.cr();
  }
  w.cr();
  w.out += `</${tag}>`;
  w.cr();
}

function table(w: Writer, node: MdTable): void {
  w.cr();
  w.out += '<table>\n<thead>\n';
  node.children.forEach((row, index) => {
    if (index === 1) w.out += '<tbody>\n';
    const cell = index === 0 ? 'th' : 'td';
    w.out += '<tr>\n';
    row.children.forEach((child, column) => {
      const align = node.align[column];
      w.out += `<${cell}${align ? ` align="${align}"` : ''}>`;
      inlines(w, child.children);
      w.out += `</${cell}>\n`;
    });
    w.out += '</tr>\n';
    if (index === 0) w.out += '</thead>\n';
  });
  if (node.children.length > 1) w.out += '</tbody>\n';
  w.out += '</table>\n';
}

/** Footnote definitions anywhere in the tree, by upper-cased label (first one wins). */
function collectFootnotes(tree: MdRoot): Map<string, MdFootnoteDefinition> {
  const found = new Map<string, MdFootnoteDefinition>();
  const stack: MdNode[] = [tree];
  while (stack.length > 0) {
    const node = stack.pop() as MdNode;
    if (node.type === 'footnoteDefinition' && !found.has(node.label.toUpperCase()))
      found.set(node.label.toUpperCase(), node);
    if ('children' in node) stack.push(...[...(node.children as MdNode[])].reverse());
  }
  return found;
}

function backrefs(index: number, id: string, count: number): string {
  const refs: string[] = [];
  for (let n = 1; n <= count; n++) {
    const suffix = n > 1 ? `-${n}` : '';
    const idx = n > 1 ? `${index}-${n}` : `${index}`;
    refs.push(
      `<a href="#fnref-${id}${suffix}" class="footnote-backref" data-footnote-backref data-footnote-backref-idx="${idx}" aria-label="Back to reference ${idx}">↩${n > 1 ? `<sup class="footnote-ref">${n}</sup>` : ''}</a>`
    );
  }
  return refs.join(' ');
}

function footnoteSection(w: Writer): void {
  if (w.footnotes.order.length === 0) return;
  w.cr();
  w.out += '<section class="footnotes" data-footnotes>\n<ol>\n';
  // Footnotes referenced only from inside other footnotes are numbered as they appear.
  for (let i = 0; i < w.footnotes.order.length; i++) {
    const key = w.footnotes.order[i] as string;
    const definition = w.footnotes.definitions.get(key);
    if (!definition) continue;
    const id = encodeUrl(definition.label);
    w.out += `<li id="fn-${id}">\n`;
    const refs = backrefs(i + 1, id, w.footnotes.counts.get(key) ?? 1);
    const children = definition.children;
    const last = children[children.length - 1];
    if (last?.type === 'paragraph') {
      blocks(w, children.slice(0, -1), false);
      w.cr();
      w.out += '<p>';
      inlines(w, last.children);
      w.out += ` ${refs}</p>\n`;
    } else {
      blocks(w, children, false);
      w.cr();
      w.out += `${refs}\n`;
    }
    w.out += '</li>\n';
  }
  w.out += '</ol>\n</section>\n';
}

/** The reference renderer's HTML for a tree. */
export function specHtml(tree: MdRoot | MdNode, options: SpecHtmlOptions = {}): string {
  const footnotes: FootnoteState = {
    definitions: tree.type === 'root' ? collectFootnotes(tree) : new Map(),
    order: [],
    counts: new Map(),
  };
  const w = new Writer(options, footnotes);
  if (tree.type === 'root') {
    blocks(w, tree.children, false);
    footnoteSection(w);
  }
  return w.out;
}
