import { variants } from '../../internal/variants.ts';
// The recipes carry their styles: a consumer that uses these classes on its own
// elements (without the components) still gets the CSS.
import './typography.css';

/** Heading levels: the semantic `<h1>`…`<h6>` element. */
export const HEADING_LEVELS = [1, 2, 3, 4, 5, 6] as const;
export type HeadingLevel = (typeof HEADING_LEVELS)[number];

/** Heading sizes, independent of the level (the visual scale of the design system). */
export const HEADING_SIZES = ['display', 'xl', 'lg', 'md', 'sm'] as const;
export type HeadingSize = (typeof HEADING_SIZES)[number];

export const HEADING_TONES = ['default', 'muted'] as const;
export type HeadingTone = (typeof HEADING_TONES)[number];

/** The size a level gets when none is given. */
export function headingSizeOf(level: HeadingLevel): HeadingSize {
  return level === 1 ? 'xl' : level === 2 ? 'lg' : level === 3 ? 'md' : 'sm';
}

/** The elements Text renders: never a heading (use Heading). */
export const TEXT_ELEMENTS = ['p', 'span', 'div', 'label', 'small', 'strong'] as const;
export type TextElement = (typeof TEXT_ELEMENTS)[number];

/** `figure` is a large number outside Stat (the title size of the type scale). */
export const TEXT_SIZES = ['figure', 'lg', 'md', 'sm', 'xs'] as const;
export type TextSize = (typeof TEXT_SIZES)[number];

export const TEXT_TONES = [
  'default',
  'muted',
  'subtle',
  'primary',
  'success',
  'warning',
  'destructive',
  'info',
] as const;
export type TextTone = (typeof TEXT_TONES)[number];

export const TEXT_WEIGHTS = ['regular', 'medium', 'semibold'] as const;
export type TextWeight = (typeof TEXT_WEIGHTS)[number];

export const TEXT_ALIGNS = ['start', 'center', 'end'] as const;

export const TEXT_TRANSFORMS = ['none', 'uppercase', 'lowercase', 'capitalize'] as const;
export type TextTransform = (typeof TEXT_TRANSFORMS)[number];

/** `wide` is the eyebrow/overline tracking (`--tx-letter-spacing-wide`). */
export const TEXT_TRACKINGS = ['normal', 'wide'] as const;
export type TextTracking = (typeof TEXT_TRACKINGS)[number];
export type TextAlign = (typeof TEXT_ALIGNS)[number];

export const PROSE_SIZES = ['md', 'lg'] as const;
export type ProseSize = (typeof PROSE_SIZES)[number];

export const PROSE_ELEMENTS = ['div', 'article', 'section'] as const;
export type ProseElement = (typeof PROSE_ELEMENTS)[number];

export const BOX_ELEMENTS = ['div', 'section', 'article', 'aside', 'header', 'footer'] as const;
export type BoxElement = (typeof BOX_ELEMENTS)[number];

export const BOX_PADDINGS = ['none', 'sm', 'md', 'lg', 'xl'] as const;
export type BoxPadding = (typeof BOX_PADDINGS)[number];

export const BOX_RADII = ['none', 'sm', 'md', 'lg', 'xl', 'full'] as const;
export type BoxRadius = (typeof BOX_RADII)[number];

/** A full border, or one logical side only (`block-start`, `block-end`) for app headers and footers. */
export const BOX_BORDERS = ['none', 'default', 'strong', 'block-start', 'block-end'] as const;
export type BoxBorder = (typeof BOX_BORDERS)[number];

export const BOX_ELEVATIONS = ['none', 'sm', 'md', 'lg'] as const;
export type BoxElevation = (typeof BOX_ELEVATIONS)[number];

/** The surface fill: the Box's `variant` axis in the catalog. */
export const BOX_SURFACES = ['transparent', 'default', 'muted', 'subtle', 'elevated'] as const;
export type BoxSurface = (typeof BOX_SURFACES)[number];

/** A value of a closed list, or the fallback (a hostile or stale prop never reaches a class). */
export function oneOf<T extends string | number>(
  list: readonly T[],
  value: unknown,
  fallback: T
): T {
  return list.includes(value as T) ? (value as T) : fallback;
}

const map = <T extends string>(list: readonly T[], prefix: string) =>
  Object.fromEntries(list.map((value) => [value, `${prefix}${value}`])) as Record<T, string>;

export const headingClass = variants({
  base: 'tx-heading',
  variants: {
    size: map(HEADING_SIZES, 'tx-heading--'),
    tone: map(HEADING_TONES, 'tx-type-tone--'),
  },
  defaultVariants: { size: 'lg', tone: 'default' },
});

export const textClass = variants({
  base: 'tx-text',
  variants: {
    size: map(TEXT_SIZES, 'tx-text--'),
    tone: map(TEXT_TONES, 'tx-type-tone--'),
    weight: map(TEXT_WEIGHTS, 'tx-text--weight-'),
    align: map(TEXT_ALIGNS, 'tx-text--align-'),
    transform: map(TEXT_TRANSFORMS, 'tx-text--transform-'),
    tracking: map(TEXT_TRACKINGS, 'tx-text--tracking-'),
  },
  defaultVariants: {
    size: 'md',
    tone: 'default',
    weight: 'regular',
    align: 'start',
    transform: 'none',
    tracking: 'normal',
  },
});

export const proseClass = variants({
  base: 'tx-prose',
  variants: { size: map(PROSE_SIZES, 'tx-prose--') },
  defaultVariants: { size: 'md' },
});

export const boxClass = variants({
  base: 'tx-box',
  variants: {
    padding: map(BOX_PADDINGS, 'tx-box--pad-'),
    radius: map(BOX_RADII, 'tx-box--radius-'),
    border: map(BOX_BORDERS, 'tx-box--border-'),
    elevation: map(BOX_ELEVATIONS, 'tx-box--elevation-'),
    surface: map(BOX_SURFACES, 'tx-box--surface-'),
  },
  defaultVariants: {
    padding: 'md',
    radius: 'md',
    border: 'none',
    elevation: 'none',
    surface: 'transparent',
  },
});
