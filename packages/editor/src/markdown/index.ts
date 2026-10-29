/**
 * `@texuli/editor/markdown`: Markdown in and out of the editor document,
 * framework-free (ADR-003, EDITOR_ARCHITECTURE section 9). It reads and
 * writes the closed subset the editor can hold: paragraphs, headings 1–4,
 * bullet, ordered and todo lists, quotes, fenced code, dividers, media
 * references, breaks, and the strong, em, strike, code and link marks.
 *
 * Nothing here produces HTML. Raw HTML in the source stays literal text and
 * is escaped when written back; every link passes `safeHref` at the given
 * trust (`untrusted` by default); input is capped and read in linear time.
 */
import {
  fromMarkdown,
  MARKDOWN_CODEC_LIMITS,
  type MarkdownReadOptions,
  toMarkdown,
} from '@texuli/core/editor-markdown';
import {
  type EditorDocument,
  type EditorLoadResult,
  loadEditorDocument,
} from '@texuli/core/editor-model';
import type { HrefTrust } from '@texuli/core/url-policy';

export { MARKDOWN_CODEC_LIMITS };

/** `trust` (default `untrusted`), `newId`, lower `limits` and `maxSource`. */
export type MarkdownToDocumentOptions = MarkdownReadOptions;

export interface DocumentToMarkdownOptions {
  /** URL policy tier every link is checked at again. Default `untrusted`. */
  trust?: HrefTrust;
}

/**
 * Read Markdown (agent output, stored text, a file) into a valid editor
 * document. Never throws: what the subset cannot hold degrades to text and
 * each degradation is reported once in `diagnostics`.
 */
export function markdownToDocument(
  source: unknown,
  options: MarkdownToDocumentOptions = {}
): EditorLoadResult {
  return fromMarkdown(source, options);
}

/**
 * Write an editor document as Markdown that reads back to the same document
 * (except what the subset cannot spell, such as empty paragraphs). The
 * document is loaded again first, so a hand-built one is held to the same
 * caps and URL policy: a refused link is written as its text.
 */
export function documentToMarkdown(
  doc: EditorDocument,
  options: DocumentToMarkdownOptions = {}
): string {
  const loaded = loadEditorDocument(doc, { trust: options.trust ?? 'untrusted' });
  return toMarkdown(loaded.doc);
}
