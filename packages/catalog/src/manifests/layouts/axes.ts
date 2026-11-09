import { manifestData } from '../../manifest/data.ts';
import type { CatalogAxisName, CatalogManifest, CatalogStateName } from '../../manifest/types.ts';

type AxisStamp = {
  readonly axes?: Readonly<Partial<Record<CatalogAxisName, string>>>;
  readonly states?: readonly CatalogStateName[];
};

/**
 * Part C axes and states for the layouts group (ADR-032). No layout has a
 * variant/size/tone/density/color enum. States are confirmed against the layout
 * CSS/ARIA; Sidebar.svelte and Card.svelte scans on the shell ids are dropped.
 */
export const LAYOUTS_AXIS_STAMP: Readonly<Record<string, AxisStamp>> = {
  'content-layout': { states: ['hover', 'focus-visible', 'selected'] },
  'layout-auth-split': { states: ['selected'] },
  'layout-chrome': { states: ['focus-visible'] },
  'layout-dashboard-grid': { states: ['hover', 'focus-visible', 'selected'] },
  'layout-drawer': { states: ['focus-visible', 'open'] },
  'layout-dual-sidebar': { states: ['focus-visible'] },
  'layout-host': { states: ['loading'] },
  'layout-landing': { states: ['focus-visible'] },
  'layout-marketing': { states: ['focus-visible'] },
  'layout-pricing': { states: ['focus-visible', 'selected'] },
  'layout-settings': { states: ['hover', 'focus-visible', 'selected'] },
  'layout-sidebar': { states: ['focus-visible'] },
  'layout-top-nav': { states: ['hover', 'focus-visible', 'disabled', 'selected'] },
  'layout-wizard': { states: ['focus-visible', 'disabled', 'selected'] },
  'split-view': { states: ['hover', 'focus-visible', 'selected', 'expanded'] },
};

/** Applies the part-C stamp. Components with neither axes nor states stay unchanged. */
export function stampLayoutsAxes(manifest: CatalogManifest): CatalogManifest {
  const extra = LAYOUTS_AXIS_STAMP[manifest.id];
  return extra ? manifestData({ ...manifest, ...extra }) : manifest;
}
