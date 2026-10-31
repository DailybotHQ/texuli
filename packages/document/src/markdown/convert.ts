/**
 * Markdown import and export through the `@texuli/core` editor codec
 * (ADR-003): the same closed, linear-time Markdown subset, no HTML in or
 * out, every link through `safeHref` and every image through
 * `safeImageSrc` at the tier. Document-only blocks have no Markdown
 * spelling and are written as their nearest text form.
 *
 * A document's `designSystem` (ADR-024) travels in a closed front matter
 * block: `---`, one `designSystem: <value>` line, `---`. The value is the
 * ref itself (`acme@2.1.0`, `texuli:ocean`) or, for an inline document, the
 * whole field as one line of JSON (`{"inline":{…}}`), so the round trip is
 * lossless. Only that exact shape is front matter; any other leading `---`
 * stays Markdown (a divider).
 */
import { fromMarkdown, toMarkdown } from '@texuli/core/editor-markdown';
import type {
  EditorBlock,
  EditorDocument,
  EditorInline,
  EditorIssue,
} from '@texuli/core/editor-model';
import { type HrefTrust, safeImageSrc } from '@texuli/core/url-policy';
import { createDocument, createIdSource, type DocumentIdSource } from '../model/document.ts';
import { DOCUMENT_LIMITS } from '../model/limits.ts';
import type {
  DocumentBlock,
  DocumentDesignSystem,
  DocumentInline,
  DocumentMeta,
  ListItem,
  TexuliDocument,
} from '../model/types.ts';
import { type SimpleTable, wrappedTable, wrappedText } from '../output/shared.ts';
import { type DocumentDiagnostic, validateDocument } from '../schema/validate.ts';

export interface MarkdownImportOptions {
  /** URL tier for links and images. Default `untrusted`. */
  trust?: HrefTrust;
  /** Persisted ids for the new blocks (default `b1`, `b2`, …). */
  newId?: DocumentIdSource;
  /** Metadata for the new document (the title defaults to the first heading's text, or ''). */
  meta?: Partial<DocumentMeta>;
  /** Longest source read (default 100,000 characters, the core codec's cap). */
  maxSource?: number;
}

export type MarkdownImport =
  | {
      ok: true;
      document: TexuliDocument;
      /** What the codec degraded (refused links, capped nesting…), reported once each. */
      diagnostics: readonly EditorIssue[];
    }
  | { ok: false; issues: DocumentDiagnostic[]; diagnostics: readonly EditorIssue[] };

/** The front matter: `---`, one `designSystem:` line, `---`, then a blank line or the end. */
const FRONT_MATTER = /^---\r?\ndesignSystem:[ \t]*([^\r\n]*)\r?\n---[ \t]*(?:\r?\n|$)/;

/** Split the design-system front matter off; a value that does not read leaves the source as is. */
function readFrontMatter(source: string): {
  body: string;
  designSystem?: unknown;
} {
  const match = FRONT_MATTER.exec(source);
  const raw = match?.[1]?.trim();
  if (!match || !raw) return { body: source };
  let designSystem: unknown = { ref: raw };
  if (raw.startsWith('{')) {
    try {
      designSystem = JSON.parse(raw);
    } catch {
      return { body: source };
    }
  }
  return { body: source.slice(match[0].length).replace(/^(?:[ \t]*\r?\n)+/, ''), designSystem };
}

/** Code points, truncated to `max`. */
function clip(text: string, max: number): string {
  if (text.length <= max) return text;
  return Array.from(text).slice(0, max).join('');
}

function inline(content: readonly EditorInline[]): DocumentInline[] {
  return content.map((part) =>
    part.type === 'break'
      ? { type: 'break' }
      : { type: 'text', text: part.text, marks: part.marks.map((mark) => ({ ...mark })) }
  );
}

function plain(content: readonly EditorInline[]): string {
  let out = '';
  for (const part of content) out += part.type === 'break' ? ' ' : part.text;
  return out;
}

