import { manifestData } from '../../manifest/data.ts';
import type { CatalogAxisName, CatalogManifest, CatalogStateName } from '../../manifest/types.ts';

type AxisStamp = {
  readonly axes?: Readonly<Partial<Record<CatalogAxisName, string>>>;
  readonly states?: readonly CatalogStateName[];
};

/**
 * Part C axes and states for spreadsheet (ADR-032). Focus-visible and
 * readonly are on SheetView; active is the current cell.
 */
export const SHEETS_AXIS_STAMP: Readonly<Record<string, AxisStamp>> = {
  spreadsheet: { states: ['focus-visible', 'active', 'readonly'] },
};

/** Applies the part-C stamp. Components with neither axes nor states stay unchanged. */
export function stampSheetsAxes(manifest: CatalogManifest): CatalogManifest {
  const extra = SHEETS_AXIS_STAMP[manifest.id];
  return extra ? manifestData({ ...manifest, ...extra }) : manifest;
}
