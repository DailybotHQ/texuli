import { type MdInline, parseInlineMarkdown } from '@texuli/core/markdown';
import { safeHref } from '@texuli/core/url-policy';
import type {
  RichTextDiagnostic,
  RichTextDocument,
  RichTextInline,
  RichTextOptions,
  RichTextParagraph,
  RichTextResult,
} from './types.ts';
import { RICHTEXT_LIMITS } from './types.ts';

/**
 * Parse an untrusted inline Markdown subset into sink-free nodes.
 *
 * Supported: plain text, `**strong**`, `*em*`, `` `code` ``, `[label](href)`,
 * hard breaks (`  \n` or `\\\n`), backslash escapes and character references.
 * Paragraphs split on blank lines. Each paragraph is read by the shared CommonMark
 * inline parser (`@texuli/core/markdown`, ADR-034) and filtered down to this
 * vocabulary: raw HTML tags stay literal text, an image reads as `!` and a link,
 * and links go through `safeHref`. Nothing produces HTML strings.
 */
export function renderRichText(source: unknown, options: RichTextOptions = {}): RichTextResult {
  const diagnostics: RichTextDiagnostic[] = [];
  const maxSource = options.maxSource ?? RICHTEXT_LIMITS.source;
  const maxDepth = options.maxDepth ?? RICHTEXT_LIMITS.inlineDepth;
  const hrefTrust = options.hrefTrust ?? 'untrusted';

  let text = typeof source === 'string' ? source : String(source ?? '');
  text = text.replace(/\r\n?/g, '\n');
  if (text.length > maxSource) {
    diagnostics.push({
      code: 'source-truncated',
      message: `Source truncated from ${text.length} to ${maxSource} characters.`,
      offset: maxSource,
    });
    text = text.slice(0, maxSource);
  }

  if (hasHtmlLikeTag(text)) {
    diagnostics.push({
      code: 'html-as-text',
      message: 'HTML-like tags are kept as literal text; nothing is interpreted as markup.',
    });
  }

  const rawParagraphs = splitParagraphs(text).slice(0, RICHTEXT_LIMITS.paragraphs);
  const paragraphs: RichTextParagraph[] = rawParagraphs.map((chunk) => ({
    type: 'paragraph',
    children: parseParagraph(chunk, maxDepth, hrefTrust, diagnostics),
  }));

  const document: RichTextDocument = {
    paragraphs: paragraphs.length > 0 ? paragraphs : [{ type: 'paragraph', children: [] }],
  };

  return { document, diagnostics };
}

/**
 * True when the text holds `<tag…>` or `</tag…>`: the old `/<\/?[a-zA-Z][^>]*>/`
 * test, read by index. That pattern restarted at every `<` and ran to the end
 * of the text when no `>` followed, so a run of `<a` was quadratic.
 */
function hasHtmlLikeTag(text: string): boolean {
  const lastClose = text.lastIndexOf('>');
  if (lastClose < 0) return false;
  for (let at = text.indexOf('<'); at !== -1 && at < lastClose; at = text.indexOf('<', at + 1)) {
    let letter = at + 1;
    if (!isAsciiLetter(text.charCodeAt(letter))) {
      if (text[letter] !== '/') continue;
      letter += 1;
      if (!isAsciiLetter(text.charCodeAt(letter))) continue;
    }
    // `[^>]*>` holds whenever any `>` comes after the letter.
    if (letter < lastClose) return true;
  }
  return false;
}

function isAsciiLetter(code: number): boolean {
  return (code >= 65 && code <= 90) || (code >= 97 && code <= 122);
}

/** Flatten a document to plain text (for search, titles, plain fallbacks). */
export function richTextToPlain(document: RichTextDocument): string {
  return document.paragraphs
    .map((paragraph) => inlinesToPlain(paragraph.children))
    .filter((line) => line.length > 0)
    .join('\n\n');
}

function inlinesToPlain(nodes: readonly RichTextInline[]): string {
  let out = '';
  for (const node of nodes) {
    switch (node.type) {
      case 'text':
      case 'code':
        out += node.value;
        break;
      case 'break':
        out += '\n';
        break;
      case 'strong':
      case 'em':
      case 'link':
        out += inlinesToPlain(node.children);
        break;
      default:
        break;
    }
  }
  return out;
}

function splitParagraphs(source: string): string[] {
  const lines = source.split('\n');
  const chunks: string[] = [];
  let buf: string[] = [];
  const flush = () => {
    if (buf.length === 0) return;
    // Soft-join single newlines inside a paragraph with a space; keep hard breaks as markers.
    chunks.push(buf.join('\n'));
    buf = [];
  };
  for (const line of lines) {
    if (line.trim() === '') {
      flush();
      continue;
    }
    buf.push(line);
  }
  flush();
  return chunks;
}

