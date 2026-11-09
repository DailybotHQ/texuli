/**
 * A closed Markdown subset for Solution docs: headings, paragraphs, lists and
 * fenced code. The page renders the blocks as elements (no HTML sink).
 */

export type DocInline =
  | { readonly kind: 'text'; readonly text: string }
  | { readonly kind: 'code'; readonly text: string };

export type DocBlock =
  | { readonly type: 'h2'; readonly id: string; readonly text: string }
  | { readonly type: 'p'; readonly parts: readonly DocInline[] }
  | { readonly type: 'ul'; readonly items: readonly (readonly DocInline[])[] }
  | { readonly type: 'code'; readonly lang: string; readonly code: string };

const FENCE = /^```([a-zA-Z0-9_-]*)\s*$/;

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

export function parseInline(text: string): DocInline[] {
  const parts: DocInline[] = [];
  const pieces = text.split('`');
  pieces.forEach((piece, index) => {
    if (piece.length === 0) return;
    parts.push({ kind: index % 2 === 0 ? 'text' : 'code', text: piece });
  });
  return parts;
}

/** Parse the closed Markdown subset used by every Solution's docs. */
export function parseDocMarkdown(source: string): DocBlock[] {
  const blocks: DocBlock[] = [];
  const lines = source.replace(/\r\n/g, '\n').split('\n');
  let index = 0;
  while (index < lines.length) {
    const line = lines[index] ?? '';
    if (line.trim() === '') {
      index += 1;
      continue;
    }
    const fence = FENCE.exec(line.trim());
    if (fence) {
      const lang = fence[1] || 'text';
      const body: string[] = [];
      index += 1;
      while (index < lines.length && !FENCE.test((lines[index] ?? '').trim())) {
        body.push(lines[index] ?? '');
        index += 1;
      }
      if (index < lines.length) index += 1;
      blocks.push({ type: 'code', lang, code: body.join('\n').trimEnd() });
      continue;
    }
    if (line.startsWith('## ')) {
      const text = line.slice(3).trim();
      blocks.push({ type: 'h2', id: slugify(text), text });
      index += 1;
      continue;
    }
    if (line.startsWith('- ')) {
      const items: (readonly DocInline[])[] = [];
      while (index < lines.length && (lines[index] ?? '').startsWith('- ')) {
        items.push(parseInline((lines[index] ?? '').slice(2).trim()));
        index += 1;
      }
      blocks.push({ type: 'ul', items });
      continue;
    }
    const para: string[] = [];
    while (
      index < lines.length &&
      (lines[index] ?? '').trim() !== '' &&
      !(lines[index] ?? '').startsWith('## ') &&
      !(lines[index] ?? '').startsWith('- ') &&
      !FENCE.test((lines[index] ?? '').trim())
    ) {
      para.push((lines[index] ?? '').trim());
      index += 1;
    }
    if (para.length > 0) blocks.push({ type: 'p', parts: parseInline(para.join(' ')) });
  }
  return blocks;
}
