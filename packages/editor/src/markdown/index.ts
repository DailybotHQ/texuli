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
 * `documentToDialect` writes the document for a chat platform (Slack, Discord, WhatsApp,
 * Telegram, Teams, Google Chat, Mattermost, plain text) through `@texuli/core/markdown-dialects`,
 * with the losses each format reports.
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
import {
  type MarkdownDiagnostic,
  type MarkdownDiagnosticCode,
  type MdBlock,
  parseMarkdown,
} from '@texuli/core/markdown';
import {
  MARKDOWN_DIALECTS,
  type MarkdownDialect,
  writeMarkdownDialect,
} from '@texuli/core/markdown-dialects';
import type { HrefTrust } from '@texuli/core/url-policy';
import { PASTE_LIMITS } from '../paste/html.ts';
import {
  countRejected,
  finish,
  type PasteOptions,
  type PasteResult,
  TRUNCATED,
} from '../paste/result.ts';

export type { MarkdownDialect };

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

// ── export to chat dialects (PLAN_023 row 11) ───────────────────────────

/** The chat formats `documentToDialect` writes, in menu order. */
export const EDITOR_EXPORT_DIALECTS: readonly MarkdownDialect[] = MARKDOWN_DIALECTS;

/** Visible names of the export formats (translate by passing your own map). */
export const EDITOR_DIALECT_NAMES: Readonly<Record<MarkdownDialect, string>> = Object.freeze({
  slack: 'Slack',
  discord: 'Discord',
  whatsapp: 'WhatsApp',
  'telegram-markdown-v2': 'Telegram (MarkdownV2)',
  'telegram-html': 'Telegram (HTML)',
  teams: 'Microsoft Teams',
  'google-chat': 'Google Chat',
  mattermost: 'Mattermost',
  'plain-text': 'Plain text',
});

export interface DocumentToDialectOptions {
  /** URL policy tier links are checked at again. Default `untrusted`. */
  trust?: HrefTrust;
}

/** One thing the format cannot carry, with how often it happened. */
export interface DialectLoss {
  readonly code: MarkdownDiagnosticCode;
  readonly message: string;
  readonly count: number;
}

export interface DocumentToDialectResult {
  /** The message text in the chosen format. */
  readonly value: string;
  /** What the format lost or changed, grouped by message, for the user to see. */
  readonly losses: readonly DialectLoss[];
}

/** The GFM the editor holds: task items and strikethrough. */
const EXPORT_GFM = {
  table: false,
  footnote: false,
  autolink: false,
  strikethrough: true,
  taskList: true,
} as const;

/**
 * Write an editor document for a chat platform: the document's Markdown (the editor codec,
 * every link checked again at `trust`) read by the shared CommonMark parser and written by
 * `@texuli/core/markdown-dialects`. Broadcast mentions are never written (`@everyone`,
 * `@here`, `@channel` stay text), and host extension marks are written as their label text.
 * Never throws; what the format cannot carry is returned in `losses`.
 */
export function documentToDialect(
  doc: EditorDocument,
  dialect: MarkdownDialect,
  options: DocumentToDialectOptions = {}
): DocumentToDialectResult {
  const trust = options.trust ?? 'untrusted';
  const markdown = documentToMarkdown(doc, { trust });
  const { tree } = parseMarkdown(markdown, { gfm: EXPORT_GFM });
  const own: MarkdownDiagnostic[] = [];
  const children = markTasks(tree.children, own);
  const written = writeMarkdownDialect({ ...tree, children }, dialect, {
    trust,
    allowBroadcastMentions: false,
  });
  const grouped = new Map<
    string,
    { code: MarkdownDiagnosticCode; message: string; count: number }
  >();
  for (const diagnostic of [...own, ...written.diagnostics]) {
    const key = `${diagnostic.code}\u0000${diagnostic.message}`;
    const entry = grouped.get(key);
    if (entry) entry.count += 1;
    else grouped.set(key, { code: diagnostic.code, message: diagnostic.message, count: 1 });
  }
  return { value: written.value, losses: [...grouped.values()] };
}

/**
 * No chat format has checklists: a checked or unchecked item keeps its state as a visible
 * ☑ / ☐ before its text, reported as a loss, instead of silently becoming a plain item.
 */
function markTasks(blocks: readonly MdBlock[], losses: MarkdownDiagnostic[]): MdBlock[] {
  return blocks.map((block): MdBlock => {
    if (block.type === 'blockquote')
      return { ...block, children: markTasks(block.children, losses) };
    if (block.type !== 'list') return block;
    return {
      ...block,
      children: block.children.map((item) => {
        const children = markTasks(item.children, losses);
        if (item.checked === undefined) return { ...item, children };
        losses.push({
          code: 'dialect-loss',
          message: 'Checklist items are written with ☑ and ☐ marks.',
        });
        const [first, ...rest] = children;
        const mark = { type: 'text' as const, value: item.checked ? '☑ ' : '☐ ' };
        const { checked: _checked, ...plain } = item;
        return {
          ...plain,
          children:
            first?.type === 'paragraph'
              ? [{ ...first, children: [mark, ...first.children] }, ...rest]
              : [{ type: 'paragraph' as const, children: [mark] }, ...children],
        };
      }),
    };
  });
}

// ── Paste as Markdown (PLAN_023 row 10) ─────────────────────────────────

/**
 * "Paste as Markdown": clipboard text read by the editor's Markdown codec at the `untrusted`
 * tier (raw HTML stays literal text, every link passes the policy), ending in the same
 * `PasteResult` as `@texuli/editor/paste` (source `'markdown'`). Only on the user's explicit
 * command; a plain paste never interprets Markdown. It lives here, with the parser, so the
 * paste reader and the controller do not carry the parser (the controller loads this lazily).
 */
export function importMarkdown(text: string, options: PasteOptions = {}): PasteResult {
  const source = typeof text === 'string' ? text : '';
  const truncated = source.length > PASTE_LIMITS.source;
  const read = fromMarkdown(truncated ? source.slice(0, PASTE_LIMITS.source) : source, {
    trust: 'untrusted',
    maxSource: PASTE_LIMITS.source,
    ...(options.newId ? { newId: options.newId } : {}),
    ...(options.limits ? { limits: options.limits } : {}),
  });
  return finish(
    read.doc,
    'markdown',
    options,
    [...(truncated ? [TRUNCATED] : []), ...read.diagnostics],
    countRejected(read.diagnostics)
  );
}
