/**
 * `@texuli/editor/paste`: framework-free clipboard import (EDITOR_ARCHITECTURE
 * section 8). Paste is data: every format becomes a fragment of the closed
 * editor vocabulary through `loadEditorDocument` at the `untrusted` tier,
 * whatever trust the editor itself was given. Nothing here touches the DOM.
 */
import {
  EDITOR_LIMITS,
  type EditorDocument,
  type EditorIdSource,
  type EditorIssue,
  type EditorLimits,
  editorBlockCount,
  loadEditorDocument,
} from '@texuli/core/editor-model';
import { safeHref } from '@texuli/core/url-policy';
import { htmlToBlocks, PASTE_LIMITS, type RawBlock } from './html.ts';

export {
  decodeEntities,
  type HtmlImportStats,
  type HtmlToken,
  htmlToBlocks,
  PASTE_LIMITS,
  type RawBlock,
  tokenizeHtml,
} from './html.ts';

/** The editor's own clipboard format (still untrusted on the way in). */
export const EDITOR_CLIPBOARD_TYPE = 'application/x-texuli-editor+json';

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

/** What `readClipboard` needs from a `DataTransfer`. */
export interface ClipboardLike {
  getData(type: string): string;
  readonly types?: readonly string[];
}

const TRUNCATED: EditorIssue = {
  code: 'text-truncated',
  message: `Clipboard content after ${PASTE_LIMITS.source} characters was dropped.`,
};

function finish(
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
    linksRemoved: rejected ? Math.max(1, linksRemoved) : 0,
  };
}

/** Count `link` marks whose href the URL policy will refuse (for the announcement). */
function countLinks(blocks: readonly RawBlock[]): number {
  const accept = (href: string) =>
    href.length <= EDITOR_LIMITS.href && safeHref(href, 'untrusted') !== undefined;
  let count = 0;
  const seen = new Set<unknown>();
  const visit = (nodes: readonly RawBlock[], depth: number) => {
    if (depth > PASTE_LIMITS.containers + 2) return;
    for (const block of nodes) {
      if (block.type === 'paragraph' || block.type === 'heading') {
        for (const run of block.content) {
          if (run.type !== 'text') continue;
          const link = run.marks.find((mark) => mark.type === 'link');
          if (link && link.type === 'link' && !seen.has(link) && !accept(link.href)) {
            seen.add(link);
            count += 1;
          }
        }
      } else if (block.type === 'quote') visit(block.blocks, depth + 1);
      else if (block.type === 'list') for (const item of block.items) visit(item.blocks, depth + 1);
    }
  };
  visit(blocks, 0);
  return count;
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

/** Clipboard HTML through the owned tokenizer and the element allowlist. */
export function importHtml(html: string, options: PasteOptions = {}): PasteResult {
  const limit = (options.limits?.blocks ?? EDITOR_LIMITS.blocks) + 1;
  const { blocks, stats } = htmlToBlocks(html, limit);
  const removed = countLinks(blocks);
  return finish(
    { version: 1, blocks },
    'html',
    options,
    stats.truncated ? [TRUNCATED] : [],
    removed
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
 * falls through to the next one.
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
