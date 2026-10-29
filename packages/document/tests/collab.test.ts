// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  createDocumentSync,
  type DocumentSync,
  describeChanges,
  diffDocuments,
  parseMentions,
  seedOperations,
} from '../src/collab/index.ts';
import { decodeValue, encodeValue } from '../src/collab/vocabulary.ts';
import type { DocumentBlock, TexuliDocument } from '../src/model/index.ts';
import { applyOperations, type DocumentOperation, equalData } from '../src/ops/index.ts';
import { validateDocument } from '../src/schema/index.ts';
import { createMemorySyncHub, ROOT, type SyncOp } from '../src/sync/index.ts';
import { rng, time } from './fixtures.ts';

/*
 * @texuli/document/collab: the binding of documents to the CRDT (seed,
 * local commits, merged states back as document operations, undo), the
 * projection's deterministic repair, comments anchored to item ids,
 * suggestions, versions with restore, presence, and hostile input.
 */

const t = (text: string) => [{ type: 'text' as const, text, marks: [] }];
const para = (id: string, text: string): DocumentBlock => ({
  id,
  type: 'paragraph',
  content: t(text),
});

function sample(): TexuliDocument {
  return {
    format: 'texuli-document',
    formatVersion: 1,
    meta: { title: 'Field notes' },
    blocks: [
      { id: 'h1', type: 'heading', level: 1, content: t('Field notes') },
      para('p1', 'Hello world'),
      para('p2', 'Second paragraph'),
      {
        id: 'l1',
        type: 'list',
        kind: 'bullet',
        items: [
          { id: 'i1', blocks: [para('ip1', 'one')] },
          { id: 'i2', blocks: [para('ip2', 'two')] },
        ],
      },
      {
        id: 'cols',
        type: 'columns',
        columns: [
          { id: 'c1', type: 'column', blocks: [para('c1p', 'left')] },
          { id: 'c2', type: 'column', blocks: [para('c2p', 'right')] },
        ],
      },
    ],
  };
}

/** A session plus the editor document it feeds (the editor's op log stays the only edit path). */
function peer(replica: string, doc: TexuliDocument = sample(), now = () => 1_700_000_000_000) {
  const session = createDocumentSync({
    replica,
    document: doc,
    author: { name: replica, color: 2 },
    now,
  });
  const state = { doc: session.document, origins: [] as string[] };
  session.subscribe((change) => {
    state.origins.push(change.origin);
    if (change.operations.length === 0) return;
    const result = applyOperations(state.doc, change.operations);
    if (!result.ok) throw new Error(result.reason);
    state.doc = result.document;
  });
  const edit = (operations: DocumentOperation[], group?: string) => {
    const result = applyOperations(state.doc, operations);
    if (!result.ok) throw new Error(result.reason);
    state.doc = result.document;
    return session.commit(result.document, group ? { group } : {});
  };
  return { session, state, edit };
}

/** Wire sessions so every local batch reaches the others at once. */
function link(...sessions: DocumentSync[]): void {
  for (const from of sessions)
    from.replica.onOps((ops, origin) => {
      if (origin !== 'local') return;
      for (const to of sessions) if (to !== from) to.receive(JSON.parse(JSON.stringify({ ops })));
    });
}

const textOf = (doc: TexuliDocument, id: string) => {
  const stack = [...doc.blocks] as unknown as Record<string, unknown>[];
  while (stack.length > 0) {
    const node = stack.pop() as Record<string, unknown>;
    if (node.id === id) {
      if (typeof node.text === 'string') return node.text;
      return ((node.content ?? node.summary ?? []) as { type: string; text?: string }[])
        .map((part) => (part.type === 'break' ? '\n' : part.text))
        .join('');
    }
    for (const key of ['blocks', 'items', 'columns'])
      if (Array.isArray(node[key])) stack.push(...(node[key] as Record<string, unknown>[]));
  }
  return null;
};

