/**
 * Test-only HTML writer in the CommonMark reference renderer's exact shape, so the spec suite
 * can compare the AST against the spec's expected HTML. Raw HTML passes through here because
 * the spec expects it; the product writer (`core/markdown-html`, ADR-016) escapes or drops it.
 */
import type { MdBlock, MdInline, MdList, MdNode, MdRoot } from '../../src/markdown/ast.ts';

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

class Writer {
  out = '';
  cr(): void {
    if (this.out !== '' && !this.out.endsWith('\n')) this.out += '\n';
  }
}

function inlines(w: Writer, nodes: readonly MdInline[]): void {
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
      case 'strong':
        w.out += '<strong>';
        inlines(w, node.children);
        w.out += '</strong>';
        break;
      case 'inlineCode':
        w.out += `<code>${escapeXml(node.value)}</code>`;
        break;
      case 'html':
        w.out += node.value;
        break;
      case 'link':
        w.out += `<a href="${escapeXml(encodeUrl(node.url))}"${node.title ? ` title="${escapeXml(node.title)}"` : ''}>`;
        inlines(w, node.children);
        w.out += '</a>';
        break;
      case 'image':
        w.out += `<img src="${escapeXml(encodeUrl(node.url))}" alt="${escapeXml(node.alt)}"${node.title ? ` title="${escapeXml(node.title)}"` : ''} />`;
        break;
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
      w.out += node.value;
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
    default:
      break;
  }
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
    blocks(w, item.children, !node.spread);
    w.out += '</li>';
    w.cr();
  }
  w.cr();
  w.out += `</${tag}>`;
  w.cr();
}

/** The reference renderer's HTML for a tree. */
export function specHtml(tree: MdRoot | MdNode): string {
  const w = new Writer();
  if (tree.type === 'root') blocks(w, tree.children, false);
  return w.out;
}
