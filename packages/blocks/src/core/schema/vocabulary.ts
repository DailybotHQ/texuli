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

/** Inline alignment of a heading or text block; `start` follows the writing direction. */
export const BLOCK_ALIGNS = ['start', 'center'] as const;
export type BlockAlign = (typeof BLOCK_ALIGNS)[number];

/** Type scale steps of a text block (`md` is the body size). */
export const BLOCK_TEXT_SIZES = ['sm', 'md', 'lg'] as const;
export type BlockTextSize = (typeof BLOCK_TEXT_SIZES)[number];

/** List markers: bullets, numbers, done or open checks, or one icon per item. */
export const LIST_STYLES = ['bullet', 'number', 'check', 'icon'] as const;
export type ListStyle = (typeof LIST_STYLES)[number];

/** A divider is a rule (optionally labeled) or blank space. */
export const DIVIDER_VARIANTS = ['line', 'space'] as const;
export type DividerVariant = (typeof DIVIDER_VARIANTS)[number];

/**
 * Icon names in block data are lowercase kebab-case words (`circle-check`,
 * `rocket`), the naming Lucide and the Texuli built-in icons share. A name is
 * only a token: renderers draw a Texuli built-in icon of that name, or what
 * the host's `resolveIcon` returns, and draw nothing for any other name.
 */
export const BLOCK_ICON_NAME = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;
