export type MediaBlockLabels = {
  invalid: string;
  galleryFallback: string;
};

export type MediaBlockLabelOverrides = Partial<MediaBlockLabels>;

export const DEFAULT_MEDIA_BLOCK_LABELS: MediaBlockLabels = Object.freeze({
  invalid: 'This media block could not be shown.',
  galleryFallback: 'Image unavailable',
});

export function resolveMediaBlockLabels(overrides?: MediaBlockLabelOverrides): MediaBlockLabels {
  if (!overrides) return DEFAULT_MEDIA_BLOCK_LABELS;
  return {
    invalid: overrides.invalid ?? DEFAULT_MEDIA_BLOCK_LABELS.invalid,
    galleryFallback: overrides.galleryFallback ?? DEFAULT_MEDIA_BLOCK_LABELS.galleryFallback,
  };
}
