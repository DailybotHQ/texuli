/**
 * @texuli/core/html (ADR-034): untrusted HTML → `texuli-md/v1` Markdown AST through a tolerant,
 * DOM-free tokenizer and the same element allowlist `core/markdown-html` writes. The result is
 * plain data; links and images pass the URL policy at the caller's tier. See `read.ts` for the
 * mapping and the loss rules. Turning the tree into Markdown text is the Markdown writer's job
 * (`@texuli/core/markdown`).
 */
export { DiagnosticList, MAX_DIAGNOSTICS_PER_CODE } from './diagnostics.ts';
export { decodeHtmlEntities } from './entities.ts';
export { HTML_MAX_ELEMENT_DEPTH, type HtmlReadOptions, htmlToMarkdownTree } from './read.ts';
export {
  HTML_TOKEN_LIMITS,
  type HtmlAttributes,
  type HtmlToken,
  KEPT_ATTRIBUTES,
  RAW_DROPPED,
  tokenizeHtml,
} from './tokenize.ts';
