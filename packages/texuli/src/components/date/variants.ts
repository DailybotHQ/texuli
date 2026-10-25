import { variants } from '../../internal/variants.ts';
// The recipe carries its styles: a consumer that composes the primitive with
// these classes (without the styled component) still gets the CSS.
import './date.css';

export const DATE_SIZES = ['sm', 'md'] as const;
export type DateSize = (typeof DATE_SIZES)[number];

export const dateFieldClass = variants({
  base: 'tx-date',
  variants: {
    size: { sm: 'tx-date--sm', md: '' },
  },
  defaultVariants: { size: 'md' },
});

export const dateCalendarClass = variants({
  base: 'tx-date-calendar',
  variants: {
    size: { sm: 'tx-date-calendar--sm', md: '' },
  },
  defaultVariants: { size: 'md' },
});
