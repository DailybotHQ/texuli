import { variants } from '../../internal/variants.ts';
// The recipe carries its styles: a consumer that composes the primitive with
// these classes (without the styled component) still gets the CSS.
import './number-pin.css';

export const NUMBER_PIN_SIZES = ['sm', 'md', 'lg'] as const;
export type NumberPinSize = (typeof NUMBER_PIN_SIZES)[number];

export const numberFieldClass = variants({
  base: 'tx-number-field',
  variants: {
    size: {
      sm: 'tx-number-field--sm',
      md: 'tx-number-field--md',
      lg: 'tx-number-field--lg',
    },
  },
  defaultVariants: { size: 'md' },
});

export const pinInputClass = variants({
  base: 'tx-pin-input',
  variants: {
    size: {
      sm: 'tx-pin-input--sm',
      md: 'tx-pin-input--md',
      lg: 'tx-pin-input--lg',
    },
  },
  defaultVariants: { size: 'md' },
});
