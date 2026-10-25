import { variants } from '../../internal/variants.ts';
// The recipe carries its styles: a consumer that composes the primitive with
// these classes (without the styled component) still gets the CSS.
import './toolbar.css';

export const TOOLBAR_VARIANTS = ['default', 'outline', 'ghost'] as const;
export type ToolbarVariant = (typeof TOOLBAR_VARIANTS)[number];

export const TOOLBAR_SIZES = ['sm', 'md'] as const;
export type ToolbarSize = (typeof TOOLBAR_SIZES)[number];

export const toolbarRootClass = variants({
  base: 'tx-toolbar',
  variants: {
    variant: {
      default: 'tx-toolbar--default',
      outline: 'tx-toolbar--outline',
      ghost: 'tx-toolbar--ghost',
    },
    size: {
      sm: 'tx-toolbar--sm',
      md: 'tx-toolbar--md',
    },
    orientation: {
      horizontal: 'tx-toolbar--horizontal',
      vertical: 'tx-toolbar--vertical',
    },
  },
  defaultVariants: { variant: 'default', size: 'md', orientation: 'horizontal' },
});

export const toolbarButtonClass = variants({
  base: 'tx-toolbar__button',
  variants: {
    size: {
      sm: 'tx-toolbar__button--sm',
      md: 'tx-toolbar__button--md',
    },
  },
  defaultVariants: { size: 'md' },
});
