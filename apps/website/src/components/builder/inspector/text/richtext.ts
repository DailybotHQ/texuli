/**
 * The interchange between a text block's Markdown field and the rich text
 * editor's model. The field keeps storing Markdown (the subset text blocks
 * and the catalog's rich text parse); the editor reads it at the untrusted
 * tier and writes it back on each edit. Framework-free, so it can move into
 * a future `@texuli/builder` unchanged.
 */
import { fromMarkdown, toMarkdown } from '@texuli/core/editor-markdown';
import type { EditorDocument, EditorIssue } from '@texuli/core/editor-model';

export interface RichTextField {
  readonly doc: EditorDocument;
  /** What the editor could not keep from the stored Markdown, as sentences. */
  readonly notes: readonly string[];
}

const NOTE: Partial<Record<EditorIssue['code'], string>> = {
  'link-rejected':
    'A link was refused by the URL policy. The editor shows its text only, and your next edit here saves it as plain text.',
  'text-truncated': 'Text past the field limit was left out of the editor.',
};

/** Read a stored Markdown field into an editor document, with notes for every degradation. */
export function readRichText(markdown: string, max: number): RichTextField {
  const { doc, diagnostics } = fromMarkdown(markdown, max > 0 ? { maxSource: max } : {});
  const notes = [...new Set(diagnostics.map((issue) => NOTE[issue.code] ?? issue.message))];
  return { doc, notes };
}

/** The Markdown an edited document saves as. */
export function writeRichText(doc: EditorDocument): string {
  return toMarkdown(doc);
}
