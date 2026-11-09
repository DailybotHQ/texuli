import { manifestData } from '../../manifest/data.ts';
import type { CatalogManifest, CatalogStateName } from '../../manifest/types.ts';

type Stamp = { readonly states?: readonly CatalogStateName[] };

/** Audited observable states for content components (ADR-032). */
export const CONTENT_AXIS_STAMP: Readonly<Record<string, Stamp>> = {
  'blocks-code': {
    states: ['hover', 'focus-visible', 'disabled', 'loading', 'invalid', 'selected', 'readonly'],
  },
  'blocks-diagram': { states: ['focus-visible'] },
  'blocks-embed': { states: ['focus-visible', 'disabled', 'loading'] },
  'blocks-interactive': { states: ['disabled', 'checked'] },
  'blocks-map': { states: ['focus-visible', 'active', 'selected'] },
  'blocks-media': { states: ['invalid'] },
  'blocks-structure': { states: ['focus-visible'] },
  'blocks-text': { states: ['focus-visible', 'invalid', 'checked', 'open'] },
  'charts-cartesian': { states: ['open'] },
  'charts-sparkline': { states: ['focus-visible'] },
  'media-composition-canvas': { states: ['focus-visible', 'disabled'] },
  'media-composition-svg': { states: ['focus-visible', 'invalid'] },
  'media-image': { states: ['focus-visible'] },
};

export function stampContentAxes(manifest: CatalogManifest): CatalogManifest {
  const stamp = CONTENT_AXIS_STAMP[manifest.id];
  const axes = manifest.id === 'charts-sparkline' ? { variant: 'variant' as const } : undefined;
  return stamp || axes
    ? manifestData({ ...manifest, ...(axes ? { axes } : {}), ...stamp })
    : manifest;
}
