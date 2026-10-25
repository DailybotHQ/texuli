import { variants } from '../../internal/variants.ts';
// The recipe carries its styles: a consumer that composes the primitive with
// these classes (without the styled component) still gets the CSS.
import './toggle.css';

export const TOGGLE_VARIANTS = ['default', 'outline'] as const;
export type ToggleVariant = (typeof TOGGLE_VARIANTS)[number];

export const TOGGLE_SIZES = ['sm', 'md', 'lg'] as const;
export type ToggleSize = (typeof TOGGLE_SIZES)[number];

export const toggleClass = variants({
  base: 'tx-toggle',
  variants: {
    variant: {
      default: 'tx-toggle--default',
      outline: 'tx-toggle--outline',
    },
    size: {
      sm: 'tx-toggle--sm',
      md: 'tx-toggle--md',
      lg: 'tx-toggle--lg',
    },
  },
  defaultVariants: { variant: 'default', size: 'md' },
});

export const toggleGroupClass = variants({
  base: 'tx-toggle-group',
  variants: {
    orientation: {
      horizontal: 'tx-toggle-group--horizontal',
      vertical: 'tx-toggle-group--vertical',
    },
    variant: {
      default: 'tx-toggle-group--default',
      outline: 'tx-toggle-group--outline',
    },
  },
  defaultVariants: { orientation: 'horizontal', variant: 'default' },
});