describe('seeding', () => {
  it('derives the same seed from the same document, so independent starts merge as one', () => {
    const a = peer('ada');
    const b = peer('lin');
    expect(a.session.document).toEqual(sample());
    expect(a.session.replica.versionVector()).toEqual(b.session.replica.versionVector());
    link(a.session, b.session);
    a.edit([{ op: 'insert-text', id: 'p1', offset: 5, text: ',' }]);
    expect(textOf(b.session.document, 'p1')).toBe('Hello, world');
    const other = seedOperations({ ...sample(), meta: { title: 'Other' } });
    expect(other[0]?.replica).not.toBe(seedOperations(sample())[0]?.replica);
  });

  it('seeds comment threads from the document annotations, anchored to the seeded text', () => {
    const doc: TexuliDocument = {
      ...sample(),
      annotations: {
        comments: [
          {
            id: 't1',
            anchor: { block: 'p1', start: 6, end: 11 },
            status: 'resolved',
            messages: [
              { id: 'm1', author: 'Ada', body: 'Which world?' },
              { id: 'm2', author: 'Lin', body: 'This one.' },
            ],
          },
        ],
      },
    };
    const { session } = peer('ada', doc);
    const [thread] = session.threads();
    expect(thread).toMatchObject({
      block: 'p1',
      range: { from: 6, to: 11 },
      quote: 'world',
      status: 'resolved',
    });
    expect(thread?.messages.map((message) => message.body)).toEqual(['Which world?', 'This one.']);
    expect(session.document.annotations).toBeUndefined();
    const exported = { ...session.document, annotations: session.exportAnnotations() };
    expect(validateDocument(exported).ok).toBe(true);
    expect(exported.annotations.comments?.[0]?.anchor).toEqual({ block: 'p1', start: 6, end: 11 });
  });
});

