// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { createDocumentSync, type DocumentSync } from '../src/collab/index.ts';
import type { DocumentBlock, DocumentNode, TexuliDocument } from '../src/model/index.ts';
import { walkDocument } from '../src/model/index.ts';
import { applyOperations, type DocumentOperation, equalData } from '../src/ops/index.ts';
import { validateDocument } from '../src/schema/index.ts';
import type { SyncBatch } from '../src/sync/index.ts';
import { rng } from './fixtures.ts';

/*
 * Convergence of the document binding (ADR-010 on the ADR-011 format): three
 * sessions edit one document through its op log (random typed operations,
 * undo, redo, suggestion mode, comments, accept and reject), their batches
 * are delivered reordered and duplicated, and every replica ends with the
 * identical, valid document, which every editor's own document (fed only by
 * the operations the session hands it) equals at every step.
 */

const t = (text: string) => [{ type: 'text' as const, text, marks: [] }];

function start(): TexuliDocument {
  return {
    format: 'texuli-document',
    formatVersion: 1,
    meta: { title: 'Field notes' },
    blocks: [
      { id: 'h1', type: 'heading', level: 1, content: t('Field notes') },
      { id: 'p1', type: 'paragraph', content: t('Alpha beta gamma') },
      {
        id: 'l1',
        type: 'list',
        kind: 'bullet',
        items: [{ id: 'i1', blocks: [{ id: 'ip1', type: 'paragraph', content: t('First item') }] }],
      },
      {
        id: 'q1',
        type: 'callout',
        tone: 'info',
        blocks: [{ id: 'qp1', type: 'paragraph', content: t('Inside') }],
      },
      { id: 'c1', type: 'code', lang: 'ts', text: 'let x = 1;' },
    ],
  };
}

interface Peer {
  session: DocumentSync;
  doc: TexuliDocument;
  ids: number;
}

type Located = { node: DocumentNode; parent: string | null; kind: string };

function nodes(doc: TexuliDocument): Located[] {
  const out: Located[] = [];
  walkDocument(doc, ({ node, parent }) => {
    out.push({ node, parent, kind: 'type' in node ? node.type : 'item' });
  });
  return out;
}

const WORDS = ['red ', 'blue', 'ü', '😀', 'x', ' and ', 'line\nbreak', 'tree'];
const MARKS = [
  { type: 'strong' as const },
  { type: 'em' as const },
  { type: 'link' as const, href: 'https://example.com/a' },
];

function textLength(node: DocumentNode): number {
  if (!('type' in node)) return 0;
  if (node.type === 'code') return node.text.length;
  const content = node.type === 'toggle' ? node.summary : 'content' in node ? node.content : [];
  let length = 0;
  for (const part of content) length += part.type === 'break' ? 1 : part.text.length;
  return length;
}

/** A UTF-16 offset that never splits a surrogate pair. */
function boundary(node: DocumentNode, random: () => number): number {
  const length = textLength(node);
  let offset = Math.floor(random() * (length + 1));
  const text =
    'type' in node && node.type === 'code'
      ? node.text
      : ('content' in node ? node.content : [])
          .map((part) => (part.type === 'break' ? '\n' : part.text))
          .join('');
  const code = text.charCodeAt(offset);
  if (offset > 0 && code >= 0xdc00 && code <= 0xdfff) offset -= 1;
  return offset;
}

function block(peer: Peer, random: () => number): DocumentBlock {
  const id = () => `${peer.session.replica.id}-${(peer.ids++).toString(36)}`;
  const pick = random();
  if (pick < 0.45)
    return {
      id: id(),
      type: 'paragraph',
      content: t(WORDS[Math.floor(random() * WORDS.length)] as string),
    };
  if (pick < 0.55) return { id: id(), type: 'heading', level: 2, content: t('Heading') };
  if (pick < 0.65)
    return {
      id: id(),
      type: 'list',
      kind: 'ordered',
      items: [{ id: id(), blocks: [{ id: id(), type: 'paragraph', content: t('item') }] }],
    };
  if (pick < 0.73)
    return {
      id: id(),
      type: 'quote',
      blocks: [{ id: id(), type: 'paragraph', content: t('quoted') }],
    };
  if (pick < 0.8)
    return {
      id: id(),
      type: 'columns',
      columns: [
        { id: id(), type: 'column', blocks: [{ id: id(), type: 'paragraph', content: t('left') }] },
        {
          id: id(),
          type: 'column',
          blocks: [{ id: id(), type: 'paragraph', content: t('right') }],
        },
      ],
    };
  if (pick < 0.88) return { id: id(), type: 'code', text: 'a\tb' };
  if (pick < 0.94) return { id: id(), type: 'toggle', summary: t('More'), blocks: [] };
  return { id: id(), type: 'divider' };
}

