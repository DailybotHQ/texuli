/**
 * Markdown import and export through the `@texuli/core` editor codec
 * (ADR-003): the same closed, linear-time Markdown subset, no HTML in or
 * out, every link through `safeHref` and every image through
 * `safeImageSrc` at the tier. Document-only blocks have no Markdown
 * spelling and are written as their nearest text form.
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
  DocumentInline,
  DocumentMeta,
  ListItem,
  TexuliDocument,
} from '../model/types.ts';
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
  const read = fromMarkdown(source, {
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
  const checked = validateDocument(created, { trust });
  if (!checked.ok) return { ok: false, issues: checked.issues, diagnostics };
  return { ok: true, document: checked.document, diagnostics };
}

export interface MarkdownExportOptions {
  /** Write `meta.title` as a level 1 heading first (default false). */
  title?: boolean;
  /**
   * Embeds and nested-page links have no Markdown form: `title` (default)
   * writes their title as a paragraph, `drop` leaves them out. Wrapped
   * `@texuli/blocks` blocks are always left out.
   */
  embeds?: 'title' | 'drop';
}

const text = (value: string): EditorInline[] =>
  value ? [{ type: 'text', text: value, marks: [] }] : [];

/** Document blocks to core editor blocks, degrading document-only blocks. */
function exportBlocks(
  blocks: readonly DocumentBlock[],
  options: MarkdownExportOptions,
  depth: number
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
            blocks: exportBlocks(item.blocks, options, depth + 1),
          })),
        });
        break;
      case 'quote':
        out.push({ ...block, blocks: exportBlocks(block.blocks, options, depth + 1) });
        break;
      case 'callout': {
        const inner = exportBlocks(block.blocks, options, depth + 1);
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
        out.push(...exportBlocks(block.blocks, options, depth + 1));
        break;
      case 'columns':
        for (const column of block.columns)
          out.push(...exportBlocks(column.blocks, options, depth + 1));
        break;
      case 'page-link':
        titled(block.id, block.title);
        break;
      case 'embed':
        titled(block.id, block.title);
        break;
      case 'block':
        break;
    }
  }
  return out;
}

/**
 * Write a document as the closed Markdown subset. A document of core
 * blocks (paragraph, heading, code, list, quote, divider, media) reads back
 * as the same blocks; document-only blocks degrade as documented.
 */
export function documentToMarkdown(
  doc: Pick<TexuliDocument, 'blocks' | 'meta'>,
  options: MarkdownExportOptions = {}
): string {
  const blocks = exportBlocks(doc.blocks, options, 0);
  if (options.title && doc.meta.title)
    blocks.unshift({ id: 'title', type: 'heading', level: 1, content: text(doc.meta.title) });
  const editorDoc: EditorDocument = { version: 1, blocks };
  return toMarkdown(editorDoc);
}
