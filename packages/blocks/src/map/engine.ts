/**
 * `@texuli/blocks/map/engine` — Svelte-free map parsers, limits, labels and view-model.
 */

import type { FieldIssue } from '../core/schema/primitives.ts';
import type { MapBlockLabelOverrides } from './labels.ts';

export { checkMapBlock, type MapBlockCheck } from './check.ts';
export {
  DEFAULT_MAP_BLOCK_LABELS,
  formatMapLabel,
  type MapBlockLabelOverrides,
  type MapBlockLabels,
  resolveMapBlockLabels,
} from './labels.ts';
export {
  isMapBlock,
  MAP_BASEMAPS,
  MAP_LIMITS,
  type MapBasemapId,
  type MapBlock,
  type MapPoint,
  parseMapBlock,
} from './schema.ts';
export * from './view-model.ts';

export const MAP_BLOCK_TYPES = ['map'] as const;
export type MapFamilyBlockType = (typeof MAP_BLOCK_TYPES)[number];

export interface MapBlockViewProps {
  block: unknown;
  labels?: MapBlockLabelOverrides;
  locale?: string;
  headingLevel?: 2 | 3 | 4 | 5 | 6;
  oninvalid?: (issues: FieldIssue[]) => void;
  onselect?: (pointId: string) => void;
}
