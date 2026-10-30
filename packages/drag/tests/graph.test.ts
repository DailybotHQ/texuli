// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  canConnect,
  compatiblePorts,
  cycleId,
  distanceToPolyline,
  edgeHitArea,
  edgePath,
  hitEdge,
  hitPort,
  nodesReaching,
  type Port,
  reaches,
  sideCurveControls,
  sideCurvePath,
} from '../src/graph.ts';

const ports: Port[] = [
  { id: 'a.out', nodeId: 'a', kind: 'out', point: { x: 100, y: 50 } },
  { id: 'b.in', nodeId: 'b', kind: 'in', point: { x: 200, y: 50 } },
  { id: 'b.out', nodeId: 'b', kind: 'out', point: { x: 300, y: 50 } },
  { id: 'c.in', nodeId: 'c', kind: 'in', point: { x: 400, y: 50 }, type: 'number' },
  { id: 'a.in', nodeId: 'a', kind: 'in', point: { x: 0, y: 50 } },
  { id: 'd.out', nodeId: 'd', kind: 'out', point: { x: 0, y: 300 }, type: 'text' },
];
const byId = new Map(ports.map((p) => [p.id, p]));
const port = (id: string) => byId.get(id) as Port;
const edges = [{ id: 'e1', from: 'a.out', to: 'b.in' }];

describe('ports', () => {
  it('hit-tests the nearest port within the radius', () => {
    expect(hitPort(ports, { x: 105, y: 52 })?.id).toBe('a.out');
    expect(hitPort(ports, { x: 150, y: 52 })).toBeNull();
    expect(hitPort(ports, { x: 140, y: 52 }, 60)?.id).toBe('a.out');
    expect(hitPort(ports, { x: 150, y: 50 }, 60)?.id).toBe('a.out');
  });

  it('refuses invalid connections with a reason', () => {
    expect(canConnect(port('b.in'), port('a.out'), byId, edges)).toEqual({
      ok: false,
      reason: 'direction',
    });
    expect(canConnect(port('b.out'), port('b.in'), byId, edges)).toEqual({
      ok: false,
      reason: 'self',
    });
    expect(canConnect(port('a.out'), port('b.in'), byId, edges)).toEqual({
      ok: false,
      reason: 'duplicate',
    });
    expect(canConnect(port('b.out'), port('a.in'), byId, edges)).toEqual({
      ok: false,
      reason: 'cycle',
    });
    expect(canConnect(port('d.out'), port('c.in'), byId, edges)).toEqual({
      ok: false,
      reason: 'type',
    });
    expect(
      canConnect(port('a.out'), port('b.in'), byId, edges, { allowDuplicate: true, maxIn: 1 })
    ).toEqual({
      ok: false,
      reason: 'full',
    });
    expect(canConnect(port('b.out'), port('c.in'), byId, edges)).toEqual({ ok: true });
    expect(canConnect(port('b.out'), port('a.in'), byId, edges, { allowCycles: true })).toEqual({
      ok: true,
    });
    expect(
      canConnect(port('b.out'), port('c.in'), byId, edges, {
        canConnect: () => ({ ok: false, reason: 'policy' }),
      })
    ).toEqual({ ok: false, reason: 'policy' });
  });

  it('lists compatible ports for keyboard connect mode and cycles through them', () => {
    const compatible = compatiblePorts(port('b.out'), ports, edges).map((p) => p.id);
    expect(compatible).toEqual(['c.in']);
    expect(compatiblePorts(port('d.out'), ports, edges).map((p) => p.id)).toEqual(['b.in', 'a.in']);
    expect(
      compatiblePorts(port('b.out'), ports, edges, { allowCycles: true }).map((p) => p.id)
    ).toEqual(['c.in', 'a.in']);
    expect(cycleId(['x', 'y', 'z'], null)).toBe('x');
    expect(cycleId(['x', 'y', 'z'], 'z')).toBe('x');
    expect(cycleId(['x', 'y', 'z'], 'x', -1)).toBe('z');
    expect(cycleId(['x', 'y'], null, -1)).toBe('y');
    expect(cycleId([], null)).toBeNull();
  });

  it('walks reachability without looping on cycles', () => {
    const loop = [
      ...edges,
      { id: 'e2', from: 'b.out', to: 'a.in' },
      { id: 'ghost', from: 'zz', to: 'a.in' },
    ];
    expect(reaches('a', 'b', byId, loop)).toBe(true);
    expect(reaches('b', 'c', byId, loop)).toBe(false);
    expect([...nodesReaching('a', byId, loop)].sort()).toEqual(['a', 'b']);
  });
});

describe('edge hit areas', () => {
  it('builds a curve that starts and ends on the ports', () => {
    const path = edgePath({ x: 0, y: 0 }, { x: 200, y: 100 }, 8);
    expect(path).toHaveLength(9);
    expect(path[0]).toEqual({ x: 0, y: 0 });
    expect(path[8]?.x).toBeCloseTo(200);
    expect(path[8]?.y).toBeCloseTo(100);
  });

  it('measures distance to a polyline', () => {
    const line = [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
    ];
    expect(distanceToPolyline(line, { x: 50, y: 5 })).toBe(5);
    expect(distanceToPolyline(line, { x: -3, y: 4 })).toBe(5);
    expect(distanceToPolyline([{ x: 0, y: 0 }], { x: 3, y: 4 })).toBe(5);
    expect(
      distanceToPolyline(
        [
          { x: 1, y: 1 },
          { x: 1, y: 1 },
        ],
        { x: 1, y: 4 }
      )
    ).toBe(3);
  });

  it('hits the nearest edge within tolerance, with a box prefilter', () => {
    const areas = [
      edgeHitArea('top', edgePath({ x: 0, y: 0 }, { x: 300, y: 0 })),
      edgeHitArea('low', edgePath({ x: 0, y: 40 }, { x: 300, y: 40 })),
    ];
    expect(hitEdge(areas, { x: 150, y: 4 })).toBe('top');
    expect(hitEdge(areas, { x: 150, y: 37 })).toBe('low');
    expect(hitEdge(areas, { x: 150, y: 20 })).toBeNull();
    expect(hitEdge(areas, { x: 150, y: 20 }, 25)).toBe('top');
  });

  it('reaches out from each side for side-aware cubic edges (workflows and canvas)', () => {
    const a = { x: 0, y: 0 };
    const b = { x: 100, y: 50 };
    expect(sideCurvePath(a, 'right', b, 'left')).toBe('M0 0C44.7 0 55.3 50 100 50');
    expect(sideCurvePath(a, 'bottom', b, 'top')).toBe('M0 0C0 44.7 100 5.3 100 50');
    // Short edges still reach 32 out, so the curve leaves its side visibly.
    const [c1, c2] = sideCurveControls(a, 'left', { x: 10, y: 0 }, 'right');
    expect(c1).toEqual({ x: -32, y: 0 });
    expect(c2).toEqual({ x: 42, y: 0 });
  });
});
