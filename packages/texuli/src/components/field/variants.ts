import { variants } from '../../internal/variants.ts';
// The recipe carries its styles: a consumer that composes the primitive with
// these classes (without the styled component) still gets the CSS.
import './field.css';

export const FIELD_ORIENTATIONS = ['vertical', 'horizontal'] as const;
export type FieldOrientation = (typeof FIELD_ORIENTATIONS)[number];

export const fieldRootClass = variants({
  base: 'tx-field-root',
  variants: {
    orientation: {
      vertical: 'tx-field-root--vertical',
      horizontal: 'tx-field-root--horizontal',
    },
  },
  defaultVariants: { orientation: 'vertical' },
});

export const labelClass = variants({
  base: 'tx-label',
  variants: {
    size: {
      sm: 'tx-label--sm',
      md: 'tx-label--md',
    },
  },
  defaultVariants: { size: 'md' },
});

export const descriptionClass = variants({
  base: 'tx-description',
  variants: {},
  defaultVariants: {},
});

export const fieldErrorClass = variants({
  base: 'tx-field-error',
  variants: {},
  defaultVariants: {},
});

export const formClass = variants({
  base: 'tx-form',
  variants: {
    layout: {
      stack: 'tx-form--stack',
      grid: 'tx-form--grid',
    },
  },
  defaultVariants: { layout: 'stack' },
});
