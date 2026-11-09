/**
 * The /solutions/documents/ demo model (PLAN_015, SOURCE §8.3): rename the
 * title, add a block, switch between edit and read, undo, redo and reset,
 * all on a deterministic fixture through `@texuli/document/ops-core` (typed
 * operations, validated at the untrusted tier, with an op log). No Svelte,
 * no DOM, no network and no shared persistence: the state lives in memory
 * and a reset returns the fixture exactly.
 */
import type { DocumentBlock, DocumentInline, TexuliDocument } from '@texuli/document/model';
import {
  cloneData,
  createDocumentHistory,
  type DocumentHistory,
  type DocumentOperation,
} from '@texuli/document/ops-core';
import { PRODUCT_REPORT, REPORT_TITLE_ID } from './fixtures/product-report.ts';

export type DocumentsDemoMode = 'edit' | 'read';

/** The blocks the demo can append. */
export const ADDABLE_BLOCKS = ['paragraph', 'heading', 'list', 'callout'] as const;
export type AddableBlock = (typeof ADDABLE_BLOCKS)[number];

/** The longest title the rename action accepts. */
export const MAX_TITLE_LENGTH = 120;

export type DocumentsDemoAction =
  | { type: 'rename-title'; title: string }
  | { type: 'add-block'; block: AddableBlock }
  | { type: 'set-mode'; mode: DocumentsDemoMode }
  | { type: 'toggle-mode' }
  | { type: 'undo' }
  | { type: 'redo' }
  | { type: 'reset' };

export interface OutlineEntry {
  id: string;
  level: number;
  text: string;
}

export interface DocumentsDemoState {
  readonly document: TexuliDocument;
  readonly mode: DocumentsDemoMode;
  readonly canUndo: boolean;
  readonly canRedo: boolean;
  /** Top-level block count (the reader and the inspector show it). */
  readonly blockCount: number;
  /** The headings, in order: the same model seen as a table of contents. */
  readonly outline: readonly OutlineEntry[];
  /** Why the last action changed nothing, or `null`. */
  readonly error: string | null;
}

export interface DocumentsDemo {
  readonly state: DocumentsDemoState;
  dispatch(action: DocumentsDemoAction): DocumentsDemoState;
  subscribe(listener: (state: DocumentsDemoState) => void): () => void;
}

const text = (value: string): DocumentInline[] => [{ type: 'text', text: value, marks: [] }];

/** Plain text of inline content (text runs only; breaks count as a space). */
export function inlineText(content: readonly DocumentInline[]): string {
  return content.map((node) => (node.type === 'text' ? node.text : ' ')).join('');
}

/** The document's headings, depth first through containers. */
export function documentOutline(document: TexuliDocument): OutlineEntry[] {
  const out: OutlineEntry[] = [];
  const walk = (blocks: readonly DocumentBlock[]): void => {
    for (const block of blocks) {
      if (block.type === 'heading') {
        out.push({ id: block.id, level: block.level, text: inlineText(block.content) });
      } else if (block.type === 'list') {
        for (const entry of block.items) walk(entry.blocks);
      } else if (block.type === 'columns') {
        for (const column of block.columns) walk(column.blocks);
      } else if (block.type === 'quote' || block.type === 'callout' || block.type === 'toggle') {
        walk(block.blocks);
      }
    }
  };
  walk(document.blocks);
  return out;
}

function textLength(content: readonly DocumentInline[]): number {
  // A break counts 1 (`@texuli/document/ops` offsets are UTF-16 units).
  return content.reduce((sum, node) => sum + (node.type === 'text' ? node.text.length : 1), 0);
}

