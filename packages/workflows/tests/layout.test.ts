// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { DEFAULT_NODE_SIZE, layoutMoves, layoutWorkflow, type Size } from '../src/layout/index.ts';
import {
  applyWorkflowOp,
  createWorkflow,
  defineNodeTypes,
  type WorkflowEdge,
  type WorkflowNode,
} from '../src/model/index.ts';

function node(id: string): WorkflowNode {
  return { id, type: 'step', label: id, position: { x: 0, y: 0 } };
}

function edge(from: string, to: string, id = `${from}>${to}`): WorkflowEdge {
  return { id, from: { node: from, port: 'out' }, to: { node: to, port: 'in' } };
}

function graphOf(ids: string[], pairs: [string, string][]) {
  return { nodes: ids.map(node), edges: pairs.map(([a, b]) => edge(a, b)) };
}

function createRng(seed: number) {
  let state = seed >>> 0 || 1;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 0x1_0000_0000;
  };
}

function shuffle<T>(list: readonly T[], random: () => number): T[] {
  const copy = [...list];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [copy[i], copy[j]] = [copy[j] as T, copy[i] as T];
  }
  return copy;
}

function randomGraph(seed: number, size: number, density: number) {
  const random = createRng(seed);
  const ids = Array.from({ length: size }, (_, i) => `n${i}`);
  const edges: WorkflowEdge[] = [];
  for (let e = 0; e < size * density; e++) {
    const a = ids[Math.floor(random() * size)] as string;
    const b = ids[Math.floor(random() * size)] as string;
    edges.push(edge(a, b, `e${e}`));
  }
  return { nodes: ids.map(node), edges };
}

function serialize(layout: ReturnType<typeof layoutWorkflow>) {
  return JSON.stringify({
    positions: [...layout.positions].sort(([a], [b]) => (a < b ? -1 : 1)),
    ranks: [...layout.ranks].sort(([a], [b]) => (a < b ? -1 : 1)),
    layers: layout.layers,
    reversed: layout.reversed,
    crossings: layout.crossings,
    size: layout.size,
  });
}

describe('layoutWorkflow', () => {
  it('lays out an empty graph', () => {
    const layout = layoutWorkflow({ nodes: [], edges: [] });
    expect(layout.size).toEqual({ width: 0, height: 0 });
    expect(layout.positions.size).toBe(0);
    expect(layout.layers).toEqual([]);
  });

  it('ranks a chain left to right, then top to bottom', () => {
    const chain = graphOf(
      ['a', 'b', 'c'],
      [
        ['a', 'b'],
        ['b', 'c'],
      ]
    );
    const lr = layoutWorkflow(chain);
    expect(lr.layers).toEqual([['a'], ['b'], ['c']]);
    expect([...lr.positions.values()]).toEqual([
      { x: 0, y: 0 },
      { x: 260, y: 0 },
      { x: 520, y: 0 },
    ]);
    expect(lr.size).toEqual({ width: 3 * 180 + 2 * 80, height: 64 });
    const tb = layoutWorkflow(chain, { direction: 'TB', rankGap: 40 });
    expect(tb.positions.get('c')).toEqual({ x: 0, y: 2 * (64 + 40) });
    expect(tb.size).toEqual({ width: 180, height: 3 * 64 + 2 * 40 });
  });

  it('pulls a source down next to its successor', () => {
    // `late` feeds only `d`, the end of a long chain: it sits one rank before it.
    const layout = layoutWorkflow(
      graphOf(
        ['a', 'b', 'c', 'd', 'late'],
        [
          ['a', 'b'],
          ['b', 'c'],
          ['c', 'd'],
          ['late', 'd'],
        ]
      )
    );
    expect(layout.ranks.get('late')).toBe(2);
    expect(layout.ranks.get('d')).toBe(3);
  });

  it('removes crossings a barycenter sweep can fix', () => {
    // a→d and b→c laid out in id order cross once; reordering fixes it.
    const layout = layoutWorkflow(
      graphOf(
        ['a', 'b', 'c', 'd'],
        [
          ['a', 'd'],
          ['b', 'c'],
        ]
      )
    );
    expect(layout.crossings).toBe(0);
    const top = (id: string) => layout.positions.get(id)?.y as number;
    expect(Math.sign(top('a') - top('b'))).toBe(Math.sign(top('d') - top('c')));
  });

  it('breaks cycles deterministically and ignores self-loops', () => {
    const layout = layoutWorkflow(
      graphOf(
        ['a', 'b', 'c'],
        [
          ['a', 'b'],
          ['b', 'c'],
          ['c', 'a'],
          ['b', 'b'],
        ]
      )
    );
    expect(layout.reversed).toEqual(['c>a']);
    expect(layout.layers).toEqual([['a'], ['b'], ['c']]);
  });

  it('mirrors horizontally for right-to-left reading', () => {
    const chain = graphOf(
      ['a', 'b', 'c', 'x'],
      [
        ['a', 'b'],
        ['b', 'c'],
        ['a', 'x'],
      ]
    );
    for (const direction of ['LR', 'TB'] as const) {
      const ltr = layoutWorkflow(chain, { direction });
      const rtl = layoutWorkflow(chain, { direction, rtl: true });
      expect(rtl.size).toEqual(ltr.size);
      for (const [id, point] of ltr.positions) {
        expect(rtl.positions.get(id)).toEqual({
          x: ltr.size.width - point.x - DEFAULT_NODE_SIZE.width,
          y: point.y,
        });
      }
    }
    const rtl = layoutWorkflow(chain, { rtl: true });
    expect((rtl.positions.get('a')?.x as number) > (rtl.positions.get('c')?.x as number)).toBe(
      true
    );
  });

  it('honors node sizes, gaps and the origin', () => {
    const sizes: Record<string, Size> = {
      a: { width: 100, height: 40 },
      b: { width: 300, height: 120 },
      c: { width: 100, height: 40 },
    };
    const layout = layoutWorkflow(
      graphOf(
        ['a', 'b', 'c'],
        [
          ['a', 'c'],
          ['b', 'c'],
        ]
      ),
      {
        nodeSize: (n) => sizes[n.id] as Size,
        nodeGap: 10,
        rankGap: 50,
        origin: { x: 1000, y: 2000 },
      }
    );
    const a = layout.positions.get('a') as { x: number; y: number };
    const b = layout.positions.get('b') as { x: number; y: number };
    // Rank 0 is as deep as its widest node; narrower nodes center in the band.
    expect(a.x).toBe(1000 + 100);
    expect(b.x).toBe(1000);
    expect(layout.positions.get('c')?.x).toBe(1000 + 300 + 50);
    // Neighbors in a rank keep the gap.
    const [first, second] = layout.layers[0] as string[];
    const top = layout.positions.get(first as string) as { y: number };
    const next = layout.positions.get(second as string) as { y: number };
    expect(next.y - top.y).toBeGreaterThanOrEqual(
      (sizes[first as string]?.height as number) + 10 - 1
    );
    expect(Math.min(a.y, b.y)).toBe(2000);
  });

  it('feeds a moveNodes op that the model applies as one step', () => {
    const registry = defineNodeTypes([
      {
        type: 'step',
        label: 'Step',
        ports: [
          { id: 'in', direction: 'in', dataType: 'any' },
          { id: 'out', direction: 'out', dataType: 'any' },
        ],
      },
    ]);
    const graph = { ...createWorkflow(), ...graphOf(['a', 'b'], [['a', 'b']]) };
    const moves = layoutMoves(layoutWorkflow(graph));
    expect(moves).toEqual([
      { id: 'a', x: 0, y: 0 },
      { id: 'b', x: 260, y: 0 },
    ]);
    const result = applyWorkflowOp(graph, { op: 'moveNodes', moves }, { registry });
    expect(result.ok && result.graph.nodes.map((n) => n.position)).toEqual([
      { x: 0, y: 0 },
      { x: 260, y: 0 },
    ]);
  });

  it('ignores edges to missing nodes and bad sizes', () => {
    const layout = layoutWorkflow(
      { nodes: [node('a')], edges: [edge('a', 'ghost')] },
      { nodeSize: () => ({ width: Number.NaN, height: -1 }), rankGap: Number.NaN }
    );
    expect(layout.size).toEqual(DEFAULT_NODE_SIZE);
  });
});

