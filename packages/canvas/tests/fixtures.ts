import type { CanvasDocument } from '../src/model/types.ts';

/** A canvas with every shape type and routing (fictional data only). */
export function everyShape(): CanvasDocument {
  return {
    format: 'texuli-canvas',
    formatVersion: 1,
    meta: { title: 'Launch plan', locale: 'en' },
    grid: 8,
    shapes: [
      {
        id: 'frame',
        type: 'frame',
        title: 'Week one',
        x: 0,
        y: 0,
        width: 640,
        height: 400,
        children: [
          {
            id: 'idea',
            type: 'sticky',
            x: 24,
            y: 48,
            width: 160,
            height: 120,
            text: 'Ship the beta',
            color: 'yellow',
          },
          {
            id: 'review',
            type: 'rect',
            x: 240,
            y: 48,
            width: 160,
            height: 80,
            radius: 8,
            text: 'Review',
            paint: { fill: 'blue', stroke: 'default', strokeWidth: 2 },
          },
        ],
      },
      { id: 'start', type: 'ellipse', x: 720, y: 40, width: 120, height: 80, text: 'Start' },
      { id: 'choice', type: 'diamond', x: 720, y: 200, width: 120, height: 120, text: 'Ready?' },
      {
        id: 'note',
        type: 'text',
        x: 900,
        y: 40,
        width: 200,
        height: 40,
        text: 'Owner: Ada Example',
        fontSize: 'm',
      },
      {
        id: 'pair',
        type: 'group',
        children: [
          { id: 'a1', type: 'rect', x: 40, y: 480, width: 80, height: 40 },
          { id: 'a2', type: 'rect', x: 160, y: 480, width: 80, height: 40, rotation: 15 },
        ],
      },
      {
        id: 'underline',
        type: 'line',
        x: 900,
        y: 90,
        width: 200,
        height: 0,
        points: [
          [0, 0],
          [200, 0],
        ],
      },
      {
        id: 'pointer',
        type: 'arrow',
        x: 300,
        y: 500,
        width: 100,
        height: 50,
        points: [
          [0, 0],
          [100, 50],
        ],
      },
      {
        id: 'scribble',
        type: 'path',
        x: 500,
        y: 480,
        width: 60,
        height: 30,
        points: [
          [0, 0],
          [30, 30],
          [60, 0],
        ],
        paint: { stroke: 'red' },
      },
      {
        id: 'logo',
        type: 'image',
        x: 900,
        y: 200,
        width: 120,
        height: 120,
        ref: 'assets/logo-1',
        alt: 'Example logo',
      },
    ],
    connectors: [
      { id: 'c1', from: { shape: 'start' }, to: { shape: 'choice' }, routing: 'elbow' },
      {
        id: 'c2',
        from: { shape: 'choice', anchor: 'left' },
        to: { shape: 'review', anchor: 'right' },
        routing: 'curved',
        text: 'yes',
      },
      { id: 'c3', from: { shape: 'idea' }, to: { x: 400, y: 300 }, endCap: 'dot' },
    ],
  };
}

/** Mulberry32: a small seeded generator for property tests. */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Wall-clock milliseconds of a run. */
export function timed(run: () => void): number {
  const start = performance.now();
  run();
  return performance.now() - start;
}
