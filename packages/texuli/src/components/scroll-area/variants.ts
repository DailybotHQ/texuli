import { variants } from '../../internal/variants.ts';
// The recipe carries its styles: a consumer that composes the primitive with
// these classes (without the styled component) still gets the CSS.
import './scroll-area.css';

export const SCROLL_AREA_SIZES = ['sm', 'md', 'lg'] as const;
export type ScrollAreaSize = (typeof SCROLL_AREA_SIZES)[number];

export const scrollAreaVariants = variants({
  base: 'tx-scroll-area',
  variants: {
    size: {
      sm: 'tx-scroll-area--sm',
      md: 'tx-scroll-area--md',
      lg: 'tx-scroll-area--lg',
    },
  },
  defaultVariants: { size: 'md' },
});
