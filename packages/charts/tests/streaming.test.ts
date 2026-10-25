import { describe, expect, it } from 'vitest';
import { appendSeriesWindow } from '../src/streaming/index.ts';

describe('appendSeriesWindow', () => {
  it('appends immutably and retains only the newest points per series', () => {
    const current = [
      {
        id: 'latency',
        label: 'Latency',
        points: [
          { x: 0, y: 12 },
          { x: 1, y: 11 },
          { x: 2, y: 14 },
        ],
      },
    ];
    const additions = [
      {
        id: 'latency',
        label: 'Latency',
        points: [
          { x: 3, y: 10 },
          { x: 4, y: null },
          { x: 5, y: 9 },
        ],
      },
    ];

    const next = appendSeriesWindow(current, additions, { maxPoints: 4 });

    expect(next[0]?.points).toEqual([
      { x: 2, y: 14 },
      { x: 3, y: 10 },
      { x: 4, y: null },
      { x: 5, y: 9 },
    ]);
    expect(current[0]?.points).toHaveLength(3);
    expect(additions[0]?.points).toHaveLength(3);
    expect(next).not.toBe(current);
    expect(next[0]).not.toBe(current[0]);
  });

  it('rejects non-append order, unknown or duplicate streams, invalid points, and unsafe bounds', () => {
    const current = [{ id: 'latency', label: 'Latency', points: [{ x: 2, y: 3 }] }];
    const batch = (id: string, points: { x: number; y: number | null }[]) => [
      { id, label: 'Latency', points },
    ];

    expect(() => appendSeriesWindow(current, batch('latency', [{ x: 2, y: 4 }]))).toThrow(
      /strictly after/
    );
    expect(() =>
      appendSeriesWindow(
        current,
        batch('latency', [
          { x: 4, y: 4 },
          { x: 3, y: 5 },
        ])
      )
    ).toThrow(/strictly increasing/);
    expect(() => appendSeriesWindow(current, batch('unknown', [{ x: 3, y: 4 }]))).toThrow(
      /unknown series/
    );
    expect(() =>
      appendSeriesWindow(current, [
        ...batch('latency', [{ x: 3, y: 4 }]),
        ...batch('latency', [{ x: 4, y: 5 }]),
      ])
    ).toThrow(/Duplicate appended series/);
    expect(() => appendSeriesWindow(current, batch('latency', [{ x: Number.NaN, y: 4 }]))).toThrow(
      /finite numeric/
    );
    expect(() =>
      appendSeriesWindow(current, batch('latency', [{ x: 3, y: Number.POSITIVE_INFINITY }]))
    ).toThrow(/finite numeric/);
    expect(() => appendSeriesWindow(current, [], { maxPoints: 0 })).toThrow(/maxPoints/);
  });

  it('bounds an oversized seed even when the incoming batch is empty', () => {
    const current = [
      {
        id: 'latency',
        label: 'Latency',
        points: Array.from({ length: 5 }, (_, x) => ({ x, y: x })),
      },
    ];

    const next = appendSeriesWindow(current, [], { maxPoints: 2 });

    expect(next[0]?.points).toEqual([
      { x: 3, y: 3 },
      { x: 4, y: 4 },
    ]);
    expect(current[0]?.points).toHaveLength(5);
  });
});
