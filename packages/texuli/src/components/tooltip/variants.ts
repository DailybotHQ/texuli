import { variants } from '../../internal/variants.ts';
// The recipe carries its styles: a consumer that composes the primitive with
// these classes (without the styled component) still gets the CSS.
import './tooltip.css';

export const TOOLTIP_SIDES = ['top', 'right', 'bottom', 'left'] as const;
export type TooltipSide = (typeof TOOLTIP_SIDES)[number];

export const TOOLTIP_ALIGNS = ['start', 'center', 'end'] as const;
export type TooltipAlign = (typeof TOOLTIP_ALIGNS)[number];

export const tooltipContentClass = variants({
  base: 'tx-tooltip',
  variants: {
    side: {
      top: 'tx-tooltip--top',
      right: 'tx-tooltip--right',
      bottom: 'tx-tooltip--bottom',
      left: 'tx-tooltip--left',
    },
  },
  defaultVariants: { side: 'top' },
});
