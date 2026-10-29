// @vitest-environment node
import { createMemorySyncHub, SYNC_LIMITS, type SyncOp } from '@texuli/document/sync';
import { describe, expect, it } from 'vitest';
import {
  type CanvasDocument,
  type CanvasOperation,
  connectOps,
  createCanvas,
  deleteOps,
  groupOps,
  indexShapes,
  moveOps,
  reorderOps,
  reparentOps,
  resizeOps,
  rotateOps,
  textOps,
  ungroupOps,
  validateCanvas,
  walkShapes,
} from '../src/model/index.ts';
import {
  type CanvasSync,
  canvasSeedOperations,
  checkCanvasPresence,
  createCanvasPresenceStore,
  createCanvasSync,
  projectCanvas,
} from '../src/sync/index.ts';
import { everyShape, rng } from './fixtures.ts';

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

/** Wire sessions so every local batch is queued for every other session. */
function wire(sessions: CanvasSync[]) {
  const queues = sessions.map(() => [] as SyncOp[][]);
  sessions.forEach((session, i) => {
    session.replica.onOps((ops, origin) => {
      if (origin !== 'local') return;
      sessions.forEach((_, j) => {
        if (j !== i) (queues[j] as SyncOp[][]).push(JSON.parse(JSON.stringify(ops)));
      });
    });
  });
  return queues;
}

