/**
 * Comment threads, suggestions and named versions, stored in the replica
 * itself so they sync like content (ADR-010). Threads anchor to item ids
 * (the first and last character of the range), so a comment follows its
 * text through concurrent edits; when every character of the range is
 * deleted (or its block leaves the document) the thread is reported as
 * orphaned with the text it quoted. Suggestions are marks whose value is a
 * suggestion id, plus a record with the author. Versions are version
 * vectors with a name: the document at a version is rebuilt by replaying
 * the operations it covers.
 *
 * Everything read back from the replica came from peers: every field is
 * validated here, and a malformed record is skipped.
 */

import { walkDocument } from '../model/document.ts';
import { DOCUMENT_ID_PATTERN } from '../model/limits.ts';
import type { DocumentBlockId, TexuliDocument } from '../model/types.ts';
import {
  type ItemId,
  REPLICA_PATTERN,
  type Replica,
  type SyncJson,
  type VersionVector,
} from '../sync/index.ts';
import { type FieldView, offsetOfRaw, type Projection, unitAtOffset } from './project.ts';
import {
  COMMENTS_NODE,
  decodeValue,
  encodeValue,
  kindOf,
  SUGGEST_DELETE,
  SUGGEST_INSERT,
  SUGGESTIONS_NODE,
  textFieldOf,
  VERSIONS_NODE,
} from './vocabulary.ts';

/** Caps on annotation text (the document format's comment caps). */
export const ANNOTATION_LIMITS = Object.freeze({
  /** Code points in a message body. */
  body: 4_000,
  /** Characters of a display name. */
  author: 200,
  /** Characters of quoted text kept with a thread. */
  quote: 2_000,
  /** Characters of a version name. */
  name: 120,
  /** Threads, messages per thread, suggestions and versions read back. */
  threads: 500,
  messages: 200,
  versions: 500,
});

/** A mention in a message body: the G48 inline extension grammar `@{id|label}`. */
export interface CommentMention {
  id: string;
  label: string;
}

/** A body as text and mentions, in order. */
export type CommentSegment = { text: string } | { mention: CommentMention };

const MENTION_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;

/** Split a message body into text and `@{id|label}` mentions. Linear; never throws. */
export function parseMentions(body: string): CommentSegment[] {
  const out: CommentSegment[] = [];
  let text = '';
  let at = 0;
  while (at < body.length) {
    const open = body.indexOf('@{', at);
    if (open < 0) break;
    const bar = body.indexOf('|', open + 2);
    const close = bar < 0 ? -1 : body.indexOf('}', bar + 1);
    const nextOpen = body.indexOf('@{', open + 2);
    const id = bar < 0 ? '' : body.slice(open + 2, bar);
    const label = close < 0 ? '' : body.slice(bar + 1, close);
    if (
      close < 0 ||
      (nextOpen >= 0 && nextOpen < close) ||
      !MENTION_ID.test(id) ||
      label.length === 0 ||
      label.length > 200 ||
      label.includes('\n')
    ) {
      text += body.slice(at, open + 2);
      at = open + 2;
      continue;
    }
    text += body.slice(at, open);
    if (text) out.push({ text });
    text = '';
    out.push({ mention: { id, label } });
    at = close + 1;
  }
  text += body.slice(at);
  if (text) out.push({ text });
  return out;
}

/** C0/C1 controls (newline and tab allowed in bodies), separators and bidi controls. */
function unsafeText(value: string, multiline: boolean): boolean {
  for (let i = 0; i < value.length; i += 1) {
    const c = value.charCodeAt(i);
    if (multiline && (c === 0x0a || c === 0x09)) continue;
    if (c < 0x20 || (c >= 0x7f && c <= 0x9f) || c === 0x2028 || c === 0x2029) return true;
    if ((c >= 0x202a && c <= 0x202e) || (c >= 0x2066 && c <= 0x2069)) return true;
  }
  return false;
}

const text = (value: SyncJson | undefined, max: number, multiline = false): string | null =>
  typeof value === 'string' && value.length <= max && !unsafeText(value, multiline) ? value : null;

function itemId(value: SyncJson | undefined): ItemId | null {
  if (!Array.isArray(value) || value.length !== 2) return null;
  const [replica, counter] = value;
  if (typeof replica !== 'string' || !REPLICA_PATTERN.test(replica)) return null;
  if (!Number.isSafeInteger(counter) || (counter as number) < 0) return null;
  return [replica, counter as number];
}

/** Check a display name or body a host passes in (refuses empty, too long or control characters). */
export function checkAnnotationText(value: unknown, max: number, multiline = false): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (trimmed.length === 0 || [...trimmed].length > max || unsafeText(trimmed, multiline))
    return null;
  return trimmed;
}

