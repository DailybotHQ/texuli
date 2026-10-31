// @vitest-environment node
import { parseDeck } from '@texuli/deck/model';
import { describe, expect, it } from 'vitest';
import { createDocumentSync, type DocumentSync } from '../src/collab/index.ts';
import { decodeValue, encodeValue } from '../src/collab/vocabulary.ts';
import type { DocumentBlock, EmbedBlock, TexuliDocument } from '../src/model/index.ts';
import { applyOperations, type DocumentOperation } from '../src/ops/index.ts';
import { validateDocument } from '../src/schema/index.ts';
import type { SyncOp } from '../src/sync/index.ts';

/*
 * Embeds on the CRDT of @texuli/document/collab: every embed kind and
 * payload the document model allows (component, deck, sheet and canvas,
 * each by host ref and inline, plus the wrapped blocks of @texuli/blocks)
 * survives a seed, a remote insert, a snapshot load and an encoded round
 * trip on every replica, with its payload intact. Inline payloads are one
 * register: concurrent writes to the same embed resolve last writer wins
 * at the embed level, never a mix of two payloads. A payload the validator
 * refuses leaves out only its embed, never the rest of the document.
 */

const t = (text: string) => [{ type: 'text' as const, text, marks: [] }];
const para = (id: string, text: string): DocumentBlock => ({
  id,
  type: 'paragraph',
  content: t(text),
});

const slide = (id: string, title: string) => ({ id, layout: 'title-hero', props: { title } });

/** A two-slide deck (deck model v2, fictional). */
const DECK = {
  formatVersion: 2,
  meta: { title: 'Launch plan' },
  slides: [slide('s1', 'Launch plan'), slide('s2', 'Questions')],
};

/** A deck past one register's nesting bound (a component slide with nested props), so it travels chunked. */
const BIG_DECK = {
  formatVersion: 2,
  meta: { title: 'Long talk' },
  slides: [
    slide('s1', 'Long talk'),
    {
      id: 's2',
      layout: 'component',
      component: {
        component: 'charts-line',
        props: { series: { a: { b: { c: { d: { value: 1 } } } } } },
      },
    },
    ...Array.from({ length: 40 }, (_, i) => slide(`s${i + 3}`, `Section ${i + 1}`)),
  ],
};

/** A canvas-like inline payload with more keys than one register holds, so it travels chunked. */
const BIG_CANVAS = {
  shapes: Object.fromEntries(
    Array.from({ length: 150 }, (_, i) => [`n${i}`, { id: `n${i}`, x: i, y: i * 2 }])
  ),
};

const EMBEDS: [string, DocumentBlock][] = [
  [
    'component inline (a one-node catalog blueprint)',
    {
      id: 'e-comp',
      type: 'embed',
      kind: 'component',
      title: 'Signups',
      inline: { id: 'charts-donut', props: { data: [{ label: 'A', value: 3 }] } },
    },
  ],
  ['component ref', { id: 'e-comp-ref', type: 'embed', kind: 'component', ref: 'components/kpi' }],
  [
    'deck inline',
    { id: 'e-deck', type: 'embed', kind: 'deck', title: 'Launch plan', inline: DECK },
  ],
  ['deck inline, chunked', { id: 'e-deck-big', type: 'embed', kind: 'deck', inline: BIG_DECK }],
  [
    'deck ref',
    { id: 'e-deck-ref', type: 'embed', kind: 'deck', ref: 'decks/launch', title: 'Launch' },
  ],
  [
    'sheet inline',
    {
      id: 'e-sheet',
      type: 'embed',
      kind: 'sheet',
      inline: { cells: { A1: 'Budget', B1: 1200, A2: 'Rent', B2: '=B1/2' } },
    },
  ],
  ['sheet ref', { id: 'e-sheet-ref', type: 'embed', kind: 'sheet', ref: 'sheets/budget-2026' }],
  ['canvas inline, chunked', { id: 'e-canvas', type: 'embed', kind: 'canvas', inline: BIG_CANVAS }],
  ['canvas ref', { id: 'e-canvas-ref', type: 'embed', kind: 'canvas', ref: 'canvases/board' }],
  [
    'wrapped block (props with ids inside)',
    {
      id: 'b-table',
      type: 'block',
      family: 'data',
      block: 'table',
      props: { columns: [{ id: 'name', label: 'Name' }], rows: [{ id: 'r1', name: 'Ada' }] },
    },
  ],
];

