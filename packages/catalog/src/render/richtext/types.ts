/**
 * Sink-free rich-text nodes for the agent catalog renderer.
 * Hosts map these to real components or plain text — never HTML strings.
 */

/** One inline node. Children are themselves inline (emphasis nesting). */
export type RichTextInline =
  | { type: 'text'; value: string }
  | { type: 'code'; value: string }
  | { type: 'break' }
  | { type: 'strong' | 'em'; children: readonly RichTextInline[] }
  | {
      type: 'link';
      /** Policy-checked href; omitted when the URL was rejected. */
      href?: string;
      children: readonly RichTextInline[];
    };

/** A paragraph is a flat sequence of inline nodes. */
export type RichTextParagraph = {
  type: 'paragraph';
  children: readonly RichTextInline[];
};

/** Document: one or more paragraphs (blank lines split paragraphs). */
export type RichTextDocument = {
  paragraphs: readonly RichTextParagraph[];
};

/** Why a span degraded or a link was refused. */
export type RichTextIssueCode =
  | 'source-truncated'
  | 'depth-capped'
  | 'link-rejected'
  | 'html-as-text';

export interface RichTextDiagnostic {
  code: RichTextIssueCode;
  message: string;
  /** Character offset in the (possibly truncated) source when known. */
  offset?: number;
}

export interface RichTextResult {
  document: RichTextDocument;
  diagnostics: readonly RichTextDiagnostic[];
}

/** Nesting and size caps: hostile input degrades to text, never recursion blowups. */
export const RICHTEXT_LIMITS = Object.freeze({
  /** Longest source accepted; remainder is dropped with a diagnostic. */
  source: 4_000,
  /** Nested emphasis and links. */
  inlineDepth: 6,
  /** Max paragraphs after blank-line split. */
  paragraphs: 256,
});

export type RichTextHrefTrust = 'developer' | 'untrusted';

export interface RichTextOptions {
  /**
   * Trust tier for link URLs. Default `untrusted` (agent/catalog content).
   * Developer-authored chrome may pass `developer`.
   */
  hrefTrust?: RichTextHrefTrust;
  /** Override source length cap (tests). */
  maxSource?: number;
  /** Override inline nesting depth (tests). */
  maxDepth?: number;
}