describe('layout properties', () => {
  it('equal input gives equal output, whatever the input order (60 random graphs)', () => {
    for (let seed = 1; seed <= 60; seed++) {
      const graph = randomGraph(seed, 5 + (seed % 40), 1 + (seed % 4));
      const random = createRng(seed * 13);
      const expected = serialize(layoutWorkflow(graph, { direction: seed % 2 ? 'LR' : 'TB' }));
      for (let round = 0; round < 3; round++) {
        const shuffled = {
          nodes: shuffle(graph.nodes, random),
          edges: shuffle(graph.edges, random),
        };
        expect(serialize(layoutWorkflow(shuffled, { direction: seed % 2 ? 'LR' : 'TB' }))).toBe(
          expected
        );
      }
    }
  });

  it('crossing reduction never adds crossings and removes most of them (60 random graphs)', () => {
    let before = 0;
    let after = 0;
    for (let seed = 1; seed <= 60; seed++) {
      const graph = randomGraph(seed * 7, 10 + (seed % 30), 2);
      const unswept = layoutWorkflow(graph, { sweeps: 0 }).crossings;
      const swept = layoutWorkflow(graph).crossings;
      expect(swept).toBeLessThanOrEqual(unswept);
      before += unswept;
      after += swept;
    }
    expect(after).toBeLessThan(before * 0.75);
  });

  it('edges point forward, ranks are contiguous and nodes never overlap (60 random graphs)', () => {
    for (let seed = 1; seed <= 60; seed++) {
      const graph = randomGraph(seed * 101, 3 + (seed % 50), 1 + (seed % 3));
      const layout = layoutWorkflow(graph);
      const reversed = new Set(layout.reversed);
      for (const e of graph.edges) {
        if (e.from.node === e.to.node) continue;
        const [from, to] = reversed.has(e.id) ? [e.to.node, e.from.node] : [e.from.node, e.to.node];
        expect(layout.ranks.get(to) as number).toBeGreaterThan(layout.ranks.get(from) as number);
      }
      expect(layout.layers.every((layer) => layer.length > 0)).toBe(true);
      expect(layout.layers.flat().sort()).toEqual(graph.nodes.map((n) => n.id).sort());
      for (const layer of layout.layers) {
        const tops = layer.map((id) => layout.positions.get(id)?.y as number);
        for (let i = 1; i < tops.length; i++) {
          expect((tops[i] as number) - (tops[i - 1] as number)).toBeGreaterThanOrEqual(
            DEFAULT_NODE_SIZE.height + 32 - 1
          );
        }
      }
      for (const point of layout.positions.values()) {
        expect(Number.isInteger(point.x) && Number.isInteger(point.y)).toBe(true);
        expect(point.x).toBeGreaterThanOrEqual(0);
        expect(point.y).toBeGreaterThanOrEqual(0);
        expect(point.x + DEFAULT_NODE_SIZE.width).toBeLessThanOrEqual(layout.size.width);
        expect(point.y + DEFAULT_NODE_SIZE.height).toBeLessThanOrEqual(layout.size.height + 1);
      }
    }
  });
});
