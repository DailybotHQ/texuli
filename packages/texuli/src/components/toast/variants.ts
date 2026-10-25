import { variants } from '../../internal/variants.ts';
import type { ToastKind } from './types.ts';
// The recipe carries its styles: a consumer that composes the primitive with
// these classes (without the styled component) still gets the CSS.
import './toast.css';

export const TOAST_KINDS = [
  'success',
  'error',
  'info',
  'warning',
] as const satisfies readonly ToastKind[];

export const toastItemClass = variants({
  base: 'tx-toast',
  variants: {
    kind: {
      success: 'tx-toast--success',
      error: 'tx-toast--error',
      info: 'tx-toast--info',
      warning: 'tx-toast--warning',
    },
  },
  defaultVariants: { kind: 'info' },
});

/** Where a Toaster stacks: block edge × logical inline position. */
export const TOASTER_POSITIONS = [
  'top-start',
  'top-center',
  'top-end',
  'bottom-start',
  'bottom-center',
  'bottom-end',
] as const;
export type ToasterPosition = (typeof TOASTER_POSITIONS)[number];

export const toasterClass = variants({
  base: 'tx-toaster',
  variants: {},
  defaultVariants: {},
});