describe('local commits and merged states', () => {
  it('keeps the projection equal to every kind of local edit (no correction)', () => {
    const { session, state, edit } = peer('ada');
    const steps: DocumentOperation[][] = [
      [{ op: 'insert-text', id: 'p1', offset: 0, text: 'Bold ', marks: [{ type: 'strong' }] }],
      [
        {
          op: 'set-mark',
          id: 'p1',
          from: 5,
          to: 10,
          mark: { type: 'link', href: 'https://example.com/a' },
          value: true,
        },
      ],
      [
        {
          op: 'replace-text',
          id: 'p2',
          from: 0,
          to: 6,
          content: [{ type: 'text', text: 'First', marks: [{ type: 'em' }] }, { type: 'break' }],
        },
      ],
      [
        {
          op: 'insert-node',
          parent: 'c1',
          index: 1,
          node: { id: 'q1', type: 'quote', blocks: [para('q1p', 'quoted 😀')] },
        },
      ],
      [{ op: 'move-node', id: 'p2', parent: 'q1', index: 0 }],
      [{ op: 'move-node', id: 'i2', parent: 'l1', index: 0 }],
      [{ op: 'set-attrs', id: 'h1', attrs: { level: 2 } }],
      [
        { op: 'set-attrs', id: 'i1', attrs: { checked: true } },
        { op: 'set-attrs', id: 'l1', attrs: { kind: 'todo' } },
      ],
      [{ op: 'set-meta', meta: { title: 'Renamed', tags: ['notes'] } }],
      [{ op: 'set-page', page: { size: 'a4', orientation: 'portrait' } }],
      [{ op: 'delete-text', id: 'ip1', offset: 1, length: 2 }],
      [{ op: 'remove-node', id: 'cols' }],
      [
        {
          op: 'insert-node',
          parent: null,
          index: 0,
          node: { id: 'k1', type: 'code', lang: 'ts', text: 'a\tb\nc' },
        },
      ],
      [
        {
          op: 'insert-node',
          parent: null,
          index: 1,
          node: {
            id: 'e1',
            type: 'embed',
            kind: 'component',
            title: 'Big',
            inline: {
              id: 'charts-bar',
              props: {
                data: Array.from({ length: 900 }, (_, i) => ({ label: `L${i}`, value: i })),
              },
            },
          },
        },
      ],
    ];
    for (const operations of steps) {
      expect(edit(operations)).toEqual([]);
      expect(session.document).toEqual(state.doc);
    }
    expect(validateDocument(session.document).ok).toBe(true);
  });

  it('turns remote changes into document operations the editor applies', () => {
    const a = peer('ada');
    const b = peer('lin');
    link(a.session, b.session);
    a.edit([{ op: 'insert-node', parent: null, index: 2, node: para('n1', 'from Ada') }]);
    b.edit([{ op: 'insert-text', id: 'n1', offset: 8, text: ' and Lin' }]);
    a.edit([{ op: 'move-node', id: 'n1', parent: 'c2', index: 0 }]);
    for (const side of [a, b]) {
      expect(side.state.doc).toEqual(side.session.document);
      expect(textOf(side.state.doc, 'n1')).toBe('from Ada and Lin');
    }
    expect(b.state.origins).toContain('remote');
  });

  it('diffDocuments turns any document into any other (property, 300 seeded pairs)', () => {
    for (let seed = 1; seed <= 300; seed += 1) {
      const random = rng(seed);
      const a = peer(`p${seed}`);
      let from = a.session.document;
      const docs: TexuliDocument[] = [from];
      // Random walks from the sample give related documents.
      for (let step = 0; step < 6; step += 1) {
        const ids = ['p1', 'p2', 'ip1', 'c1p', 'h1'];
        const id = ids[Math.floor(random() * ids.length)] as string;
        const options: DocumentOperation[] = [
          { op: 'insert-text', id, offset: 0, text: 'x' },
          { op: 'move-node', id: 'p2', parent: random() < 0.5 ? null : 'c1', index: 0 },
          { op: 'remove-node', id },
          { op: 'insert-node', parent: null, index: 0, node: para(`n${step}`, 'new') },
          { op: 'set-attrs', id: 'h1', attrs: { level: 3 } },
          { op: 'set-mark', id, from: 0, to: 1, mark: { type: 'strong' }, value: true },
        ];
        const result = applyOperations(from, [
          options[Math.floor(random() * options.length)] as DocumentOperation,
        ]);
        if (result.ok) {
          from = result.document;
          docs.push(from);
        }
      }
      const x = docs[Math.floor(random() * docs.length)] as TexuliDocument;
      const y = docs[Math.floor(random() * docs.length)] as TexuliDocument;
      const result = applyOperations(x, diffDocuments(x, y));
      expect(result.ok, `seed ${seed}`).toBe(true);
      expect(result.ok && equalData(result.document, y), `seed ${seed}`).toBe(true);
    }
  });

  it('undo is local and selective: it reverts this author’s edit and keeps the other’s', () => {
    const a = peer('ada');
    const b = peer('lin');
    link(a.session, b.session);
    a.edit([{ op: 'insert-text', id: 'p1', offset: 11, text: '!' }]);
    b.edit([{ op: 'insert-text', id: 'p1', offset: 0, text: '> ' }]);
    expect(a.session.undo()).toBe(true);
    expect(textOf(a.state.doc, 'p1')).toBe('> Hello world');
    expect(b.state.doc).toEqual(a.state.doc);
    expect(a.session.redo()).toBe(true);
    expect(textOf(b.state.doc, 'p1')).toBe('> Hello world!');
    expect(a.state.origins).toEqual(expect.arrayContaining(['undo', 'redo']));
  });

  it('groups commits of one group within groupMs into one undo step', () => {
    let clock = 0;
    const a = peer('ada', sample(), () => clock);
    for (const char of 'abc') {
      clock += 100;
      a.edit([{ op: 'insert-text', id: 'p1', offset: 0, text: char }], 'typing');
    }
    clock += 5_000;
    a.edit([{ op: 'insert-text', id: 'p1', offset: 0, text: 'z' }], 'typing');
    a.session.undo();
    expect(textOf(a.state.doc, 'p1')).toBe('cbaHello world');
    a.session.undo();
    expect(textOf(a.state.doc, 'p1')).toBe('Hello world');
    expect(a.session.canUndo).toBe(false);
  });

  it('revives a removed node with its identity when an edit brings it back', () => {
    const a = peer('ada');
    const b = peer('lin');
    link(a.session, b.session);
    const before = a.session.document;
    a.edit([{ op: 'remove-node', id: 'p1' }]);
    b.edit([{ op: 'insert-text', id: 'p2', offset: 0, text: '*' }]);
    // A restore-like edit: the old document again (p1 returns, p2 keeps Lin's star by the text diff).
    a.edit(diffDocuments(a.state.doc, { ...before, blocks: before.blocks }));
    expect(textOf(b.state.doc, 'p1')).toBe('Hello world');
    expect(a.session.replica.node('p1')?.parent).toBe(ROOT);
  });
});