const CONTAINERS = new Set(['quote', 'callout', 'toggle', 'column', 'item']);

function randomOperations(peer: Peer, random: () => number): DocumentOperation[] {
  const all = nodes(peer.doc);
  const pick = <T>(list: readonly T[]): T | undefined => list[Math.floor(random() * list.length)];
  const texts = all.filter((entry) =>
    ['paragraph', 'heading', 'code', 'toggle'].includes(entry.kind)
  );
  const rich = texts.filter((entry) => entry.kind !== 'code');
  const roll = random();
  const target = pick(texts);
  if (roll < 0.3 && target) {
    const isCode = target.kind === 'code';
    const marks = isCode ? [] : MARKS.filter(() => random() < 0.3);
    return [
      {
        op: 'insert-text',
        id: target.node.id,
        offset: boundary(target.node, random),
        text: pick(WORDS) as string,
        marks,
      },
    ];
  }
  if (roll < 0.45 && target) {
    const from = boundary(target.node, random);
    const to = Math.max(from, boundary(target.node, random));
    return [{ op: 'delete-text', id: target.node.id, offset: from, length: to - from }];
  }
  const richTarget = pick(rich);
  if (roll < 0.53 && richTarget) {
    const from = boundary(richTarget.node, random);
    const to = Math.max(from, boundary(richTarget.node, random));
    return [
      {
        op: 'set-mark',
        id: richTarget.node.id,
        from,
        to,
        mark: pick(MARKS) as never,
        value: random() < 0.7,
      },
    ];
  }
  if (roll < 0.66) {
    const parents = all.filter((entry) => CONTAINERS.has(entry.kind));
    const parent = random() < 0.5 ? null : (pick(parents)?.node ?? null);
    const count =
      parent === null
        ? peer.doc.blocks.length
        : ((parent as unknown as { blocks: unknown[] }).blocks?.length ?? 0);
    return [
      {
        op: 'insert-node',
        parent: parent?.id ?? null,
        index: Math.floor(random() * (count + 1)),
        node: block(peer, random),
      },
    ];
  }
  if (roll < 0.74) {
    const victim = pick(all);
    return victim ? [{ op: 'remove-node', id: victim.node.id }] : [];
  }
  if (roll < 0.84) {
    const moving = pick(all.filter((entry) => entry.kind !== 'item' && entry.kind !== 'column'));
    const parents = all.filter((entry) => CONTAINERS.has(entry.kind));
    const parent = random() < 0.5 ? null : (pick(parents)?.node ?? null);
    if (!moving) return [];
    const count =
      parent === null
        ? peer.doc.blocks.length
        : ((parent as unknown as { blocks: unknown[] }).blocks?.length ?? 0);
    return [
      {
        op: 'move-node',
        id: moving.node.id,
        parent: parent?.id ?? null,
        index: Math.floor(random() * (count + 1)),
      },
    ];
  }
  if (roll < 0.92) {
    const entry = pick(all);
    if (!entry) return [];
    const attrs: Record<string, Record<string, unknown>> = {
      heading: { level: 1 + Math.floor(random() * 4) },
      callout: { tone: pick(['info', 'warning', 'success']) },
      item: { checked: random() < 0.5 },
      code: { lang: pick(['ts', 'js', null]) },
      toggle: { open: random() < 0.5 },
      column: { width: random() < 0.5 ? 4 : null },
    };
    const value = attrs[entry.kind];
    return value ? [{ op: 'set-attrs', id: entry.node.id, attrs: value as never }] : [];
  }
  if (roll < 0.95)
    return [{ op: 'set-meta', meta: { title: `Notes ${Math.floor(random() * 9)}` } }];
  if (richTarget) {
    const from = boundary(richTarget.node, random);
    const to = Math.max(from, boundary(richTarget.node, random));
    return [
      {
        op: 'replace-text',
        id: richTarget.node.id,
        from,
        to,
        content: [{ type: 'text', text: 'swap', marks: [{ type: 'em' }] }],
      },
    ];
  }
  return [];
}

function expectFed(peer: Peer): void {
  // The editor's document, fed only by the session's operations, equals the projection.
  expect(equalData(peer.doc, peer.session.document)).toBe(true);
}

