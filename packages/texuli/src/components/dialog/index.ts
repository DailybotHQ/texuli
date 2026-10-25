/**
 * Styled Dialog and AlertDialog on the token contract.
 * Built on `@texuli/primitives/dialog` and `@texuli/primitives/alert-dialog`.
 */

export { default as AlertDialog } from './AlertDialog.svelte';
export { default as Dialog } from './Dialog.svelte';
export {
  alertDialogActionsClass,
  alertDialogContentClass,
  alertDialogErrorClass,
  alertDialogIconClass,
  DIALOG_SIZES,
  type DialogSize,
  dialogBodyClass,
  dialogCloseClass,
  dialogContentClass,
  dialogDescriptionClass,
  dialogFooterClass,
  dialogHeaderClass,
  dialogOverlayClass,
  dialogTitleClass,
} from './variants.ts';
