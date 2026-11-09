import { manifestData } from '../../manifest/data.ts';
import type { CatalogAxisName, CatalogManifest, CatalogStateName } from '../../manifest/types.ts';

type AxisStamp = {
  readonly axes?: Readonly<Partial<Record<CatalogAxisName, string>>>;
  readonly states?: readonly CatalogStateName[];
};

/**
 * Part C axes and states for the composition group (ADR-032). All four
 * layouts are static: gap/align/ratio stay ordinary enums.
 */
export const COMPOSITION_AXIS_STAMP: Readonly<Record<string, AxisStamp>> = {};

/** Applies the part-C stamp. Components with neither axes nor states stay unchanged. */
export function stampCompositionAxes(manifest: CatalogManifest): CatalogManifest {
  const extra = COMPOSITION_AXIS_STAMP[manifest.id];
  return extra ? manifestData({ ...manifest, ...extra }) : manifest;
}
