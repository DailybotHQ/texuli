/**
 * How a document maps onto the generic CRDT of `@texuli/document/sync`
 * (ADR-010): every block, column and list item is a tree node whose id is
 * the persisted id and whose type is the node kind (`item` for a list
 * item); attributes are last-writer-wins registers; the text of
 * paragraphs, headings (`content`), toggles (`summary`) and code blocks
 * (`text`) is a sequence with marks; metadata and page settings are
 * registers on the root. Annotations (comment threads, suggestions and
 * named versions) live in detached containers that no block can name,
 * because their ids hold a `:` that persisted ids never do.
 */
import type { EditorMark } from '@texuli/core/editor-model';
import { type HrefTrust, safeHref } from '@texuli/core/url-policy';
import { DOCUMENT_BLOCK_TYPES } from '../model/limits.ts';
import type { DocumentNode } from '../model/types.ts';
import { NODE_ATTRS } from '../ops/operations.ts';
import type { MarkExpand, SyncJson } from '../sync/index.ts';
import { checkJson } from '../sync/validate.ts';

/** The node kind: the block type, or `item` for a list item. */
export const kindOf = (node: DocumentNode): string => ('type' in node ? node.type : 'item');

/** The container of comment threads (detached: never under the root). */
export const COMMENTS_NODE = 'x:comments';
/** The container of suggestion records. */
export const SUGGESTIONS_NODE = 'x:suggestions';
/** The container of named versions. */
export const VERSIONS_NODE = 'x:versions';

/** Annotation node types: containers, threads, messages, suggestions and versions. */
export const ANNOTATION_TYPES = Object.freeze([
  'comments',
  'thread',
  'message',
  'suggestions',
  'suggestion',
  'versions',
  'version',
]);

/** Every node type a document replica accepts (a closed set: creates of others are dropped). */
export const COLLAB_NODE_TYPES: readonly string[] = Object.freeze([
  ...DOCUMENT_BLOCK_TYPES,
  'column',
  'item',
  ...ANNOTATION_TYPES,
]);

/** Mark key of suggested insertions (the value is the suggestion id). */
export const SUGGEST_INSERT = 'suggest-insert';
/** Mark key of suggested deletions (the value is the suggestion id). */
export const SUGGEST_DELETE = 'suggest-delete';

/** The document marks (the document format's mark vocabulary). */
export const DOCUMENT_MARK_KEYS = Object.freeze([
  'strong',
  'em',
  'strike',
  'code',
  'link',
] as const);

/** Every mark key a document replica accepts. */
export const COLLAB_MARK_KEYS: readonly string[] = Object.freeze([
  ...DOCUMENT_MARK_KEYS,
  SUGGEST_INSERT,
  SUGGEST_DELETE,
]);

/** Links and suggestions never grow at their end; emphasis does (ADR-010). */
export function collabMarkExpand(key: string): MarkExpand {
  return key === 'link' || key === SUGGEST_INSERT || key === SUGGEST_DELETE ? 'none' : 'end';
}

/** Metadata fields, stored as registers on the root under the same names. */
export const META_FIELDS = Object.freeze([
  'title',
  'description',
  'locale',
  'dir',
  'authors',
  'tags',
  'created',
  'updated',
] as const);

/** The root register that holds the page settings. */
export const PAGE_FIELD = 'page';

/** The text field of a node kind, and whether it holds marks; `null` for kinds without text. */
export function textFieldOf(
  kind: string
): { field: 'content' | 'summary' | 'text'; rich: boolean } | null {
  if (kind === 'paragraph' || kind === 'heading') return { field: 'content', rich: true };
  if (kind === 'toggle') return { field: 'summary', rich: true };
  if (kind === 'code') return { field: 'text', rich: false };
  return null;
}

/** The attribute registers of a node kind (`NODE_ATTRS` of `@texuli/document/ops`). */
export const attrsOf = (kind: string): readonly string[] => NODE_ATTRS[kind] ?? [];

