/**
 * The `texuli-md/v1` Markdown AST (ADR-034): the one tree every reader writes and every writer
 * reads. `@texuli/core/markdown` parses CommonMark 0.31.2 and GFM into it; `core/markdown-html`
 * writes HTML from it through `core/markup`; `core/html` reads untrusted HTML into it; and
 * `core/markdown-dialects` reads and writes chat dialects through it. Framework-free and DOM-free.
 *
 * Rules every producer keeps:
 * - Text is plain text: no node carries markup to be trusted. Raw HTML from Markdown stays in
 *   `html` nodes as literal source; writers escape or drop it, never emit it.
 * - URLs are kept as written; writers pass them through the URL policy at the caller's tier.
 * - Positions, when present, are UTF-16 offsets into the source (JavaScript string indices).
 * - Trees are bounded by `MARKDOWN_LIMITS`; a producer that hits a limit stops descending and
 *   reports a diagnostic instead of throwing.
 */

export const MARKDOWN_AST_VERSION = 'texuli-md/v1' as const;

/** Source span as UTF-16 offsets, end exclusive. */
export interface MdPosition {
  readonly start: number;
  readonly end: number;
}

interface MdBase {
  readonly position?: MdPosition;
}

interface MdParent<C> extends MdBase {
  readonly children: readonly C[];
}

// ---------------------------------------------------------------------------
// Blocks

export interface MdRoot extends MdParent<MdBlock> {
  readonly type: 'root';
  readonly version: typeof MARKDOWN_AST_VERSION;
}

export interface MdParagraph extends MdParent<MdInline> {
  readonly type: 'paragraph';
}

export interface MdHeading extends MdParent<MdInline> {
  readonly type: 'heading';
  readonly depth: 1 | 2 | 3 | 4 | 5 | 6;
}

export interface MdThematicBreak extends MdBase {
  readonly type: 'thematicBreak';
}

export interface MdBlockquote extends MdParent<MdBlock> {
  readonly type: 'blockquote';
}

export interface MdList extends MdParent<MdListItem> {
  readonly type: 'list';
  readonly ordered: boolean;
  /** First number of an ordered list. */
  readonly start?: number;
  /** Loose list (blank lines between items). */
  readonly spread: boolean;
}

export interface MdListItem extends MdParent<MdBlock> {
  readonly type: 'listItem';
  /** GFM task item: `true` checked, `false` unchecked; absent when not a task. */
  readonly checked?: boolean;
  readonly spread: boolean;
}

export interface MdCode extends MdBase {
  readonly type: 'code';
  /** First word of the info string, when any. */
  readonly lang?: string;
  /** The rest of the info string. */
  readonly meta?: string;
  readonly value: string;
  readonly fenced: boolean;
}

/** Raw HTML (block or inline) kept as literal source. Never emitted as markup. */
export interface MdHtml extends MdBase {
  readonly type: 'html';
  readonly value: string;
}

export type MdAlign = 'left' | 'center' | 'right' | null;

export interface MdTable extends MdParent<MdTableRow> {
  readonly type: 'table';
  readonly align: readonly MdAlign[];
}

export interface MdTableRow extends MdParent<MdTableCell> {
  readonly type: 'tableRow';
}

export interface MdTableCell extends MdParent<MdInline> {
  readonly type: 'tableCell';
}

/** A link reference definition (`[label]: url "title"`), kept for round trips. */
export interface MdDefinition extends MdBase {
  readonly type: 'definition';
  /** Normalized label (case-folded, whitespace collapsed). */
  readonly label: string;
  readonly url: string;
  readonly title?: string;
}

/** GFM footnote definition. */
export interface MdFootnoteDefinition extends MdParent<MdBlock> {
  readonly type: 'footnoteDefinition';
  readonly label: string;
}

export type MdBlock =
  | MdParagraph
  | MdHeading
  | MdThematicBreak
  | MdBlockquote
  | MdList
  | MdCode
  | MdHtml
  | MdTable
  | MdDefinition
  | MdFootnoteDefinition;

// ---------------------------------------------------------------------------
// Inlines

export interface MdText extends MdBase {
  readonly type: 'text';
  readonly value: string;
}

export interface MdEmphasis extends MdParent<MdInline> {
  readonly type: 'emphasis';
}

export interface MdStrong extends MdParent<MdInline> {
  readonly type: 'strong';
}

/** GFM strikethrough. */
export interface MdDelete extends MdParent<MdInline> {
  readonly type: 'delete';
}

/** Underline: not CommonMark; read from and written to dialects that have it (Discord, Telegram). */
export interface MdUnderline extends MdParent<MdInline> {
  readonly type: 'underline';
}

/** Spoiler: Discord `||x||`, Telegram `||x||` / `<tg-spoiler>`. */
export interface MdSpoiler extends MdParent<MdInline> {
  readonly type: 'spoiler';
}

export interface MdInlineCode extends MdBase {
  readonly type: 'inlineCode';
  readonly value: string;
}

/** Hard line break (two spaces or backslash before a newline); soft breaks are text `\n`. */
export interface MdBreak extends MdBase {
  readonly type: 'break';
}

export interface MdLink extends MdParent<MdInline> {
  readonly type: 'link';
  readonly url: string;
  readonly title?: string;
}

export interface MdImage extends MdBase {
  readonly type: 'image';
  readonly url: string;
  readonly alt: string;
  readonly title?: string;
}

export interface MdFootnoteReference extends MdBase {
  readonly type: 'footnoteReference';
  readonly label: string;
}

/**
 * A chat mention or reference: Slack `<@U123>` / `<#C123|name>`, Discord `<@123>` / `<#123>` /
 * `<@&123>`, Teams `<at>`, `@everyone`. `id` is the platform id; `label` the display text when known.
 */
export interface MdMention extends MdBase {
  readonly type: 'mention';
  readonly kind: 'user' | 'channel' | 'role' | 'everyone' | 'here';
  readonly id?: string;
  readonly label?: string;
}

export type MdInline =
  | MdText
  | MdEmphasis
  | MdStrong
  | MdDelete
  | MdUnderline
  | MdSpoiler
  | MdInlineCode
  | MdBreak
  | MdLink
  | MdImage
  | MdFootnoteReference
  | MdMention
  | MdHtml;

export type MdNode = MdRoot | MdBlock | MdInline | MdListItem | MdTableRow | MdTableCell;

// ---------------------------------------------------------------------------
// Limits and diagnostics

/** Upper bounds every reader enforces; callers may lower them, never raise them past these. */
export const MARKDOWN_LIMITS = Object.freeze({
  /** Longest source read (UTF-16 code units); the rest is dropped with a diagnostic. */
  source: 1_000_000,
  /** Deepest block nesting (blockquotes, lists). */
  blockDepth: 32,
  /** Deepest inline nesting (emphasis, links, spoilers). */
  inlineDepth: 16,
  /** Most nodes in one tree. */
  nodes: 200_000,
});

export type MarkdownDiagnosticCode =
  | 'source-truncated'
  | 'depth-limit'
  | 'node-limit'
  | 'html-dropped'
  | 'url-refused'
  | 'unsupported-construct'
  | 'dialect-loss';

export interface MarkdownDiagnostic {
  readonly code: MarkdownDiagnosticCode;
  readonly message: string;
  readonly position?: MdPosition;
}

/** Every reader returns a tree plus what it had to drop or change; readers never throw on input. */
export interface MarkdownReadResult {
  readonly tree: MdRoot;
  readonly diagnostics: readonly MarkdownDiagnostic[];
}
