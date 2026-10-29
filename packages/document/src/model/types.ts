/**
 * The document format, version 1 (ADR-011). Plain JSON data: no DOM, no
 * HTML, no functions. A document is metadata, page settings, a tree of
 * blocks with persisted ids, and annotations kept apart from content.
 *
 * Text blocks reuse the `@texuli/core` editor vocabulary (paragraph,
 * heading, code, list, quote, divider, media) with its runs and marks, so a
 * document's text maps onto the core editor model one to one. Document
 * blocks add columns, callouts, toggles, links to nested pages, wrapped
 * `@texuli/blocks` blocks and typed embeds.
 */
import type { EditorInline, EditorListKind, EditorMark } from '@texuli/core/editor-model';

/** Persisted block id: unique in its document, at most 64 characters. */
export type DocumentBlockId = string;

/** A mark on a text run: the core editor marks (`strong`, `em`, `strike`, `code`, `link`). */
export type DocumentMark = EditorMark;
export type DocumentMarkType = DocumentMark['type'];

/** A text run with marks, or a line break (the core editor inline). */
export type DocumentInline = EditorInline;
export type DocumentText = Extract<DocumentInline, { type: 'text' }>;

export type DocumentHeadingLevel = 1 | 2 | 3 | 4;
export type DocumentListKind = EditorListKind;

export interface ParagraphBlock {
  id: DocumentBlockId;
  type: 'paragraph';
  content: DocumentInline[];
}

export interface HeadingBlock {
  id: DocumentBlockId;
  type: 'heading';
  level: DocumentHeadingLevel;
  content: DocumentInline[];
}

export interface CodeBlock {
  id: DocumentBlockId;
  type: 'code';
  lang?: string;
  text: string;
}

export interface ListItem {
  id: DocumentBlockId;
  /** Todo lists only. */
  checked?: boolean;
  /** The first block is always a paragraph. */
  blocks: DocumentBlock[];
}

export interface ListBlock {
  id: DocumentBlockId;
  type: 'list';
  kind: DocumentListKind;
  /** Ordered lists only; 1 when omitted. */
  start?: number;
  items: ListItem[];
}

export interface QuoteBlock {
  id: DocumentBlockId;
  type: 'quote';
  blocks: DocumentBlock[];
}

export interface DividerBlock {
  id: DocumentBlockId;
  type: 'divider';
}

/** An image: `ref` passes `safeImageSrc` at the document's tier (an HTTPS URL or a relative asset path). */
export interface MediaBlock {
  id: DocumentBlockId;
  type: 'media';
  ref: string;
  alt: string;
}

export type CalloutTone = 'neutral' | 'accent' | 'info' | 'success' | 'warning' | 'danger';

export interface CalloutBlock {
  id: DocumentBlockId;
  type: 'callout';
  tone: CalloutTone;
  /** An optional short title shown above the blocks. */
  title?: string;
  blocks: DocumentBlock[];
}

/** A disclosure: the summary is always visible, the blocks show when open. */
export interface ToggleBlock {
  id: DocumentBlockId;
  type: 'toggle';
  summary: DocumentInline[];
  /** Open by default (default false). */
  open?: boolean;
  blocks: DocumentBlock[];
}

/** One column of a `columns` block; `width` is its share of 12. */
export interface ColumnBlock {
  id: DocumentBlockId;
  type: 'column';
  width?: number;
  blocks: DocumentBlock[];
}

export interface ColumnsBlock {
  id: DocumentBlockId;
  type: 'columns';
  /** Two to four columns. */
  columns: ColumnBlock[];
}

/**
 * A link to a nested page. A nested page is its own document, resolved by
 * the host from `ref`, which keeps every document within its block cap.
 */
export interface PageLinkBlock {
  id: DocumentBlockId;
  type: 'page-link';
  ref: string;
  title: string;
}

/** The `@texuli/blocks` render families (mirrored; a test keeps them in sync). */
export type BlockFamily =
  | 'text'
  | 'media'
  | 'data'
  | 'structure'
  | 'code'
  | 'diagram'
  | 'interactive'
  | 'map'
  | 'embed';

