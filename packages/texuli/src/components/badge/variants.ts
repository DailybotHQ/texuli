import { variants } from '../../internal/variants.ts';
// The recipe carries its styles: a consumer that composes the primitive with
// these classes (without the styled component) still gets the CSS.
import './badge.css';

export const BADGE_VARIANTS = [
  'default',
  'secondary',
  'outline',
  'success',
  'warning',
  'destructive',
  'info',
  'neutral',
] as const;

export type BadgeVariant = (typeof BADGE_VARIANTS)[number];

export const badgeClass = variants({
  base: 'tx-badge',
  variants: {
    variant: {
      default: 'tx-badge--default',
      secondary: 'tx-badge--secondary',
      outline: 'tx-badge--outline',
      success: 'tx-badge--success',
      warning: 'tx-badge--warning',
      destructive: 'tx-badge--destructive',
      info: 'tx-badge--info',
      neutral: 'tx-badge--neutral',
    },
  },
  defaultVariants: { variant: 'default' },
});

export const tagClass = variants({
  base: 'tx-tag tx-badge',
  variants: {
    variant: {
      default: 'tx-badge--default',
      secondary: 'tx-badge--secondary',
      outline: 'tx-badge--outline',
      success: 'tx-badge--success',
      warning: 'tx-badge--warning',
      destructive: 'tx-badge--destructive',
      info: 'tx-badge--info',
      neutral: 'tx-badge--neutral',
    },
  },
  defaultVariants: { variant: 'secondary' },
});

export const chipClass = variants({
  base: 'tx-chip tx-badge',
  variants: {
    variant: {
      default: 'tx-badge--default',
      secondary: 'tx-badge--secondary',
      outline: 'tx-badge--outline',
      success: 'tx-badge--success',
      warning: 'tx-badge--warning',
      destructive: 'tx-badge--destructive',
      info: 'tx-badge--info',
      neutral: 'tx-badge--neutral',
    },
  },
  defaultVariants: { variant: 'outline' },
});
