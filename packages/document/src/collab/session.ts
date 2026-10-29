/**
 * A collaborative document session (ADR-010 bound to the ADR-011 format):
 * one replica, its projection, and the bridge to an editor's op log.
 *
 * - The editor edits its own document through `@texuli/document/ops` (the
 *   single edit path) and hands each accepted result to `commit`, which
 *   emits the replica operations (the id-keyed tree diff).
 * - Remote batches, undo, redo, restores and accepted suggestions change
 *   the replica; the session projects it again and tells listeners the
 *   document operations (`diffDocuments`) that bring the editor's
 *   document to the projection, which the editor applies as `sync`
 *   entries of its op log.
 * - Undo is the replica's: local, selective and made of new operations.
 *
 * Every replica of a document must start from the same document (its seed
 * operations are derived from the content, so identical starts merge as
 * one) or from a snapshot, and must project at the same URL tier.
 */
import type { HrefTrust } from '@texuli/core/url-policy';
import { DOCUMENT_FORMAT, DOCUMENT_FORMAT_VERSION } from '../model/limits.ts';
import type { DocumentAnnotations, TexuliDocument } from '../model/types.ts';
import { cloneData } from '../ops/clone.ts';
import type { DocumentOperation } from '../ops/operations.ts';
import {
  checkPresence,
  connectReplica,
  createPresenceStore,
  type PresenceCursor,
  type PresenceStore,
  Replica,
  SYNC_LIMITS,
  type SyncAdapter,
  type SyncBatch,
  type SyncConnection,
  type SyncOp,
  type SyncSnapshot,
} from '../sync/index.ts';
import {
  ANNOTATION_LIMITS,
  type AuthorInfo,
  anchorTarget,
  type CollabSuggestion,
  type CollabThread,
  type CollabVersion,
  type CommentTarget,
  checkAnnotationText,
  readSuggestions,
  readThreads,
  readVersions,
  settleSuggestion,
  suggestionBy,
  writeMessage,
  writeSuggestion,
  writeThread,
  writeVersion,
} from './annotations.ts';
import { commitDocument } from './commit.ts';
import { type DocumentChange, describeChanges, diffDocuments } from './diff.ts';
import { offsetOfRaw, type Projection, Projector, unitAtOffset } from './project.ts';
import { COLLAB_MARK_KEYS, COLLAB_NODE_TYPES, collabMarkExpand } from './vocabulary.ts';

/** What changed the projection. */
export type DocumentSyncOrigin =
  | 'local'
  | 'remote'
  | 'undo'
  | 'redo'
  | 'restore'
  | 'suggestion'
  | 'annotations'
  | 'presence';

export interface DocumentSyncChange {
  origin: DocumentSyncOrigin;
  /** The projected document after the change. */
  document: TexuliDocument;
  /**
   * Operations that bring an editor's document (the projection before the
   * change, or the document a local commit passed in) to `document`;
   * empty when only annotations or presence changed.
   */
  operations: DocumentOperation[];
}

export interface DocumentSyncOptions {
  /** This replica's id: 1 to 40 of `A–Z a–z 0–9 _ -`, random per session. */
  replica: string;
  /** The starting document; every replica of the document starts from the same one. */
  document?: TexuliDocument;
  /** Host-provided display name and token color index (0 to 11) of this author. */
  author?: { name: string; color?: number };
  /** URL tier the projection validates at (`untrusted` by default; the same on every replica). */
  tier?: HrefTrust;
  /** Clock for timestamps and presence (default `Date.now`). */
  now?: () => number;
  /** Local edits in one group within this many ms undo as one step (default 1000). */
  groupMs?: number;
  /** Undo steps kept (default 500). */
  undoLimit?: number;
  /** Presence heartbeat in ms (default 10,000; presence expires 30 s after the last one). */
  heartbeat?: number;
}

/** A point in the document: a text block and a UTF-16 offset in its text. */
export interface DocumentPoint {
  block: string;
  offset: number;
}

export interface Collaborator {
  replica: string;
  name: string;
  /** Token color index, 0 to 11. */
  color: number;
  /** The caret, when it is in a text block of the projection. */
  focus: DocumentPoint | null;
  /** A selection's other end, when there is one. */
  anchor: DocumentPoint | null;
}