// ── comments ─────────────────────────────────────────────────────────────

export interface CollabMessage {
  id: string;
  author: string;
  body: string;
  /** Text and `@{id|label}` mentions of the body. */
  segments: CommentSegment[];
  mentions: CommentMention[];
  created?: string;
  /** The replica that wrote it (`mine` compares it with this session's). */
  replica?: string;
  mine: boolean;
}

export interface CollabThread {
  id: string;
  status: 'open' | 'resolved';
  author: string;
  created?: string;
  block: DocumentBlockId;
  /** The UTF-16 range in the block's text; `null` for a block comment or an orphaned thread. */
  range: { from: number; to: number } | null;
  /** The text the thread quoted when it was opened. */
  quote: string;
  /** True when the block left the document or every character of the range was deleted. */
  orphaned: boolean;
  messages: CollabMessage[];
}

/** Where a new comment points: a block, or a UTF-16 range of a text block. */
export interface CommentTarget {
  block: DocumentBlockId;
  from?: number;
  to?: number;
}

/** Resolve a target to item ids in the projection; `null` when it names no text or block. */
export function anchorTarget(
  projection: Projection,
  target: CommentTarget
): {
  block: string;
  field: string | null;
  start: ItemId | null;
  end: ItemId | null;
  quote: string;
} | null {
  if (typeof target?.block !== 'string' || !projection.has(target.block)) return null;
  if (target.from === undefined && target.to === undefined)
    return { block: target.block, field: null, start: null, end: null, quote: '' };
  const view = projection.view(target.block);
  if (!view || !Number.isSafeInteger(target.from) || !Number.isSafeInteger(target.to)) return null;
  const from = unitAtOffset(view, Math.max(0, target.from as number));
  const to = unitAtOffset(view, Math.min(view.offsets.at(-1) as number, target.to as number));
  if (to <= from) return null;
  return {
    block: target.block,
    field: view.field,
    start: view.ids[from] as ItemId,
    end: view.ids[to - 1] as ItemId,
    quote: view.chars.slice(from, to).join('').slice(0, ANNOTATION_LIMITS.quote),
  };
}

function resolveRange(
  replica: Replica,
  view: FieldView,
  start: ItemId,
  end: ItemId
): { from: number; to: number } | null {
  const s = replica.anchorIndex(view.node, view.field, { id: start, side: 'before' });
  const e = replica.anchorIndex(view.node, view.field, { id: end, side: 'after' });
  if (s === null || e === null || e <= s) return null;
  const from = offsetOfRaw(view, s);
  const to = offsetOfRaw(view, e);
  return to > from ? { from, to } : null;
}

function readMessage(replica: Replica, id: string, me: string): CollabMessage | null {
  const props = replica.node(id)?.props;
  if (!props) return null;
  const author = text(props.author, ANNOTATION_LIMITS.author);
  const body = text(props.body, ANNOTATION_LIMITS.body * 2, true);
  if (!author || !body) return null;
  const segments = parseMentions(body);
  const message: CollabMessage = {
    id,
    author,
    body,
    segments,
    mentions: segments.flatMap((segment) => ('mention' in segment ? [segment.mention] : [])),
    mine: props.replica === me,
  };
  const created = text(props.created, 40);
  if (created) message.created = created;
  if (typeof props.replica === 'string' && REPLICA_PATTERN.test(props.replica))
    message.replica = props.replica;
  return message;
}

/** Document order of every node id (pre-order index). */
function orderOf(doc: TexuliDocument): Map<string, number> {
  const order = new Map<string, number>();
  walkDocument(doc, ({ node }) => {
    order.set(node.id, order.size);
  });
  return order;
}

/** Every thread, anchored ones in document order, then orphaned ones in creation order. */
export function readThreads(replica: Replica, projection: Projection): CollabThread[] {
  const me = replica.id;
  const out: CollabThread[] = [];
  for (const id of replica.children(COMMENTS_NODE).slice(0, ANNOTATION_LIMITS.threads)) {
    const node = replica.node(id);
    if (node?.type !== 'thread') continue;
    const props = node.props;
    const block =
      typeof props.block === 'string' && DOCUMENT_ID_PATTERN.test(props.block) ? props.block : null;
    const author = text(props.author, ANNOTATION_LIMITS.author);
    if (!block || !author) continue;
    const quote = text(props.quote, ANNOTATION_LIMITS.quote, true) ?? '';
    const start = itemId(props.start);
    const end = itemId(props.end);
    let range: { from: number; to: number } | null = null;
    let orphaned = !projection.has(block);
    if (!orphaned && start && end) {
      const view = projection.view(block);
      range = view && view.field === props.field ? resolveRange(replica, view, start, end) : null;
      orphaned = range === null;
    }
    const messages: CollabMessage[] = [];
    for (const child of replica.children(id).slice(0, ANNOTATION_LIMITS.messages)) {
      const message = readMessage(replica, child, me);
      if (message) messages.push(message);
    }
    const thread: CollabThread = {
      id,
      status: props.status === 'resolved' ? 'resolved' : 'open',
      author,
      block,
      range,
      quote,
      orphaned,
      messages,
    };
    const created = text(props.created, 40);
    if (created) thread.created = created;
    out.push(thread);
  }
  const order = orderOf(projection.document);
  const anchored = out.filter((thread) => !thread.orphaned);
  anchored.sort(
    (a, b) =>
      (order.get(a.block) ?? 0) - (order.get(b.block) ?? 0) ||
      (a.range?.from ?? -1) - (b.range?.from ?? -1)
  );
  return [...anchored, ...out.filter((thread) => thread.orphaned)];
}