/** Core editor blocks to document blocks (the vocabulary is shared). */
function importBlocks(
  blocks: readonly EditorBlock[],
  trust: HrefTrust,
  issues: EditorIssue[]
): DocumentBlock[] {
  const out: DocumentBlock[] = [];
  for (const block of blocks) {
    switch (block.type) {
      case 'paragraph':
        out.push({ id: block.id, type: 'paragraph', content: inline(block.content) });
        break;
      case 'heading':
        out.push({
          id: block.id,
          type: 'heading',
          level: block.level,
          content: inline(block.content),
        });
        break;
      case 'code':
        out.push(
          block.lang === undefined
            ? { id: block.id, type: 'code', text: block.text }
            : { id: block.id, type: 'code', lang: block.lang, text: block.text }
        );
        break;
      case 'divider':
        out.push({ id: block.id, type: 'divider' });
        break;
      case 'media': {
        const alt = clip(block.alt, DOCUMENT_LIMITS.title);
        if (safeImageSrc(block.ref, trust) === undefined) {
          issues.push({
            code: 'link-rejected',
            message: 'An image refused by the URL policy became its alt text.',
            block: block.id,
          });
          out.push({
            id: block.id,
            type: 'paragraph',
            content: alt ? [{ type: 'text', text: alt, marks: [] }] : [],
          });
        } else out.push({ id: block.id, type: 'media', ref: block.ref, alt });
        break;
      }
      case 'quote':
        out.push({
          id: block.id,
          type: 'quote',
          blocks: importBlocks(block.blocks, trust, issues),
        });
        break;
      case 'list': {
        const items: ListItem[] = block.items.map((item) => {
          const next: ListItem = { id: item.id, blocks: importBlocks(item.blocks, trust, issues) };
          if (item.checked !== undefined) next.checked = item.checked;
          if (next.blocks[0]?.type !== 'paragraph')
            next.blocks.unshift({ id: `${item.id}-p`, type: 'paragraph', content: [] });
          return next;
        });
        out.push(
          block.start === undefined
            ? { id: block.id, type: 'list', kind: block.kind, items }
            : { id: block.id, type: 'list', kind: block.kind, start: block.start, items }
        );
        break;
      }
    }
  }
  return out;
}

/**
 * Read Markdown (untrusted by default) into a validated document. Linear
 * in the input: the core codec reads it in one pass and every cap is
 * enforced while reading. Never throws.
 */
export function documentFromMarkdown(
  source: unknown,
  options: MarkdownImportOptions = {}
): MarkdownImport {
  const trust: HrefTrust = options.trust === 'developer' ? 'developer' : 'untrusted';
  const newId = options.newId ?? createIdSource('b');
  const front: { body: unknown; designSystem?: unknown } =
    typeof source === 'string' ? readFrontMatter(source) : { body: source };
  const read = fromMarkdown(front.body, {
    trust,
    newId,
    maxSource: options.maxSource,
    limits: { blocks: DOCUMENT_LIMITS.blocks, chars: DOCUMENT_LIMITS.chars },
  });
  const diagnostics = [...read.diagnostics];
  const blocks = importBlocks(read.doc.blocks, trust, diagnostics);
  const firstHeading = blocks.find((block) => block.type === 'heading');
  const title =
    options.meta?.title ??
    (firstHeading?.type === 'heading'
      ? clip(plain(firstHeading.content), DOCUMENT_LIMITS.title)
      : '');
  const created = createDocument({ meta: { ...options.meta, title }, blocks });
  // validateDocument checks the shape and the ref grammar; the reader compiles it.
  if (front.designSystem !== undefined)
    created.designSystem = front.designSystem as DocumentDesignSystem;
  const checked = validateDocument(created, { trust });
  if (!checked.ok) return { ok: false, issues: checked.issues, diagnostics };
  return { ok: true, document: checked.document, diagnostics };
}

export interface MarkdownExportOptions {
  /** Write `meta.title` as a level 1 heading first (default false). */
  title?: boolean;
  /**
   * Embeds and nested-page links have no Markdown form: `title` (default)
   * writes their title as a paragraph, `drop` leaves them out.
   */
  embeds?: 'title' | 'drop';
  /**
   * Wrapped `@texuli/blocks` blocks: `text` (default) writes a data table as
   * a GFM table (its caption in emphasis on the line before) and any other
   * block as the text the DOCX and PDF writers print for it; `drop` leaves
   * them out. Neither reads back as a wrapped block: the subset has no
   * table, so a table reads back as a paragraph of its cells.
   */
  blocks?: 'text' | 'drop';
}

const oneLine = (value: string) => value.replace(/\r\n?|[\n\u2028\u2029]/g, ' ');

