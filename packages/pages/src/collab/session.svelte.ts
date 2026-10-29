/**
 * A reactive collaboration session for the page editor: a `DocumentSync`
 * of `@texuli/document/collab` with its threads, suggestions, versions and
 * collaborators as Svelte state, and the bridge that puts a `PagesEditor`
 * on it (local transactions to the replica, merged changes back through
 * the editor's op log as `sync` entries, undo and redo through the
 * replica).
 */
import {
  type Collaborator,
  type CollabSuggestion,
  type CollabThread,
  type CollabVersion,
  type CommentTarget,
  createDocumentSync,
  type DocumentChange,
  type DocumentPoint,
  type DocumentSync,
  type DocumentSyncOptions,
} from '@texuli/document/collab';
import type { TexuliDocument } from '@texuli/document/model';
import type { SyncAdapter } from '@texuli/document/sync';
import type { PagesEditor } from '../editor/state.svelte.ts';

export interface CollabSessionOptions extends DocumentSyncOptions {
  /** A transport to connect right away (in-memory, `BroadcastChannel` or the host's). */
  adapter?: SyncAdapter;
}

/** A document range a comment or suggestion covers, for highlights. */
export interface CollabRange {
  block: string;
  from: number;
  to: number;
  kind: 'comment' | 'insert' | 'delete';
  /** The thread or suggestion id. */
  id: string;
}

/** A comment being written: its target and the text it quotes. */
export interface CommentDraft extends CommentTarget {
  quote: string;
}

/** The token color custom property for a presence color index (0 to 11). */
export const presenceColor = (index: number): string =>
  `var(--tx-chart-${(Math.abs(Math.trunc(index)) % 8) + 1}, Highlight)`;

export class CollabSession {
  readonly sync: DocumentSync;
  document: TexuliDocument = $state.raw(null as unknown as TexuliDocument);
  threads: CollabThread[] = $state.raw([]);
  suggestions: CollabSuggestion[] = $state.raw([]);
  versions: CollabVersion[] = $state.raw([]);
  collaborators: Collaborator[] = $state.raw([]);
  /** The thread the sidebar has active (highlighted in the text), or `null`. */
  activeThread: string | null = $state(null);
  /** Bumped on every change. */
  revision = $state(0);
  #suggesting = $state(false);
  #editor: PagesEditor | null = null;
  #off: () => void;

  constructor(options: CollabSessionOptions) {
    const { adapter, ...rest } = options;
    this.sync = createDocumentSync(rest);
    this.#refresh();
    this.#off = this.sync.subscribe((change) => {
      if (change.operations.length > 0 && this.#editor)
        this.#editor.applyExternal(change.operations, change.origin);
      this.#refresh();
    });
    if (adapter) this.sync.connect(adapter);
  }

  #refresh(): void {
    this.document = this.sync.document;
    this.threads = this.sync.threads();
    this.suggestions = this.sync.suggestions();
    this.versions = this.sync.versions();
    this.collaborators = this.sync.collaborators();
    if (this.activeThread && !this.threads.some((thread) => thread.id === this.activeThread))
      this.activeThread = null;
    this.revision += 1;
  }

  get replica(): string {
    return this.sync.replica.id;
  }

  get author(): { name: string; color: number } {
    return this.sync.author;
  }

  /** Suggestion mode: this author's text edits become suggestions. */
  get suggesting(): boolean {
    return this.#suggesting;
  }

  set suggesting(value: boolean) {
    this.#suggesting = value;
    this.sync.suggesting = value;
  }

  /**
   * Put an editor on this session: it loads the session's document, its
   * accepted transactions become replica operations, merged changes reach
   * it as `sync` entries of its op log, and its undo becomes the replica's.
   * New block ids carry this replica's id. Returns the unbind function.
   */
  bind(editor: PagesEditor): () => void {
    this.#editor = editor;
    if (editor.doc !== this.sync.document) editor.load(this.sync.document);
    editor.setIdPrefix(`n${this.replica}-`);
    const sync = this.sync;
    editor.connectSync({
      commit: (doc, group) => {
        sync.commit(doc, { group });
        this.#refresh();
      },
      undo: () => sync.undo(),
      redo: () => sync.redo(),
      get canUndo() {
        return sync.canUndo;
      },
      get canRedo() {
        return sync.canRedo;
      },
    });
    return () => {
      if (this.#editor === editor) this.#editor = null;
      editor.connectSync(null);
    };
  }

  /** Comment and suggestion ranges for highlights (open threads only). */
  ranges(): CollabRange[] {
    const out: CollabRange[] = [];
    for (const thread of this.threads)
      if (thread.range && thread.status === 'open')
        out.push({ block: thread.block, ...thread.range, kind: 'comment', id: thread.id });
    for (const suggestion of this.suggestions)
      for (const change of suggestion.changes)
        out.push({
          block: change.block,
          from: change.from,
          to: change.to,
          kind: change.kind,
          id: suggestion.id,
        });
    return out;
  }

  #run<T>(action: () => T): T {
    const out = action();
    this.#refresh();
    return out;
  }

  addComment(target: CommentTarget, body: string): string | null {
    return this.#run(() => this.sync.addComment(target, body));
  }

  reply(thread: string, body: string): string | null {
    return this.#run(() => this.sync.reply(thread, body));
  }

  resolve(thread: string): boolean {
    return this.#run(() => this.sync.resolve(thread));
  }

  reopen(thread: string): boolean {
    return this.#run(() => this.sync.reopen(thread));
  }

  deleteComment(id: string): boolean {
    return this.#run(() => this.sync.deleteComment(id));
  }

  accept(id: string): boolean {
    return this.#run(() => this.sync.accept(id));
  }

  reject(id: string): boolean {
    return this.#run(() => this.sync.reject(id));
  }

  acceptAll(): boolean {
    return this.#run(() => this.sync.acceptAll());
  }

  rejectAll(): boolean {
    return this.#run(() => this.sync.rejectAll());
  }

  saveVersion(name: string): string | null {
    return this.#run(() => this.sync.saveVersion(name));
  }

  restoreVersion(id: string): boolean {
    return this.#run(() => this.sync.restoreVersion(id));
  }

  compare(from: string, to?: string): DocumentChange[] | null {
    return this.sync.compare(from, to);
  }

  /** Announce this author's caret or selection to peers. */
  setSelection(selection: { focus: DocumentPoint; anchor?: DocumentPoint } | null): void {
    this.sync.setSelection(selection);
  }

  /** Stop syncing and every timer. */
  close(): void {
    this.#off();
    this.sync.close();
    if (this.#editor) this.#editor.connectSync(null);
    this.#editor = null;
  }
}

/** Start a collaboration session over a document. */
export function createCollabSession(options: CollabSessionOptions): CollabSession {
  return new CollabSession(options);
}