export type DocumentJson =
  | string
  | number
  | boolean
  | null
  | DocumentJson[]
  | { [key: string]: DocumentJson };

export type DocumentJsonObject = { [key: string]: DocumentJson };

/**
 * A wrapped `@texuli/blocks` block: `{ type: block, ...props }` is what the
 * blocks parser reads. The engine checks the shape and bounds; the blocks
 * validator checks the props when the block is painted (two-phase
 * validation, ADR-011).
 */
export interface WrappedBlock {
  id: DocumentBlockId;
  type: 'block';
  family: BlockFamily;
  /** The `@texuli/blocks` block type, e.g. `stat` or `table`. */
  block: string;
  props: DocumentJsonObject;
}

export type EmbedKind = 'component' | 'deck' | 'sheet' | 'canvas';

/** A one-node catalog blueprint: a catalog component id and its props. */
export interface ComponentPayload {
  id: string;
  props?: DocumentJsonObject;
}

/**
 * An embed: a catalog component, a deck (deck model v2), a sheet or a
 * canvas. Exactly one of `ref` (host-resolved) and `inline` (bounded by
 * `DOCUMENT_LIMITS.inlineBytes`) is set.
 */
export interface EmbedBlock {
  id: DocumentBlockId;
  type: 'embed';
  kind: EmbedKind;
  ref?: string;
  inline?: DocumentJsonObject;
  /** Accessible name and the text exports fall back to. */
  title?: string;
}

/** Blocks a text cursor can be in (the core editor's text blocks). */
export type DocumentTextBlock = ParagraphBlock | HeadingBlock | CodeBlock;

/** Every block a block list holds. `column` lives only inside `columns`. */
export type DocumentBlock =
  | ParagraphBlock
  | HeadingBlock
  | CodeBlock
  | ListBlock
  | QuoteBlock
  | DividerBlock
  | MediaBlock
  | CalloutBlock
  | ToggleBlock
  | ColumnsBlock
  | PageLinkBlock
  | WrappedBlock
  | EmbedBlock;

export type DocumentBlockType = DocumentBlock['type'];

/** Any node with a persisted id: a block, a column or a list item. */
export type DocumentNode = DocumentBlock | ColumnBlock | ListItem;

export interface DocumentMeta {
  title: string;
  description?: string;
  /** A BCP 47 language tag, e.g. `en` or `pt-BR`. */
  locale?: string;
  dir?: 'ltr' | 'rtl' | 'auto';
  authors?: string[];
  tags?: string[];
  /** ISO 8601 timestamps, set by the host. */
  created?: string;
  updated?: string;
}

export type PageSize = 'a4' | 'a5' | 'letter' | 'legal';

/** Page settings for the paged view and print (`@texuli/document/paged` is planned). Millimetres. */
export interface PageSettings {
  size: PageSize;
  orientation: 'portrait' | 'landscape';
  margins?: { top: number; bottom: number; inlineStart: number; inlineEnd: number };
}

/** Where a comment points: a block, or a UTF-16 range of a text block's text (a break counts 1). */
export interface CommentAnchor {
  block: DocumentBlockId;
  start?: number;
  end?: number;
}

export interface CommentMessage {
  id: string;
  /** A host-provided display name. */
  author: string;
  body: string;
  /** ISO 8601. */
  created?: string;
}

export interface CommentThread {
  id: string;
  anchor: CommentAnchor;
  /** The quoted text when the thread was opened, kept if the range is deleted. */
  quote?: string;
  status: 'open' | 'resolved';
  messages: CommentMessage[];
}

/** Annotations travel with the document but apart from content; exports drop them. */
export interface DocumentAnnotations {
  comments?: CommentThread[];
}

export interface TexuliDocument {
  format: 'texuli-document';
  formatVersion: 1;
  meta: DocumentMeta;
  page?: PageSettings;
  blocks: DocumentBlock[];
  annotations?: DocumentAnnotations;
}
