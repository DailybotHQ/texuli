/**
 * The page editor's state: one document, one op log. Every edit (typing,
 * a slash insert, a move, a resize, an undo) is a transaction of
 * `@texuli/document` operations applied through `createDocumentHistory`;
 * the tree is never mutated. Undo groups consecutive typing in one block
 * and replays the log's inverses, so undo and redo are themselves entries
 * in the op log a host can persist or forward.
 */
import { getAnnouncer } from '@texuli/core/announcer';
import type { EditorBlock, EditorPoint, EditorSelection } from '@texuli/core/editor-model';
import type { HrefTrust } from '@texuli/core/url-policy';
import {
  childrenOf,
  type DocumentBlock,
  type DocumentBlockId,
  type DocumentIdSource,
  type DocumentNode,
  findNode,
  freshIdSource,
  type TexuliDocument,
} from '@texuli/document/model';
import {
  type ApplyResult,
  createDocumentHistory,
  type DocumentHistory,
  type DocumentOperation,
  type OpLogEntry,
} from '@texuli/document/ops-core';
import type { DeckPayloadValidator } from '@texuli/document/schema-core';
import { DEFAULT_PAGES_LABELS, type PagesLabels } from '../shared/labels.ts';
import { columnWidths } from './columns.ts';
import { adjacentRow, moveTarget } from './moves.ts';
import type { PageRef, SlashItem } from './slash.ts';
import { blockExcerpt, containsId, inlineLength, isTextRow, textRowOperations } from './text.ts';

export interface PagesFocusRequest {
  /** The row to focus. */
  id: DocumentBlockId;
  /** A text leaf inside the row and a caret offset in it. */
  leaf?: DocumentBlockId;
  offset?: number;
  /** Without a leaf: the start or the end of the row's text. */
  edge?: 'start' | 'end';
  /** Bumped per request, so the same row can be asked twice. */
  seq: number;
}

export interface PagesSlashRequest {
  /** The row the menu opens at. */
  anchor: DocumentBlockId;
  /** Replace the anchor (an empty paragraph) instead of inserting after it. */
  replace: boolean;
}

/**
 * A synced session behind the editor (`@texuli/pages/collab` provides one
 * over `@texuli/document/collab`): accepted local transactions go to
 * `commit`, and undo and redo are the session's (operations that revert
 * this author's steps only).
 */
export interface PagesEditorSync {
  /** A local transaction was accepted; `group` names a typing run (or `null`). */
  commit(doc: TexuliDocument, group: string | null): void;
  undo(): boolean;
  redo(): boolean;
  readonly canUndo: boolean;
  readonly canRedo: boolean;
}

export interface PagesEditorOptions {
  document: TexuliDocument;
  /** Prefix of new block ids (default `n`); a synced editor uses one per replica. */
  idPrefix?: string;
  labels?: PagesLabels;
  /** Polite announcements. Default: `@texuli/core/announcer` for this document. */
  announce?: (message: string) => void;
  /** Every accepted change, with the op log entry that made it. */
  onChange?: (doc: TexuliDocument, entry: OpLogEntry) => void;
  /** Validation tier of every transaction (default `untrusted`). */
  tier?: HrefTrust;
  /**
   * Checks inline deck payloads in every transaction (G136, from `0.12.0`):
   * pass `checkDeckPayload` from `@texuli/document/schema`. Without it a
   * transaction that leaves an inline deck in the document is refused.
   */
  validateDeck?: DeckPayloadValidator | null;
  /** Typing in one block within this many ms is one undo step (default 1000). */
  groupMs?: number;
  /** Undo steps kept (default 500 transactions). */
  limit?: number;
  now?: () => number;
}

interface UndoGroup {
  count: number;
  key: string | null;
  at: number;
}

export interface Located {
  node: DocumentNode;
  parent: DocumentBlockId | null;
  index: number;
  siblings: readonly DocumentNode[];
}

/** The first operation's target: what to focus after an undo or redo. */
function touched(operations: readonly DocumentOperation[]): DocumentBlockId | null {
  for (const operation of operations) {
    if ('id' in operation && typeof operation.id === 'string') return operation.id;
    if (operation.op === 'insert-node') return operation.node.id;
  }
  return null;
}

