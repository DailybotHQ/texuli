import { manifestData } from '../../manifest/data.ts';
import type { CatalogManifest, CatalogStateName } from '../../manifest/types.ts';

const DOCUMENTS_AXIS_STAMP: Readonly<
  Record<string, { readonly states?: readonly CatalogStateName[] }>
> = {
  document: { states: ['checked', 'open'] },
};

export function stampDocumentsAxes(manifest: CatalogManifest): CatalogManifest {
  const stamp = DOCUMENTS_AXIS_STAMP[manifest.id];
  return stamp ? manifestData({ ...manifest, ...stamp }) : manifest;
}
