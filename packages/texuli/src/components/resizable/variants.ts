import { variants } from '../../internal/variants.ts';
// The recipe carries its styles: a consumer that composes the primitive with
// these classes (without the styled component) still gets the CSS.
import './resizable.css';

export const RESIZABLE_VARIANTS = ['plain', 'bordered'] as const;
export type ResizableVariant = (typeof RESIZABLE_VARIANTS)[number];

export const RESIZABLE_HANDLE_SIZES = ['sm', 'md'] as const;
export type ResizableHandleSize = (typeof RESIZABLE_HANDLE_SIZES)[number];

export const resizableGroupClass = variants({
  base: 'tx-resizable',
  variants: {
    variant: {
      plain: 'tx-resizable--plain',
      bordered: 'tx-resizable--bordered',
    },
  },
  defaultVariants: { variant: 'plain' },
});

export const resizableHandleClass = variants({
  base: 'tx-resizable__handle',
  variants: {
    size: {
      sm: 'tx-resizable__handle--sm',
      md: 'tx-resizable__handle--md',
    },
  },
  defaultVariants: { size: 'md' },
});

export const resizablePanelClass = variants({ base: 'tx-resizable__panel' });