/** A new block with deterministic ids derived from `n` (the nth added block). */
export function newBlock(kind: AddableBlock, n: number): DocumentBlock {
  const id = `added-${n}`;
  switch (kind) {
    case 'paragraph':
      return { id, type: 'paragraph', content: text('A new paragraph, added in the demo.') };
    case 'heading':
      return { id, type: 'heading', level: 3, content: text('New section') };
    case 'list':
      return {
        id,
        type: 'list',
        kind: 'bullet',
        items: [
          {
            id: `${id}-item-1`,
            blocks: [{ id: `${id}-item-1-text`, type: 'paragraph', content: text('First point') }],
          },
          {
            id: `${id}-item-2`,
            blocks: [{ id: `${id}-item-2-text`, type: 'paragraph', content: text('Second point') }],
          },
        ],
      };
    case 'callout':
      return {
        id,
        type: 'callout',
        tone: 'info',
        title: 'Note',
        blocks: [{ id: `${id}-text`, type: 'paragraph', content: text('Sample data only.') }],
      };
  }
}

function findTitle(document: TexuliDocument): DocumentBlock | undefined {
  return document.blocks.find((block) => block.id === REPORT_TITLE_ID);
}

/** Create the demo over `fixture` (default: the product report), which is never mutated. */
export function createDocumentsDemo(fixture: TexuliDocument = PRODUCT_REPORT): DocumentsDemo {
  const initial = cloneData(fixture) as TexuliDocument;
  let history: DocumentHistory = createDocumentHistory(initial);
  let mode: DocumentsDemoMode = 'edit';
  let added = 0;
  let error: string | null = null;
  const listeners = new Set<(state: DocumentsDemoState) => void>();

  const snapshot = (): DocumentsDemoState => {
    const document = history.document;
    return {
      document,
      mode,
      canUndo: mode === 'edit' && history.canUndo,
      canRedo: mode === 'edit' && history.canRedo,
      blockCount: document.blocks.length,
      outline: documentOutline(document),
      error,
    };
  };

  let state = snapshot();

  const apply = (operations: DocumentOperation[], origin: string): void => {
    const result = history.apply(operations, { origin });
    error = result.ok ? null : result.reason;
  };

  const run = (action: DocumentsDemoAction): void => {
    error = null;
    switch (action.type) {
      case 'set-mode':
        mode = action.mode;
        return;
      case 'toggle-mode':
        mode = mode === 'edit' ? 'read' : 'edit';
        return;
      case 'reset':
        history = createDocumentHistory(cloneData(initial) as TexuliDocument);
        mode = 'edit';
        added = 0;
        return;
      default:
        break;
    }
    if (mode === 'read') {
      error = 'read-only';
      return;
    }
    switch (action.type) {
      case 'undo':
        if (!history.undo()) error = 'nothing-to-undo';
        return;
      case 'redo':
        if (!history.redo()) error = 'nothing-to-redo';
        return;
      case 'rename-title': {
        const title = action.title.replace(/\s+/g, ' ').trim();
        if (title.length === 0) {
          error = 'empty-title';
          return;
        }
        if (title.length > MAX_TITLE_LENGTH) {
          error = 'title-too-long';
          return;
        }
        const block = findTitle(history.document);
        if (block?.type !== 'heading') {
          error = 'no-title';
          return;
        }
        apply(
          [
            {
              op: 'replace-text',
              id: block.id,
              from: 0,
              to: textLength(block.content),
              content: text(title),
            },
            { op: 'set-meta', meta: { title } },
          ],
          'demo:rename-title'
        );
        return;
      }
      case 'add-block': {
        if (!(ADDABLE_BLOCKS as readonly string[]).includes(action.block)) {
          error = 'unknown-block';
          return;
        }
        const node = newBlock(action.block, added + 1);
        apply(
          [{ op: 'insert-node', parent: null, index: history.document.blocks.length, node }],
          'demo:add-block'
        );
        if (error === null) added += 1;
        return;
      }
    }
  };

  return {
    get state() {
      return state;
    },
    dispatch(action) {
      run(action);
      state = snapshot();
      for (const listener of listeners) listener(state);
      return state;
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}
