import { type ClassValue, cx } from '../../internal/cx.ts';
import { variants } from '../../internal/variants.ts';
// The recipe carries its styles: a consumer that composes the primitive with
// these classes (without the styled component) still gets the CSS.
import './popover.css';

export const POPOVER_VARIANTS = ['elevated', 'flat'] as const;
export type PopoverVariant = (typeof POPOVER_VARIANTS)[number];

export const POPOVER_SIZES = ['sm', 'md', 'lg'] as const;
export type PopoverSize = (typeof POPOVER_SIZES)[number];

export const popoverContentClass = variants({
  base: 'tx-popover',
  variants: {
    variant: {
      elevated: 'tx-popover--elevated',
      flat: 'tx-popover--flat',
    },
    size: {
      sm: 'tx-popover--sm',
      md: 'tx-popover--md',
      lg: 'tx-popover--lg',
    },
  },
  defaultVariants: {
    variant: 'elevated',
    size: 'md',
  },
});

export function popoverTriggerClass(input?: { class?: ClassValue }): string {
  return cx('tx-popover__trigger', input?.class);
}

export function popoverCloseClass(input?: { class?: ClassValue }): string {
  return cx('tx-popover__close', input?.class);
}

export function popoverArrowClass(input?: { class?: ClassValue }): string {
  return cx('tx-popover__arrow', input?.class);
}

export const hoverCardContentClass = variants({
  base: 'tx-hover-card',
  variants: {
    variant: {
      elevated: 'tx-hover-card--elevated',
      flat: 'tx-hover-card--flat',
    },
    size: {
      sm: 'tx-hover-card--sm',
      md: 'tx-hover-card--md',
      lg: 'tx-hover-card--lg',
    },
  },
  defaultVariants: {
    variant: 'elevated',
    size: 'md',
  },
});

export function hoverCardTriggerClass(input?: { class?: ClassValue }): string {
  return cx('tx-hover-card__trigger', input?.class);
}

export function hoverCardArrowClass(input?: { class?: ClassValue }): string {
  return cx('tx-hover-card__arrow', input?.class);
}
