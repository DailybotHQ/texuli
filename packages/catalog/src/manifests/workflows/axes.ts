import { manifestData } from '../../manifest/data.ts';
import type { CatalogAxisName, CatalogManifest, CatalogStateName } from '../../manifest/types.ts';

type AxisStamp = {
  readonly axes?: Readonly<Partial<Record<CatalogAxisName, string>>>;
  readonly states?: readonly CatalogStateName[];
};

/**
 * Part C axes and states for workflow-graph (ADR-032). Mode and flow stay
 * ordinary enums. States are the graph's CSS/ARIA (focus, selection, edit).
 */
export const WORKFLOWS_AXIS_STAMP: Readonly<Record<string, AxisStamp>> = {
  'workflow-graph': {
    states: ['focus-visible', 'disabled', 'invalid', 'selected', 'expanded', 'checked', 'readonly'],
  },
};

/** Applies the part-C stamp. Components with neither axes nor states stay unchanged. */
export function stampWorkflowsAxes(manifest: CatalogManifest): CatalogManifest {
  const extra = WORKFLOWS_AXIS_STAMP[manifest.id];
  return extra ? manifestData({ ...manifest, ...extra }) : manifest;
}
