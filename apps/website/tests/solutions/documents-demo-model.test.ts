/**
 * The /solutions/documents/ demo model (PLAN_015 T-documents-demo-model,
 * SOURCE §8.3): a deterministic product-report fixture that is valid at the
 * untrusted tier, and the named actions (rename title, add block, edit/read
 * modes, undo, redo, reset) driven through `@texuli/document/ops-core`.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { TexuliDocument } from '@texuli/document/model';
import { equalData } from '@texuli/document/ops-core';
import { isDocument, validateDocument } from '@texuli/document/schema';
import { describe, expect, it } from 'vitest';
import {
  PRODUCT_REPORT,
  REPORT_TITLE_ID,
} from '../../src/components/solutions/documents/demo/fixtures/product-report.ts';
import {
  ADDABLE_BLOCKS,
  createDocumentsDemo,
  type DocumentsDemoAction,
  documentOutline,
  inlineText,
  MAX_TITLE_LENGTH,
} from '../../src/components/solutions/documents/demo/model.ts';

const DEMO_DIR = resolve(__dirname, '../../src/components/solutions/documents/demo');

const titleText = (doc: TexuliDocument): string => {
  const block = doc.blocks.find((b) => b.id === REPORT_TITLE_ID);
  if (block?.type !== 'heading') throw new Error('no title heading');
  return inlineText(block.content);
};

const frozenFixture = (): TexuliDocument => JSON.parse(JSON.stringify(PRODUCT_REPORT));

describe('documents demo fixture', () => {
  it('is a valid document at the untrusted tier', () => {
    const result = validateDocument(PRODUCT_REPORT, { trust: 'untrusted' });
    expect(result.ok).toBe(true);
  });

  it('is the §8.3 product report: a title, two sections, a list and a table', () => {
    const types = PRODUCT_REPORT.blocks.map((b) => b.type);
    expect(PRODUCT_REPORT.blocks[0]?.id).toBe(REPORT_TITLE_ID);
    expect(documentOutline(PRODUCT_REPORT).map((e) => [e.level, e.text])).toEqual([
      [2, 'Lumen quarterly product report'],
      [3, 'Highlights'],
      [3, 'Metrics'],
    ]);
    expect(types).toContain('list');
    const table = PRODUCT_REPORT.blocks.find((b) => b.type === 'block');
    expect(table).toMatchObject({ family: 'data', block: 'table' });
  });

  it('uses fictional data only', () => {
    const json = JSON.stringify(PRODUCT_REPORT);
    expect(json).toMatch(/fictional/i);
    for (const match of json.matchAll(/https?:\/\/([^/"]+)/g)) {
      expect(match[1]).toMatch(/(^|\.)example\.(com|org|net)$|\.example$/);
    }
  });
});

describe('documents demo model', () => {
  it('starts in edit mode on the fixture with nothing to undo', () => {
    const demo = createDocumentsDemo();
    expect(demo.state.mode).toBe('edit');
    expect(demo.state.canUndo).toBe(false);
    expect(demo.state.canRedo).toBe(false);
    expect(demo.state.error).toBeNull();
    expect(equalData(demo.state.document, PRODUCT_REPORT)).toBe(true);
    expect(demo.state.blockCount).toBe(PRODUCT_REPORT.blocks.length);
  });

  it('renames the title in the heading and the metadata, as one undoable step', () => {
    const demo = createDocumentsDemo();
    const state = demo.dispatch({ type: 'rename-title', title: '  Lumen   Q3 report ' });
    expect(state.error).toBeNull();
    expect(titleText(state.document)).toBe('Lumen Q3 report');
    expect(state.document.meta.title).toBe('Lumen Q3 report');
    expect(state.outline[0]).toEqual({ id: REPORT_TITLE_ID, level: 2, text: 'Lumen Q3 report' });
    expect(isDocument(state.document, { trust: 'untrusted' })).toBe(true);

    const undone = demo.dispatch({ type: 'undo' });
    expect(equalData(undone.document, PRODUCT_REPORT)).toBe(true);
    expect(undone.canRedo).toBe(true);
    const redone = demo.dispatch({ type: 'redo' });
    expect(titleText(redone.document)).toBe('Lumen Q3 report');
  });

  it('refuses an empty or overlong title and changes nothing', () => {
    const demo = createDocumentsDemo();
    expect(demo.dispatch({ type: 'rename-title', title: '   ' }).error).toBe('empty-title');
    expect(
      demo.dispatch({ type: 'rename-title', title: 'x'.repeat(MAX_TITLE_LENGTH + 1) }).error
    ).toBe('title-too-long');
    expect(equalData(demo.state.document, PRODUCT_REPORT)).toBe(true);
    expect(demo.state.canUndo).toBe(false);
  });

  it.each(ADDABLE_BLOCKS)('appends a valid %s block with a deterministic id', (block) => {
    const demo = createDocumentsDemo();
    const state = demo.dispatch({ type: 'add-block', block });
    expect(state.error).toBeNull();
    expect(state.blockCount).toBe(PRODUCT_REPORT.blocks.length + 1);
    const last = state.document.blocks.at(-1);
    expect(last?.id).toBe('added-1');
    expect(last?.type).toBe(block);
    expect(isDocument(state.document, { trust: 'untrusted' })).toBe(true);
  });

  it('numbers added blocks in order and keeps ids unique across undo', () => {
    const demo = createDocumentsDemo();
    demo.dispatch({ type: 'add-block', block: 'paragraph' });
    demo.dispatch({ type: 'undo' });
    const state = demo.dispatch({ type: 'add-block', block: 'list' });
    expect(state.error).toBeNull();
    expect(state.document.blocks.at(-1)?.id).toBe('added-2');
    expect(state.canRedo).toBe(false);
  });

  it('refuses an unknown block kind', () => {
    const demo = createDocumentsDemo();
    const action = { type: 'add-block', block: 'script' } as unknown as DocumentsDemoAction;
    expect(demo.dispatch(action).error).toBe('unknown-block');
    expect(demo.state.blockCount).toBe(PRODUCT_REPORT.blocks.length);
  });

  it('switches between edit and read; read mode refuses edits, undo and redo', () => {
    const demo = createDocumentsDemo();
    demo.dispatch({ type: 'add-block', block: 'heading' });
    const read = demo.dispatch({ type: 'toggle-mode' });
    expect(read.mode).toBe('read');
    expect(read.canUndo).toBe(false);
    const before = read.document;
    for (const action of [
      { type: 'rename-title', title: 'Nope' },
      { type: 'add-block', block: 'paragraph' },
      { type: 'undo' },
      { type: 'redo' },
    ] as const) {
      const state = demo.dispatch(action);
      expect(state.error).toBe('read-only');
      expect(state.document).toBe(before);
    }
    const edit = demo.dispatch({ type: 'set-mode', mode: 'edit' });
    expect(edit.mode).toBe('edit');
    expect(edit.canUndo).toBe(true);
    expect(edit.error).toBeNull();
  });

  it('reports nothing to undo or redo', () => {
    const demo = createDocumentsDemo();
    expect(demo.dispatch({ type: 'undo' }).error).toBe('nothing-to-undo');
    expect(demo.dispatch({ type: 'redo' }).error).toBe('nothing-to-redo');
  });

  it('resets to the exact fixture, edit mode, an empty history and restarted ids', () => {
    const demo = createDocumentsDemo();
    demo.dispatch({ type: 'rename-title', title: 'Changed' });
    demo.dispatch({ type: 'add-block', block: 'callout' });
    demo.dispatch({ type: 'add-block', block: 'paragraph' });
    demo.dispatch({ type: 'set-mode', mode: 'read' });
    const reset = demo.dispatch({ type: 'reset' });
    expect(equalData(reset.document, PRODUCT_REPORT)).toBe(true);
    expect(reset.mode).toBe('edit');
    expect(reset.canUndo).toBe(false);
    expect(reset.canRedo).toBe(false);
    expect(reset.error).toBeNull();
    const again = demo.dispatch({ type: 'add-block', block: 'paragraph' });
    expect(again.document.blocks.at(-1)?.id).toBe('added-1');
  });

  it('never mutates the fixture', () => {
    const before = frozenFixture();
    const demo = createDocumentsDemo();
    demo.dispatch({ type: 'rename-title', title: 'Mutated?' });
    demo.dispatch({ type: 'add-block', block: 'list' });
    demo.dispatch({ type: 'reset' });
    expect(PRODUCT_REPORT).toEqual(before);
  });

  it('is deterministic: the same actions give the same document', () => {
    const script: DocumentsDemoAction[] = [
      { type: 'rename-title', title: 'Lumen summary' },
      { type: 'add-block', block: 'heading' },
      { type: 'add-block', block: 'list' },
      { type: 'undo' },
      { type: 'add-block', block: 'callout' },
    ];
    const a = createDocumentsDemo();
    const b = createDocumentsDemo();
    for (const action of script) {
      a.dispatch(action);
      b.dispatch(action);
    }
    expect(equalData(a.state.document, b.state.document)).toBe(true);
  });

  it('notifies subscribers until they unsubscribe', () => {
    const demo = createDocumentsDemo();
    const seen: string[] = [];
    const stop = demo.subscribe((state) => seen.push(state.mode));
    demo.dispatch({ type: 'toggle-mode' });
    stop();
    demo.dispatch({ type: 'toggle-mode' });
    expect(seen).toEqual(['read']);
  });

  it('accepts another valid fixture without touching it', () => {
    const other = frozenFixture();
    other.meta.title = 'Another report';
    const demo = createDocumentsDemo(other);
    demo.dispatch({ type: 'add-block', block: 'paragraph' });
    expect(other.blocks.length).toBe(PRODUCT_REPORT.blocks.length);
    expect(demo.state.document.meta.title).toBe('Another report');
  });
});

describe('documents demo module', () => {
  it('imports only @texuli/document and its own fixtures (no Svelte, DOM or network)', () => {
    for (const file of ['model.ts', 'fixtures/product-report.ts']) {
      const source = readFileSync(resolve(DEMO_DIR, file), 'utf8');
      const imports = [...source.matchAll(/from '([^']+)'/g)].map((m) => m[1] ?? '');
      for (const spec of imports) {
        expect(spec.startsWith('@texuli/document/') || spec.startsWith('./')).toBe(true);
      }
      expect(source).not.toMatch(/\bfetch\(|innerHTML|\{@html|localStorage|document\.create/);
    }
  });
});
