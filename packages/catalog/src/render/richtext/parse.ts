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

const ESCAPABLE = /[\\`*_[\]()]/;

/**
 * Parse an untrusted inline Markdown subset into sink-free nodes.
 *
 * Supported: plain text, `**strong**`, `*em*`, `` `code` ``, `[label](href)`,
 * hard breaks (`  \n` or `\\\n`), backslash escapes. Paragraphs split on blank
 * lines. Raw HTML tags stay literal text. Links go through `safeHref`.
 * Nothing produces HTML strings.
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

  if (/<\/?[a-zA-Z][^>]*>/.test(text)) {
    diagnostics.push({
      code: 'html-as-text',
      message: 'HTML-like tags are kept as literal text; nothing is interpreted as markup.',
    });
  }

  const rawParagraphs = splitParagraphs(text).slice(0, RICHTEXT_LIMITS.paragraphs);
  const paragraphs: RichTextParagraph[] = rawParagraphs.map((chunk) => ({
    type: 'paragraph',
    children: parseInline(chunk, 0, maxDepth, hrefTrust, diagnostics),
  }));

  const document: RichTextDocument = {
    paragraphs: paragraphs.length > 0 ? paragraphs : [{ type: 'paragraph', children: [] }],
  };

  return { document, diagnostics };
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

function parseInline(
  source: string,
  depth: number,
  maxDepth: number,
  hrefTrust: NonNullable<RichTextOptions['hrefTrust']>,
  diagnostics: RichTextDiagnostic[],
  inLink = false
): RichTextInline[] {
  const out: RichTextInline[] = [];
  let buffer = '';
  const flush = () => {
    if (buffer) {
      out.push({ type: 'text', value: buffer });
      buffer = '';
    }
  };

  let i = 0;
  while (i < source.length) {
    const ch = source[i] ?? '';

    // Backslash escapes and hard break.
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
      buffer += ch;
      i += 1;
      continue;
    }

    // Soft newline → space; trailing two spaces → hard break.
    if (ch === '\n') {
      if (/ {2,}$/.test(buffer)) {
        buffer = buffer.replace(/ +$/, '');
        flush();
        out.push({ type: 'break' });
      } else {
        buffer += ' ';
      }
      i += 1;
      continue;
    }

    // Inline code.
    if (ch === '`') {
      const run = /^`+/.exec(source.slice(i))?.[0] ?? '`';
      const close = source.indexOf(run, i + run.length);
      if (close !== -1) {
        flush();
        let code = source.slice(i + run.length, close).replace(/\n/g, ' ');
        if (code.length > 2 && /^ .* $/.test(code)) code = code.slice(1, -1);
        out.push({ type: 'code', value: code });
        i = close + run.length;
        continue;
      }
      buffer += run;
      i += run.length;
      continue;
    }

    // Links: [label](href) — not inside another link.
    if (ch === '[' && !inLink) {
      const link = matchLink(source, i);
      if (link) {
        flush();
        if (depth >= maxDepth) {
          diagnostics.push({
            code: 'depth-capped',
            message: 'Link nesting exceeded the inline depth cap; rendered as text.',
            offset: i,
          });
          buffer += source.slice(i, link.end);
          i = link.end;
          continue;
        }
        const href = safeHref(link.href, hrefTrust);
        const children = parseInline(link.label, depth + 1, maxDepth, hrefTrust, diagnostics, true);
        if (href) {
          out.push({ type: 'link', href, children });
        } else {
          diagnostics.push({
            code: 'link-rejected',
            // The refused URL is never echoed: diagnostics must not carry
            // attacker-chosen text (the frame and sink scan follow the same rule).
            message: 'Link href rejected by the URL policy.',
            offset: i,
          });
          // Keep the visible label as text (never the raw scheme).
          out.push(...children);
        }
        i = link.end;
        continue;
      }
    }

    // Emphasis / strong when depth allows.
    if (depth < maxDepth && (ch === '*' || ch === '_')) {
      const emphasis = matchEmphasis(source, i);
      if (emphasis) {
        flush();
        out.push({
          type: emphasis.type,
          children: parseInline(
            source.slice(emphasis.innerStart, emphasis.innerEnd),
            depth + 1,
            maxDepth,
            hrefTrust,
            diagnostics,
            inLink
          ),
        });
        i = emphasis.end;
        continue;
      }
    } else if (depth >= maxDepth && (ch === '*' || ch === '_')) {
      // Only warn once per run of markers at this depth.
      if (source[i - 1] !== ch) {
        diagnostics.push({
          code: 'depth-capped',
          message: 'Emphasis nesting exceeded the inline depth cap; markers kept as text.',
          offset: i,
        });
      }
    }

    buffer += ch;
    i += 1;
  }

  flush();
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

function matchLink(
  source: string,
  start: number
): { label: string; href: string; end: number } | null {
  if (source[start] !== '[') return null;
  let i = start + 1;
  let depth = 1;
  let labelEnd = -1;
  while (i < source.length) {
    const ch = source[i] ?? '';
    if (ch === '\\') {
      i += 2;
      continue;
    }
    if (ch === '[') depth += 1;
    if (ch === ']') {
      depth -= 1;
      if (depth === 0) {
        labelEnd = i;
        break;
      }
    }
    if (ch === '\n') return null;
    i += 1;
  }
  if (labelEnd < 0 || source[labelEnd + 1] !== '(') return null;
  let j = labelEnd + 2;
  let hrefEnd = -1;
  while (j < source.length) {
    const ch = source[j] ?? '';
    if (ch === '\\') {
      j += 2;
      continue;
    }
    if (ch === ')') {
      hrefEnd = j;
      break;
    }
    if (ch === '\n' || ch === ' ') return null;
    j += 1;
  }
  if (hrefEnd < 0) return null;
  return {
    label: source.slice(start + 1, labelEnd),
    href: source.slice(labelEnd + 2, hrefEnd),
    end: hrefEnd + 1,
  };
}

function matchEmphasis(
  source: string,
  start: number
): { type: 'strong' | 'em'; innerStart: number; innerEnd: number; end: number } | null {
  const marker = source[start] ?? '';
  if (marker !== '*' && marker !== '_') return null;
  const next = source[start + 1] ?? '';
  // Strong: ** or __
  if (next === marker) {
    const close = findClose(source, start + 2, marker + marker);
    if (close === null) return null;
    // Disallow empty
    if (close === start + 2) return null;
    return {
      type: 'strong',
      innerStart: start + 2,
      innerEnd: close,
      end: close + 2,
    };
  }
  // Em: * or _ (not part of strong)
  const close = findClose(source, start + 1, marker);
  if (close === null) return null;
  if (close === start + 1) return null;
  // Avoid matching the second * of ** as em open
  return {
    type: 'em',
    innerStart: start + 1,
    innerEnd: close,
    end: close + 1,
  };
}

function findClose(source: string, from: number, token: string): number | null {
  let i = from;
  while (i < source.length) {
    const ch = source[i] ?? '';
    if (ch === '\\') {
      i += 2;
      continue;
    }
    if (ch === '\n') return null;
    if (source.startsWith(token, i)) {
      // For single-char em, do not close on the first half of **
      if (token.length === 1 && source[i + 1] === token) {
        i += 2;
        continue;
      }
      return i;
    }
    i += 1;
  }
  return null;
}
