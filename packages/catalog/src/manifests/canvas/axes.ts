import { manifestData } from '../../manifest/data.ts';
import type { CatalogManifest, CatalogStateName } from '../../manifest/types.ts';

const CANVAS_AXIS_STAMP: Readonly<
  Record<string, { readonly states?: readonly CatalogStateName[] }>
> = {
  canvas: {
    states: [
      'hover',
      'focus-visible',
      'active',
      'disabled',
      'selected',
      'expanded',
      'checked',
      'open',
      'readonly',
    ],
  },
};

export function stampCanvasAxes(manifest: CatalogManifest): CatalogManifest {
  const stamp = CANVAS_AXIS_STAMP[manifest.id];
  return stamp ? manifestData({ ...manifest, ...stamp }) : manifest;
}
