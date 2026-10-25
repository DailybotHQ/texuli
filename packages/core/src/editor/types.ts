/**
 * The rich text editor document model, version 1 (ADR-003). Framework-free
 * data: no DOM, no HTML. A document is a tree of blocks; text blocks hold
 * flat runs of text with mark sets. Link hrefs are data here: they passed
 * `safeHref` when they entered the model, and the binding renders them
 * through the URL policy again.
 */

/** Runtime-only block id: assigned on load, never serialized. */
export type EditorBlockId = string;

export type EditorMark =
  | { type: 'strong' }
  | { type: 'em' }
  | { type: 'strike' }
  | { type: 'code' }
  | { type: 'link'; href: string };

export type EditorMarkType = EditorMark['type'];

export type EditorInline =
  | { type: 'text'; text: string; marks: readonly EditorMark[] }
  | { type: 'break' };

export type EditorHeadingLevel = 1 | 2 | 3 | 4;

export type EditorParagraph = {
  id: EditorBlockId;
  type: 'paragraph';
  content: readonly EditorInline[];
};
export type EditorHeading = {
  id: EditorBlockId;
  type: 'heading';
  level: EditorHeadingLevel;
  content: readonly EditorInline[];
};
export type EditorCodeBlock = { id: EditorBlockId; type: 'code'; lang?: string; text: string };

/** Blocks that hold inline content (marks allowed). */
export type EditorRichBlock = EditorParagraph | EditorHeading;
/** Blocks a caret can be in. */
export type EditorTextBlock = EditorRichBlock | EditorCodeBlock;

export type EditorListKind = 'bullet' | 'ordered' | 'todo';

export type EditorListItem = {
  id: EditorBlockId;
  /** Todo lists only. */
  checked?: boolean;
  /** The first block is always a paragraph. */
  blocks: readonly EditorBlock[];
};

export type EditorList = {
  id: EditorBlockId;
  type: 'list';
  kind: EditorListKind;
  /** Ordered lists only; 1 when omitted. */
  start?: number;
  items: readonly EditorListItem[];
};
export type EditorQuote = { id: EditorBlockId; type: 'quote'; blocks: readonly EditorBlock[] };
export type EditorDivider = { id: EditorBlockId; type: 'divider' };
/** A host-resolved media reference; the model never loads it. */
export type EditorMedia = { id: EditorBlockId; type: 'media'; ref: string; alt: string };

export type EditorBlock = EditorTextBlock | EditorList | EditorQuote | EditorDivider | EditorMedia;

export type EditorBlockType = EditorBlock['type'];

export type EditorDocument = { version: 1; blocks: readonly EditorBlock[] };

/** A caret position: a text block and a UTF-16 offset into its text (a break counts 1). */
export type EditorPoint = { block: EditorBlockId; offset: number };

export type EditorSelection =
  | { kind: 'text'; anchor: EditorPoint; focus: EditorPoint }
  | { kind: 'node'; block: EditorBlockId };

/** What transforms and history work on. */
export interface EditorState {
  doc: EditorDocument;
  selection: EditorSelection;
  /** Marks the next typed text gets (set by a mark toggle at a caret). */
  storedMarks?: readonly EditorMark[] | null;
}

export type EditorIssueCode =
  | 'invalid-shape'
  | 'unknown-node'
  | 'unknown-mark'
  | 'version-unsupported'
  | 'depth-capped'
  | 'blocks-capped'
  | 'text-truncated'
  | 'link-rejected'
  | 'mark-dropped'
  | 'characters-stripped'
  | 'heading-clamped'
  | 'not-normalized'
  | 'duplicate-id'
  | 'invalid-selection'
  | 'not-allowed-here'
  | 'nothing-to-do'
  | 'limit-reached';

export interface EditorIssue {
  code: EditorIssueCode;
  message: string;
  /** The block concerned, when there is one. */
  block?: EditorBlockId;
}

export type EditorTransformResult =
  | { ok: true; state: EditorState; diagnostics?: readonly EditorIssue[] }
  | { ok: false; errors: readonly EditorIssue[] };

/** Caps: hostile input degrades (diagnostics), never throws or recurses without bound. */
export const EDITOR_LIMITS = Object.freeze({
  /** Blocks in a document, containers included. */
  blocks: 2_000,
  /** Characters of text in a document. */
  chars: 200_000,
  /** Nested lists and quotes around a block. */
  depth: 4,
  /** Longest link href or media ref kept. */
  href: 2_048,
  /** Longest code block language name. */
  lang: 32,
  /** History snapshots kept. */
  history: 200,
});

export type EditorLimits = { blocks: number; chars: number; depth: number };

/** Canonical mark order: a run's marks are always sorted this way. */
export const EDITOR_MARK_ORDER: readonly EditorMarkType[] = [
  'link',
  'strong',
  'em',
  'strike',
  'code',
];

export const EDITOR_BLOCK_TYPES: readonly EditorBlockType[] = [
  'paragraph',
  'heading',
  'code',
  'list',
  'quote',
  'divider',
  'media',
];