const EMPTY: TexuliDocument = Object.freeze({
  format: DOCUMENT_FORMAT,
  formatVersion: DOCUMENT_FORMAT_VERSION,
  meta: { title: '' },
  blocks: [],
}) as TexuliDocument;

/** FNV-1a over a string, twice with different offsets, as base 36. */
function contentHash(text: string): string {
  let a = 0x811c9dc5;
  let b = 0x01000193 ^ text.length;
  for (let i = 0; i < text.length; i += 1) {
    const c = text.charCodeAt(i);
    a = Math.imul(a ^ c, 0x01000193) >>> 0;
    b = Math.imul(b ^ c, 0x5bd1e995) >>> 0;
  }
  return a.toString(36) + b.toString(36);
}

function replicaFor(id: string, undoLimit = 10_000): Replica {
  return new Replica({
    replica: id,
    types: COLLAB_NODE_TYPES,
    markKeys: COLLAB_MARK_KEYS,
    markExpand: collabMarkExpand,
    undoLimit,
  });
}

/**
 * The seed operations of a document: made by a replica named after the
 * content (`seed-<hash>`), so every replica that starts from the same
 * document derives the same operations and they merge as one.
 */
export function seedOperations(doc: TexuliDocument, options: { tier?: HrefTrust } = {}): SyncOp[] {
  const content = {
    meta: doc.meta,
    page: doc.page ?? null,
    blocks: doc.blocks,
    annotations: doc.annotations ?? null,
  };
  const seed = replicaFor(`seed-${contentHash(JSON.stringify(content))}`.slice(0, 40));
  const projector = new Projector(seed, options);
  seed.transact(() => commitDocument({ replica: seed, previous: EMPTY, tier: options.tier }, doc));
  // Comment threads of the document anchor to the seeded text.
  const comments = doc.annotations?.comments ?? [];
  if (comments.length > 0) {
    const projection = projector.project();
    seed.transact(() => {
      for (const thread of comments.slice(0, ANNOTATION_LIMITS.threads)) {
        const first = thread.messages[0];
        if (!first) continue;
        const { block, start, end } = thread.anchor;
        const anchor =
          (start !== undefined && end !== undefined
            ? anchorTarget(projection, { block, from: start, to: end })
            : null) ?? anchorTarget(projection, { block });
        if (!anchor) continue;
        if (thread.quote) anchor.quote = thread.quote.slice(0, ANNOTATION_LIMITS.quote);
        const author = (message: typeof first): AuthorInfo =>
          message.created
            ? { name: message.author, created: message.created }
            : { name: message.author };
        const id = writeThread(seed, anchor, first.body, author(first));
        for (const message of thread.messages.slice(1, ANNOTATION_LIMITS.messages))
          writeMessage(seed, id, message.body, author(message));
        if (thread.status === 'resolved') seed.setProp(id, 'status', 'resolved');
      }
    });
  }
  return seed.snapshot().ops;
}

interface UndoGroup {
  count: number;
  key: string | null;
  at: number;
}

type Listener = (change: DocumentSyncChange) => void;

/** One collaborative session over a document replica. */
export class DocumentSync {
  readonly replica: Replica;
  readonly tier: HrefTrust;
  readonly #projector: Projector;
  #projection: Projection;
  readonly #listeners = new Set<Listener>();
  readonly #now: () => number;
  readonly #groupMs: number;
  readonly #undoLimit: number;
  #undo: UndoGroup[] = [];
  #redo: UndoGroup[] = [];
  #author: { name: string; color: number };
  #suggesting = false;
  readonly #presence: PresenceStore;
  #selection: { cursor?: PresenceCursor; anchor?: PresenceCursor } = {};
  #connection: SyncConnection | null = null;
  #adapter: SyncAdapter | null = null;
  #timers: ReturnType<typeof setInterval>[] = [];
  #offPresence: (() => void) | null = null;
  #presenceSize = 0;
  readonly #heartbeat: number;
  #versionCache = new Map<string, TexuliDocument>();
  #ready = false;

