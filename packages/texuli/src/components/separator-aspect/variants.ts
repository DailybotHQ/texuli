import { variants } from '../../internal/variants.ts';
// The recipe carries its styles: a consumer that composes the primitive with
// these classes (without the styled component) still gets the CSS.
import './separator-aspect.css';

export const SEPARATOR_ORIENTATIONS = ['horizontal', 'vertical'] as const;
export type SeparatorOrientation = (typeof SEPARATOR_ORIENTATIONS)[number];

export const SEPARATOR_VARIANTS = ['default', 'subtle', 'strong'] as const;
export type SeparatorVariant = (typeof SEPARATOR_VARIANTS)[number];

export const ASPECT_RATIOS = ['1/1', '16/9', '4/3', '3/2', '21/9', '9/16'] as const;
export type AspectRatioValue = (typeof ASPECT_RATIOS)[number];

export const separatorClass = variants({
  base: 'tx-separator',
  variants: {
    orientation: {
      horizontal: 'tx-separator--horizontal',
      vertical: 'tx-separator--vertical',
    },
    variant: {
      default: 'tx-separator--default',
      subtle: 'tx-separator--subtle',
      strong: 'tx-separator--strong',
    },
  },
  defaultVariants: { orientation: 'horizontal', variant: 'default' },
});

export const aspectRatioClass = variants({
  base: 'tx-aspect-ratio',
  variants: {
    ratio: {
      '1/1': 'tx-aspect-ratio--1-1',
      '16/9': 'tx-aspect-ratio--16-9',
      '4/3': 'tx-aspect-ratio--4-3',
      '3/2': 'tx-aspect-ratio--3-2',
      '21/9': 'tx-aspect-ratio--21-9',
      '9/16': 'tx-aspect-ratio--9-16',
    },
  },
  defaultVariants: { ratio: '16/9' },
});

export const visuallyHiddenClass = variants({
  base: 'tx-visually-hidden',
  variants: {},
  defaultVariants: {},
});