const base = (blocks: DocumentBlock[] = []): TexuliDocument => ({
  format: 'texuli-document',
  formatVersion: 1,
  meta: { title: 'Embeds' },
  blocks: [para('p1', 'Intro'), ...blocks],
});

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

/** A session plus the editor document it feeds. */
function peer(replica: string, doc: TexuliDocument = base()) {
  const session = createDocumentSync({
    replica,
    document: doc,
    author: { name: replica, color: 1 },
  });
  const state = { doc: session.document };
  session.subscribe((change) => {
    if (change.operations.length === 0) return;
    const result = applyOperations(state.doc, change.operations);
    if (!result.ok) throw new Error(result.reason);
    state.doc = result.document;
  });
  const outbox: SyncOp[][] = [];
  session.replica.onOps((ops, origin) => {
    if (origin === 'local') outbox.push(clone(ops));
  });
  const edit = (operations: DocumentOperation[]) => {
    const result = applyOperations(state.doc, operations);
    if (!result.ok) throw new Error(result.reason);
    state.doc = result.document;
    return session.commit(result.document);
  };
  return { session, state, edit, outbox };
}

/** Deliver every queued local batch of `from` to `to`, encoded as JSON text. */
function deliver(from: { outbox: SyncOp[][] }, to: DocumentSync): void {
  for (const ops of from.outbox) to.receive(JSON.parse(JSON.stringify({ ops })));
}

const find = (doc: TexuliDocument, id: string) => doc.blocks.find((block) => block.id === id);

describe('collab embeds: every kind and payload survives sync', () => {
  it('the fixtures are valid documents (inline decks are deck model v2)', () => {
    expect(parseDeck(DECK).ok).toBe(true);
    expect(parseDeck(BIG_DECK).ok).toBe(true);
    expect(validateDocument(base(EMBEDS.map(([, block]) => block))).ok).toBe(true);
  });

  it.each(EMBEDS)('%s: seed, remote insert, snapshot and encoded round trip', (_name, block) => {
    // Seeded: a session started from a document holding the embed keeps it.
    const seeded = peer('ada', base([block]));
    expect(find(seeded.session.document, block.id)).toEqual(block);
    expect(seeded.session.projection.repaired).toBe(0);

    // Inserted on one replica, received by another (JSON-encoded batches).
    const a = peer('ada');
    const b = peer('lin');
    expect(a.edit([{ op: 'insert-node', parent: null, index: 1, node: clone(block) }])).toEqual([]);
    deliver(a, b.session);
    for (const side of [a, b]) {
      expect(find(side.session.document, block.id)).toEqual(block);
      expect(side.state.doc).toEqual(side.session.document);
    }

    // A third replica loads the encoded state (a stored snapshot) and agrees.
    const c = peer('cyd');
    c.session.load(JSON.parse(JSON.stringify(a.session.snapshot())));
    expect(find(c.session.document, block.id)).toEqual(block);
    expect(c.session.document).toEqual(a.session.document);
    expect(validateDocument(c.session.document).ok).toBe(true);
  });

  it('all kinds together converge on two replicas editing around them', () => {
    const blocks = EMBEDS.map(([, block]) => block);
    const a = peer('ada', base(blocks));
    const b = peer('lin', base(blocks));
    a.edit([{ op: 'insert-text', id: 'p1', offset: 5, text: ' from Ada' }]);
    b.edit([{ op: 'set-attrs', id: 'e-deck', attrs: { title: 'Launch plan v2' } }]);
    deliver(a, b.session);
    deliver(b, a.session);
    expect(a.session.document).toEqual(b.session.document);
    for (const block of blocks) {
      const merged = find(a.session.document, block.id);
      const expected = block.id === 'e-deck' ? { ...block, title: 'Launch plan v2' } : block;
      expect(merged).toEqual(expected);
    }
  });

  it('a chunked inline payload decodes to the same value', () => {
    for (const value of [BIG_DECK, BIG_CANVAS]) {
      const encoded = encodeValue(value);
      expect(encoded).toHaveProperty('$json');
      expect(decodeValue(JSON.parse(JSON.stringify(encoded)))).toEqual(value);
    }
  });
});

