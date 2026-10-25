/**
 * Native checkbox form participation for the headless control. Mirrors the
 * hide style of `@texuli/core/form-bridge` but uses `type="checkbox"` so
 * unchecked values stay out of FormData.
 */
export type CheckboxFormOptions = {
  name: string;
  value: string;
  checked: boolean;
  required?: boolean;
  disabled?: boolean;
  form?: string;
  focusTarget: HTMLElement;
  onNativeChange?: (checked: boolean) => void;
};

export type CheckboxFormBridge = {
  readonly input: HTMLInputElement;
  setChecked(checked: boolean): void;
  setDisabled(disabled: boolean): void;
  setRequired(required: boolean): void;
  dispose(): void;
};

export function createCheckboxFormBridge(
  ownerDocument: Document,
  options: CheckboxFormOptions
): CheckboxFormBridge {
  const input = ownerDocument.createElement('input');
  input.type = 'checkbox';
  input.name = options.name;
  input.value = options.value;
  input.checked = options.checked;
  input.required = options.required ?? false;
  input.disabled = options.disabled ?? false;
  input.tabIndex = -1;
  input.setAttribute('aria-hidden', 'true');
  input.setAttribute('data-tx-form-bridge', 'checkbox');
  if (options.form) input.setAttribute('form', options.form);

  input.style.position = 'absolute';
  input.style.inlineSize = '1px';
  input.style.blockSize = '1px';
  input.style.padding = '0';
  input.style.margin = '-1px';
  input.style.overflow = 'hidden';
  input.style.clipPath = 'inset(50%)';
  input.style.whiteSpace = 'nowrap';
  input.style.border = '0';

  const onInvalid = () => {
    queueMicrotask(() => options.focusTarget.focus());
  };
  input.addEventListener('invalid', onInvalid);

  const onChange = () => {
    options.onNativeChange?.(input.checked);
  };
  input.addEventListener('change', onChange);

  let disposed = false;
  return {
    input,
    setChecked(checked) {
      input.checked = checked;
    },
    setDisabled(disabled) {
      input.disabled = disabled;
    },
    setRequired(required) {
      input.required = required;
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      input.removeEventListener('invalid', onInvalid);
      input.removeEventListener('change', onChange);
      input.remove();
    },
  };
}