describe('the projection repairs merges deterministically', () => {
  it('hides a structure two concurrent edits made invalid, the same way on every replica', () => {
    const three = sample();
    (three.blocks[4] as { columns: unknown[] }).columns.push({
      id: 'c3',
      type: 'column',
      blocks: [para('c3p', 'third')],
    });
    const a = peer('ada', three);
    const b = peer('lin', three);
    // Each removes a different column: one column is left, which a columns block cannot be.
    a.edit([{ op: 'remove-node', id: 'c1' }]);
    b.edit([{ op: 'remove-node', id: 'c2' }]);
    link(a.session, b.session);
    a.session.receive({ ops: b.session.replica.opsSince(a.session.replica.versionVector()) });
    b.session.receive({ ops: a.session.replica.opsSince(b.session.replica.versionVector()) });
    for (const side of [a, b]) {
      expect(validateDocument(side.session.document).ok).toBe(true);
      expect(side.session.document.blocks.map((block) => block.id)).not.toContain('cols');
      expect(side.session.projection.repaired).toBeGreaterThan(0);
      expect(side.state.doc).toEqual(side.session.document);
    }
    expect(JSON.stringify(a.session.document)).toBe(JSON.stringify(b.session.document));
    // Undo brings the column back for everyone.
    a.session.undo();
    expect(a.session.document.blocks.map((block) => block.id)).toContain('cols');
    expect(b.state.doc).toEqual(a.state.doc);
  });

  it('leaves out a list item whose first block a concurrent move made a heading', () => {
    const a = peer('ada');
    const b = peer('lin');
    a.edit([{ op: 'move-node', id: 'h1', parent: 'i1', index: 1 }]);
    b.edit([
      { op: 'move-node', id: 'ip1', parent: null, index: 0 },
      { op: 'insert-node', parent: 'i1', index: 0, node: para('keep', 'k') },
    ]);
    b.edit([
      { op: 'remove-node', id: 'keep' },
      { op: 'insert-node', parent: 'i1', index: 0, node: para('keep2', 'k') },
    ]);
    link(a.session, b.session);
    a.session.receive({ ops: b.session.replica.opsSince(a.session.replica.versionVector()) });
    b.session.receive({ ops: a.session.replica.opsSince(b.session.replica.versionVector()) });
    expect(JSON.stringify(a.session.document)).toBe(JSON.stringify(b.session.document));
    expect(validateDocument(a.session.document).ok).toBe(true);
  });

  it('never projects an invalid document from hostile remote operations, in bounded time', () => {
    const { session, state } = peer('ada');
    const base = { replica: 'evil', lamport: 10_000, deps: session.replica.versionVector() };
    const ops: SyncOp[] = [
      { ...base, counter: 0, kind: 'create', node: 'bad', type: 'heading' },
      { ...base, counter: 1, kind: 'set', node: 'bad', key: 'level', value: 'huge' },
      {
        ...base,
        counter: 2,
        kind: 'move',
        node: 'bad',
        parent: ROOT,
        slot: { parent: null, side: 'R' },
      },
      { ...base, counter: 3, kind: 'set', node: ROOT, key: 'locale', value: '<script>' },
      { ...base, counter: 4, kind: 'set', node: 'p1', key: 'level', value: 3 },
      { ...base, counter: 5, kind: 'create', node: 'x1', type: 'item' },
      {
        ...base,
        counter: 6,
        kind: 'move',
        node: 'x1',
        parent: ROOT,
        slot: { parent: null, side: 'R' },
      },
      {
        ...base,
        counter: 7,
        kind: 'insert',
        node: 'p2',
        field: 'content',
        origin: { parent: null, side: 'R' },
        text: '‮evil\u0000',
      },
      {
        ...base,
        counter: 13,
        kind: 'mark',
        node: 'p2',
        field: 'content',
        key: 'link',
        value: 'javascript:alert(1)',
        start: 'start',
        end: 'end',
      },
      { ...base, counter: 14, kind: 'create', node: 'nope', type: 'script' },
      { ...base, counter: 15, kind: 'set', node: 'p1', key: 'props', value: { $json: ['{"a":'] } },
    ];
    const result = session.receive({ ops });
    expect(result.ok).toBe(true);
    const doc = session.document;
    expect(validateDocument(doc).ok).toBe(true);
    expect(doc.meta.locale).toBeUndefined();
    expect(doc.blocks.map((block) => block.id)).not.toContain('bad');
    expect(textOf(doc, 'p2')).toBe('evilSecond paragraph');
    expect(state.doc).toEqual(doc);
    // A flood of nested nodes past the caps stays bounded and valid.
    const flood: SyncOp[] = [];
    let counter = 16;
    let parent = ROOT;
    for (let i = 0; i < 3_000; i += 1) {
      const id = `f${i}`;
      flood.push({
        ...base,
        counter: counter++,
        kind: 'create',
        node: id,
        type: i % 2 ? 'quote' : 'paragraph',
      });
      flood.push({
        ...base,
        counter: counter++,
        kind: 'move',
        node: id,
        parent,
        slot: { parent: null, side: 'R' },
      });
      if (i % 2) parent = id;
    }
    const elapsed = time(() => session.receive({ ops: flood }));
    expect(validateDocument(session.document).ok).toBe(true);
    expect(elapsed).toBeLessThan(5_000);
  });

  it('carries values beyond the register bounds as one chunked register', () => {
    const big = { rows: Array.from({ length: 3_000 }, (_, i) => i) };
    const encoded = encodeValue(big);
    expect(encoded).toHaveProperty('$json');
    expect(decodeValue(encoded)).toEqual(big);
    expect(encodeValue({ small: true })).toEqual({ small: true });
    expect(decodeValue({ $json: ['{"a":'] })).toBeNull();
    expect(decodeValue({ $json: [1] as never })).toBeNull();
  });
});