describe('collab embeds: concurrent writes', () => {
  it('concurrent replacements of one inline payload resolve to one whole payload on both replicas', () => {
    const start: EmbedBlock = { id: 'd1', type: 'embed', kind: 'deck', inline: DECK };
    const a = peer('ada', base([start]));
    const b = peer('lin', base([start]));
    const ours = { ...DECK, slides: [slide('s1', 'Ada one'), slide('s2', 'Ada two')] };
    const theirs = { ...DECK, slides: [slide('s9', 'Lin only')] };
    a.edit([{ op: 'set-attrs', id: 'd1', attrs: { inline: ours } }]);
    b.edit([{ op: 'set-attrs', id: 'd1', attrs: { inline: theirs } }]);
    deliver(a, b.session);
    deliver(b, a.session);
    const left = find(a.session.document, 'd1') as EmbedBlock;
    const right = find(b.session.document, 'd1') as EmbedBlock;
    expect(left).toEqual(right);
    // Last writer wins at the embed level: one writer's payload, never a mix.
    expect([ours, theirs]).toContainEqual(left.inline);
    expect(a.state.doc).toEqual(a.session.document);
    expect(b.state.doc).toEqual(b.session.document);
  });

  it('concurrent writes to different attributes of one embed both survive', () => {
    const start: EmbedBlock = { id: 'd1', type: 'embed', kind: 'deck', inline: DECK, title: 'Old' };
    const a = peer('ada', base([start]));
    const b = peer('lin', base([start]));
    const next = { ...DECK, slides: [slide('s1', 'Renamed')] };
    a.edit([{ op: 'set-attrs', id: 'd1', attrs: { inline: next } }]);
    b.edit([{ op: 'set-attrs', id: 'd1', attrs: { title: 'New' } }]);
    deliver(a, b.session);
    deliver(b, a.session);
    for (const side of [a, b])
      expect(find(side.session.document, 'd1')).toEqual({ ...start, inline: next, title: 'New' });
  });
});

describe('collab embeds: a refused payload leaves out its embed only', () => {
  const broken: [string, EmbedBlock][] = [
    [
      'a deck slide without a layout',
      {
        id: 'bad',
        type: 'embed',
        kind: 'deck',
        inline: { formatVersion: 2, meta: { title: 'T' }, slides: [{ id: 's1', props: {} }] },
      },
    ],
    [
      'a deck that is not deck model v2',
      { id: 'bad', type: 'embed', kind: 'deck', inline: { slides: [{ id: 's1' }] } },
    ],
    [
      'a component payload that is not one catalog node',
      { id: 'bad', type: 'embed', kind: 'component', inline: { id: 'Not Kebab', children: [] } },
    ],
  ];

  it.each(broken)('%s', (_name, block) => {
    const doc = base([block, para('p2', 'Outro')]);
    expect(validateDocument(doc).ok).toBe(false);
    const { session } = peer('ada', doc);
    expect(session.document).toEqual(base([para('p2', 'Outro')]));
    expect(session.projection.repaired).toBe(1);
    // The replica still holds it: a fix of the payload brings the embed back.
    const fixed = { ...block, kind: 'deck' as const, inline: DECK };
    expect(
      session.commit({
        ...session.document,
        blocks: [para('p1', 'Intro'), fixed, para('p2', 'Outro')],
      })
    ).toEqual([]);
    expect(find(session.document, 'bad')).toEqual(fixed);
  });
});