export class PagesEditor {
  doc: TexuliDocument = $state.raw(null as unknown as TexuliDocument);
  /** The selected block (block selection), or `null`. */
  selected: DocumentBlockId | null = $state.raw(null);
  focus: PagesFocusRequest | null = $state.raw(null);
  slash: PagesSlashRequest | null = $state.raw(null);
  /** Bumped on every change, so `canUndo` and `canRedo` stay reactive. */
  revision = $state(0);
  labels: PagesLabels;
  readonly options: PagesEditorOptions;
  newId: DocumentIdSource;
  #history: DocumentHistory;
  #undo: UndoGroup[] = [];
  #redo: UndoGroup[] = [];
  #seq = 0;
  #limit: number;
  #sync: PagesEditorSync | null = null;
  #prefix: string;
  /** Recent external transactions, for mapping carets through them. */
  #external: { seq: number; operations: readonly DocumentOperation[] }[] = [];

  constructor(options: PagesEditorOptions) {
    this.options = options;
    this.labels = options.labels ?? DEFAULT_PAGES_LABELS;
    this.#limit = Math.max(1, Math.floor(options.limit ?? 500));
    this.#prefix = options.idPrefix ?? 'n';
    this.#history = this.#createHistory(options.document);
    this.doc = options.document;
    this.newId = this.#idSource(options.document);
  }