describe('comments anchored to item ids', () => {
  it('follow their text through concurrent edits, sync, resolve, reopen and delete', () => {
    const a = peer('ada');
    const b = peer('lin');
    link(a.session, b.session);
    const thread = a.session.addComment(
      { block: 'p1', from: 6, to: 11 },
      'Which @{u-lin|Lin} world?'
    ) as string;
    expect(thread).toBeTruthy();
    b.edit([{ op: 'insert-text', id: 'p1', offset: 0, text: 'Oh, ' }]);
    a.edit([{ op: 'insert-text', id: 'p1', offset: 13, text: 'wide ' }]);
    for (const side of [a, b]) {
      const [entry] = side.session.threads();
      expect(entry?.range).toEqual({ from: 10, to: 20 });
      expect(entry?.quote).toBe('world');
      expect(entry?.messages[0]?.mentions).toEqual([{ id: 'u-lin', label: 'Lin' }]);
    }
    expect(b.session.reply(thread, 'This one.')).toBeTruthy();
    expect(
      a.session.threads()[0]?.messages.map((message) => [message.author, message.mine])
    ).toEqual([
      ['ada', true],
      ['lin', false],
    ]);
    expect(a.session.resolve(thread)).toBe(true);
    expect(b.session.threads()[0]?.status).toBe('resolved');
    expect(b.session.reopen(thread)).toBe(true);
    expect(a.session.threads()[0]?.status).toBe('open');
    const reply = a.session.threads()[0]?.messages[1]?.id as string;
    expect(a.session.deleteComment(reply)).toBe(true);
    expect(b.session.threads()[0]?.messages).toHaveLength(1);
    expect(b.session.deleteComment(thread)).toBe(true);
    expect(a.session.threads()).toEqual([]);
  });

  it('reports orphaned threads with their quote when the range or block is deleted', () => {
    const a = peer('ada');
    a.session.addComment({ block: 'p1', from: 0, to: 5 }, 'Greeting');
    a.session.addComment({ block: 'p2' }, 'Whole block');
    a.edit([{ op: 'delete-text', id: 'p1', offset: 0, length: 6 }]);
    a.edit([{ op: 'remove-node', id: 'p2' }]);
    const threads = a.session.threads();
    expect(threads.map((thread) => [thread.orphaned, thread.quote, thread.range])).toEqual([
      [true, 'Hello', null],
      [true, '', null],
    ]);
    a.session.undo();
    a.session.undo();
    expect(a.session.threads().every((thread) => !thread.orphaned)).toBe(true);
  });

  it('refuses empty or control-character bodies, unknown blocks and empty ranges', () => {
    const { session } = peer('ada');
    expect(session.addComment({ block: 'p1', from: 0, to: 3 }, '   ')).toBeNull();
    expect(session.addComment({ block: 'p1', from: 0, to: 3 }, 'bad‮')).toBeNull();
    expect(session.addComment({ block: 'missing' }, 'x')).toBeNull();
    expect(session.addComment({ block: 'p1', from: 3, to: 3 }, 'x')).toBeNull();
    expect(session.reply('p1', 'x')).toBeNull();
    expect(session.threads()).toEqual([]);
  });

  it('parses mentions in the G48 grammar and leaves malformed ones as text', () => {
    expect(parseMentions('Hi @{u1|Ada} and @{bad id|X} @{u2|} @{u3|Lin}!')).toEqual([
      { text: 'Hi ' },
      { mention: { id: 'u1', label: 'Ada' } },
      { text: ' and @{bad id|X} @{u2|} ' },
      { mention: { id: 'u3', label: 'Lin' } },
      { text: '!' },
    ]);
    const hostile = `${'@{'.repeat(50_000)}x`;
    expect(time(() => parseMentions(hostile))).toBeLessThan(1_000);
  });
});

