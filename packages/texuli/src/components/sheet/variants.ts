import { variants } from '../../internal/variants.ts';
// The recipe carries its styles: a consumer that composes the primitive with
// these classes (without the styled component) still gets the CSS.
import './sheet.css';

export const SHEET_SIZES = ['sm', 'md', 'lg', 'xl'] as const;
export type SheetSize = (typeof SHEET_SIZES)[number];

export const sheetContentClass = variants({
  base: 'tx-sheet',
  variants: {
    size: {
      sm: 'tx-sheet--sm',
      md: 'tx-sheet--md',
      lg: 'tx-sheet--lg',
      xl: 'tx-sheet--xl',
    },
  },
  defaultVariants: { size: 'md' },
});

export const drawerContentClass = variants({
  base: 'tx-drawer',
  variants: {
    size: {
      sm: 'tx-drawer--sm',
      md: 'tx-drawer--md',
      lg: 'tx-drawer--lg',
      xl: 'tx-drawer--xl',
    },
  },
  defaultVariants: { size: 'md' },
});

export const detailPanelContentClass = variants({
  base: 'tx-detail-panel',
  variants: {
    size: {
      sm: 'tx-detail-panel--sm',
      md: 'tx-detail-panel--md',
      lg: 'tx-detail-panel--lg',
      xl: 'tx-detail-panel--xl',
    },
  },
  defaultVariants: { size: 'md' },
});

export const responsiveModalContentClass = variants({
  base: 'tx-responsive-modal',
  variants: {
    size: {
      sm: 'tx-responsive-modal--sm',
      md: 'tx-responsive-modal--md',
      lg: 'tx-responsive-modal--lg',
      xl: 'tx-responsive-modal--xl',
    },
  },
  defaultVariants: { size: 'md' },
});
