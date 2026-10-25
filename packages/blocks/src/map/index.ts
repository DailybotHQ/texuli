/**
 * `@texuli/blocks` map family (T-blocks-map): points and an optional route on
 * an offline, fictional basemap. No Svelte or geo engine is imported eagerly:
 * the renderer loads through `loadMapFamily()` (its own chunk) or from
 * `@texuli/blocks/map/renderers`.
 */

export { checkMapBlock, type MapBlockCheck } from './check.ts';
export {
  loadMapFamily,
  MAP_BLOCK_TYPES,
  type MapBlockViewProps,
  type MapFamilyBlockType,
} from './family.ts';
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