describe('suggestions', () => {
  function suggesting() {
    const a = peer('ada');
    const b = peer('lin');
    link(a.session, b.session);
    a.session.suggesting = true;
    // Replace "Hello" by "Howdy": one suggestion with a deletion and an insertion.
    a.edit([{ op: 'replace-text', id: 'p1', from: 1, to: 5, content: t('owdy') }]);
    return { a, b };
  }

  it('records insertions and deletions as one attributed suggestion that keeps struck text visible', () => {
    const { a, b } = suggesting();
    expect(textOf(a.state.doc, 'p1')).toBe('Helloowdy world');
    expect(a.state.doc).toEqual(a.session.document);
    const [suggestion] = b.session.suggestions();
    expect(b.session.suggestions()).toHaveLength(1);
    expect(suggestion).toMatchObject({ author: 'ada', mine: false });
    expect(suggestion?.changes).toEqual([
      { block: 'p1', kind: 'delete', from: 1, to: 5, text: 'ello' },
      { block: 'p1', kind: 'insert', from: 5, to: 9, text: 'owdy' },
    ]);
    // Typing next to it extends the same suggestion.
    a.edit([{ op: 'insert-text', id: 'p1', offset: 9, text: '!' }]);
    expect(a.session.suggestions()).toHaveLength(1);
    // Deleting your own suggested text really deletes it.
    a.edit([{ op: 'delete-text', id: 'p1', offset: 9, length: 1 }]);
    expect(textOf(b.state.doc, 'p1')).toBe('Helloowdy world');
  });

  it('accepts and rejects one suggestion or all, as ordinary synced operations', () => {
    const accepted = suggesting();
    expect(accepted.b.session.accept(accepted.b.session.suggestions()[0]?.id as string)).toBe(true);
    expect(textOf(accepted.a.state.doc, 'p1')).toBe('Howdy world');
    expect(accepted.a.session.suggestions()).toEqual([]);
    const rejected = suggesting();
    expect(rejected.b.session.rejectAll()).toBe(true);
    expect(textOf(rejected.a.state.doc, 'p1')).toBe('Hello world');
    const all = suggesting();
    all.a.edit([{ op: 'insert-text', id: 'p2', offset: 0, text: 'New ' }]);
    expect(all.a.session.suggestions()).toHaveLength(2);
    all.a.session.acceptAll();
    expect(textOf(all.b.state.doc, 'p1')).toBe('Howdy world');
    expect(textOf(all.b.state.doc, 'p2')).toBe('New Second paragraph');
    // Accepting undoes as one step.
    all.a.session.undo();
    expect(all.a.session.suggestions()).toHaveLength(2);
  });
});

