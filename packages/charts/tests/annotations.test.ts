import { describe, expect, it } from 'vitest';
import {
  annotationInteractionSeries,
  assertChartAnnotations,
  type ChartAnnotation,
  projectAnnotations,
} from '../src/annotations/model.ts';
import { nearestPoint2d } from '../src/interaction/model.ts';

const plot = { x: 10, y: 20, width: 100, height: 80 };

describe('chart annotations', () => {
  const annotations: ChartAnnotation[] = [
    { id: 'goal', type: 'line', axis: 'y', value: 5, label: 'Goal: 5' },
    { id: 'focus', type: 'band', axis: 'x', start: 'Tue', end: 'Mon', label: 'Focus window' },
    { id: 'event', type: 'point', x: 'Tue', y: 3, label: 'Release event' },
  ];

  it('projects line, normalized band and point annotations into plot space', () => {
    const projected = projectAnnotations(annotations, {
      plot,
      x: (value) => (value === 'Mon' ? 25 : value === 'Tue' ? 75 : undefined),
      y: (value) => (typeof value === 'number' ? 100 - value * 10 : undefined),
    });
    expect(projected).toEqual([
      { id: 'goal', type: 'line', axis: 'y', position: 50, label: 'Goal: 5' },
      { id: 'focus', type: 'band', axis: 'x', start: 25, end: 75, label: 'Focus window' },
      { id: 'event', type: 'point', x: 75, y: 70, label: 'Release event' },
    ]);
  });

  it('adds an announcement point for every annotation in declaration order', () => {
    const projected = projectAnnotations(annotations, {
      plot,
      x: (value) => (value === 'Mon' ? 25 : 75),
      y: (value) => (typeof value === 'number' ? 100 - value * 10 : undefined),
    });
    const series = annotationInteractionSeries(projected, plot);
    expect(series[0]?.points.map((point) => point.accessibleLabel)).toEqual([
      'Annotation: Goal: 5.',
      'Annotation: Focus window.',
      'Annotation: Release event.',
    ]);
    expect(series[0]?.points[0]).toMatchObject({ x: 60, y: 50, yValue: null });
    expect(series[0]?.pointer).toBe(false);
    expect(
      nearestPoint2d(
        [
          { id: 'data', label: 'Data', points: [{ x: 60, y: 50, xValue: 'A', yValue: 1 }] },
          ...series,
        ],
        new Set(),
        60,
        50
      )
    ).toEqual({ series: 0, index: 0 });
  });

  it('rejects duplicate ids and missing labels', () => {
    expect(() => assertChartAnnotations([annotations[0]!, annotations[0]!])).toThrow(
      /Duplicate annotation id/
    );
    expect(() =>
      assertChartAnnotations([{ id: 'unlabeled', type: 'point', x: 1, y: 2, label: ' ' }])
    ).toThrow(/non-empty label/);
    expect(() =>
      assertChartAnnotations(
        Array.from({ length: 101 }, (_, index) => ({
          id: `a${index}`,
          type: 'line' as const,
          axis: 'y' as const,
          value: index,
          label: `Line ${index}`,
        }))
      )
    ).toThrow(/at most 100/);
  });
});
