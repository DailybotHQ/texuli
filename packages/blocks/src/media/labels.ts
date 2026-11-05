export type MediaBlockLabels = {
  invalid: string;
  galleryFallback: string;
};

export type MediaBlockLabelOverrides = Partial<MediaBlockLabels>;

export const DEFAULT_MEDIA_BLOCK_LABELS: MediaBlockLabels = Object.freeze({
  invalid: 'This media block could not be shown.',
  galleryFallback: 'Image unavailable',
});

export function resolveMediaBlockLabels(
  overrides?: MediaBlockLabelOverrides,
  /** The defaults to merge over (the view passes them localized through the catalog in context). */
  defaults: Readonly<MediaBlockLabels> = DEFAULT_MEDIA_BLOCK_LABELS
): MediaBlockLabels {
  if (!overrides) return defaults;
  return {
    invalid: overrides.invalid ?? defaults.invalid,
    galleryFallback: overrides.galleryFallback ?? defaults.galleryFallback,
  };
}
