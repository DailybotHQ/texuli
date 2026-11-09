import { manifestData } from '../../manifest/data.ts';
import type { CatalogAxisName, CatalogManifest, CatalogStateName } from '../../manifest/types.ts';

type Stamp = {
  readonly axes?: Readonly<Partial<Record<CatalogAxisName, string>>>;
  readonly states?: readonly CatalogStateName[];
};

/** Audited visual axes and observable states for display components (ADR-032). */
export const DISPLAY_AXIS_STAMP: Readonly<Record<string, Stamp>> = {
  accordion: {
    axes: { variant: 'variant' },
    states: ['hover', 'focus-visible', 'disabled', 'expanded'],
  },
  alert: { axes: { tone: 'tone' }, states: ['hover', 'focus-visible'] },
  'avatar-group-grid': { axes: { size: 'size' } },
  badge: {
    axes: { variant: 'variant' },
    states: ['hover', 'focus-visible', 'disabled', 'selected'],
  },
  banner: { axes: { tone: 'tone' } },
  // Typography and surfaces (ADR-032): static, no observable state.
  box: { axes: { variant: 'surface' } },
  heading: { axes: { size: 'size', tone: 'tone' } },
  prose: { axes: { size: 'size' } },
  text: { axes: { size: 'size', tone: 'tone' } },
  callout: { axes: { tone: 'tone' } },
  card: { axes: { variant: 'variant' }, states: ['hover', 'focus-visible'] },
  chip: { axes: { variant: 'variant' }, states: ['active', 'disabled', 'selected'] },
  code: { axes: { variant: 'variant' }, states: ['hover', 'focus-visible', 'disabled'] },
  'empty-state': { axes: { size: 'size' } },
  kbd: { states: ['hover', 'focus-visible', 'disabled'] },
  kpi: { axes: { variant: 'variant' }, states: ['hover', 'focus-visible', 'loading'] },
  stat: { axes: { variant: 'variant' }, states: ['hover'] },
  stepper: { states: ['focus-visible', 'selected'] },
  tabs: {
    axes: { variant: 'variant' },
    states: ['hover', 'focus-visible', 'disabled', 'selected'],
  },
  table: {
    axes: { variant: 'variant', density: 'density' },
    states: ['focus-visible', 'loading'],
  },
  tag: { axes: { variant: 'variant' }, states: ['hover', 'focus-visible', 'disabled', 'loading'] },
  timeline: { states: ['focus-visible', 'selected'] },
  icon: { axes: { size: 'size', tone: 'tone' } },
  avatar: { axes: { size: 'size' } },
  skeleton: { axes: { size: 'size' }, states: ['loading'] },
  spinner: { axes: { size: 'size', tone: 'tone' }, states: ['loading'] },
  progress: { axes: { size: 'size', tone: 'tone' }, states: ['loading'] },
  carousel: { states: ['hover', 'focus-visible', 'selected'] },
  separator: { axes: { variant: 'variant' } },
  list: {},
  'list-item': { states: ['hover', 'focus-visible', 'disabled', 'selected'] },
  mark: { axes: { tone: 'tone' } },
};

export function stampDisplayAxes(manifest: CatalogManifest): CatalogManifest {
  const stamp = DISPLAY_AXIS_STAMP[manifest.id];
  return stamp ? manifestData({ ...manifest, ...stamp }) : manifest;
}
