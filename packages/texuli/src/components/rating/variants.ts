import { variants } from '../../internal/variants.ts';
// The recipe carries its styles: a consumer that composes the primitive with
// these classes (without the styled component) still gets the CSS.
import './rating.css';

export const RATING_SIZES = ['sm', 'md', 'lg'] as const;
export type RatingSize = (typeof RATING_SIZES)[number];

/** Fill color of selected stars, from the token contract. */
export const RATING_TONES = ['warning', 'primary', 'neutral'] as const;
export type RatingTone = (typeof RATING_TONES)[number];

export const ratingClass = variants({
  base: 'tx-rating',
  variants: {
    size: {
      sm: 'tx-rating--sm',
      md: 'tx-rating--md',
      lg: 'tx-rating--lg',
    },
    tone: {
      warning: 'tx-rating--warning',
      primary: 'tx-rating--primary',
      neutral: 'tx-rating--neutral',
    },
  },
  defaultVariants: { size: 'md', tone: 'warning' },
});
