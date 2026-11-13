/**
 * Internal: the result shape every clipboard import ends in, shared by `@texuli/editor/paste`
 * and `importMarkdown` in `@texuli/editor/markdown` (not exported from either barrel).
 */
import {
  type EditorDocument,
  type EditorIdSource,
  type EditorIssue,
  type EditorLimits,
  loadEditorDocument,
} from '@texuli/core/editor-model';
import { PASTE_LIMITS } from './html.ts';

export type PasteSource = 'editor' | 'html' | 'text' | 'markdown' | 'empty';

export interface PasteOptions {
  newId?: EditorIdSource;
  /** Lower document caps (the editor's own limits). */
  limits?: Partial<EditorLimits>;
}

export interface PasteResult {
  /** The fragment to insert with `replaceSelection`. */
  doc: EditorDocument;
  diagnostics: readonly EditorIssue[];
  source: PasteSource;
  /** Top-level blocks pasted (0 for an empty clipboard). */
  blocks: number;
  /** Links the URL policy refused (their text was kept). */
  linksRemoved: number;
}

export const TRUNCATED: EditorIssue = {
  code: 'text-truncated',
  message: `Clipboard content after ${PASTE_LIMITS.source} characters was dropped.`,
};

export function finish(
  raw: unknown,
  source: PasteSource,
  options: PasteOptions,
  extra: EditorIssue[] = [],
  linksRemoved = 0
): PasteResult {
  const loaded = loadEditorDocument(raw, {
    trust: 'untrusted',
    ...(options.newId ? { newId: options.newId } : {}),
    ...(options.limits ? { limits: options.limits } : {}),
  });
  const empty = loaded.doc.blocks.every(
    (block) => block.type === 'paragraph' && block.content.length === 0
  );
  const rejected = loaded.diagnostics.some((issue) => issue.code === 'link-rejected');
  return {
    doc: empty ? { version: 1, blocks: [] } : loaded.doc,
    diagnostics: [...extra, ...loaded.diagnostics],
    source: empty ? 'empty' : source,
    blocks: empty ? 0 : loaded.doc.blocks.length,
    // Links the reader already refused, plus any the loader refuses now.
    linksRemoved: rejected ? Math.max(1, linksRemoved) : linksRemoved,
  };
}

export const countRejected = (issues: readonly EditorIssue[]) =>
  issues.filter((issue) => issue.code === 'link-rejected').length;
