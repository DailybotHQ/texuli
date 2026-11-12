/**
 * @texuli/core/markdown-html (ADR-034): `texuli-md/v1` Markdown AST → a safe HTML fragment,
 * written only through `@texuli/core/markup` (element allowlist, escaped text and attributes,
 * every `href` and `src` through the URL policy at the caller's tier). Raw HTML in the tree is
 * dropped or escaped, never emitted. See `render.ts` for the output and loss rules.
 */
export {
  footnoteIdPart,
  MARKDOWN_HTML_MAX_DEPTH,
  type MarkdownHtmlOptions,
  type MarkdownHtmlResult,
  type MarkdownMarkupResult,
  markdownTreeToHtml,
  markdownTreeToMarkup,
} from './render.ts';