export interface AuthorInfo {
  name: string;
  created?: string;
}

/** Write a thread with its first message (call inside a transaction); returns the thread id. */
export function writeThread(
  replica: Replica,
  anchor: NonNullable<ReturnType<typeof anchorTarget>>,
  body: string,
  author: AuthorInfo
): string {
  replica.ensureNode(COMMENTS_NODE, 'comments');
  const props: { [key: string]: SyncJson } = {
    block: anchor.block,
    field: anchor.field,
    start: anchor.start ? [...anchor.start] : null,
    end: anchor.end ? [...anchor.end] : null,
    quote: anchor.quote,
    status: 'open',
    author: author.name,
    replica: replica.id,
  };
  if (author.created) props.created = author.created;
  const thread = replica.insertNode(
    'thread',
    COMMENTS_NODE,
    replica.children(COMMENTS_NODE).length,
    { props }
  );
  writeMessage(replica, thread, body, author);
  return thread;
}

/** Append a message to a thread (call inside a transaction); returns its id. */
export function writeMessage(
  replica: Replica,
  thread: string,
  body: string,
  author: AuthorInfo
): string {
  const props: { [key: string]: SyncJson } = { author: author.name, body, replica: replica.id };
  if (author.created) props.created = author.created;
  return replica.insertNode('message', thread, replica.children(thread).length, { props });
}

// ── suggestions ──────────────────────────────────────────────────────────

/** One contiguous change of a suggestion. */
export interface SuggestionChange {
  block: DocumentBlockId;
  kind: 'insert' | 'delete';
  /** UTF-16 range in the block's text. */
  from: number;
  to: number;
  text: string;
}

export interface CollabSuggestion {
  id: string;
  author: string;
  created?: string;
  replica?: string;
  mine: boolean;
  changes: SuggestionChange[];
}

/** True when a suggestion id was made by `replica` (ids are `<replica>.<counter>`). */
export const suggestionBy = (id: string, replica: string) => id.startsWith(`${replica}.`);

/** Pending suggestions (those with marks in the document), in document order. */
export function readSuggestions(replica: Replica, projection: Projection): CollabSuggestion[] {
  const byId = new Map<string, CollabSuggestion>();
  walkDocument(projection.document, ({ node }) => {
    const field = textFieldOf(kindOf(node));
    if (!field) return;
    const view = projection.view(node.id);
    if (!view) return;
    for (const [kind, list] of [
      ['insert', view.inserted],
      ['delete', view.deleted],
    ] as const) {
      let i = 0;
      while (i < list.length) {
        const sid = list[i];
        if (sid === null || sid === undefined) {
          i += 1;
          continue;
        }
        let j = i + 1;
        while (j < list.length && list[j] === sid) j += 1;
        let suggestion = byId.get(sid);
        if (!suggestion) {
          const props = replica.node(sid)?.props ?? {};
          suggestion = {
            id: sid,
            author: text(props.author, ANNOTATION_LIMITS.author) ?? '',
            mine: suggestionBy(sid, replica.id),
            changes: [],
          };
          const created = text(props.created, 40);
          if (created) suggestion.created = created;
          if (typeof props.replica === 'string' && REPLICA_PATTERN.test(props.replica))
            suggestion.replica = props.replica;
          byId.set(sid, suggestion);
        }
        suggestion.changes.push({
          block: node.id,
          kind,
          from: view.offsets[i] as number,
          to: view.offsets[j] as number,
          text: view.chars.slice(i, j).join(''),
        });
        i = j;
      }
    }
  });
  const order = orderOf(projection.document);
  const byPosition = (a: SuggestionChange, b: SuggestionChange) =>
    (order.get(a.block) ?? 0) - (order.get(b.block) ?? 0) || a.from - b.from;
  for (const suggestion of byId.values()) suggestion.changes.sort(byPosition);
  return [...byId.values()].sort((a, b) =>
    byPosition(a.changes[0] as SuggestionChange, b.changes[0] as SuggestionChange)
  );
}

