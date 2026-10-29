// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  type BroadcastChannelLike,
  checkBatch,
  connectReplica,
  createBroadcastChannelAdapter,
  createMemorySyncHub,
  createPresenceStore,
  createReplica,
  type Replica,
  ROOT,
  type SyncBatch,
  type SyncNodeJson,
  type SyncOp,
} from '../src/sync/index.ts';
import { rng, time } from './fixtures.ts';

const json = (replica: Replica) => JSON.stringify(replica.toJSON());

function nodesOf(tree: SyncNodeJson): SyncNodeJson[] {
  const out: SyncNodeJson[] = [];
  const stack = [tree];
  while (stack.length > 0) {
    const node = stack.pop() as SyncNodeJson;
    out.push(node);
    stack.push(...node.children);
  }
  return out;
}

/** Wire every replica to every other through per-pair queues of copied batches. */
function network(replicas: Replica[]) {
  const queues = new Map<string, SyncBatch[]>();
  const sent: SyncBatch[][] = replicas.map(() => []);
  replicas.forEach((replica, from) => {
    replica.onOps((ops, origin) => {
      if (origin !== 'local') return;
      const batch = JSON.parse(JSON.stringify({ ops })) as SyncBatch;
      sent[from]?.push(batch);
      replicas.forEach((_, to) => {
        if (to === from) return;
        const key = `${from}>${to}`;
        queues.set(key, [...(queues.get(key) ?? []), batch]);
      });
    });
  });
  return { queues, sent };
}

/** One random local edit on a replica, valid in its own view. */
function randomEdit(replica: Replica, random: () => number, label: number): void {
  const pick = <T>(list: readonly T[]): T => list[Math.floor(random() * list.length)] as T;
  const nodes = nodesOf(replica.toJSON());
  const editable = nodes.filter((node) => node.id !== ROOT);
  const roll = random();
  if (roll < 0.22 || editable.length === 0) {
    const parent = pick(nodes);
    replica.insertNode(
      pick(['p', 'list']),
      parent.id,
      Math.floor(random() * (parent.children.length + 1))
    );
  } else if (roll < 0.32) {
    const node = pick(editable);
    const parent = pick(nodes);
    const siblings = replica.children(parent.id).filter((id) => id !== node.id).length;
    replica.moveNode(node.id, parent.id, Math.floor(random() * (siblings + 1)));
  } else if (roll < 0.38) {
    replica.removeNode(pick(editable).id);
  } else if (roll < 0.46) {
    replica.setProp(
      pick(editable).id,
      pick(['level', 'checked']),
      pick([1, 2, true, null, `v${label}`])
    );
  } else if (roll < 0.66) {
    const node = pick(editable);
    const length = [...replica.text(node.id, 'text')].length;
    replica.insertText(
      node.id,
      'text',
      Math.floor(random() * (length + 1)),
      pick(['a', 'bc', 'def', 'é', '😀'])
    );
  } else if (roll < 0.76) {
    const node = pick(editable);
    const length = [...replica.text(node.id, 'text')].length;
    if (length === 0) return;
    const start = Math.floor(random() * length);
    replica.deleteText(node.id, 'text', start, 1 + Math.floor(random() * (length - start)));
  } else if (roll < 0.86) {
    const node = pick(editable);
    const length = [...replica.text(node.id, 'text')].length;
    if (length === 0) return;
    const from = Math.floor(random() * length);
    const to = from + 1 + Math.floor(random() * (length - from));
    replica.formatText(
      node.id,
      'text',
      from,
      to,
      pick(['strong', 'em', 'link']),
      pick([true, null, 'https://example.com'])
    );
  } else if (roll < 0.94) {
    replica.undo();
  } else {
    replica.redo();
  }
}

