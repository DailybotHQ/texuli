// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  applyDocumentPatch,
  applyOperations,
  createDocumentHistory,
  type DocumentOperation,
  type DocumentPatchOperation,
  MAX_PATCH_OPERATIONS,
} from '../src/ops/index.ts';
import { everyBlock, time } from './fixtures.ts';

const para = (id: string, text: string) => ({
  id,
  type: 'paragraph' as const,
  content: [{ type: 'text' as const, text, marks: [] }],
});

describe('document operations', () => {
  it('applies every operation kind and its inverse restores the input exactly', () => {
    const cases: [string, DocumentOperation[]][] = [
      [
        'insert at the top',
        [{ op: 'insert-node', parent: null, index: 0, node: para('n1', 'New') }],
      ],
      [
        'insert into a quote',
        [{ op: 'insert-node', parent: 'q1', index: 1, node: para('n2', 'More') }],
      ],
      [
        'insert a list item',
        [
          {
            op: 'insert-node',
            parent: 'l1',
            index: 2,
            node: { id: 'i3', blocks: [para('i3p', 'Ship')] },
          },
        ],
      ],
      ['remove a nested block', [{ op: 'remove-node', id: 'co1p' }]],
      ['remove a container', [{ op: 'remove-node', id: 'l1' }]],
      ['move to the end', [{ op: 'move-node', id: 'h1', parent: null, index: 13 }]],
      ['move into a column', [{ op: 'move-node', id: 'd1', parent: 'col2', index: 0 }]],
      ['move between items', [{ op: 'move-node', id: 'q1', parent: 'i2', index: 1 }]],
      ['heading level', [{ op: 'set-attrs', id: 'h1', attrs: { level: 2 } }]],
      ['clear a callout title', [{ op: 'set-attrs', id: 'co1', attrs: { title: null } }]],
      ['todo check', [{ op: 'set-attrs', id: 'i2', attrs: { checked: true } }]],
      ['insert text inside a link', [{ op: 'insert-text', id: 'p1', offset: 11, text: 'X' }]],
      [
        'insert text with a break',
        [{ op: 'insert-text', id: 'p1', offset: 0, text: 'A\nB', marks: [{ type: 'em' }] }],
      ],
      ['delete across runs', [{ op: 'delete-text', id: 'p1', offset: 3, length: 12 }]],
      ['code text', [{ op: 'insert-text', id: 'c1', offset: 5, text: 'y\n' }]],
      ['toggle summary', [{ op: 'delete-text', id: 't1', offset: 0, length: 3 }]],
      [
        'bold a range',
        [{ op: 'set-mark', id: 'p1', from: 0, to: 9, mark: { type: 'strong' }, value: true }],
      ],
      [
        'code mark drops others',
        [{ op: 'set-mark', id: 'p1', from: 14, to: 18, mark: { type: 'code' }, value: true }],
      ],
      [
        'unlink',
        [
          {
            op: 'set-mark',
            id: 'p1',
            from: 9,
            to: 14,
            mark: { type: 'link', href: 'https://example.com/guide' },
            value: false,
          },
        ],
      ],
      [
        'replace text',
        [
          {
            op: 'replace-text',
            id: 'p1',
            from: 0,
            to: 4,
            content: [{ type: 'text', text: 'See', marks: [] }],
          },
        ],
      ],
      [
        'meta',
        [{ op: 'set-meta', meta: { title: 'Renamed', description: 'A summary', tags: null } }],
      ],
      ['page', [{ op: 'set-page', page: { size: 'letter', orientation: 'landscape' } }]],
      ['clear page', [{ op: 'set-page', page: null }]],
      [
        'a transaction',
        [
          { op: 'insert-node', parent: null, index: 1, node: para('tx', 'one') },
          { op: 'insert-text', id: 'tx', offset: 3, text: ' two' },
          { op: 'move-node', id: 'tx', parent: 'co1', index: 0 },
          { op: 'remove-node', id: 'co1p' },
        ],
      ],
    ];
    for (const [name, operations] of cases) {
      const input = everyBlock();
      const snapshot = JSON.stringify(input);
      const forward = applyOperations(input, operations);
      expect(
        forward.ok,
        `${name}: ${forward.ok ? '' : `${forward.reason} ${JSON.stringify(forward.issues)}`}`
      ).toBe(true);
      if (!forward.ok) continue;
      expect(JSON.stringify(input), `${name} left the input untouched`).toBe(snapshot);
      expect(JSON.stringify(forward.document), name).not.toBe(snapshot);
      const back = applyOperations(forward.document, forward.inverse);
      expect(back.ok, name).toBe(true);
      if (back.ok) expect(back.document, name).toEqual(JSON.parse(snapshot));
    }
  });

  it('refuses invalid operations and leaves the input untouched', () => {
    const cases: [string, DocumentOperation[], RegExp][] = [
      ['unknown id', [{ op: 'remove-node', id: 'nope' }], /No node/],
      [
        'duplicate id',
        [{ op: 'insert-node', parent: null, index: 0, node: para('p1', 'dup') }],
        /already used/,
      ],
      [
        'item at the top',
        [{ op: 'insert-node', parent: null, index: 0, node: { id: 'it', blocks: [] } }],
        /cannot go inside/,
      ],
      [
        'block in a list',
        [{ op: 'insert-node', parent: 'l1', index: 0, node: para('x', 'x') }],
        /cannot go inside/,
      ],
      [
        'into a leaf',
        [{ op: 'insert-node', parent: 'p1', index: 0, node: para('x', 'x') }],
        /holds no children/,
      ],
      [
        'move into itself',
        [{ op: 'move-node', id: 'cols', parent: 'col1', index: 0 }],
        /inside itself/,
      ],
      [
        'index out of range',
        [{ op: 'insert-node', parent: null, index: 99, node: para('x', 'x') }],
        /index/,
      ],
      [
        'unknown attribute',
        [{ op: 'set-attrs', id: 'p1', attrs: { style: 'red' } }],
        /no attribute/,
      ],
      ['text past the end', [{ op: 'delete-text', id: 'p1', offset: 2, length: 99 }], /length/],
      [
        'marks on code',
        [{ op: 'set-mark', id: 'c1', from: 0, to: 1, mark: { type: 'em' }, value: true }],
        /plain text/,
      ],
      [
        'text on a divider',
        [{ op: 'insert-text', id: 'd1', offset: 0, text: 'x' }],
        /holds no text/,
      ],
      ['remove the title', [{ op: 'set-meta', meta: { title: null } }], /title/],
      [
        'unknown op',
        [{ op: 'eval', id: 'x' } as unknown as DocumentOperation],
        /Unknown operation/,
      ],
      [
        'invalid result',
        [{ op: 'set-attrs', id: 'h1', attrs: { level: 9 } }],
        /not a valid document/,
      ],
      [
        'unsafe link in the result',
        [
          {
            op: 'set-mark',
            id: 'p1',
            from: 0,
            to: 2,
            mark: { type: 'link', href: 'javascript:alert(1)' },
            value: true,
          },
        ],
        /not a valid document/,
      ],
      [
        'fails halfway',
        [
          { op: 'insert-node', parent: null, index: 0, node: para('ok', 'fine') },
          { op: 'remove-node', id: 'missing' },
        ],
        /No node/,
      ],
    ];
    for (const [name, operations, reason] of cases) {
      const input = everyBlock();
      const snapshot = JSON.stringify(input);
      const result = applyOperations(input, operations);
      expect(result.ok, name).toBe(false);
      if (!result.ok) expect(result.reason, name).toMatch(reason);
      expect(JSON.stringify(input), name).toBe(snapshot);
    }
  });

  it('keeps an op log with undo and redo as new entries', () => {
    const history = createDocumentHistory(everyBlock());
    const seen: number[] = [];
    history.subscribe((entry) => seen.push(entry.seq));
    expect(
      history.apply([{ op: 'insert-text', id: 'h1', offset: 5, text: '!' }], { origin: 'local' }).ok
    ).toBe(true);
    expect(history.apply([{ op: 'remove-node', id: 'd1' }]).ok).toBe(true);
    expect(history.apply([{ op: 'remove-node', id: 'd1' }]).ok).toBe(false);
    expect(history.undo()).toBe(true);
    expect(history.document.blocks.some((block) => block.id === 'd1')).toBe(true);
    expect(history.redo()).toBe(true);
    expect(history.undo()).toBe(true);
    expect(history.undo()).toBe(true);
    expect(history.document).toEqual(everyBlock());
    expect(history.canUndo).toBe(false);
    expect(history.log().map((entry) => entry.kind)).toEqual([
      'edit',
      'edit',
      'undo',
      'redo',
      'undo',
      'undo',
    ]);
    expect(history.since(4).map((entry) => entry.seq)).toEqual([5, 6]);
    expect(history.log()[0]?.origin).toBe('local');
    expect(seen).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it('logs non-undoable sync entries off the undo and redo stacks', () => {
    const history = createDocumentHistory(everyBlock());
    expect(history.apply([{ op: 'insert-text', id: 'h1', offset: 0, text: 'A' }]).ok).toBe(true);
    const remote = history.apply([{ op: 'remove-node', id: 'd1' }], {
      origin: 'remote',
      undoable: false,
    });
    expect(remote.ok).toBe(true);
    expect(history.log().map((entry) => [entry.kind, entry.origin])).toEqual([
      ['edit', undefined],
      ['sync', 'remote'],
    ]);
    // Undo reverts the local edit only; the remote removal stays.
    expect(history.undo()).toBe(true);
    expect(history.canUndo).toBe(false);
    expect(history.document.blocks.some((block) => block.id === 'd1')).toBe(false);
  });
});

describe('document patches', () => {
  it('applies RFC 6902 patches and their inverse patches restore the input', () => {
    const cases: [string, DocumentPatchOperation[]][] = [
      ['add a block', [{ op: 'add', path: '/blocks/1', value: para('n1', 'New') }]],
      ['append a block', [{ op: 'add', path: '/blocks/-', value: para('n2', 'End') }]],
      ['remove a block', [{ op: 'remove', path: '/blocks/5' }]],
      [
        'replace a title',
        [
          { op: 'test', path: '/meta/title', value: 'Field notes' },
          { op: 'replace', path: '/meta/title', value: 'Notes' },
        ],
      ],
      ['add an optional field', [{ op: 'add', path: '/meta/description', value: 'About' }]],
      ['remove an optional field', [{ op: 'remove', path: '/page' }]],
      ['move a block', [{ op: 'move', from: '/blocks/0', path: '/blocks/3' }]],
      ['move into a quote', [{ op: 'move', from: '/blocks/5', path: '/blocks/4/blocks/0' }]],
      [
        'copy and re-id',
        [
          { op: 'copy', from: '/blocks/1', path: '/blocks/2' },
          { op: 'replace', path: '/blocks/2/id', value: 'copy1' },
        ],
      ],
      ['edit run text', [{ op: 'replace', path: '/blocks/1/content/0/text', value: 'See the ' }]],
    ];
    for (const [name, patch] of cases) {
      const input = everyBlock();
      const snapshot = JSON.stringify(input);
      const forward = applyDocumentPatch(input, patch);
      expect(forward.ok, `${name}: ${forward.ok ? '' : forward.reason}`).toBe(true);
      if (!forward.ok) continue;
      expect(JSON.stringify(input), name).toBe(snapshot);
      const back = applyDocumentPatch(forward.document, forward.inverse);
      expect(back.ok, name).toBe(true);
      if (back.ok) expect(back.document, name).toEqual(JSON.parse(snapshot));
    }
  });

  it('refuses hostile patches in linear time', () => {
    const cases: [string, unknown, RegExp][] = [
      ['prototype path', [{ op: 'add', path: '/meta/__proto__/x', value: 1 }], /Prototype/],
      ['bad escape', [{ op: 'remove', path: '/meta/~2' }], /escape/],
      ['missing path', [{ op: 'remove', path: '/nope' }], /does not exist/],
      ['failed test', [{ op: 'test', path: '/meta/title', value: 'Other' }], /test/],
      [
        'into a descendant',
        [{ op: 'move', from: '/blocks/3', path: '/blocks/3/blocks/0' }],
        /descendant/,
      ],
      ['remove the root', [{ op: 'remove', path: '' }], /root/],
      ['unknown op', [{ op: 'eval', path: '' }], /Unsupported/],
      [
        'too many',
        Array.from({ length: MAX_PATCH_OPERATIONS + 1 }, () => ({
          op: 'test',
          path: '',
          value: 1,
        })),
        /at most/,
      ],
      ['invalid result', [{ op: 'replace', path: '/blocks/0/level', value: 7 }], /valid document/],
      [
        'unsafe link',
        [{ op: 'replace', path: '/blocks/1/content/1/marks/0/href', value: 'javascript:alert(1)' }],
        /valid document/,
      ],
    ];
    for (const [name, patch, reason] of cases) {
      const result = applyDocumentPatch(everyBlock(), patch as DocumentPatchOperation[]);
      expect(result.ok, name).toBe(false);
      if (!result.ok) expect(result.reason, name).toMatch(reason);
    }
    // 1,000 appends to a large document: one copy, not one per operation.
    const big = everyBlock();
    for (let i = 0; i < 1_200; i += 1) big.blocks.push(para(`big${i}`, 'x'.repeat(100)));
    const patch = Array.from({ length: 400 }, (_, i) => ({
      op: 'add' as const,
      path: '/blocks/-',
      value: para(`app${i}`, 'y'),
    }));
    expect(time(() => expect(applyDocumentPatch(big, patch).ok).toBe(true))).toBeLessThan(2_000);
  });
});
