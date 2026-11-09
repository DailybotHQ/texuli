import { variants } from '../../internal/variants.ts';
import './icons.css';
import type { IconSize, IconTone } from './types.ts';

export const ICON_SIZES = {
  xs: 12,
  sm: 16,
  md: 20,
  lg: 24,
} as const satisfies Record<IconSize, number>;

export const ICON_TONES = [
  'default',
  'primary',
  'success',
  'warning',
  'destructive',
  'info',
  'neutral',
] as const satisfies readonly IconTone[];

export const iconClass = variants({
  base: 'tx-icon',
  variants: {
    size: {
      xs: 'tx-icon--xs',
      sm: 'tx-icon--sm',
      md: 'tx-icon--md',
      lg: 'tx-icon--lg',
    },
    tone: {
      default: 'tx-icon--default',
      primary: 'tx-icon--primary',
      success: 'tx-icon--success',
      warning: 'tx-icon--warning',
      destructive: 'tx-icon--destructive',
      info: 'tx-icon--info',
      neutral: 'tx-icon--neutral',
    },
  },
  defaultVariants: { size: 'md', tone: 'default' },
});
