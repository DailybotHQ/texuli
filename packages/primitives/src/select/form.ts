import { createFormBridge, type FormBridge } from '@texuli/core/form-bridge';

/** Keep a native text field in sync with the select value for form posts. */
export function attachSelectFormBridge(
  ownerDocument: Document,
  options: {
    name: string;
    value: string;
    required?: boolean;
    disabled?: boolean;
    form?: string;
    focusTarget: HTMLElement;
  }
): FormBridge {
  return createFormBridge(ownerDocument, {
    name: options.name,
    value: options.value,
    defaultValue: options.value,
    required: options.required,
    disabled: options.disabled,
    form: options.form,
    focusTarget: options.focusTarget,
  });
}
