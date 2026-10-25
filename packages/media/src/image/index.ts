/**
 * Framework-free image model and types (T-media-image). The media root
 * re-exports these; the `Image` component lives on the `@texuli/media/image`
 * subpath (`entry.ts`), so the root never pulls in Svelte or component CSS.
 */

export {
  buildSrcset,
  type FocalPoint,
  focalPointPosition,
  IMAGE_FITS,
  IMAGE_LIMITS,
  type ImageFetchPriority,
  type ImageFit,
  type ImageLoader,
  type ImageLoading,
  type ImagePlaceholder,
  type ImageSourceInput,
  type ImageSourceIssue,
  type ImageTrust,
  intrinsicSize,
  normalizeFit,
  normalizeFocalPoint,
  normalizeWidths,
  type ResolvedImageSources,
  type ResolvedPlaceholder,
  resolveImageSources,
  resolvePlaceholder,
  safeSizes,
} from './model.ts';
export type { ImageLabels, ImageProps, ImageStatus } from './types.ts';
