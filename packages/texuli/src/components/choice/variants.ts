import { variants } from '../../internal/variants.ts';
// The recipe carries its styles: a consumer that composes the primitive with
// these classes (without the styled component) still gets the CSS.
import './choice.css';

export const CHOICE_SIZES = ['sm', 'md'] as const;
export type ChoiceSize = (typeof CHOICE_SIZES)[number];

export const RADIO_VARIANTS = ['default', 'card'] as const;
export type RadioVariant = (typeof RADIO_VARIANTS)[number];

export const RADIO_ORIENTATIONS = ['vertical', 'horizontal'] as const;
export type RadioOrientation = (typeof RADIO_ORIENTATIONS)[number];

export const choiceControlClass = variants({
  base: 'tx-choice-control',
  variants: {
    size: {
      sm: 'tx-choice-control--sm',
      md: 'tx-choice-control--md',
    },
  },
  defaultVariants: { size: 'md' },
});

export const switchControlClass = variants({
  base: 'tx-switch-control',
  variants: {
    size: {
      sm: 'tx-switch-control--sm',
      md: 'tx-switch-control--md',
    },
  },
  defaultVariants: { size: 'md' },
});

export const radioGroupClass = variants({
  base: 'tx-radio-group',
  variants: {
    orientation: {
      vertical: 'tx-radio-group--vertical',
      horizontal: 'tx-radio-group--horizontal',
    },
    variant: {
      default: 'tx-radio-group--default',
      card: 'tx-radio-group--card',
    },
  },
  defaultVariants: { orientation: 'vertical', variant: 'default' },
});