  constructor(options: DocumentSyncOptions) {
    this.replica = replicaFor(options.replica);
    this.tier = options.tier ?? 'untrusted';
    this.#now = options.now ?? (() => Date.now());
    this.#groupMs = options.groupMs ?? 1_000;
    this.#undoLimit = Math.max(1, Math.floor(options.undoLimit ?? 500));
    this.#heartbeat = Math.max(1_000, options.heartbeat ?? 10_000);
    this.#author = { name: 'Anonymous', color: 0 };
    if (options.author) this.setAuthor(options.author);
    this.#presence = createPresenceStore({ now: this.#now });
    this.#projector = new Projector(this.replica, { tier: this.tier });
    this.replica.onOps((ops, origin) => {
      for (const op of ops) this.#projector.dirty(op.node);
      if (origin === 'remote' && this.#ready) this.#refresh('remote');
    });
    if (options.document) this.#receiveAll(seedOperations(options.document, { tier: this.tier }));
    this.#projection = this.#projector.project();
    this.#ready = true;
  }

  /** Integrate operations in batches within the sync limit (a seed or a snapshot). */
  #receiveAll(ops: readonly SyncOp[]): void {
    for (let at = 0; at < ops.length; at += SYNC_LIMITS.batch)
      this.replica.receive({ ops: ops.slice(at, at + SYNC_LIMITS.batch) });
  }

  // ── reading ──────────────────────────────────────────────────────────

  /** The projected document (valid at the session's tier; treat as read-only). */
  get document(): TexuliDocument {
    return this.#projection.document;
  }

  /** The current projection (text views map item ids to UTF-16 offsets). */
  get projection(): Projection {
    return this.#projection;
  }

