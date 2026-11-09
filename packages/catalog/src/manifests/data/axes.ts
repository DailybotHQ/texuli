import { manifestData } from '../../manifest/data.ts';
import type { CatalogAxisName, CatalogManifest, CatalogStateName } from '../../manifest/types.ts';

type AxisStamp = {
  readonly axes?: Readonly<Partial<Record<CatalogAxisName, string>>>;
  readonly states?: readonly CatalogStateName[];
};

/**
 * Part C axes and states for the data group (ADR-032). Axes name the enum
 * prop only. States are confirmed against the view's CSS/ARIA.
 */
export const DATA_AXIS_STAMP: Readonly<Record<string, AxisStamp>> = {
  'data-board': {
    axes: { density: 'density' },
    states: ['focus-visible', 'active', 'disabled', 'expanded', 'open'],
  },
  'data-calendar': {
    states: ['hover', 'focus-visible', 'active', 'disabled', 'selected', 'open', 'readonly'],
  },
  'data-cohort-table': { axes: { density: 'density' } },
  'data-dashboard': {
    axes: { density: 'density' },
    states: ['hover', 'focus-visible', 'active'],
  },
  'data-files': {
    axes: { density: 'density' },
    states: ['focus-visible', 'active', 'selected'],
  },
  'data-filter-builder': { states: ['focus-visible', 'disabled', 'invalid'] },
  'data-grid': {
    axes: { density: 'density' },
    states: ['hover', 'focus-visible', 'disabled', 'loading', 'selected', 'checked', 'readonly'],
  },
  'data-map': { states: ['hover', 'focus-visible', 'active', 'selected'] },
  'data-notification-inbox': {
    states: ['focus-visible', 'active', 'disabled', 'loading'],
  },
  'data-timeline': {
    states: ['focus-visible', 'active', 'disabled', 'loading', 'selected', 'expanded', 'open'],
  },
  'data-tree-view': {
    axes: { density: 'density' },
    states: [
      'focus-visible',
      'active',
      'disabled',
      'loading',
      'invalid',
      'selected',
      'expanded',
      'checked',
    ],
  },
};

/** Applies the part-C stamp. Components with neither axes nor states stay unchanged. */
export function stampDataAxes(manifest: CatalogManifest): CatalogManifest {
  const extra = DATA_AXIS_STAMP[manifest.id];
  return extra ? manifestData({ ...manifest, ...extra }) : manifest;
}