describe('sync convergence (property tests)', () => {
  it('converges three replicas under 1,000 seeded random interleavings with reordering and duplicates', () => {
    const CASES = 1_000;
    let edits = 0;
    for (let seed = 1; seed <= CASES; seed += 1) {
      const random = rng(seed);
      const replicas = ['a', 'b', 'c'].map((replica) => createReplica({ replica }));
      const { queues, sent } = network(replicas);
      const steps = 12 + Math.floor(random() * 18);
      for (let step = 0; step < steps; step += 1) {
        if (random() < 0.6) {
          randomEdit(replicas[Math.floor(random() * 3)] as Replica, random, step);
          edits += 1;
        } else {
          // Deliver part of one queue, shuffled, sometimes duplicated.
          const keys = [...queues.keys()];
          if (keys.length === 0) continue;
          const key = keys[Math.floor(random() * keys.length)] as string;
          const queue = queues.get(key) ?? [];
          const take = queue.splice(0, Math.ceil(random() * queue.length));
          take.sort(() => random() - 0.5);
          if (random() < 0.3 && take.length > 0) take.push(take[0] as SyncBatch);
          const to = Number(key.split('>')[1]);
          for (const batch of take) expect((replicas[to] as Replica).receive(batch).ok).toBe(true);
        }
      }
      // Finally everything arrives everywhere, in a random order, with duplicates.
      replicas.forEach((replica, to) => {
        const all = sent.flatMap((batches, from) => (from === to ? [] : batches));
        all.push(...all.slice(0, Math.floor(all.length / 3)));
        all.sort(() => random() - 0.5);
        for (const batch of all) replica.receive(batch);
      });
      const states = replicas.map(json);
      expect(states[1], `seed ${seed}`).toBe(states[0]);
      expect(states[2], `seed ${seed}`).toBe(states[0]);
      for (const replica of replicas) expect(replica.pending, `seed ${seed}`).toBe(0);
    }
    expect(edits).toBeGreaterThan(10_000);
  });

  it('replaying any replica snapshot into a fresh replica reaches the same state', () => {
    for (let seed = 1; seed <= 50; seed += 1) {
      const random = rng(seed * 7);
      const a = createReplica({ replica: 'a' });
      for (let i = 0; i < 30; i += 1) randomEdit(a, random, i);
      const copy = createReplica({ replica: 'z' });
      const ops = [...a.snapshot().ops].reverse();
      expect(copy.receive({ ops }).ok).toBe(true);
      expect(json(copy), `seed ${seed}`).toBe(json(a));
    }
  });
});