function runCase(seed: number, steps: number): void {
  const random = rng(seed);
  const names = ['ada', 'lin', 'kai'];
  const suggestMode = seed % 4 === 0;
  const peers: Peer[] = names.map((replica) => {
    const session = createDocumentSync({
      replica: `${replica}${seed}`,
      document: start(),
      author: { name: replica },
      now: () => 1_700_000_000_000,
    });
    const peer: Peer = { session, doc: session.document, ids: 0 };
    session.subscribe((change) => {
      if (change.operations.length === 0) return;
      const result = applyOperations(peer.doc, change.operations);
      if (!result.ok)
        throw new Error(`seed ${seed}: ${change.origin} ops refused: ${result.reason}`);
      peer.doc = result.document;
    });
    return peer;
  });
  const queues = new Map<string, SyncBatch[]>();
  peers.forEach((peer, from) => {
    peer.session.replica.onOps((ops, origin) => {
      if (origin !== 'local') return;
      const wire = JSON.stringify({ ops });
      peers.forEach((_, to) => {
        if (to === from) return;
        const key = `${from}>${to}`;
        queues.set(key, [...(queues.get(key) ?? []), JSON.parse(wire) as SyncBatch]);
      });
    });
  });
  const deliver = (key: string, keep: boolean) => {
    const queue = queues.get(key) ?? [];
    if (queue.length === 0) return;
    const index = Math.floor(random() * queue.length);
    const batch = queue[index] as SyncBatch;
    if (!keep) queue.splice(index, 1);
    const to = Number(key.split('>')[1]);
    const result = (peers[to] as Peer).session.receive(JSON.parse(JSON.stringify(batch)));
    expect(result.ok).toBe(true);
  };
  for (let step = 0; step < steps; step += 1) {
    const peer = peers[Math.floor(random() * peers.length)] as Peer;
    const roll = random();
    if (roll < 0.45) {
      if (suggestMode) peer.session.suggesting = random() < 0.6;
      const operations = randomOperations(peer, random);
      const result = applyOperations(peer.doc, operations);
      if (result.ok && operations.length > 0) {
        peer.doc = result.document;
        const clean = !peer.session.suggesting && peer.session.projection.repaired === 0;
        const corrections = peer.session.commit(result.document, {
          group: random() < 0.3 ? 'typing' : null,
        });
        // The edit took effect as made: no correction unless suggestion mode or a merge repair applies.
        if (clean && peer.session.projection.repaired === 0)
          expect(corrections, `seed ${seed}`).toEqual([]);
        expectFed(peer);
      }
    } else if (roll < 0.5) {
      peer.session.undo();
      expectFed(peer);
    } else if (roll < 0.53) {
      peer.session.redo();
      expectFed(peer);
    } else if (roll < 0.56) {
      const text = nodes(peer.doc).find((entry) => entry.kind === 'paragraph');
      if (text)
        peer.session.addComment(
          { block: text.node.id, from: 0, to: Math.min(3, textLength(text.node)) },
          'Note'
        );
    } else if (roll < 0.59 && suggestMode) {
      const pending = peer.session.suggestions();
      const chosen = pending[Math.floor(random() * pending.length)];
      if (chosen) random() < 0.5 ? peer.session.accept(chosen.id) : peer.session.reject(chosen.id);
      expectFed(peer);
    } else {
      const keys = [...queues.keys()].filter((key) => (queues.get(key) ?? []).length > 0);
      const key = keys[Math.floor(random() * keys.length)];
      if (key) deliver(key, random() < 0.15);
      expectFed(peer);
    }
  }
  // Drain every queue in random order (duplicates and reordering included).
  let keys = [...queues.keys()].filter((key) => (queues.get(key) ?? []).length > 0);
  while (keys.length > 0) {
    deliver(keys[Math.floor(random() * keys.length)] as string, random() < 0.05);
    keys = [...queues.keys()].filter((key) => (queues.get(key) ?? []).length > 0);
  }
  const [first, ...rest] = peers as [Peer, ...Peer[]];
  const expected = JSON.stringify(first.session.document);
  expect(validateDocument(first.session.document).ok, `seed ${seed}`).toBe(true);
  const strip = (session: DocumentSync) =>
    JSON.stringify({
      threads: session.threads().map(({ messages, ...thread }) => ({
        ...thread,
        messages: messages.map(({ mine, ...m }) => m),
      })),
      suggestions: session.suggestions().map(({ mine, ...entry }) => entry),
    });
  for (const peer of rest) {
    expect(JSON.stringify(peer.session.document), `seed ${seed}`).toBe(expected);
    expect(strip(peer.session), `seed ${seed}`).toBe(strip(first.session));
  }
  for (const peer of peers) expectFed(peer);
}

describe('document binding convergence (property)', () => {
  // 1,000 seeded cases in four slices, so a slow host reports where it stalls.
  for (let slice = 0; slice < 4; slice += 1) {
    it(`converges on random concurrent edits, cases ${slice * 250} to ${slice * 250 + 249}`, () => {
      for (let seed = slice * 250; seed < (slice + 1) * 250; seed += 1) runCase(seed + 1, 24);
    }, 120_000);
  }
});