  #createHistory(doc: TexuliDocument): DocumentHistory {
    const history = createDocumentHistory(doc, {
      limit: this.#limit,
      validate: this.options.tier ?? 'untrusted',
      validateDeck: this.options.validateDeck ?? null,
    });
    history.subscribe((entry, next) => {
      this.doc = next;
      this.revision += 1;
      this.options.onChange?.(next, entry);
    });
    return history;
  }

  #idSource(doc: TexuliDocument): DocumentIdSource {
    const source = freshIdSource(doc, this.#prefix);
    return () => {
      let id = source();
      while (findNode(this.doc, id)) id = source();
      return id;
    };
  }

  get canUndo(): boolean {
    void this.revision;
    return this.#sync ? this.#sync.canUndo : this.#undo.length > 0;
  }

  get canRedo(): boolean {
    void this.revision;
    return this.#sync ? this.#sync.canRedo : this.#redo.length > 0;
  }

  /** True while a synced session is connected. */
  get synced(): boolean {
    void this.revision;
    return this.#sync !== null;
  }

  /**
   * Connect a synced session (or `null` to disconnect): local transactions
   * go to it and undo and redo become its. The local undo stack is dropped.
   */
  connectSync(sync: PagesEditorSync | null): void {
    this.#sync = sync;
    this.#undo = [];
    this.#redo = [];
    this.revision += 1;
  }

  /** Make new block ids with this prefix from now on (a synced editor uses one per replica). */
  setIdPrefix(prefix: string): void {
    this.#prefix = prefix;
    this.newId = this.#idSource(this.doc);
  }

  /**
   * Apply a transaction that did not come from this editor (a merged remote
   * change, a session undo, a restore): logged as a `sync` entry that is
   * never on the local undo stack. Carets in text rows follow it.
   */
  applyExternal(operations: readonly DocumentOperation[], origin = 'remote'): ApplyResult {
    const result = this.#history.apply(operations, { origin, undoable: false });
    if (result.ok && operations.length > 0) {
      const entry = this.#history.log().at(-1);
      if (entry) {
        this.#external.push({ seq: entry.seq, operations: entry.operations });
        if (this.#external.length > 64) this.#external.shift();
      }
      if (this.selected && !findNode(this.doc, this.selected)) this.selected = null;
      this.revision += 1;
    }
    return result;
  }

  /** The newest op log sequence number (0 before any change). */
  lastSeq(): number {
    return this.#history.log().at(-1)?.seq ?? 0;
  }

  /**
   * Map a point in a text leaf through the external transactions applied
   * after `since`: text inserted or removed before it shifts it. Text
   * inserted exactly at the point stays after it (`bias: 'before'`, the
   * default) or moves it past the insertion (`bias: 'after'`).
   */
  mapPoint(point: EditorPoint, since: number, bias: 'before' | 'after' = 'before'): EditorPoint {
    let offset = point.offset;
    for (const { seq, operations } of this.#external) {
      if (seq <= since) continue;
      for (const operation of operations) {
        if (operation.op !== 'replace-text' || operation.id !== point.block) continue;
        let length = 0;
        for (const part of operation.content)
          length += part.type === 'break' ? 1 : part.text.length;
        const insertion = operation.from === operation.to;
        if (insertion && offset === operation.from) {
          if (bias === 'after') offset += length;
        } else if (offset >= operation.to) offset += length - (operation.to - operation.from);
        else if (offset > operation.from) offset = operation.from + length;
      }
    }
    return offset === point.offset ? point : { block: point.block, offset };
  }

  /** The op log of this session (edits, undos and redos), oldest first. */
  log(): readonly OpLogEntry[] {
    return this.#history.log();
  }

  /** Replace the document from outside: history restarts. */
  load(doc: TexuliDocument): void {
    this.#history = this.#createHistory(doc);
    this.#undo = [];
    this.#redo = [];
    this.#external = [];
    this.doc = doc;
    this.newId = this.#idSource(doc);
    this.selected = null;
    this.slash = null;
    this.revision += 1;
  }

  say(message: string): void {
    if (!message) return;
    if (this.options.announce) this.options.announce(message);
    else if (typeof document !== 'undefined') getAnnouncer(document).announce(message, 'polite');
  }

  /**
   * Apply one transaction through the op log. `group` names a typing run:
   * consecutive transactions with the same group within `groupMs` undo as
   * one step. A refused transaction changes nothing and is announced.
   */
  apply(operations: readonly DocumentOperation[], options: { group?: string } = {}): ApplyResult {
    const result = this.#history.apply(operations, { origin: 'local' });
    if (!result.ok) {
      this.say(this.labels.editRefused(result.reason));
      return result;
    }
    if (operations.length === 0) return result;
    if (this.#sync) {
      this.#sync.commit(result.document, options.group ?? null);
      this.revision += 1;
      return result;
    }
    const now = (this.options.now ?? Date.now)();
    const last = this.#undo.at(-1);
    const key = options.group ?? null;
    if (
      last &&
      key !== null &&
      last.key === key &&
      this.#redo.length === 0 &&
      now - last.at <= (this.options.groupMs ?? 1000)
    ) {
      last.count += 1;
      last.at = now;
    } else {
      this.#undo.push({ count: 1, key, at: now });
    }
    this.#redo = [];
    let total = this.#undo.reduce((sum, group) => sum + group.count, 0);
    while (total > this.#limit && this.#undo.length > 1) {
      total -= (this.#undo.shift() as UndoGroup).count;
    }
    this.revision += 1;
    return result;
  }

  #replay(from: UndoGroup[], to: UndoGroup[], step: () => boolean, message: string): boolean {
    const group = from.pop();
    if (!group) {
      this.say(this.labels.nothingToUndo);
      return false;
    }
    let done = 0;
    while (done < group.count && step()) done += 1;
    if (done > 0) to.push({ count: done, key: null, at: 0 });
    this.revision += 1;
    const entry = this.#history.log().at(-1);
    const target = entry ? touched(entry.operations) : null;
    if (target) {
      const row = this.rowOf(target);
      if (row) this.requestFocus(row, { edge: 'end' });
    }
    this.say(message);
    return done > 0;
  }

  undo(): boolean {
    if (this.#sync) return this.#syncStep(this.#sync.undo(), this.labels.undone);
    return this.#replay(this.#undo, this.#redo, () => this.#history.undo(), this.labels.undone);
  }

  redo(): boolean {
    if (this.#sync) return this.#syncStep(this.#sync.redo(), this.labels.redone);
    return this.#replay(this.#redo, this.#undo, () => this.#history.redo(), this.labels.redone);
  }

  /** After a session undo or redo (applied through `applyExternal`): focus and announce. */
  #syncStep(done: boolean, message: string): boolean {
    this.revision += 1;
    if (!done) {
      this.say(this.labels.nothingToUndo);
      return false;
    }
    const entry = this.#history.log().at(-1);
    const target = entry ? touched(entry.operations) : null;
    if (target) {
      const row = this.rowOf(target);
      if (row) this.requestFocus(row, { edge: 'end' });
    }
    this.say(message);
    return true;
  }

  /** A node with its parent id, index and siblings. */
  locate(id: DocumentBlockId): Located | null {
    const found = findNode(this.doc, id);
    if (!found) return null;
    return {
      node: found.node,
      parent: found.parent ? found.parent.id : null,
      index: found.index,
      siblings: found.parent ? childrenOf(found.parent) : this.doc.blocks,
    };
  }

  /**
   * The row (a block in a block list) that holds `id`: the id itself, or
   * the nearest ancestor that is a row (list items and text leaves belong to
   * their text row; a column belongs to its columns row).
   */
  rowOf(id: DocumentBlockId): DocumentBlockId | null {
    // The chain from the top level down to the node (depth is capped at 8).
    const chain: DocumentNode[] = [];
    let found = findNode(this.doc, id);
    while (found && chain.length < 64) {
      chain.unshift(found.node);
      found = found.parent ? findNode(this.doc, found.parent.id) : null;
    }
    const top = chain[0];
    if (!top || !('type' in top)) return null;
    let row = top as DocumentBlock;
    for (let i = 1; i < chain.length; i += 1) {
      if (isTextRow(row)) break;
      const parent = chain[i - 1] as DocumentNode;
      const node = chain[i] as DocumentNode;
      const holdsBlocks =
        'type' in parent &&
        (parent.type === 'column' ||
          parent.type === 'callout' ||
          parent.type === 'toggle' ||
          (parent.type === 'quote' && !isTextRow(parent as DocumentBlock)));
      if (holdsBlocks && 'type' in node && node.type !== 'column') row = node as DocumentBlock;
    }
    return row.id;
  }

  requestFocus(id: DocumentBlockId, options: Omit<PagesFocusRequest, 'id' | 'seq'> = {}): void {
    this.#seq += 1;
    this.focus = { id, ...options, seq: this.#seq };
  }

  /** Clear a focus request once its row took it. */
  focused(seq: number): void {
    if (this.focus?.seq === seq) this.focus = null;
  }

  select(id: DocumentBlockId | null): void {
    this.selected = id;
  }

  /** The spoken type of a block. */
  typeLabel(block: DocumentNode): string {
    if (!('type' in block)) return this.labels.blockType('list');
    if (block.type === 'column') return this.labels.blockType('columns');
    if (block.type === 'heading') return this.labels.blockType('heading', String(block.level));
    if (block.type === 'embed') return this.labels.embed(block.kind, '');
    return this.labels.blockType(block.type);
  }

  /** The name of a block in handles and announcements. */
  nameOf(block: DocumentBlock): string {
    return this.labels.handle(this.typeLabel(block), blockExcerpt(block));
  }

  // ── text rows ───────────────────────────────────────────────────────────

  /**
   * A text row's editor document changed: turn it into operations by id.
   * Returns the row's new block (or `null` when the row left the document
   * or the edit was refused). When the caret ended in another row (a split,
   * a conversion), that row is asked to take focus.
   */
  commitText(
    rowId: DocumentBlockId,
    blocks: readonly EditorBlock[],
    selection: EditorSelection | null
  ): DocumentBlock | null {
    const located = this.locate(rowId);
    if (!located) return null;
    const operations = textRowOperations(
      located.parent,
      located.index,
      located.node as DocumentBlock,
      blocks
    );
    if (operations.length === 0) return located.node as DocumentBlock;
    const result = this.apply(operations, { group: `text:${rowId}` });
    if (!result.ok) return null;
    if (selection) {
      const leaf = selection.kind === 'text' ? selection.focus.block : selection.block;
      const row = blocks.find((block) => containsId(block as unknown as DocumentBlock, leaf));
      if (row && row.id !== rowId) {
        this.requestFocus(row.id, {
          leaf,
          offset: selection.kind === 'text' ? selection.focus.offset : 0,
        });
      }
    }
    const next = this.locate(rowId);
    return next ? (next.node as DocumentBlock) : null;
  }

  /** Backspace at the start of a paragraph or heading row: join it to the text row before. */
  mergeBackward(rowId: DocumentBlockId): boolean {
    const located = this.locate(rowId);
    if (!located) return false;
    const block = located.node as DocumentBlock;
    if (block.type !== 'paragraph' && block.type !== 'heading') return false;
    const previous = located.siblings[located.index - 1] as DocumentBlock | undefined;
    if (!previous) return false;
    const empty = block.content.length === 0;
    if (previous.type === 'paragraph' || previous.type === 'heading') {
      const offset = inlineLength(previous.content);
      const result = this.apply([
        { op: 'replace-text', id: previous.id, from: offset, to: offset, content: block.content },
        { op: 'remove-node', id: block.id },
      ]);
      if (result.ok) this.requestFocus(previous.id, { leaf: previous.id, offset });
      return result.ok;
    }
    if (empty) {
      const result = this.apply([{ op: 'remove-node', id: block.id }]);
      if (result.ok) this.#focusRow(previous, 'end');
      return result.ok;
    }
    this.#focusRow(previous, 'end');
    return true;
  }

  /** Delete at the end of a paragraph or heading row: pull the next paragraph or heading in. */
  mergeForward(rowId: DocumentBlockId): boolean {
    const located = this.locate(rowId);
    if (!located) return false;
    const block = located.node as DocumentBlock;
    const next = located.siblings[located.index + 1] as DocumentBlock | undefined;
    if (!next || (block.type !== 'paragraph' && block.type !== 'heading')) return false;
    if (next.type !== 'paragraph' && next.type !== 'heading') return false;
    const offset = inlineLength(block.content);
    const result = this.apply([
      { op: 'replace-text', id: block.id, from: offset, to: offset, content: next.content },
      { op: 'remove-node', id: next.id },
    ]);
    if (result.ok) this.requestFocus(block.id, { leaf: block.id, offset });
    return result.ok;
  }

  #focusRow(block: DocumentBlock, edge: 'start' | 'end'): void {
    if (isTextRow(block)) this.requestFocus(block.id, { edge });
    else {
      this.selected = block.id;
      this.requestFocus(block.id, {});
    }
  }

  /** Move focus to the row before or after `rowId` in reading order. */
  navigate(rowId: DocumentBlockId, direction: -1 | 1): boolean {
    const target = adjacentRow(this.doc, rowId, direction);
    if (!target) return false;
    const located = this.locate(target);
    if (!located) return false;
    this.#focusRow(located.node as DocumentBlock, direction < 0 ? 'end' : 'start');
    return true;
  }

  // ── block operations ───────────────────────────────────────────────────

  openSlash(anchor: DocumentBlockId, replace: boolean): void {
    this.slash = { anchor, replace };
  }

  closeSlash(restoreFocus = true): void {
    const request = this.slash;
    this.slash = null;
    if (restoreFocus && request) {
      const located = this.locate(request.anchor);
      if (located) this.#focusRow(located.node as DocumentBlock, 'end');
    }
  }

  /** Insert `node` at `index` of `parent` (`null` is the top level) and focus it. */
  insertNode(parent: DocumentBlockId | null, index: number, node: DocumentBlock): boolean {
    const result = this.apply([{ op: 'insert-node', parent, index, node }]);
    if (!result.ok) return false;
    this.say(this.labels.inserted(this.typeLabel(node)));
    this.#focusRow(node, 'start');
    return true;
  }

  /**
   * Insert a slash item at the anchor: in place of an empty paragraph, or
   * after it. Page items ask the host for a page first.
   */
  async insertItem(
    item: SlashItem,
    request: PagesSlashRequest,
    createPage?: () => PageRef | null | undefined | Promise<PageRef | null | undefined>
  ): Promise<boolean> {
    this.slash = null;
    let page: PageRef | undefined;
    if (item.needsPage) {
      const created = createPage ? await createPage() : null;
      if (!created) return false;
      page = created;
    }
    const located = this.locate(request.anchor);
    const node = item.create(this.newId, page);
    if (!node) return false;
    if (!located) return this.insertNode(null, this.doc.blocks.length, node);
    const result = this.apply(
      request.replace
        ? [
            { op: 'remove-node', id: request.anchor },
            { op: 'insert-node', parent: located.parent, index: located.index, node },
          ]
        : [{ op: 'insert-node', parent: located.parent, index: located.index + 1, node }]
    );
    if (!result.ok) return false;
    this.say(this.labels.inserted(this.typeLabel(node)));
    this.#focusRow(node, 'start');
    return true;
  }

  /** Insert an empty paragraph after a row and focus it. */
  insertParagraphAfter(rowId: DocumentBlockId): boolean {
    const located = this.locate(rowId);
    if (!located) return false;
    return this.insertNode(located.parent, located.index + 1, {
      id: this.newId(),
      type: 'paragraph',
      content: [],
    });
  }

  /** Remove a block; the last block of a list is replaced by an empty paragraph. */
  remove(id: DocumentBlockId): boolean {
    const located = this.locate(id);
    if (!located || !('type' in located.node)) return false;
    const node = located.node as DocumentBlock;
    const operations: DocumentOperation[] = [{ op: 'remove-node', id }];
    let replacement: DocumentBlock | null = null;
    if (located.siblings.length === 1) {
      replacement = { id: this.newId(), type: 'paragraph', content: [] };
      operations.push({
        op: 'insert-node',
        parent: located.parent,
        index: 0,
        node: replacement,
      });
    }
    const neighbour = (located.siblings[located.index + 1] ??
      located.siblings[located.index - 1]) as DocumentBlock | undefined;
    const result = this.apply(operations);
    if (!result.ok) return false;
    if (this.selected === id) this.selected = null;
    this.say(this.labels.removed(this.typeLabel(node)));
    const next = replacement ?? neighbour;
    if (next) this.#focusRow(next, 'start');
    return true;
  }

  /** Move a block among its siblings by `delta` (Alt+Up/Down); announces where it landed. */
  moveBy(id: DocumentBlockId, delta: number): boolean {
    const located = this.locate(id);
    if (!located || !('type' in located.node)) return false;
    const node = located.node as DocumentBlock;
    const target = moveTarget(located.index, delta, located.siblings.length);
    if (target === null) {
      this.say(this.labels.cannotMove(this.nameOf(node)));
      return false;
    }
    return this.moveTo(id, located.parent, target);
  }

  /** Move a block to `index` of `parent` (the index counts after it left its place). */
  moveTo(
    id: DocumentBlockId,
    parent: DocumentBlockId | null,
    index: number,
    options: { quiet?: boolean } = {}
  ): boolean {
    const located = this.locate(id);
    if (!located || !('type' in located.node)) return false;
    const node = located.node as DocumentBlock;
    if (located.parent === parent && located.index === index) return true;
    const result = this.apply([{ op: 'move-node', id, parent, index }]);
    if (!result.ok) return false;
    const after = this.locate(id);
    if (after && !options.quiet)
      this.say(this.labels.moved(this.nameOf(node), after.index + 1, after.siblings.length));
    return true;
  }

  /** Set the widths of a columns row (shares of 12); one undo step per resize run. */
  setColumnWidths(columnsId: DocumentBlockId, widths: readonly number[]): boolean {
    const located = this.locate(columnsId);
    if (!located || !('type' in located.node) || located.node.type !== 'columns') return false;
    const current = columnWidths(located.node.columns);
    const operations: DocumentOperation[] = [];
    located.node.columns.forEach((column, index) => {
      const width = widths[index];
      if (width !== undefined && (width !== current[index] || column.width !== width))
        operations.push({ op: 'set-attrs', id: column.id, attrs: { width } });
    });
    if (operations.length === 0) return false;
    return this.apply(operations, { group: `resize:${columnsId}` }).ok;
  }

  /** Change a block's attributes (`NODE_ATTRS` of `@texuli/document/ops`). */
  setAttrs(
    id: DocumentBlockId,
    attrs: Record<string, string | number | boolean | null>,
    group?: string
  ): boolean {
    return this.apply([{ op: 'set-attrs', id, attrs }], group ? { group } : {}).ok;
  }
}