/**
 * One paragraph through the shared inline parser (no block structure: a leading `#`, `-` or
 * `>` stays text), projected onto the rich-text vocabulary.
 */
function parseParagraph(
  source: string,
  maxDepth: number,
  hrefTrust: NonNullable<RichTextOptions['hrefTrust']>,
  diagnostics: RichTextDiagnostic[]
): RichTextInline[] {
  const parsed = parseInlineMarkdown(source, { gfm: false });
  const state = { maxDepth: Math.max(0, maxDepth), capped: false };
  const children = project(parsed.children, 0, state, hrefTrust, diagnostics);
  if (state.capped || parsed.diagnostics.some((diagnostic) => diagnostic.code === 'depth-limit'))
    diagnostics.push({
      code: 'depth-capped',
      message: 'Emphasis or link nesting exceeded the inline depth cap; markers kept as text.',
    });
  return children;
}

/** Past the depth cap a node is written back as its Markdown text (`**…**`, `*…*`, `[…](…)`). */
function asMarkdownText(node: MdInline): string {
  switch (node.type) {
    case 'text':
    case 'inlineCode':
    case 'html':
      return node.type === 'inlineCode' ? `\`${node.value}\`` : node.value.replace(/\n/g, ' ');
    case 'break':
      return ' ';
    case 'strong':
      return `**${node.children.map(asMarkdownText).join('')}**`;
    case 'emphasis':
      return `*${node.children.map(asMarkdownText).join('')}*`;
    case 'link':
      return `[${node.children.map(asMarkdownText).join('')}](${node.url})`;
    case 'image':
      return `![${node.alt}](${node.url})`;
    default:
      return 'children' in node ? (node.children as MdInline[]).map(asMarkdownText).join('') : '';
  }
}

/** The shared tree's inlines in the rich-text vocabulary. */
function project(
  nodes: readonly MdInline[],
  depth: number,
  state: { readonly maxDepth: number; capped: boolean },
  hrefTrust: NonNullable<RichTextOptions['hrefTrust']>,
  diagnostics: RichTextDiagnostic[]
): RichTextInline[] {
  const inner = (children: readonly MdInline[]) =>
    project(children, depth + 1, state, hrefTrust, diagnostics);
  const out: RichTextInline[] = [];
  const text = (value: string) => {
    // A soft line break reads as a space.
    if (value) out.push({ type: 'text', value: value.replace(/\n/g, ' ') });
  };
  const link = (url: string, children: RichTextInline[]) => {
    const href = safeHref(url, hrefTrust);
    if (href) out.push({ type: 'link', href, children });
    else {
      diagnostics.push({
        code: 'link-rejected',
        // The refused URL is never echoed: diagnostics must not carry
        // attacker-chosen text (the frame and sink scan follow the same rule).
        message: 'Link href rejected by the URL policy.',
      });
      // Keep the visible label as text (never the raw scheme).
      out.push(...children);
    }
  };
  for (const node of nodes) {
    const container = node.type === 'strong' || node.type === 'emphasis' || node.type === 'link';
    if (container && depth >= state.maxDepth) {
      state.capped = true;
      text(asMarkdownText(node));
      continue;
    }
    switch (node.type) {
      case 'text':
        text(node.value);
        break;
      case 'break':
        out.push({ type: 'break' });
        break;
      case 'inlineCode':
        out.push({ type: 'code', value: node.value });
        break;
      case 'emphasis':
        out.push({ type: 'em', children: inner(node.children) });
        break;
      case 'strong':
        out.push({ type: 'strong', children: inner(node.children) });
        break;
      case 'link':
        link(node.url, inner(node.children));
        break;
      case 'image':
        // No pictures in rich text: the `!` stays text and the description is a link.
        text('!');
        link(node.url, node.alt ? [{ type: 'text', value: node.alt.replace(/\n/g, ' ') }] : []);
        break;
      case 'html':
        // Raw HTML is never markup: the tag stays literal text.
        text(node.value);
        break;
      default:
        // Nothing else is produced without GFM; keep any text it holds.
        if ('children' in node) out.push(...inner(node.children as MdInline[]));
        else if ('value' in node) text(String(node.value));
    }
  }
  return mergeAdjacentText(out);
}

function mergeAdjacentText(nodes: RichTextInline[]): RichTextInline[] {
  const out: RichTextInline[] = [];
  for (const node of nodes) {
    const prev = out[out.length - 1];
    if (node.type === 'text' && prev?.type === 'text') {
      out[out.length - 1] = { type: 'text', value: prev.value + node.value };
    } else {
      out.push(node);
    }
  }
  return out;
}