describe('sync semantics', () => {
  function pair() {
    const a = createReplica({ replica: 'a' });
    const b = createReplica({ replica: 'b' });
    const node = a.insertNode('p', ROOT, 0, { id: 'n1' });
    b.receive({ ops: a.opsSince(b.versionVector()) });
    const sync = () => {
      const toB = a.opsSince(b.versionVector());
      const toA = b.opsSince(a.versionVector());
      b.receive({ ops: toB });
      a.receive({ ops: toA });
    };
    return { a, b, node, sync };
  }

  it('never interleaves concurrent typing at the same place', () => {
    const { a, b, node, sync } = pair();
    a.insertText(node, 'text', 0, '[]');
    sync();
    for (const char of 'hello') a.insertText(node, 'text', a.text(node, 'text').length - 1, char);
    for (const char of 'world') b.insertText(node, 'text', b.text(node, 'text').length - 1, char);
    sync();
    expect(a.text(node, 'text')).toBe(b.text(node, 'text'));
    expect(['[helloworld]', '[worldhello]']).toContain(a.text(node, 'text'));
  });

  it('resolves a concurrent delete and revive by last writer, in either delivery order', () => {
    for (const order of ['ab', 'ba']) {
      const a = createReplica({ replica: 'a' });
      const b = createReplica({ replica: 'b' });
      const c = createReplica({ replica: 'c' });
      const node = a.insertNode('p', ROOT, 0, { id: 'n' });
      a.insertText(node, 'text', 0, 'keep');
      for (const other of [b, c]) other.receive({ ops: a.opsSince() });
      const base = a.versionVector();
      a.deleteText(node, 'text', 0, 4);
      a.undo(); // revive, Lamport 5
      for (let i = 0; i < 4; i += 1) b.setProp(node, 'level', i);
      b.deleteText(node, 'text', 0, 4); // concurrent, Lamport 9: wins
      const fromA = a.opsSince(base);
      const fromB = b.opsSince(base);
      for (const batch of order === 'ab' ? [fromA, fromB] : [fromB, fromA])
        c.receive({ ops: batch });
      a.receive({ ops: fromB });
      b.receive({ ops: fromA });
      expect(json(a), order).toBe(json(c));
      expect(json(b), order).toBe(json(c));
      expect(c.text(node, 'text'), order).toBe('');
    }
  });

  it('skips a move that would make a cycle, the same way on both replicas', () => {
    const { a, b, sync } = pair();
    const x = a.insertNode('p', ROOT, 1, { id: 'x' });
    const y = a.insertNode('p', ROOT, 2, { id: 'y' });
    sync();
    a.moveNode(x, y, 0);
    b.moveNode(y, x, 0);
    sync();
    expect(json(a)).toBe(json(b));
    const tree = a.toJSON();
    const ids = nodesOf(tree).map((node) => node.id);
    expect(ids).toContain('x');
    expect(ids).toContain('y');
  });

  it('keeps concurrent edits to a removed node and revives them on undo', () => {
    const { a, b, node, sync } = pair();
    a.insertText(node, 'text', 0, 'draft');
    sync();
    a.removeNode(node);
    b.insertText(node, 'text', 5, '!');
    sync();
    expect(a.children()).toEqual([]);
    expect(a.undo()).toBe(true);
    sync();
    expect(a.children()).toEqual(['n1']);
    expect(b.text(node, 'text')).toBe('draft!');
  });

  it('grows strong at its end but never a link, and undo restores marks', () => {
    const { a, node } = pair();
    a.insertText(node, 'text', 0, 'abc def');
    a.formatText(node, 'text', 0, 3, 'strong', true);
    a.formatText(node, 'text', 4, 7, 'link', 'https://example.com');
    a.insertText(node, 'text', 3, 'X');
    a.insertText(node, 'text', 8, 'Y');
    expect(a.textRuns(node, 'text')).toEqual([
      { text: 'abcX', marks: { strong: true } },
      { text: ' ', marks: {} },
      { text: 'def', marks: { link: 'https://example.com' } },
      { text: 'Y', marks: {} },
    ]);
    a.undo(); // Y
    a.undo(); // X
    a.undo(); // link
    expect(a.textRuns(node, 'text')).toEqual([
      { text: 'abc', marks: { strong: true } },
      { text: ' def', marks: {} },
    ]);
    a.redo();
    expect(a.textRuns(node, 'text').at(-1)).toEqual({
      text: 'def',
      marks: { link: 'https://example.com' },
    });
  });

  it('undoes only local edits with new operations, and redoes them', () => {
    const { a, b, node, sync } = pair();
    a.insertText(node, 'text', 0, 'Hello');
    sync();
    b.insertText(node, 'text', 5, ' world');
    a.deleteText(node, 'text', 0, 1);
    a.setProp(node, 'level', 2);
    sync();
    const before = a.snapshot().ops.length;
    expect(a.undo()).toBe(true); // the level
    expect(a.undo()).toBe(true); // the delete: revived, b's text kept
    sync();
    expect(a.snapshot().ops.length).toBeGreaterThan(before);
    expect(b.text(node, 'text')).toBe('Hello world');
    expect(b.node(node)?.props).toEqual({});
    expect(a.redo()).toBe(true);
    sync();
    expect(b.text(node, 'text')).toBe('ello world');
    a.transact(() => {
      a.insertText(node, 'text', 0, 'Y');
      a.insertText(node, 'text', 0, 'X');
    });
    expect(a.text(node, 'text')).toBe('XYello world');
    expect(a.undo()).toBe(true);
    expect(a.text(node, 'text')).toBe('ello world');
  });
});

