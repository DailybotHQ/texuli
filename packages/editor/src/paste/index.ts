/**
 * `@texuli/editor/paste`: framework-free clipboard import (EDITOR_ARCHITECTURE
 * section 8). Paste is data: every format becomes a fragment of the closed
 * editor vocabulary through `loadEditorDocument` at the `untrusted` tier,
 * whatever trust the editor itself was given. Nothing here touches the DOM.
 *
 * Clipboard HTML is read by the shared DOM-free reader (`htmlToMarkdownTree` from
 * `@texuli/core/html`, ADR-034) and projected onto the editor vocabulary; `text/plain` stays
 * plain. "Paste as Markdown" is `importMarkdown` in `@texuli/editor/markdown`.
 */
import { fromMarkdownTree } from '@texuli/core/editor-markdown';
import { EDITOR_LIMITS, type EditorIssue, editorBlockCount } from '@texuli/core/editor-model';
import { htmlToMarkdownTree } from '@texuli/core/html';
import { PASTE_LIMITS, type RawBlock } from './html.ts';
import {
  countRejected,
  finish,
  type PasteOptions,
  type PasteResult,
  type PasteSource,
  TRUNCATED,
} from './result.ts';

/**
 * The editor's previous clipboard-HTML tokenizer and block builder, kept exported for
 * compatibility. `importHtml` no longer uses them (it reads through `@texuli/core/html`).
 * @deprecated Use `importHtml`, or `htmlToMarkdownTree` from `@texuli/core/html`.
 */
export {
  decodeEntities,
  type HtmlImportStats,
  type HtmlToken,
  htmlToBlocks,
  PASTE_LIMITS,
  type RawBlock,
  tokenizeHtml,
} from './html.ts';
export type { PasteOptions, PasteResult, PasteSource };

/** The editor's own clipboard format (still untrusted on the way in). */
export const EDITOR_CLIPBOARD_TYPE = 'application/x-texuli-editor+json';

/** What `readClipboard` needs from a `DataTransfer`. */
export interface ClipboardLike {
  getData(type: string): string;
  readonly types?: readonly string[];
}

/**
 * Plain text: blank lines split paragraphs, single newlines become breaks.
 * Markdown is not interpreted (use `importMarkdown` for that).
 */
export function importPlainText(text: string, options: PasteOptions = {}): PasteResult {
  const truncated = text.length > PASTE_LIMITS.source;
  const source = truncated ? text.slice(0, PASTE_LIMITS.source) : text;
  const limit = options.limits?.blocks ?? EDITOR_LIMITS.blocks;
  const blocks: RawBlock[] = [];
  for (const part of source.replace(/\r\n?/g, '\n').split(/\n[ \t]*\n/)) {
    if (blocks.length > limit) break;
    const trimmed = part.replace(/^\n+|\n+$/g, '');
    if (trimmed.trim() !== '')
      blocks.push({ type: 'paragraph', content: [{ type: 'text', text: trimmed, marks: [] }] });
  }
  return finish({ version: 1, blocks }, 'text', options, truncated ? [TRUNCATED] : []);
}

/**
 * Clipboard HTML through the shared DOM-free reader at the `untrusted` tier: the element
 * allowlist of `@texuli/core/html` (script, style, iframe, svg and the other raw-text elements
 * dropped with their content; every attribute but the few it maps dropped), then the editor
 * vocabulary. Images become their alt text; refused links keep their text.
 */
export function importHtml(html: string, options: PasteOptions = {}): PasteResult {
  const read = htmlToMarkdownTree(typeof html === 'string' ? html : '', {
    trust: 'untrusted',
    maxSource: PASTE_LIMITS.source,
  });
  const truncated = read.diagnostics.some((d) => d.code === 'source-truncated');
  const refused = read.diagnostics.filter((d) => d.code === 'url-refused').length;
  const projected = fromMarkdownTree(read.tree, {
    trust: 'untrusted',
    images: 'text',
    ...(options.newId ? { newId: options.newId } : {}),
    ...(options.limits ? { limits: options.limits } : {}),
  });
  return finish(
    projected.doc,
    'html',
    options,
    [
      ...(truncated ? [TRUNCATED] : []),
      // The HTML reader refused these before the loader saw them: report them the same way.
      ...(refused > 0
        ? [
            {
              code: 'link-rejected',
              message: `${refused} pasted link(s) failed the URL policy; their text was kept.`,
            } as EditorIssue,
          ]
        : []),
      ...projected.diagnostics,
    ],
    refused + countRejected(projected.diagnostics)
  );
}

/** The editor's own JSON clipboard: parsed, validated and policy-checked again. */
export function importEditorJson(json: string, options: PasteOptions = {}): PasteResult {
  if (json.length > PASTE_LIMITS.source)
    return finish({ version: 1, blocks: [] }, 'editor', options, [TRUNCATED]);
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return finish(null, 'editor', options);
  }
  return finish(parsed, 'editor', options);
}

/**
 * Read a clipboard in the documented order: the editor's own JSON, then
 * `text/html`, then `text/plain`. Never throws; a format that reads as empty
 * falls through to the next one. Plain text is never read as Markdown: "Paste as
 * Markdown" is `importMarkdown` in `@texuli/editor/markdown`.
 */
export function readClipboard(data: ClipboardLike, options: PasteOptions = {}): PasteResult {
  const get = (type: string): string => {
    try {
      const value = data.getData(type);
      return typeof value === 'string' ? value : '';
    } catch {
      return '';
    }
  };
  const own = get(EDITOR_CLIPBOARD_TYPE);
  if (own) {
    const result = importEditorJson(own, options);
    if (result.source !== 'empty') return result;
  }
  const html = get('text/html');
  if (html) {
    const result = importHtml(html, options);
    if (result.source !== 'empty') return result;
  }
  const text = get('text/plain');
  if (text) return importPlainText(text, options);
  return finish({ version: 1, blocks: [] }, 'empty', options);
}

/** Total blocks in a pasted fragment, containers included. */
export const pastedBlockCount = (result: PasteResult): number =>
  editorBlockCount(result.doc.blocks);
