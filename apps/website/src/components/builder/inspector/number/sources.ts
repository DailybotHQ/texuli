/**
 * Number hints from the one schema that documents ranges today: the chart
 * prop schemas. A catalog `charts-*` id maps to the chart schema of the
 * same id; other ids have no hints. Imports only `@texuli/charts/schemas`.
 */
import { chartPropSchemas } from '@texuli/charts/schemas';
import type { NumberBounds, NumberHints } from './model.ts';

/** The raw chart prop schemas, re-exported for hosts and tests. */
export { chartPropSchemas };

type NumberConstraints = {
  minimum?: number;
  maximum?: number;
  exclusiveMinimum?: number;
  integer?: boolean;
};

export function chartNumberHints(id: string, name: string): NumberHints | undefined {
  if (!Object.hasOwn(chartPropSchemas, id)) return undefined;
  const schema = chartPropSchemas[id as keyof typeof chartPropSchemas];
  const prop = schema.props.find((candidate) => candidate.name === name);
  if (prop?.kind !== 'number') return undefined;
  const constraints = (prop.constraints ?? {}) as NumberConstraints;
  const bounds: NumberBounds = {};
  if (constraints.exclusiveMinimum !== undefined) {
    bounds.min = constraints.exclusiveMinimum;
    bounds.exclusive = true;
  } else if (constraints.minimum !== undefined) {
    bounds.min = constraints.minimum;
  }
  if (constraints.maximum !== undefined) bounds.max = constraints.maximum;
  if (constraints.integer) bounds.integer = true;
  return {
    ...(Object.keys(bounds).length ? { bounds } : {}),
    ...(typeof prop.default === 'number' ? { default: prop.default } : {}),
    source: `${schema.component} chart schema`,
  };
}

/**
 * Number limits the painting code enforces for non-chart props, each read
 * from the code that applies it (named in `source`). Outside the range the
 * value is clamped or ignored at paint, so the field warns.
 */
const PAINT_HINTS: Readonly<Record<string, Readonly<Record<string, NumberHints>>>> = Object.freeze({
  // packages/player/src/layouts/ContentLayout.svelte clamps both to whole numbers.
  'layout-grid': {
    columns: {
      bounds: { min: 1, max: 4, integer: true },
      default: 2,
      source: 'player grid layout',
    },
  },
  'layout-tile': {
    span: { bounds: { min: 1, max: 4, integer: true }, default: 1, source: 'player grid tile' },
    rowSpan: { bounds: { min: 1, max: 2, integer: true }, default: 1, source: 'player grid tile' },
  },
  // MapBlockView paints the title as `h{headingLevel}`.
  'blocks-map': {
    headingLevel: {
      bounds: { min: 1, max: 6, integer: true },
      default: 3,
      source: 'map block title heading (h1 to h6)',
    },
  },
  // activeHighlightIndex (blocks/code) floors a step and counts from 0.
  'blocks-code': {
    step: { bounds: { min: 0, integer: true }, source: 'code block highlight steps' },
    hostStep: { bounds: { min: 0, integer: true }, source: 'code block highlight steps' },
  },
  // canvasBackingSize (media/composition-canvas) caps the ratio at 4 and falls back to 1.
  'media-composition-canvas': {
    pixelRatio: {
      bounds: { min: 0, exclusive: true, max: 4 },
      default: 1,
      source: 'composition canvas backing size',
    },
  },
  // heatLevel (data/cohort) tints nothing unless the top of the scale is above 0.
  'data-cohort-table': {
    max: { bounds: { min: 0, exclusive: true }, source: 'cohort table heat scale' },
  },
  // FilterBuilder clamps the offered depth to 1 through FILTER_LIMITS.depth - 1.
  'data-filter-builder': {
    maxDepth: {
      bounds: { min: 1, max: 5, integer: true },
      default: 3,
      source: 'filter builder nesting depth',
    },
  },
  // DataNotificationInboxPainter paints the heading as h2 to h6.
  'data-notification-inbox': {
    headingLevel: {
      bounds: { min: 2, max: 6, integer: true },
      default: 2,
      source: 'notification inbox heading (h2 to h6)',
    },
  },
  // intrinsicSize (media/image) keeps safe integers from 1 to IMAGE_LIMITS.dimension.
  'media-image': {
    width: { bounds: { min: 1, max: 16_384, integer: true }, source: 'image intrinsic size' },
    height: { bounds: { min: 1, max: 16_384, integer: true }, source: 'image intrinsic size' },
  },
});

export function paintNumberHints(id: string, name: string): NumberHints | undefined {
  return PAINT_HINTS[id]?.[name];
}

/** Every number hint the inspector shows: the chart schema first, then the painting code. */
export function numberHints(id: string, name: string): NumberHints | undefined {
  return chartNumberHints(id, name) ?? paintNumberHints(id, name);
}
