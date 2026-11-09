import { manifestData } from '../../manifest/data.ts';
import type { CatalogAxisName, CatalogManifest, CatalogStateName } from '../../manifest/types.ts';

type AxisStamp = {
  readonly axes?: Readonly<Partial<Record<CatalogAxisName, string>>>;
  readonly states?: readonly CatalogStateName[];
};

/**
 * Part C axes and states for the state group (ADR-032). None of these ids
 * have a variant/size/tone/density/color enum. States are confirmed against the
 * player control source.
 */
export const STATE_AXIS_STAMP: Readonly<Record<string, AxisStamp>> = {
  'control-choice': { states: ['disabled', 'checked'] },
  'control-filter': { states: ['disabled'] },
  'control-slider': { states: ['disabled'] },
  'control-toggle': { states: ['disabled', 'checked'] },
  'flow-action': { states: ['disabled'] },
  'form-field': { states: ['invalid'] },
  'form-submit': { states: ['disabled'] },
  'host-region': { states: ['focus-visible'] },
  'sortable-list': { states: ['hover', 'focus-visible', 'disabled'] },
};

/** Applies the part-C stamp. Components with neither axes nor states stay unchanged. */
export function stampStateAxes(manifest: CatalogManifest): CatalogManifest {
  const extra = STATE_AXIS_STAMP[manifest.id];
  return extra ? manifestData({ ...manifest, ...extra }) : manifest;
}