  /** Called after every change; returns an unsubscribe function. */
  subscribe(listener: Listener): () => void {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  #emit(origin: DocumentSyncOrigin, operations: DocumentOperation[]): void {
    const change = { origin, document: this.#projection.document, operations };
    for (const listener of this.#listeners) listener(change);
  }

  /** Project again and tell listeners how the document moved. */
  #refresh(origin: DocumentSyncOrigin): DocumentOperation[] {
    const before = this.#projection.document;
    this.#projection = this.#projector.project();
    const operations = diffDocuments(before, this.#projection.document);
    this.#emit(operations.length > 0 || origin !== 'remote' ? origin : 'annotations', operations);
    return operations;
  }

  // ── author and suggestion mode ───────────────────────────────────────

  get author(): { name: string; color: number } {
    return { ...this.#author };
  }

  /** Set the display name (at most 64 characters) and token color index (0 to 11). */
  setAuthor(author: { name: string; color?: number }): void {
    const checked = checkPresence({
      replica: this.replica.id,
      name: author.name,
      color: author.color ?? 0,
    });
    if (!checked || checked.name.trim() === '')
      throw new TypeError('An author has a short name and a color from 0 to 11.');
    this.#author = { name: checked.name, color: checked.color };
    this.#sendPresence();
  }

  /** Suggestion mode: local text edits become suggested insertions and deletions. */
  get suggesting(): boolean {
    return this.#suggesting;
  }

  set suggesting(value: boolean) {
    this.#suggesting = value;
  }

  #stamp(): AuthorInfo {
    return { name: this.#author.name, created: new Date(this.#now()).toISOString() };
  }

  // ── local edits and undo ─────────────────────────────────────────────

  /** Run a local transaction as one undo step (grouped with the previous one when `group` matches). */
  #transact(run: () => void, group: string | null = null): boolean {
    const steps = this.replica.editCount;
    try {
      this.replica.transact(run);
    } catch {
      // A refused local edit (it raced a structure it did not see): the
      // operations already emitted stay, and the projection brings the
      // editor back to the merged state.
    }
    if (this.replica.editCount === steps) return false;
    const now = this.#now();
    const last = this.#undo.at(-1);
    if (
      last &&
      group !== null &&
      last.key === group &&
      this.#redo.length === 0 &&
      now - last.at <= this.#groupMs
    ) {
      last.count += 1;
      last.at = now;
    } else this.#undo.push({ count: 1, key: group, at: now });
    this.#redo = [];
    let total = this.#undo.reduce((sum, entry) => sum + entry.count, 0);
    while (total > this.#undoLimit && this.#undo.length > 1)
      total -= (this.#undo.shift() as UndoGroup).count;
    return true;
  }

  /**
   * An editor accepted a local change: emit the replica operations that make
   * the projection equal `next`. Returns the operations that bring `next` to
   * the projection when they differ (suggestion mode keeps struck text, a
   * merge repair hides a node); listeners get them too.
   */
  commit(next: TexuliDocument, options: { group?: string | null } = {}): DocumentOperation[] {
    const previous = this.#projection.document;
    // One suggestion per transaction (a replacement is one suggestion); typing next to
    // one of this author's suggestions extends it.
    let created: string | null = null;
    const suggest = this.#suggesting
      ? {
          mine: (id: string) => suggestionBy(id, this.replica.id),
          create: () => {
            created ??= writeSuggestion(this.replica, this.#stamp());
            return created;
          },
        }
      : null;
    this.#transact(
      () => commitDocument({ replica: this.replica, previous, suggest, tier: this.tier }, next),
      options.group ?? null
    );
    this.#projection = this.#projector.project();
    const corrections = diffDocuments(next, this.#projection.document);
    this.#emit('local', corrections);
    return corrections;
  }

  get canUndo(): boolean {
    return this.#undo.length > 0;
  }

  get canRedo(): boolean {
    return this.#redo.length > 0;
  }

  #step(from: UndoGroup[], to: UndoGroup[], step: () => boolean, origin: 'undo' | 'redo'): boolean {
    const group = from.pop();
    if (!group) return false;
    let done = 0;
    while (done < group.count && step()) done += 1;
    if (done > 0) to.push({ count: done, key: null, at: 0 });
    this.#refresh(origin);
    return done > 0;
  }

  /** Undo this author's newest step with new operations (others' edits stay). */
  undo(): boolean {
    return this.#step(this.#undo, this.#redo, () => this.replica.undo(), 'undo');
  }

  redo(): boolean {
    return this.#step(this.#redo, this.#undo, () => this.replica.redo(), 'redo');
  }

  // ── transport ────────────────────────────────────────────────────────

  /** Integrate a remote batch (untrusted); `connect` does this for an adapter. */
  receive(batch: SyncBatch | unknown) {
    return this.replica.receive(batch);
  }

  /**
   * Connect to a transport: operations sync both ways (offline edits catch
   * up), and presence is announced on a heartbeat and kept from peers.
   */
  connect(adapter: SyncAdapter): SyncConnection {
    this.disconnect();
    this.#adapter = adapter;
    this.#connection = connectReplica(this.replica, adapter);
    const channel = adapter.presence;
    if (channel) {
      this.#offPresence = channel.subscribe((state) => {
        const checked = checkPresence(state);
        if (!checked || checked.replica === this.replica.id) return;
        if (this.#presence.update(checked)) this.#presenceChanged(true);
      });
      this.#timers.push(setInterval(() => this.#sendPresence(), this.#heartbeat));
      this.#timers.push(
        setInterval(() => this.#presenceChanged(false), Math.min(5_000, this.#heartbeat))
      );
      this.#sendPresence();
    }
    return { close: () => this.disconnect() };
  }

  /** Stop syncing (local edits keep working and catch up on the next `connect`). */
  disconnect(): void {
    this.#connection?.close();
    this.#offPresence?.();
    for (const timer of this.#timers) clearInterval(timer);
    this.#timers = [];
    this.#connection = null;
    this.#offPresence = null;
    this.#adapter = null;
  }

  /** Every integrated operation, for a host to persist; `load` integrates it into a session. */
  snapshot(): SyncSnapshot {
    return this.replica.snapshot();
  }

  /** Integrate a snapshot (another replica's, or a stored one). */
  load(snapshot: SyncSnapshot): void {
    if (!snapshot || !Array.isArray(snapshot.ops)) return;
    this.#receiveAll(snapshot.ops);
  }

  // ── presence ─────────────────────────────────────────────────────────

  #cursorAt(point: DocumentPoint | null | undefined): PresenceCursor | undefined {
    if (!point) return undefined;
    const view = this.#projection.view(point.block);
    if (!view || !Number.isSafeInteger(point.offset)) return undefined;
    const unit = unitAtOffset(view, Math.max(0, point.offset));
    return {
      node: point.block,
      field: view.field,
      after: unit > 0 ? (view.ids[unit - 1] as [string, number]) : null,
    };
  }

  #pointOf(cursor: PresenceCursor | undefined): DocumentPoint | null {
    if (!cursor) return null;
    const view = this.#projection.view(cursor.node);
    if (!view || view.field !== cursor.field) return null;
    if (cursor.after === null) return { block: cursor.node, offset: 0 };
    const raw = this.replica.anchorIndex(cursor.node, cursor.field, {
      id: cursor.after,
      side: 'after',
    });
    return raw === null ? null : { block: cursor.node, offset: offsetOfRaw(view, raw) };
  }

  /** This author's selection (a caret when `anchor` is absent or equal), announced to peers. */
  setSelection(selection: { focus: DocumentPoint; anchor?: DocumentPoint } | null): void {
    const cursor = this.#cursorAt(selection?.focus);
    const anchor = this.#cursorAt(selection?.anchor);
    this.#selection = {};
    if (cursor) this.#selection.cursor = cursor;
    if (anchor && cursor && JSON.stringify(anchor) !== JSON.stringify(cursor))
      this.#selection.anchor = anchor;
    this.#sendPresence();
  }

  #sendPresence(): void {
    const channel = this.#adapter?.presence;
    if (!channel) return;
    channel.send({ replica: this.replica.id, ...this.#author, ...this.#selection });
  }

  #presenceChanged(force: boolean): void {
    const size = this.#presence.list().length;
    if (!force && size === this.#presenceSize) return;
    this.#presenceSize = size;
    this.#emit('presence', []);
  }

  /** Live collaborators (expired ones pruned), with their carets mapped through every edit since. */
  collaborators(): Collaborator[] {
    return this.#presence.list().map((entry) => ({
      replica: entry.replica,
      name: entry.name,
      color: entry.color,
      focus: this.#pointOf(entry.cursor),
      anchor: this.#pointOf(entry.anchor),
    }));
  }