/** One GFM table cell: one line, Markdown punctuation and `|` escaped, so nothing in it is markup. */
function tableCell(value: string): string {
  return oneLine(value)
    .replace(/[\\`*_[\]~<>!|&]/g, '\\$&')
    .trim();
}

function tableRow(cells: readonly string[]): string {
  return `| ${cells.map(tableCell).join(' | ')} |`;
}

/** A GFM table (header, delimiter row, body); `wrappedTable` already bounded it. */
function gfmTable(table: SimpleTable): string {
  return [
    tableRow(table.header),
    `| ${table.header.map(() => '---').join(' | ')} |`,
    ...table.rows.map(tableRow),
  ].join('\n');
}

/** Where the GFM tables go in the codec's output: one placeholder paragraph each. */
interface TableSlots {
  /** A word found nowhere in the document, so a placeholder never matches its text. */
  token: string;
  tables: string[];
}

function tableSlots(blocks: readonly DocumentBlock[]): TableSlots {
  const source = JSON.stringify(blocks);
  let token = 'txtable';
  while (source.includes(token)) token += 'x';
  return { token, tables: [] };
}

const text = (value: string): EditorInline[] =>
  value ? [{ type: 'text', text: value, marks: [] }] : [];

/** Document blocks to core editor blocks, degrading document-only blocks. */
function exportBlocks(
  blocks: readonly DocumentBlock[],
  options: MarkdownExportOptions,
  depth: number,
  slots: TableSlots
): EditorBlock[] {
  if (depth > DOCUMENT_LIMITS.depth + 2) return [];
  const out: EditorBlock[] = [];
  const titled = (id: string, title: string | undefined) => {
    if ((options.embeds ?? 'title') === 'title' && title)
      out.push({ id, type: 'paragraph', content: text(title) });
  };
  for (const block of blocks) {
    switch (block.type) {
      case 'paragraph':
      case 'heading':
      case 'code':
      case 'divider':
      case 'media':
        out.push(block as EditorBlock);
        break;
      case 'list':
        out.push({
          ...block,
          items: block.items.map((item) => ({
            ...item,
            blocks: exportBlocks(item.blocks, options, depth + 1, slots),
          })),
        });
        break;
      case 'quote':
        out.push({ ...block, blocks: exportBlocks(block.blocks, options, depth + 1, slots) });
        break;
      case 'callout': {
        const inner = exportBlocks(block.blocks, options, depth + 1, slots);
        if (block.title)
          inner.unshift({
            id: `${block.id}-title`,
            type: 'paragraph',
            content: [{ type: 'text', text: block.title, marks: [{ type: 'strong' }] }],
          });
        out.push({ id: block.id, type: 'quote', blocks: inner });
        break;
      }
      case 'toggle':
        out.push({ id: block.id, type: 'paragraph', content: block.summary });
        out.push(...exportBlocks(block.blocks, options, depth + 1, slots));
        break;
      case 'columns':
        for (const column of block.columns)
          out.push(...exportBlocks(column.blocks, options, depth + 1, slots));
        break;
      case 'page-link':
        titled(block.id, block.title);
        break;
      case 'embed':
        titled(block.id, block.title);
        break;
      case 'block': {
        if (options.blocks === 'drop') break;
        const table = wrappedTable(block);
        if (!table) {
          out.push({ id: block.id, type: 'paragraph', content: text(wrappedText(block)) });
          break;
        }
        if (table.caption)
          out.push({
            id: `${block.id}-caption`,
            type: 'paragraph',
            content: [{ type: 'text', text: oneLine(table.caption), marks: [{ type: 'em' }] }],
          });
        out.push({
          id: block.id,
          type: 'paragraph',
          content: text(`${slots.token}${slots.tables.length}`),
        });
        slots.tables.push(gfmTable(table));
        break;
      }
    }
  }
  return out;
}

/**
 * Put each GFM table where its placeholder paragraph was written, under
 * the same line prefix (`> ` in a quote, the item's indent in a list): the
 * first line keeps the prefix, the next ones replace a list marker by
 * spaces so the table stays inside the item.
 */
function placeTables(markdown: string, slots: TableSlots): string {
  if (slots.tables.length === 0) return markdown;
  const placeholder = new RegExp(`^(.*?)${slots.token}(\\d+)$`);
  return markdown
    .split('\n')
    .map((line) => {
      const match = placeholder.exec(line);
      const table = match ? slots.tables[Number(match[2])] : undefined;
      if (!match || table === undefined) return line;
      const first = match[1] ?? '';
      const next = first.replace(/(?:[-*+]|\d+[.)])(?: \[[ xX]\])? /g, (marker) =>
        ' '.repeat(marker.length)
      );
      return table
        .split('\n')
        .map((row, index) => `${index === 0 ? first : next}${row}`)
        .join('\n');
    })
    .join('\n');
}

/**
 * Write a document as the closed Markdown subset, plus GFM tables for
 * wrapped data tables. A document of core
 * blocks (paragraph, heading, code, list, quote, divider, media) reads back
 * as the same blocks; document-only blocks degrade as documented.
 */
export function documentToMarkdown(
  doc: Pick<TexuliDocument, 'blocks' | 'meta' | 'designSystem'>,
  options: MarkdownExportOptions = {}
): string {
  const slots = tableSlots(doc.blocks);
  const blocks = exportBlocks(doc.blocks, options, 0, slots);
  if (options.title && doc.meta.title)
    blocks.unshift({ id: 'title', type: 'heading', level: 1, content: text(doc.meta.title) });
  const editorDoc: EditorDocument = { version: 1, blocks };
  const body = placeTables(toMarkdown(editorDoc), slots);
  const system = doc.designSystem;
  if (!system) return body;
  // One line: a ref as itself, an inline document as JSON (its strings hold no line break).
  const value =
    typeof system.ref === 'string' && system.inline === undefined
      ? system.ref
      : JSON.stringify(system);
  return `---\ndesignSystem: ${value}\n---\n\n${body}`;
}
