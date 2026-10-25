import { variants } from '../../internal/variants.ts';
// The recipe carries its styles: a consumer that composes the primitive with
// these classes (without the styled component) still gets the CSS.
import './slider.css';

export const SLIDER_SIZES = ['sm', 'md', 'lg'] as const;
export type SliderSize = (typeof SLIDER_SIZES)[number];

export const sliderRootClass = variants({
  base: 'tx-slider',
  variants: {
    size: {
      sm: 'tx-slider--sm',
      md: 'tx-slider--md',
      lg: 'tx-slider--lg',
    },
    orientation: {
      horizontal: 'tx-slider--horizontal',
      vertical: 'tx-slider--vertical',
    },
  },
  defaultVariants: { size: 'md', orientation: 'horizontal' },
});
