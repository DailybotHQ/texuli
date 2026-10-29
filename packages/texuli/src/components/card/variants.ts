import { variants } from '../../internal/variants.ts';
// The recipe carries its styles: a consumer that composes the primitive with
// these classes (without the styled component) still gets the CSS.
import './card.css';

export const CARD_VARIANTS = ['elevated', 'flat'] as const;
export type CardVariant = (typeof CARD_VARIANTS)[number];

export const CARD_GAPS = ['sm', 'md', 'lg'] as const;
export type CardGridGap = (typeof CARD_GAPS)[number];
/**
 * What `CardGrid` `gap` accepts: a class step, the inline steps `none`, `xs`
 * and `xl`, a CSS length or a custom property name (validated in the
 * component).
 */
export type CardGridGapValue = CardGridGap | 'none' | 'xs' | 'xl' | (string & {});

export const cardClass = variants({
  base: 'tx-card',
  variants: {
    variant: {
      elevated: '',
      flat: 'tx-card--flat',
    },
  },
  defaultVariants: { variant: 'elevated' },
});

export const cardGridClass = variants({
  base: 'tx-card-grid',
  variants: {
    gap: {
      sm: 'tx-card-grid--gap-sm',
      md: 'tx-card-grid--gap-md',
      lg: 'tx-card-grid--gap-lg',
    },
  },
  defaultVariants: { gap: 'md' },
});