/** Create a suggestion record (call inside a transaction); its id is the marks' value. */
export function writeSuggestion(replica: Replica, author: AuthorInfo): string {
  replica.ensureNode(SUGGESTIONS_NODE, 'suggestions');
  const props: { [key: string]: SyncJson } = {
    author: author.name,
    replica: replica.id,
    status: 'open',
  };
  if (author.created) props.created = author.created;
  return replica.insertNode(
    'suggestion',
    SUGGESTIONS_NODE,
    replica.children(SUGGESTIONS_NODE).length,
    {
      props,
    }
  );
}

/**
 * Accept or reject one suggestion (call inside a transaction): accepting
 * keeps its insertions and deletes its deletions; rejecting does the
 * opposite. Ordinary operations, so it syncs and undoes like any edit.
 */
export function settleSuggestion(
  replica: Replica,
  projection: Projection,
  id: string,
  accept: boolean
): boolean {
  let touched = false;
  walkDocument(projection.document, ({ node }) => {
    const text = textFieldOf(kindOf(node));
    if (!text) return;
    const runs = replica.textRuns(node.id, text.field);
    const marks: { insert: [number, number][]; delete: [number, number][] } = {
      insert: [],
      delete: [],
    };
    let at = 0;
    for (const run of runs) {
      const length = [...run.text].length;
      for (const [kind, key] of [
        ['insert', SUGGEST_INSERT],
        ['delete', SUGGEST_DELETE],
      ] as const) {
        if (run.marks[key] !== id) continue;
        const list = marks[kind];
        const last = list.at(-1);
        if (last && last[1] === at) last[1] = at + length;
        else list.push([at, at + length]);
      }
      at += length;
    }
    if (marks.insert.length === 0 && marks.delete.length === 0) return;
    touched = true;
    const keep = accept ? marks.insert : marks.delete;
    const drop = accept ? marks.delete : marks.insert;
    for (const [from, to] of keep)
      replica.formatText(
        node.id,
        text.field,
        from,
        to,
        accept ? SUGGEST_INSERT : SUGGEST_DELETE,
        null
      );
    for (let i = drop.length - 1; i >= 0; i -= 1) {
      const [from, to] = drop[i] as [number, number];
      replica.deleteText(node.id, text.field, from, to - from);
    }
  });
  if (touched && replica.node(id)) replica.setProp(id, 'status', accept ? 'accepted' : 'rejected');
  return touched;
}

// ── versions ─────────────────────────────────────────────────────────────

export interface CollabVersion {
  id: string;
  name: string;
  author: string;
  created?: string;
  /** What the version covers. */
  vector: VersionVector;
}

function readVector(raw: SyncJson | undefined): VersionVector | null {
  const value = decodeValue(raw);
  if (!Array.isArray(value)) return null;
  const vector: VersionVector = {};
  for (const pair of value) {
    if (!Array.isArray(pair) || pair.length !== 2) return null;
    const [replica, counter] = pair;
    if (typeof replica !== 'string' || !REPLICA_PATTERN.test(replica)) return null;
    if (!Number.isSafeInteger(counter) || (counter as number) < 0) return null;
    vector[replica] = counter as number;
  }
  return vector;
}

/** Named versions, oldest first. */
export function readVersions(replica: Replica): CollabVersion[] {
  const out: CollabVersion[] = [];
  for (const id of replica.children(VERSIONS_NODE).slice(0, ANNOTATION_LIMITS.versions)) {
    const node = replica.node(id);
    if (node?.type !== 'version') continue;
    const name = text(node.props.name, ANNOTATION_LIMITS.name);
    const author = text(node.props.author, ANNOTATION_LIMITS.author);
    const vector = readVector(node.props.vector);
    if (!name || !author || !vector) continue;
    const version: CollabVersion = { id, name, author, vector };
    const created = text(node.props.created, 40);
    if (created) version.created = created;
    out.push(version);
  }
  return out;
}

/** Record a named version of the current state (call inside a transaction); returns its id. */
export function writeVersion(replica: Replica, name: string, author: AuthorInfo): string {
  const vector = replica.versionVector();
  replica.ensureNode(VERSIONS_NODE, 'versions');
  const props: { [key: string]: SyncJson } = {
    name,
    author: author.name,
    replica: replica.id,
    vector: encodeValue(
      Object.entries(vector)
        .sort(([a], [b]) => (a < b ? -1 : 1))
        .map(([key, counter]) => [key, counter])
    ),
  };
  if (author.created) props.created = author.created;
  return replica.insertNode('version', VERSIONS_NODE, replica.children(VERSIONS_NODE).length, {
    props,
  });
}