describe('hostile batches', () => {
  const base = { replica: 'h', counter: 0, lamport: 1, deps: {} };

  it('refuses malformed batches whole and drops operations with uncovered references', () => {
    const malformed: unknown[] = [
      null,
      { ops: 'x' },
      { ops: [{ ...base, kind: 'eval' }] },
      { ops: [{ ...base, replica: 'bad id!', kind: 'create', node: 'n', type: 'p' }] },
      { ops: [{ ...base, counter: -1, kind: 'create', node: 'n', type: 'p' }] },
      { ops: [{ ...base, lamport: 2 ** 60, kind: 'create', node: 'n', type: 'p' }] },
      { ops: [{ ...base, kind: 'create', node: ROOT, type: 'p' }] },
      { ops: [{ ...base, kind: 'set', node: 'n', key: '__proto__', value: 1 }] },
      {
        ops: [
          { ...base, kind: 'set', node: 'n', key: 'k', value: { __proto__: null, constructor: 1 } },
        ],
      },
      {
        ops: [
          {
            ...base,
            kind: 'insert',
            node: 'n',
            field: 'text',
            origin: { parent: null, side: 'L' },
            text: 'x',
          },
        ],
      },
      {
        ops: [
          {
            ...base,
            kind: 'insert',
            node: 'n',
            field: 'text',
            origin: { parent: null, side: 'R' },
            text: 'x'.repeat(10_001),
          },
        ],
      },
      {
        ops: [
          {
            ...base,
            kind: 'set',
            node: 'n',
            key: 'k',
            value: JSON.parse('['.repeat(20) + ']'.repeat(20)),
          },
        ],
      },
      {
        ops: Array.from({ length: 10_001 }, () => ({
          ...base,
          kind: 'create',
          node: 'n',
          type: 'p',
        })),
      },
      {
        ops: [{ ...base, kind: 'delete', node: 'n', field: 'text', ranges: [['h', 0, 2_000_000]] }],
      },
      {
        ops: [
          {
            ...base,
            deps: Object.fromEntries(Array.from({ length: 1_025 }, (_, i) => [`r${i}`, 1])),
            kind: 'create',
            node: 'n',
            type: 'p',
          },
        ],
      },
    ];
    for (const [index, batch] of malformed.entries()) {
      const replica = createReplica({ replica: 'a' });
      const result = replica.receive(batch);
      expect(result.ok, `case ${index}`).toBe(false);
      expect(json(replica)).toBe(json(createReplica({ replica: 'a' })));
    }
    // Well formed, but referencing a node its deps do not cover: dropped on every replica alike.
    const victim = createReplica({ replica: 'a' });
    victim.insertNode('p', ROOT, 0, { id: 'n1' });
    const sneaky = { ops: [{ ...base, kind: 'set', node: 'n1', key: 'k', value: 1 } as SyncOp] };
    const result = victim.receive(sneaky);
    expect(result).toMatchObject({ ok: true, integrated: 1, dropped: 1 });
    expect(victim.node('n1')?.props).toEqual({});
  });

  it('integrates large and adversarial batches in linear time', () => {
    // 10,000 single-character inserts in one batch.
    const author = createReplica({ replica: 'w' });
    const node = author.insertNode('p', ROOT, 0, { id: 'n' });
    for (let i = 0; i < 3_000; i += 1) author.insertText(node, 'text', i, 'x');
    const reader = createReplica({ replica: 'r' });
    const ops = author.snapshot().ops;
    expect(
      time(() => expect(reader.receive({ ops: [...ops].reverse() }).ok).toBe(true))
    ).toBeLessThan(3_000);
    expect(reader.text(node, 'text')).toBe('x'.repeat(3_000));
    // A deep chain of nodes, then moves arriving in reverse Lamport order.
    const deep = createReplica({ replica: 'd' });
    let parent = ROOT;
    for (let i = 0; i < 400; i += 1) parent = deep.insertNode('p', parent, 0);
    for (let i = 0; i < 2_000; i += 1) deep.moveNode(parent, ROOT, 0);
    const late = createReplica({ replica: 'l' });
    expect(
      time(() => expect(late.receive({ ops: [...deep.snapshot().ops].reverse() }).ok).toBe(true))
    ).toBeLessThan(3_000);
    expect(json(late)).toBe(json(deep));
    expect(
      time(() =>
        checkBatch({
          ops: Array.from({ length: 10_000 }, () => ({
            ...base,
            kind: 'set',
            node: 'n',
            key: 'k',
            value: 'v'.repeat(500),
          })),
        })
      )
    ).toBeLessThan(1_500);
  });
});

