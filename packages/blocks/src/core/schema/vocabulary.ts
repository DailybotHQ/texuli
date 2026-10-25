/**
 * Colors in block data are tones, never CSS, hex values or style strings.
 * Renderers map each tone to theme tokens so contrast holds in every theme.
 */
export const BLOCK_TONES = ['neutral', 'accent', 'info', 'success', 'warning', 'danger'] as const;

export type BlockTone = (typeof BLOCK_TONES)[number];

/**
 * Render families. Each one is a lazy UI subpath so a document downloads only
 * the families its blocks use.
 */
export const BLOCK_FAMILIES = [
  'text',
  'media',
  'data',
  'structure',
  'code',
  'diagram',
  'interactive',
  'map',
  'embed',
] as const;

export type BlockFamily = (typeof BLOCK_FAMILIES)[number];

/** True when `value` is one of the block tones. */
export function isBlockTone(value: unknown): value is BlockTone {
  return typeof value === 'string' && (BLOCK_TONES as readonly string[]).includes(value);
}

/** True when `value` is one of the render families. */
export function isBlockFamily(value: unknown): value is BlockFamily {
  return typeof value === 'string' && (BLOCK_FAMILIES as readonly string[]).includes(value);
}

/** Fragment order inside a slide; pages and docs ignore it. */
export const BLOCK_REVEALS = ['fade', 'fade-up', 'grow', 'highlight', 'strike'] as const;
export type BlockReveal = (typeof BLOCK_REVEALS)[number];

export function isBlockReveal(value: unknown): value is BlockReveal {
  return typeof value === 'string' && (BLOCK_REVEALS as readonly string[]).includes(value);
}