describe('canvas sync', () => {
  it('starts every replica from the same seed and projects the canvas it started from', () => {
    const canvas = everyShape();
    const ada = createCanvasSync({ replica: 'ada', canvas });
    const lin = createCanvasSync({ replica: 'lin', canvas });
    expect(ada.canvas).toEqual(canvas);
    expect(lin.replica.toJSON()).toEqual(ada.replica.toJSON());
    // The seed is not a local undo step.
    expect(ada.canUndo).toBe(false);
    expect(canvasSeedOperations(canvas)).toEqual(canvasSeedOperations(everyShape()));
  });

  it('merges concurrent edits through a hub, and undo is selective', async () => {
    const hub = createMemorySyncHub();
    const ada = createCanvasSync({ replica: 'ada', canvas: everyShape() });
    const lin = createCanvasSync({ replica: 'lin', canvas: everyShape() });
    ada.connect(hub.adapter(), { name: 'Ada', color: 1 });
    lin.connect(hub.adapter(), { name: 'Lin', color: 2 });
    await tick();
    ada.apply(moveOps(ada.canvas, ['start'], { x: 100, y: 0 }));
    lin.apply(textOps(lin.canvas, 'start', 'Kickoff'));
    lin.apply(reparentOps(lin.canvas, ['choice'], 'frame'));
    await tick();
    for (const session of [ada, lin]) {
      const start = indexShapes(session.canvas).get('start')?.shape as { x: number; text: string };
      expect(start).toMatchObject({ x: 820, text: 'Kickoff' });
      expect(indexShapes(session.canvas).get('choice')?.parent?.id).toBe('frame');
    }
    ada.undo();
    await tick();
    for (const session of [ada, lin])
      expect(indexShapes(session.canvas).get('start')?.shape).toMatchObject({
        x: 720,
        text: 'Kickoff',
      });
    expect(ada.canvas).toEqual(lin.canvas);
    // Presence: each sees the other's pointer and selection.
    expect(lin.peers().map((peer) => peer.name)).toEqual(['Ada']);
  });

  it('converges when one replica moves a shape into a frame another deletes', () => {
    const ada = createCanvasSync({ replica: 'ada', canvas: everyShape() });
    const lin = createCanvasSync({ replica: 'lin', canvas: everyShape() });
    const [toAda, toLin] = wire([ada, lin]);
    ada.apply(reparentOps(ada.canvas, ['start'], 'frame'));
    lin.apply(deleteOps(lin.canvas, ['frame']));
    for (const batch of toAda as SyncOp[][]) ada.receive({ ops: batch });
    for (const batch of toLin as SyncOp[][]) lin.receive({ ops: batch });
    expect(ada.canvas).toEqual(lin.canvas);
    expect(validateCanvas(ada.canvas).ok).toBe(true);
    // The frame went to the trash with what it holds, connectors to its shapes too.
    expect(indexShapes(ada.canvas).has('frame')).toBe(false);
    expect(ada.canvas.connectors.every((c) => !('shape' in c.to) || c.to.shape !== 'review')).toBe(
      true
    );
  });

  it('refuses or neutralizes hostile remote batches the same way on every replica', () => {
    const ada = createCanvasSync({ replica: 'ada', canvas: everyShape() });
    const lin = createCanvasSync({ replica: 'lin', canvas: everyShape() });
    const evil = createCanvasSync({ replica: 'evil', canvas: everyShape() });
    const ops: SyncOp[] = [];
    evil.replica.onOps((batch) => ops.push(...batch));
    evil.replica.transact(() => {
      evil.replica.setProp('start', 'x', 'javascript:alert(1)');
      evil.replica.setProp('logo', 'ref', 'javascript:void');
      evil.replica.setProp('note', 'onclick', 'alert(1)');
      evil.replica.insertNode('script', 'root', 0, { id: 'x1' });
    });
    for (const session of [ada, lin]) {
      const result = session.receive({ ops });
      expect(result.ok).toBe(true);
      const ids = new Set(walkShapes(session.canvas).map((entry) => entry.shape.id));
      for (const id of ['start', 'logo', 'note', 'x1']) expect(ids.has(id)).toBe(false);
      expect(validateCanvas(session.canvas).ok).toBe(true);
    }
    expect(ada.canvas).toEqual(lin.canvas);
    expect(ada.receive({ ops: [{ kind: 'nope' }] }).ok).toBe(false);
    expect(ada.receive('not a batch').ok).toBe(false);
  });

  it('neutralizes a hostile batch over thousands of shapes in near-linear time', () => {
    const shapes = (count: number) =>
      Array.from({ length: count }, (_, i) => ({
        id: `s${i}`,
        type: 'rect' as const,
        x: i,
        y: 0,
        width: 10,
        height: 10,
        text: `Item ${i}`,
      }));
    const run = (count: number) => {
      const canvas = { ...createCanvas(), shapes: shapes(count) };
      const victim = createCanvasSync({ replica: 'ada', canvas });
      const evil = createCanvasSync({ replica: 'evil', canvas });
      const ops: SyncOp[] = [];
      evil.replica.onOps((batch) => ops.push(...batch));
      evil.replica.transact(() => {
        for (let i = 0; i < count; i += 1)
          evil.replica.setProp(`s${i}`, 'x', 'javascript:alert(1)');
      });
      const start = performance.now();
      for (let at = 0; at < ops.length; at += SYNC_LIMITS.batch)
        victim.receive({ ops: ops.slice(at, at + SYNC_LIMITS.batch) });
      const elapsed = performance.now() - start;
      expect(victim.canvas.shapes).toEqual([]);
      expect(validateCanvas(victim.canvas).ok).toBe(true);
      return elapsed;
    };
    const small = run(300);
    const large = run(3_000);
    expect(large).toBeLessThan(8_000);
    expect(large).toBeLessThan(small * 40 + 500);
  }, 60_000);

  it('splits commits past the batch limit so a peer still converges', async () => {
    const hub = createMemorySyncHub();
    const ada = createCanvasSync({ replica: 'ada' });
    const lin = createCanvasSync({ replica: 'lin' });
    ada.connect(hub.adapter());
    lin.connect(hub.adapter());
    await tick();
    const ops: CanvasOperation[] = Array.from({ length: 1_500 }, (_, i) => ({
      op: 'add',
      shape: { id: `s${i}`, type: 'sticky', x: i, y: i, width: 40, height: 40, text: `Note ${i}` },
    }));
    let sent = 0;
    ada.replica.onOps((batch, origin) => {
      if (origin === 'local') sent = batch.length;
    });
    expect(ada.apply(ops).ok).toBe(true);
    expect(sent).toBeGreaterThan(SYNC_LIMITS.batch);
    await tick();
    await tick();
    expect(lin.canvas.shapes).toHaveLength(1_500);
    expect(lin.canvas).toEqual(ada.canvas);
  });

  it('validates presence and expires it', () => {
    expect(checkCanvasPresence({ replica: 'ada', name: 'Ada', color: 3 })).toEqual({
      replica: 'ada',
      name: 'Ada',
      color: 3,
    });
    const bad = [
      { replica: 'ada', name: 'evil\u202E', color: 1 },
      { replica: 'ada', name: 'Ada', color: 12 },
      { replica: 'a b', name: 'Ada', color: 1 },
      { replica: 'ada', name: 'Ada', color: 1, point: { x: Number.NaN, y: 0 } },
      { replica: 'ada', name: 'Ada', color: 1, selection: ['<b>'] },
      { replica: 'ada', name: 'Ada', color: 1, selection: Array(201).fill('a') },
    ];
    for (const value of bad) expect(checkCanvasPresence(value)).toBeNull();
    let now = 0;
    const store = createCanvasPresenceStore({ now: () => now });
    store.update({
      replica: 'ada',
      name: 'Ada',
      color: 1,
      point: { x: 1, y: 2 },
      selection: ['a'],
    });
    expect(store.list()).toHaveLength(1);
    now = 31_000;
    expect(store.list()).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Convergence: three replicas, random canvas edits, reordered and duplicated delivery.

const WORDS = ['plan', 'ship', 'ü', '😀', 'review', ' ', 'beta'];

function randomEdit(session: CanvasSync, random: () => number, serial: () => string): void {
  const doc = session.canvas;
  const entries = walkShapes(doc);
  const pick = () => entries[Math.floor(random() * entries.length)]?.shape.id ?? 'none';
  const roll = random();
  let ops: CanvasOperation[] = [];
  if (roll < 0.06) {
    session.undo();
    return;
  }
  if (roll < 0.1) {
    session.redo();
    return;
  }
  if (roll < 0.25 || entries.length < 3) {
    const id = serial();
    const kind = random();
    const shape =
      kind < 0.4
        ? { id, type: 'rect' as const, x: random() * 500, y: random() * 500, width: 40, height: 30 }
        : kind < 0.7
          ? {
              id,
              type: 'sticky' as const,
              x: random() * 500,
              y: random() * 500,
              width: 80,
              height: 80,
              text: 'Note',
            }
          : kind < 0.85
            ? {
                id,
                type: 'frame' as const,
                x: random() * 500,
                y: random() * 500,
                width: 300,
                height: 200,
                title: 'Area',
                children: [],
              }
            : {
                id,
                type: 'path' as const,
                x: 0,
                y: 0,
                width: 20,
                height: 20,
                points: [
                  [0, 0],
                  [10, 20],
                  [20, 0],
                ] as [number, number][],
              };
    ops = [{ op: 'add', shape }];
  } else if (roll < 0.4)
    ops = moveOps(doc, [pick()], { x: random() * 40 - 20, y: random() * 40 - 20 });
  else if (roll < 0.5) {
    const id = pick();
    const shape = indexShapes(doc).get(id)?.shape;
    const current = shape && 'text' in shape && typeof shape.text === 'string' ? shape.text : '';
    const at = Math.floor(random() * (Array.from(current).length + 1));
    const chars = Array.from(current);
    chars.splice(at, random() < 0.3 ? 1 : 0, WORDS[Math.floor(random() * WORDS.length)] as string);
    ops = textOps(doc, id, chars.join('').slice(0, 200));
  } else if (roll < 0.58) ops = deleteOps(doc, [pick()]);
  else if (roll < 0.64) ops = resizeOps(doc, pick(), 'se', { x: random() * 30, y: random() * 30 });
  else if (roll < 0.69) ops = rotateOps(doc, pick(), Math.floor(random() * 8) * 45);
  else if (roll < 0.75) ops = groupOps(doc, [pick(), pick(), pick()], serial());
  else if (roll < 0.79) {
    const group = entries.find((entry) => entry.shape.type === 'group');
    ops = group ? ungroupOps(doc, group.shape.id) : [];
  } else if (roll < 0.85) ops = reorderOps(doc, [pick()], random() < 0.5 ? 'front' : 'backward');
  else if (roll < 0.92) {
    const frame = entries.find((entry) => entry.shape.type === 'frame');
    ops = reparentOps(doc, [pick()], random() < 0.7 && frame ? frame.shape.id : null);
  } else {
    const a = indexShapes(doc).get(pick())?.shape;
    const b = indexShapes(doc).get(pick())?.shape;
    if (a && b && a.type !== 'group' && b.type !== 'group' && a.id !== b.id)
      ops = connectOps({ shape: a.id }, { shape: b.id }, serial(), {
        routing: random() < 0.5 ? 'elbow' : 'curved',
      });
  }
  if (ops.length > 0) session.apply(ops);
}

function shuffle<T>(items: T[], random: () => number): T[] {
  for (let i = items.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [items[i], items[j]] = [items[j] as T, items[i] as T];
  }
  return items;
}

function runCase(seed: number): { canvas: CanvasDocument; ok: boolean } {
  const random = rng(seed);
  const start: CanvasDocument =
    seed % 3 === 0
      ? createCanvas()
      : {
          ...createCanvas(),
          shapes: [
            { id: 'f', type: 'frame', x: 0, y: 0, width: 400, height: 300, children: [] },
            { id: 'a', type: 'rect', x: 10, y: 10, width: 50, height: 40, text: 'Alpha' },
            { id: 'b', type: 'sticky', x: 100, y: 10, width: 80, height: 80, text: 'Beta' },
          ],
          connectors: [{ id: 'ab', from: { shape: 'a' }, to: { shape: 'b' } }],
        };
  const sessions = ['r1', 'r2', 'r3'].map((replica) =>
    createCanvasSync({ replica, canvas: start })
  );
  const queues = wire(sessions);
  let counter = 0;
  const serials = sessions.map(
    (session) => () => `${session.replica.id}-${(counter++).toString(36)}`
  );
  const rounds = 2 + Math.floor(random() * 4);
  for (let round = 0; round < rounds; round += 1) {
    sessions.forEach((session, i) => {
      const edits = 1 + Math.floor(random() * 3);
      for (let e = 0; e < edits; e += 1) randomEdit(session, random, serials[i] as () => string);
    });
    // Partial, reordered delivery between rounds.
    sessions.forEach((session, i) => {
      const queue = queues[i] as SyncOp[][];
      const take = Math.floor(random() * (queue.length + 1));
      for (const batch of shuffle(queue.splice(0, take), random)) session.receive({ ops: batch });
    });
  }
  // Everything, reordered and duplicated.
  sessions.forEach((session, i) => {
    const queue = queues[i] as SyncOp[][];
    const all = shuffle([...queue, ...queue.filter(() => random() < 0.5)], random);
    queue.length = 0;
    for (const batch of all) session.receive({ ops: batch });
  });
  const [first, ...rest] = sessions as [CanvasSync, ...CanvasSync[]];
  let ok = validateCanvas(first.canvas).ok && first.replica.pending === 0;
  for (const other of rest) {
    ok &&= JSON.stringify(other.replica.toJSON()) === JSON.stringify(first.replica.toJSON());
    ok &&= JSON.stringify(other.canvas) === JSON.stringify(first.canvas);
    ok &&= JSON.stringify(projectCanvas(other.replica)) === JSON.stringify(first.canvas);
  }
  return { canvas: first.canvas, ok };
}

describe('canvas sync convergence', () => {
  it('converges on 1,000 seeded cases of three replicas with reordered, duplicated delivery', () => {
    const failures: number[] = [];
    let shapes = 0;
    for (let seed = 1; seed <= 1_000; seed += 1) {
      const result = runCase(seed);
      if (!result.ok) failures.push(seed);
      shapes += walkShapes(result.canvas).length;
    }
    expect(failures).toEqual([]);
    // The cases did real work.
    expect(shapes).toBeGreaterThan(3_000);
  }, 120_000);
});