describe('transports and presence', () => {
  it('syncs replicas through the in-memory hub, including edits made before connecting', async () => {
    const hub = createMemorySyncHub();
    const a = createReplica({ replica: 'a' });
    const b = createReplica({ replica: 'b' });
    const offline = a.insertNode('p', ROOT, 0, { id: 'offline' });
    a.insertText(offline, 'text', 0, 'made offline');
    const adapterA = hub.adapter();
    connectReplica(a, adapterA);
    const connection = connectReplica(b, hub.adapter());
    b.insertNode('p', ROOT, 0, { id: 'online' });
    for (let i = 0; i < 6; i += 1) await Promise.resolve();
    expect(json(a)).toBe(json(b));
    expect(b.text('offline', 'text')).toBe('made offline');
    await adapterA.saveSnapshot?.(a.snapshot());
    const restored = createReplica({ replica: 'c' });
    restored.receive({ ops: (await adapterA.loadSnapshot?.())?.ops ?? [] });
    expect(json(restored)).toBe(json(a));
    connection.close();
  });

  it('carries batches and presence over a BroadcastChannel, ignoring foreign messages', () => {
    const channels: FakeChannel[] = [];
    class FakeChannel implements BroadcastChannelLike {
      readonly name: string;
      readonly listeners = new Set<(event: { data: unknown }) => void>();
      constructor(name: string) {
        this.name = name;
        channels.push(this);
      }
      postMessage(message: unknown) {
        for (const other of channels)
          if (other !== this && other.name === this.name)
            for (const listener of other.listeners) listener({ data: structuredClone(message) });
      }
      addEventListener(_type: 'message', listener: (event: { data: unknown }) => void) {
        this.listeners.add(listener);
      }
      removeEventListener(_type: 'message', listener: (event: { data: unknown }) => void) {
        this.listeners.delete(listener);
      }
      close() {}
    }
    const make = (name: string) => new FakeChannel(name);
    const tabA = createBroadcastChannelAdapter('doc-1', { channel: make });
    const tabB = createBroadcastChannelAdapter('doc-1', { channel: make });
    const a = createReplica({ replica: 'a' });
    const b = createReplica({ replica: 'b' });
    connectReplica(a, tabA);
    connectReplica(b, tabB);
    a.insertText(a.insertNode('p', ROOT, 0, { id: 'n' }), 'text', 0, 'hi');
    expect(b.text('n', 'text')).toBe('hi');
    channels[0]?.postMessage({ hello: 'other app' });
    const store = createPresenceStore({ now: () => 0 });
    tabB.presence?.subscribe((state) => store.update(state));
    tabA.presence?.send({ replica: 'a', name: 'Ada Example', color: 3 });
    expect(store.list().map((entry) => entry.name)).toEqual(['Ada Example']);
    const global = globalThis as { BroadcastChannel?: unknown };
    const original = global.BroadcastChannel;
    global.BroadcastChannel = undefined;
    try {
      expect(() => createBroadcastChannelAdapter('x')).toThrow(/BroadcastChannel is not available/);
    } finally {
      global.BroadcastChannel = original;
    }
    tabA.close();
  });

  it('expires presence after 30 seconds and refuses malformed states', () => {
    let now = 0;
    const store = createPresenceStore({ now: () => now });
    expect(
      store.update({
        replica: 'a',
        name: 'Ada',
        color: 1,
        cursor: { node: 'n', field: 'text', after: ['a', 3] },
      })
    ).toBe(true);
    expect(store.update({ replica: 'b', name: 'B\u202eob', color: 1 })).toBe(false);
    expect(store.update({ replica: 'c', name: 'Cy', color: 99 })).toBe(false);
    now = 30_001;
    expect(store.list()).toEqual([]);
  });
});