  // ── comments ─────────────────────────────────────────────────────────

  /** Every comment thread: anchored ones in document order, then orphaned ones. */
  threads(): CollabThread[] {
    return readThreads(this.replica, this.#projection);
  }

  #annotate(run: () => string | boolean | null): string | boolean | null {
    let out: string | boolean | null = null;
    this.#transact(() => {
      out = run();
    });
    this.#refresh('annotations');
    return out;
  }

  /** Open a thread on a block or a UTF-16 range of a text block; `null` when the target or body is refused. */
  addComment(target: CommentTarget, body: string): string | null {
    const text = checkAnnotationText(body, ANNOTATION_LIMITS.body, true);
    const anchor = anchorTarget(this.#projection, target);
    if (!text || !anchor) return null;
    return this.#annotate(() => writeThread(this.replica, anchor, text, this.#stamp())) as string;
  }

  /** Reply to a thread; `null` when the thread is unknown or the body is refused. */
  reply(thread: string, body: string): string | null {
    const text = checkAnnotationText(body, ANNOTATION_LIMITS.body, true);
    if (!text || this.replica.node(thread)?.type !== 'thread') return null;
    return this.#annotate(() => writeMessage(this.replica, thread, text, this.#stamp())) as string;
  }

  #setStatus(thread: string, status: 'open' | 'resolved'): boolean {
    if (this.replica.node(thread)?.type !== 'thread') return false;
    return this.#annotate(() => {
      this.replica.setProp(thread, 'status', status);
      return true;
    }) as boolean;
  }

  resolve(thread: string): boolean {
    return this.#setStatus(thread, 'resolved');
  }

  reopen(thread: string): boolean {
    return this.#setStatus(thread, 'open');
  }

  /** Delete a thread, or one message of a thread. */
  deleteComment(id: string): boolean {
    const type = this.replica.node(id)?.type;
    if (type !== 'thread' && type !== 'message') return false;
    return this.#annotate(() => {
      this.replica.removeNode(id);
      return true;
    }) as boolean;
  }

  /**
   * The threads as document annotations (UTF-16 anchors), to store with the
   * document; orphaned threads keep their block and quote.
   */
  exportAnnotations(): DocumentAnnotations {
    const comments = this.threads().map((thread) => ({
      id: thread.id.replace(/[^A-Za-z0-9_-]/g, '-'),
      anchor: thread.range
        ? { block: thread.block, start: thread.range.from, end: thread.range.to }
        : { block: thread.block },
      ...(thread.quote ? { quote: thread.quote } : {}),
      status: thread.status,
      messages: thread.messages.map((message) => ({
        id: message.id.replace(/[^A-Za-z0-9_-]/g, '-'),
        author: message.author,
        body: message.body,
        ...(message.created ? { created: message.created } : {}),
      })),
    }));
    return comments.length > 0 ? { comments } : {};
  }

  // ── suggestions ──────────────────────────────────────────────────────

  /** Pending suggestions, in document order. */
  suggestions(): CollabSuggestion[] {
    return readSuggestions(this.replica, this.#projection);
  }

  #settle(ids: string[], accept: boolean): boolean {
    let touched = false;
    this.#transact(() => {
      for (const id of ids)
        if (settleSuggestion(this.replica, this.#projection, id, accept)) touched = true;
    });
    this.#refresh('suggestion');
    return touched;
  }

  accept(id: string): boolean {
    return this.#settle([id], true);
  }

  reject(id: string): boolean {
    return this.#settle([id], false);
  }

  acceptAll(): boolean {
    return this.#settle(
      this.suggestions().map((entry) => entry.id),
      true
    );
  }

  rejectAll(): boolean {
    return this.#settle(
      this.suggestions().map((entry) => entry.id),
      false
    );
  }

  // ── versions ─────────────────────────────────────────────────────────

  /** Named versions, oldest first. */
  versions(): CollabVersion[] {
    return readVersions(this.replica);
  }

  /** Name the current state; `null` when the name is refused (1 to 120 characters). */
  saveVersion(name: string): string | null {
    const text = checkAnnotationText(name, ANNOTATION_LIMITS.name);
    if (!text) return null;
    return this.#annotate(() => writeVersion(this.replica, text, this.#stamp())) as string;
  }

  /** The document as it was at a version (rebuilt by replaying the operations it covers), or `null`. */
  versionDocument(id: string): TexuliDocument | null {
    const cached = this.#versionCache.get(id);
    if (cached) return cached;
    const version = this.versions().find((entry) => entry.id === id);
    if (!version) return null;
    const replay = replicaFor('tx-version');
    const ops = this.replica
      .snapshot()
      .ops.filter((op) => op.counter < (version.vector[op.replica] ?? 0));
    for (let at = 0; at < ops.length; at += SYNC_LIMITS.batch)
      replay.receive({ ops: ops.slice(at, at + SYNC_LIMITS.batch) });
    const doc = new Projector(replay, { tier: this.tier }).project().document;
    this.#versionCache.set(id, doc);
    return doc;
  }

  /** The changes from a version to the current document (or to another version). */
  compare(from: string, to?: string): DocumentChange[] | null {
    const before = this.versionDocument(from);
    const after = to === undefined ? this.document : this.versionDocument(to);
    return before && after ? describeChanges(before, after) : null;
  }

  /**
   * Restore a version: new operations turn the current state into the
   * version's (never a rewrite of history), so the restore syncs to every
   * peer and undoes as one step.
   */
  restoreVersion(id: string): boolean {
    const target = this.versionDocument(id);
    if (!target) return false;
    const previous = this.#projection.document;
    this.#transact(() =>
      commitDocument({ replica: this.replica, previous, tier: this.tier }, cloneData(target))
    );
    this.#refresh('restore');
    return true;
  }

  /** Disconnect and stop every timer. */
  close(): void {
    this.disconnect();
    this.#listeners.clear();
  }
}

/** Start a collaborative session over a document. */
export function createDocumentSync(options: DocumentSyncOptions): DocumentSync {
  return new DocumentSync(options);
}