/** Child kinds a parent kind accepts (`root` is the top level). */
export function acceptsChild(parent: string, child: string): boolean {
  if (parent === 'list') return child === 'item';
  if (parent === 'columns') return child === 'column';
  if (
    parent === 'root' ||
    parent === 'quote' ||
    parent === 'callout' ||
    parent === 'toggle' ||
    parent === 'column' ||
    parent === 'item'
  )
    return (
      child !== 'item' &&
      child !== 'column' &&
      (DOCUMENT_BLOCK_TYPES as readonly string[]).includes(child)
    );
  return false;
}

/** Kinds whose children are a list (blocks, items or columns). */
export function childKeyOf(kind: string): 'blocks' | 'items' | 'columns' | null {
  if (kind === 'list') return 'items';
  if (kind === 'columns') return 'columns';
  if (
    kind === 'quote' ||
    kind === 'callout' ||
    kind === 'toggle' ||
    kind === 'column' ||
    kind === 'item'
  )
    return 'blocks';
  return null;
}

/** A document mark as a CRDT mark: its key and value. */
export function markToSync(mark: EditorMark): [string, SyncJson] {
  if (mark.type === 'link') return ['link', mark.href];
  if (mark.type === 'extension') return ['extension', null];
  return [mark.type, true];
}

/**
 * The document mark a CRDT mark value stands for, or `null` when the value
 * is malformed or (for links) refused by the URL policy at `tier`.
 */
export function markFromSync(
  key: string,
  value: SyncJson,
  tier: HrefTrust = 'untrusted'
): EditorMark | null {
  switch (key) {
    case 'strong':
    case 'em':
    case 'strike':
    case 'code':
      return value === true ? { type: key } : null;
    case 'link':
      return typeof value === 'string' &&
        value.length > 0 &&
        value.length <= 2_048 &&
        ![...value].some(richRefuses) &&
        !value.includes('\n') &&
        safeHref(value, tier) !== undefined
        ? { type: 'link', href: value }
        : null;
    default:
      return null;
  }
}

/** Characters a rich text run refuses (a newline is a break, kept). */
export function richRefuses(char: string): boolean {
  const c = char.charCodeAt(0);
  if (c === 0x0a) return false;
  if (c < 0x20 || (c >= 0x7f && c <= 0x9f)) return true;
  return (
    c === 0x2028 || c === 0x2029 || (c >= 0x202a && c <= 0x202e) || (c >= 0x2066 && c <= 0x2069)
  );
}

/** Characters a code block refuses (tab, line feed and carriage return stay). */
export function codeRefuses(char: string): boolean {
  const c = char.charCodeAt(0);
  if (c === 0x09 || c === 0x0a || c === 0x0d) return false;
  if (c < 0x20 || (c >= 0x7f && c <= 0x9f)) return true;
  return (c >= 0x202a && c <= 0x202e) || (c >= 0x2066 && c <= 0x2069);
}

/** Characters of one chunk of a value that is too large for one register. */
const CHUNK = 10_000;
/** JSON text a chunked value may hold (the inline payload cap with room for escapes). */
const MAX_CHUNKED = 400_000;

/**
 * A document value as a register value. Values within the sync bounds
 * travel as they are; larger ones (an inline embed payload) travel as
 * `{ $json: [chunks] }`, still one register, so a concurrent replacement
 * never mixes two writers' chunks.
 */
export function encodeValue(value: unknown): SyncJson {
  if (value === undefined) return null;
  try {
    checkJson(value);
    return value as SyncJson;
  } catch {
    const text = JSON.stringify(value);
    const chunks: string[] = [];
    for (let at = 0; at < text.length; at += CHUNK) chunks.push(text.slice(at, at + CHUNK));
    return { $json: chunks };
  }
}

/** The document value of a register (chunked values are joined and parsed; malformed ones are `null`). */
export function decodeValue(value: SyncJson | undefined): unknown {
  if (value === undefined || value === null) return null;
  if (typeof value === 'object' && !Array.isArray(value)) {
    const keys = Object.keys(value);
    const chunks = (value as { $json?: unknown }).$json;
    if (keys.length === 1 && Array.isArray(chunks)) {
      let total = 0;
      for (const chunk of chunks) {
        if (typeof chunk !== 'string') return null;
        total += chunk.length;
      }
      if (total > MAX_CHUNKED) return null;
      try {
        return JSON.parse(chunks.join('')) as unknown;
      } catch {
        return null;
      }
    }
  }
  return value;
}