describe('versions', () => {
  it('names a state, compares it, and restores it with new operations that sync and undo', () => {
    const a = peer('ada');
    const b = peer('lin');
    link(a.session, b.session);
    const version = a.session.saveVersion('Before review') as string;
    expect(b.session.versions().map((entry) => [entry.name, entry.author])).toEqual([
      ['Before review', 'ada'],
    ]);
    b.edit([{ op: 'insert-text', id: 'p1', offset: 11, text: '!' }]);
    a.edit([
      { op: 'remove-node', id: 'p2' },
      { op: 'set-attrs', id: 'h1', attrs: { level: 2 } },
    ]);
    expect(b.session.compare(version)).toEqual([
      { kind: 'attributes', block: 'h1', type: 'heading', keys: ['level'] },
      {
        kind: 'text',
        block: 'p1',
        type: 'paragraph',
        before: 'Hello world',
        after: 'Hello world!',
      },
      { kind: 'removed', block: 'p2', type: 'paragraph', text: 'Second paragraph' },
    ]);
    const log = a.session.replica.snapshot().ops.length;
    expect(b.session.restoreVersion(version)).toBe(true);
    expect(a.state.doc).toEqual(sample());
    expect(b.state.doc).toEqual(sample());
    // History is never rewritten: the restore appended operations.
    expect(a.session.replica.snapshot().ops.length).toBeGreaterThan(log);
    b.session.undo();
    expect(textOf(a.state.doc, 'p1')).toBe('Hello world!');
    expect(b.session.saveVersion('')).toBeNull();
    expect(b.session.restoreVersion('missing')).toBe(false);
  });

  it('describes added, removed, moved, text, formatting and attribute changes', () => {
    const before = sample();
    const result = applyOperations(before, [
      { op: 'insert-node', parent: null, index: 0, node: para('n1', 'new') },
      { op: 'remove-node', id: 'l1' },
      { op: 'move-node', id: 'p2', parent: null, index: 1 },
      { op: 'set-mark', id: 'p1', from: 0, to: 5, mark: { type: 'strong' }, value: true },
      { op: 'set-meta', meta: { title: 'Renamed' } },
    ]);
    if (!result.ok) throw new Error(result.reason);
    const kinds = describeChanges(before, result.document).map((change) => [
      change.kind,
      'block' in change ? change.block : null,
    ]);
    expect(kinds).toEqual([
      ['meta', null],
      ['added', 'n1'],
      ['moved', 'p2'],
      ['formatting', 'p1'],
      ['removed', 'l1'],
    ]);
  });
});

describe('presence', () => {
  it('maps a collaborator’s caret through edits made since, and expires it', async () => {
    let clock = 0;
    const hub = createMemorySyncHub({ manual: true });
    const a = peer('ada', sample(), () => clock);
    const b = peer('lin', sample(), () => clock);
    a.session.connect(hub.adapter());
    b.session.connect(hub.adapter());
    hub.flush();
    b.session.setSelection({
      focus: { block: 'p1', offset: 6 },
      anchor: { block: 'p1', offset: 11 },
    });
    hub.flush();
    expect(a.session.collaborators()).toEqual([
      {
        replica: 'lin',
        name: 'lin',
        color: 2,
        focus: { block: 'p1', offset: 6 },
        anchor: { block: 'p1', offset: 11 },
      },
    ]);
    a.edit([{ op: 'insert-text', id: 'p1', offset: 0, text: '>> ' }]);
    hub.flush();
    expect(a.session.collaborators()[0]?.focus).toEqual({ block: 'p1', offset: 9 });
    expect(b.state.doc).toEqual(a.state.doc);
    clock += 31_000;
    expect(a.session.collaborators()).toEqual([]);
    a.session.close();
    b.session.close();
  });

  it('ignores malformed presence and catches up offline edits on connect', () => {
    const hub = createMemorySyncHub({ manual: true });
    const a = peer('ada');
    const b = peer('lin');
    const evil = hub.adapter();
    a.session.connect(hub.adapter());
    evil.presence?.send({ replica: 'evil', name: 'x‮', color: 3 } as never);
    evil.presence?.send({ replica: 'evil', name: 'Eve', color: 99 } as never);
    hub.flush();
    expect(a.session.collaborators()).toEqual([]);
    // Lin edits offline, then connects: both sides catch up.
    b.edit([{ op: 'insert-text', id: 'p2', offset: 0, text: 'Offline ' }]);
    a.edit([{ op: 'insert-text', id: 'p1', offset: 0, text: 'Online ' }]);
    b.session.connect(hub.adapter());
    for (let i = 0; i < 6; i += 1) hub.flush();
    expect(textOf(a.state.doc, 'p2')).toBe('Offline Second paragraph');
    expect(textOf(b.state.doc, 'p1')).toBe('Online Hello world');
    a.session.close();
    b.session.close();
  });

  it('refuses an author name with controls or out-of-range colors', () => {
    expect(() => createDocumentSync({ replica: 'a', author: { name: 'x\u0007' } })).toThrow(
      TypeError
    );
    expect(() => createDocumentSync({ replica: 'a', author: { name: 'Ada', color: 12 } })).toThrow(
      TypeError
    );
  });
});