describe('anchors, containers and retyping (T-doc-collab additions)', () => {
  it('resolves item anchors to visible indices through concurrent edits', () => {
    const ada = createReplica({ replica: 'ada' });
    const lin = createReplica({ replica: 'lin' });
    const note = ada.insertNode('p', ROOT, 0, { id: 'n1' });
    ada.insertText(note, 'text', 0, 'Hello world');
    lin.receive({ ops: ada.opsSince() });
    const start = ada.itemAt(note, 'text', 6) as [string, number];
    const end = ada.itemAt(note, 'text', 10) as [string, number];
    expect(ada.itemAt(note, 'text', 11)).toBeNull();
    lin.insertText(note, 'text', 0, 'Oh, ');
    ada.receive({ ops: lin.opsSince(ada.versionVector()) });
    expect(ada.anchorIndex(note, 'text', { id: start, side: 'before' })).toBe(10);
    expect(ada.anchorIndex(note, 'text', { id: end, side: 'after' })).toBe(15);
    ada.deleteText(note, 'text', 10, 5);
    expect(ada.isVisible(note, 'text', start)).toBe(false);
    // A deleted item's anchors collapse onto the same index.
    expect(ada.anchorIndex(note, 'text', { id: start, side: 'before' })).toBe(10);
    expect(ada.anchorIndex(note, 'text', { id: end, side: 'after' })).toBe(10);
    expect(ada.anchorIndex(note, 'text', { id: ['zed', 1], side: 'after' })).toBeNull();
    expect(ada.anchorIndex(note, 'missing', 'end')).toBe(0);
  });

  it('registers detached containers once, retypes nodes undoably, and counts undo steps', () => {
    const ada = createReplica({ replica: 'ada' });
    const lin = createReplica({ replica: 'lin' });
    ada.ensureNode('x:box', 'box');
    lin.ensureNode('x:box', 'box');
    expect(ada.editCount).toBe(0);
    ada.insertNode('item', 'x:box', 0, { id: 'a1' });
    lin.insertNode('item', 'x:box', 0, { id: 'l1' });
    ada.receive({ ops: lin.opsSince() });
    lin.receive({ ops: ada.opsSince() });
    expect(ada.children('x:box')).toEqual(lin.children('x:box'));
    expect(ada.attached('a1')).toBe(false);
    const note = ada.insertNode('p', ROOT, 0, { id: 'n1' });
    expect(ada.attached(note)).toBe(true);
    const before = ada.editCount;
    ada.setNodeType(note, 'h');
    expect(ada.node(note)?.type).toBe('h');
    expect(ada.editCount).toBe(before + 1);
    ada.undo();
    expect(ada.node(note)?.type).toBe('p');
    expect(() => ada.setNodeType(ROOT, 'x')).toThrow(RangeError);
  });

  it('keeps a selection anchor in presence and refuses a malformed one', () => {
    const store = createPresenceStore({ now: () => 0 });
    const cursor = { node: 'n1', field: 'text', after: ['ada', 3] };
    expect(
      store.update({
        replica: 'lin',
        name: 'Lin',
        color: 1,
        cursor,
        anchor: { ...cursor, after: null },
      })
    ).toBe(true);
    expect(store.list()[0]?.anchor).toEqual({ node: 'n1', field: 'text', after: null });
    expect(
      store.update({
        replica: 'kai',
        name: 'Kai',
        color: 1,
        anchor: { node: 'bad id', field: 'text', after: null },
      })
    ).toBe(false);
  });
});
