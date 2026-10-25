/**
 * `@texuli/blocks` media family (T-blocks-media): image, figure, video and
 * gallery. No Svelte is imported eagerly: renderers load through
 * `loadMediaFamily()` (its own chunk) or directly from
 * `@texuli/blocks/media/renderers`.
 */

export { checkMediaBlock, type MediaBlockCheck } from './check.ts';
export {
  isMediaFamilyBlock,
  loadMediaFamily,
  MEDIA_BLOCK_TYPES,
  type MediaBlockViewProps,
  type MediaFamilyBlock,
  type MediaFamilyBlockType,
} from './family.ts';
export {
  DEFAULT_MEDIA_BLOCK_LABELS,
  type MediaBlockLabelOverrides,
  type MediaBlockLabels,
  resolveMediaBlockLabels,
} from './labels.ts';
export { resolveBlockMediaSrc } from './resolve.ts';
