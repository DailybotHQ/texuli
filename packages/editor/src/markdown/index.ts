/**
 * `@texuli/editor/markdown`: Markdown in and out of the editor document,
 * framework-free (ADR-003, EDITOR_ARCHITECTURE section 9). It reads and
 * writes the closed subset the editor can hold: paragraphs, headings 1–4,
 * bullet, ordered and todo lists, quotes, fenced code, dividers, media
 * references, breaks, and the strong, em, strike, code and link marks.
 *
 * Host inline extensions (mentions `@{person-1|Ada}`, references
 * `#{rec-7|Roadmap}`) round trip with their entity id when the same
 * `extensions` are passed both ways (see `createInlineExtensions` in
 * `@texuli/core/editor-model`).
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
  type EditorInlineExtension,
  type EditorInlineExtensions,
  type EditorLoadResult,
  loadEditorDocument,
  toInlineExtensions,
} from '@texuli/core/editor-model';
import type { HrefTrust } from '@texuli/core/url-policy';

export { MARKDOWN_CODEC_LIMITS };

/** `trust` (default `untrusted`), `newId`, lower `limits`, `maxSource` and `extensions`. */
export type MarkdownToDocumentOptions = MarkdownReadOptions;

export interface DocumentToMarkdownOptions {
  /** URL policy tier every link is checked at again. Default `untrusted`. */
  trust?: HrefTrust;
  /**
   * Host inline extensions written as `<sigil>{id|label}`; extension marks of
   * other names are written as their label text. None by default.
   */
  extensions?: EditorInlineExtensions | readonly EditorInlineExtension[];
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
  const extensions = toInlineExtensions(options.extensions);
  const loaded = loadEditorDocument(doc, { trust: options.trust ?? 'untrusted', extensions });
  return toMarkdown(loaded.doc, { extensions });
}
