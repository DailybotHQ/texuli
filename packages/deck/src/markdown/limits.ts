/**
 * Bounds of the deck Markdown dialect (ADR-009). Hostile documents stop at a
 * bound with a diagnostic; nothing past a bound is scanned twice.
 */
export const DECK_MARKDOWN_LIMITS = Object.freeze({
  /** UTF-8 bytes of the whole document (the untrusted loader's 1 MiB). */
  bytes: 1_048_576,
  /** Lines of the whole document. */
  lines: 100_000,
  /** UTF-16 units of one line. */
  lineLength: 20_000,
  /** Lines of the frontmatter block. */
  frontmatterLines: 64,
  /** Slides (the model's cap). */
  slides: 200,
  /** Attributes in one comment or brace list. */
  attributes: 32,
  /** UTF-16 units of one attribute value. */
  attributeValue: 512,
  /** Directive nesting: a region may hold a component fence, nothing deeper. */
  directiveDepth: 2,
  /** UTF-16 units of one JSON fence body. */
  jsonBody: 65_536,
  /** Nesting of one JSON fence body. */
  jsonDepth: 32,
  /** JSON values across one document. */
  jsonNodes: 20_000,
  /** Highlight steps of one code fence (`[1-2|4-6]`). */
  codeSteps: 16,
  /** Diagnostics kept (the rest set `truncated`). */
  issues: 200,
});
