import { type ClassValue, cx } from '../../internal/cx.ts';
import { variants } from '../../internal/variants.ts';
// The recipe carries its styles: a consumer that composes the primitive with
// these classes (without the styled component) still gets the CSS.
import './dialog.css';

export const DIALOG_SIZES = ['sm', 'md', 'lg', 'xl'] as const;
export type DialogSize = (typeof DIALOG_SIZES)[number];

export const dialogContentClass = variants({
  base: 'tx-dialog',
  variants: {
    size: {
      sm: 'tx-dialog--sm',
      md: 'tx-dialog--md',
      lg: 'tx-dialog--lg',
      xl: 'tx-dialog--xl',
    },
  },
  defaultVariants: {
    size: 'md',
  },
});

export function dialogOverlayClass(input?: { class?: ClassValue }): string {
  return cx('tx-dialog__overlay', input?.class);
}

export function dialogHeaderClass(input?: { class?: ClassValue }): string {
  return cx('tx-dialog__header', input?.class);
}

export function dialogBodyClass(input?: { class?: ClassValue }): string {
  return cx('tx-dialog__body', input?.class);
}

export function dialogFooterClass(input?: { class?: ClassValue }): string {
  return cx('tx-dialog__footer', input?.class);
}

export function dialogTitleClass(input?: { class?: ClassValue }): string {
  return cx('tx-dialog__title', input?.class);
}

export function dialogDescriptionClass(input?: { class?: ClassValue }): string {
  return cx('tx-dialog__description', input?.class);
}

export function dialogCloseClass(input?: { class?: ClassValue }): string {
  return cx('tx-dialog__close', input?.class);
}

export function alertDialogContentClass(input?: {
  class?: ClassValue;
  destructive?: boolean;
}): string {
  return cx('tx-alert-dialog', input?.destructive && 'tx-alert-dialog--destructive', input?.class);
}

export function alertDialogIconClass(input?: { class?: ClassValue }): string {
  return cx('tx-alert-dialog__icon', input?.class);
}

export function alertDialogActionsClass(input?: { class?: ClassValue }): string {
  return cx('tx-alert-dialog__actions', input?.class);
}

export function alertDialogErrorClass(input?: { class?: ClassValue }): string {
  return cx('tx-alert-dialog__error', input?.class);
}
