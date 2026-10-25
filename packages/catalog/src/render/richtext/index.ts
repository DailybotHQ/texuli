/**
 * `@texuli/catalog/render/richtext` — inline Markdown subset → sink-free nodes.
 *
 * Never produces HTML. Links use `@texuli/core/url-policy` `safeHref`.
 * Hosts map {@link RichTextInline} trees to real components or plain text.
 */

export { renderRichText, richTextToPlain } from './parse.ts';
export {
  RICHTEXT_LIMITS,
  type RichTextDiagnostic,
  type RichTextDocument,
  type RichTextHrefTrust,
  type RichTextInline,
  type RichTextIssueCode,
  type RichTextOptions,
  type RichTextParagraph,
  type RichTextResult,
} from './types.ts';
