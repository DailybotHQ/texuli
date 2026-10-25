import type { PlotPoint, PlotSeries } from '../interaction/model.ts';
import type { Rect } from '../math/types.ts';

export type ChartAxisValue = string | number;

/**
 * Plain-data chart annotation. Keep IDs unique per chart; charts accept at most
 * 100 annotations. In interactive charts, labels enter the keyboard explorer.
 */
export type ChartAnnotation =
  | {
      id: string;
      type: 'line';
      axis: 'x' | 'y';
      value: ChartAxisValue;
      label: string;
      color?: string;
    }
  | {
      id: string;
      type: 'band';
      axis: 'x' | 'y';
      start: ChartAxisValue;
      end: ChartAxisValue;
      label: string;
      color?: string;
    }
  | {
      id: string;
      type: 'point';
      x: ChartAxisValue;
      y: ChartAxisValue;
      label: string;
      color?: string;
    };

export type RenderedAnnotation =
  | { id: string; type: 'line'; axis: 'x' | 'y'; position: number; label: string; color?: string }
  | {
      id: string;
      type: 'band';
      axis: 'x' | 'y';
      start: number;
      end: number;
      label: string;
      color?: string;
    }
  | { id: string; type: 'point'; x: number; y: number; label: string; color?: string };

export interface AnnotationScales {
  plot: Rect;
  x: (value: ChartAxisValue) => number | undefined;
  y: (value: ChartAxisValue) => number | undefined;
}

/** Validate JSON-authored annotations before deriving display or interaction geometry. */
export function assertChartAnnotations(annotations: readonly ChartAnnotation[]): void {
  if (!Array.isArray(annotations)) throw new TypeError('Chart annotations must be an array.');
  if (annotations.length > 100) throw new RangeError('Charts support at most 100 annotations.');
  const ids = new Set<string>();
  for (const [index, annotation] of annotations.entries()) {
    if (!annotation || typeof annotation.id !== 'string' || annotation.id.trim() === '') {
      throw new TypeError(`Annotation ${index} needs a non-empty id.`);
    }
    if (ids.has(annotation.id)) throw new TypeError(`Duplicate annotation id "${annotation.id}".`);
    ids.add(annotation.id);
    if (typeof annotation.label !== 'string' || annotation.label.trim() === '') {
      throw new TypeError(`Annotation "${annotation.id}" needs a non-empty label.`);
    }
    if (annotation.color !== undefined && typeof annotation.color !== 'string') {
      throw new TypeError(`Annotation "${annotation.id}" color must be a string.`);
    }
    const validValue = (value: unknown) =>
      (typeof value === 'string' && value.trim() !== '') ||
      (typeof value === 'number' && Number.isFinite(value));
    if (annotation.type === 'line') {
      if ((annotation.axis !== 'x' && annotation.axis !== 'y') || !validValue(annotation.value)) {
        throw new TypeError(`Annotation "${annotation.id}" needs a valid axis and value.`);
      }
    } else if (annotation.type === 'band') {
      if (
        (annotation.axis !== 'x' && annotation.axis !== 'y') ||
        !validValue(annotation.start) ||
        !validValue(annotation.end)
      ) {
        throw new TypeError(`Annotation "${annotation.id}" needs a valid axis range.`);
      }
    } else if (annotation.type === 'point') {
      if (!validValue(annotation.x) || !validValue(annotation.y)) {
        throw new TypeError(`Annotation "${annotation.id}" needs valid x and y values.`);
      }
    } else {
      throw new TypeError(`Annotation "${annotation.id}" has an unsupported type.`);
    }
  }
}

/** Validate annotations whose y-axis is quantitative, as in Cartesian charts. */
export function assertCartesianAnnotations(annotations: readonly ChartAnnotation[]): void {
  assertChartAnnotations(annotations);
  for (const annotation of annotations) {
    if (
      (annotation.type === 'line' &&
        annotation.axis === 'y' &&
        typeof annotation.value !== 'number') ||
      (annotation.type === 'band' &&
        annotation.axis === 'y' &&
        (typeof annotation.start !== 'number' || typeof annotation.end !== 'number')) ||
      (annotation.type === 'point' && typeof annotation.y !== 'number')
    ) {
      throw new TypeError(`Annotation "${annotation.id}" needs numeric Cartesian y values.`);
    }
  }
}

/** Project plain annotation data into the chart's viewBox coordinates. */
export function projectAnnotations(
  annotations: readonly ChartAnnotation[],
  scales: AnnotationScales
): RenderedAnnotation[] {
  assertChartAnnotations(annotations);
  const projected: RenderedAnnotation[] = [];
  for (const annotation of annotations) {
    const color = annotation.color;
    if (annotation.type === 'line') {
      const position = scales[annotation.axis](annotation.value);
      if (position === undefined || !Number.isFinite(position)) continue;
      projected.push({
        id: annotation.id,
        type: 'line',
        axis: annotation.axis,
        position,
        label: annotation.label,
        ...(color === undefined ? {} : { color }),
      });
    } else if (annotation.type === 'band') {
      const start = scales[annotation.axis](annotation.start);
      const end = scales[annotation.axis](annotation.end);
      if (start === undefined || end === undefined || !Number.isFinite(start + end)) continue;
      projected.push({
        id: annotation.id,
        type: 'band',
        axis: annotation.axis,
        start: Math.min(start, end),
        end: Math.max(start, end),
        label: annotation.label,
        ...(color === undefined ? {} : { color }),
      });
    } else {
      const x = scales.x(annotation.x);
      const y = scales.y(annotation.y);
      if (x === undefined || y === undefined || !Number.isFinite(x + y)) continue;
      projected.push({
        id: annotation.id,
        type: 'point',
        x,
        y,
        label: annotation.label,
        ...(color === undefined ? {} : { color }),
      });
    }
  }
  return projected;
}

/** Append annotations to the keyboard explorer in declaration order. */
export function annotationInteractionSeries(
  annotations: readonly RenderedAnnotation[],
  plot: Rect,
  reservedIds: readonly string[] = []
): PlotSeries[] {
  if (annotations.length === 0) return [];
  const usedIds = new Set(reservedIds);
  let id = '__tx_chart_annotations__';
  while (usedIds.has(id)) id += '_';
  const points: PlotPoint[] = annotations.map((annotation) => {
    let x = plot.x + plot.width / 2;
    let y = plot.y + plot.height / 2;
    if (annotation.type === 'line') {
      if (annotation.axis === 'x') x = annotation.position;
      else y = annotation.position;
    } else if (annotation.type === 'band') {
      const center = (annotation.start + annotation.end) / 2;
      if (annotation.axis === 'x') x = center;
      else y = center;
    } else {
      x = annotation.x;
      y = annotation.y;
    }
    return {
      x,
      y,
      xValue: annotation.label,
      yValue: null,
      label: annotation.label,
      accessibleLabel: `Annotation: ${annotation.label}.`,
      ...(annotation.color === undefined ? {} : { color: annotation.color }),
    };
  });
  return [{ id, label: 'Annotations', pointer: false, points }];
}
