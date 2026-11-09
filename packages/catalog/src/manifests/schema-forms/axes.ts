import { manifestData } from '../../manifest/data.ts';
import type { CatalogAxisName, CatalogManifest, CatalogStateName } from '../../manifest/types.ts';

type AxisStamp = {
  readonly axes?: Readonly<Partial<Record<CatalogAxisName, string>>>;
  readonly states?: readonly CatalogStateName[];
};

/**
 * Part C axes and states for schema-form (ADR-032). Disabled, loading and
 * readonly are props and ARIA on SchemaForm.svelte.
 */
export const SCHEMA_FORMS_AXIS_STAMP: Readonly<Record<string, AxisStamp>> = {
  'schema-form': { states: ['disabled', 'loading', 'readonly'] },
};

/** Applies the part-C stamp. Components with neither axes nor states stay unchanged. */
export function stampSchemaFormsAxes(manifest: CatalogManifest): CatalogManifest {
  const extra = SCHEMA_FORMS_AXIS_STAMP[manifest.id];
  return extra ? manifestData({ ...manifest, ...extra }) : manifest;
}
