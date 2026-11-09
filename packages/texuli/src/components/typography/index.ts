/**
 * `texuli/typography` (ADR-032): Heading, Text, Prose and Box, the typography and surface
 * components a locked prototype uses instead of typography and visual utilities. Each is a
 * catalog component with its axes, states and root attributes.
 */
export { default as Box } from './Box.svelte';
export { default as Heading } from './Heading.svelte';
export { default as Prose } from './Prose.svelte';
export { default as Text } from './Text.svelte';
export {
  BOX_BORDERS,
  BOX_ELEMENTS,
  BOX_ELEVATIONS,
  BOX_PADDINGS,
  BOX_RADII,
  BOX_SURFACES,
  type BoxBorder,
  type BoxElement,
  type BoxElevation,
  type BoxPadding,
  type BoxRadius,
  type BoxSurface,
  boxClass,
  HEADING_LEVELS,
  HEADING_SIZES,
  HEADING_TONES,
  type HeadingLevel,
  type HeadingSize,
  type HeadingTone,
  headingClass,
  headingSizeOf,
  PROSE_ELEMENTS,
  PROSE_SIZES,
  type ProseElement,
  type ProseSize,
  proseClass,
  TEXT_ALIGNS,
  TEXT_ELEMENTS,
  TEXT_SIZES,
  TEXT_TONES,
  TEXT_TRACKINGS,
  TEXT_TRANSFORMS,
  TEXT_WEIGHTS,
  type TextAlign,
  type TextElement,
  type TextSize,
  type TextTone,
  type TextTracking,
  type TextTransform,
  type TextWeight,
  textClass,
} from './variants.ts';
