import { variants } from '../../internal/variants.ts';
// The recipes carry their styles: a consumer that uses these classes on its own
// elements (without the components) still gets the CSS.
import './typography.css';

/** Heading levels: the semantic `<h1>`…`<h6>` element. */
export const HEADING_LEVELS = [1, 2, 3, 4, 5, 6] as const;
export type HeadingLevel = (typeof HEADING_LEVELS)[number];

/**
 * Heading sizes, independent of the level (the visual scale of the design system). `2xl`,
 * `3xl` and `4xl` sit between the title (`xl`) and `display`: hero and section titles on the
 * font-size scale (`--tx-font-size-2xl`…`4xl`), with the display role's family and weight.
 */
export const HEADING_SIZES = ['display', '4xl', '3xl', '2xl', 'xl', 'lg', 'md', 'sm'] as const;
export type HeadingSize = (typeof HEADING_SIZES)[number];

/** Heading tracking: the role's own (`default`) or `tight` (`--tx-letter-spacing-tight`). */
export const HEADING_TRACKINGS = ['default', 'tight'] as const;
export type HeadingTracking = (typeof HEADING_TRACKINGS)[number];

export const HEADING_TONES = ['default', 'muted'] as const;
export type HeadingTone = (typeof HEADING_TONES)[number];

/** The size a level gets when none is given. */
export function headingSizeOf(level: HeadingLevel): HeadingSize {
  return level === 1 ? 'xl' : level === 2 ? 'lg' : level === 3 ? 'md' : 'sm';
}

/** The elements Text renders: never a heading (use Heading). */
export const TEXT_ELEMENTS = ['p', 'span', 'div', 'label', 'small', 'strong'] as const;
export type TextElement = (typeof TEXT_ELEMENTS)[number];

/**
 * `figure` is a large number outside Stat (the title size of the type scale); `inherit`
 * takes the size and line height of the parent (nested text inside a heading or a label).
 */
export const TEXT_SIZES = ['figure', 'lg', 'md', 'sm', 'xs', 'inherit'] as const;
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
  'inherit',
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

/**
 * The surface fill: the Box's `variant` axis in the catalog. `primary` is the solid primary
 * fill with its on-color, `brand` the soft primary tint with its ink (logo tiles, brand
 * marks), and `translucent` the background at the glass opacity with the glass blur (sticky
 * headers over scrolling content).
 */
export const BOX_SURFACES = [
  'transparent',
  'default',
  'muted',
  'subtle',
  'elevated',
  'primary',
  'brand',
  'translucent',
] as const;
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
    tracking: map(HEADING_TRACKINGS, 'tx-heading--tracking-'),
  },
  defaultVariants: { size: 'lg', tone: 'default', tracking: 'default' },
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
  variants: {
    size: {
      md: 'tx-prose--md',
      lg: 'tx-prose--lg',
    },
  },
  defaultVariants: { size: 'md' },
});

export const boxClass = variants({
  base: 'tx-box',
  variants: {
    padding: {
      none: 'tx-box--pad-none',
      sm: 'tx-box--pad-sm',
      md: 'tx-box--pad-md',
      lg: 'tx-box--pad-lg',
      xl: 'tx-box--pad-xl',
    },
    radius: {
      none: 'tx-box--radius-none',
      sm: 'tx-box--radius-sm',
      md: 'tx-box--radius-md',
      lg: 'tx-box--radius-lg',
      xl: 'tx-box--radius-xl',
      full: 'tx-box--radius-full',
    },
    border: map(BOX_BORDERS, 'tx-box--border-'),
    elevation: {
      none: 'tx-box--elevation-none',
      sm: 'tx-box--elevation-sm',
      md: 'tx-box--elevation-md',
      lg: 'tx-box--elevation-lg',
    },
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
