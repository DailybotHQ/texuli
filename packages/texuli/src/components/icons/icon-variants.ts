import { variants } from '../../internal/variants.ts';
import './icons.css';
import type { IconSize } from './types.ts';

export const ICON_SIZES = {
  xs: 12,
  sm: 16,
  md: 20,
  lg: 24,
} as const satisfies Record<IconSize, number>;

export const iconClass = variants({
  base: 'tx-icon',
  variants: {
    size: {
      xs: 'tx-icon--xs',
      sm: 'tx-icon--sm',
      md: 'tx-icon--md',
      lg: 'tx-icon--lg',
    },
  },
  defaultVariants: { size: 'md' },
});
