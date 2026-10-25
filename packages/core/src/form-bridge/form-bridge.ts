/** Options for a native form control backing a custom widget. */
export type FormBridgeOptions = {
  /** Submitted field name. */
  name: string;
  /** Current submitted value. Defaults to the reset value. */
  value?: string;
  /** Value restored by the owning form's reset action. */
  defaultValue?: string;
  /** Participate in native required-field validation. */
  required?: boolean;
  /** Omit the value from submission and constraint validation. */
  disabled?: boolean;
  /** Associate with a form by its id, including forms outside the widget subtree. */
  form?: string;
  /** Called after a non-canceled native form reset. */
  onReset?: (value: string) => void;
  /** Visible custom control to focus when native validation rejects this field. */
  focusTarget: HTMLElement;
};

/** A visually hidden native input plus the small operations custom widgets need. */
export type FormBridge = {
  /** Input to insert beside the custom control. It remains a native text input for validation. */
  readonly input: HTMLInputElement;
  /** Update the submitted value without changing its reset value. */
  setValue(value: string): void;
  /** Set or clear native custom validity; an empty message clears the error. */
  setValidity(message: string): void;
  /** Remove listeners and the backing input. Safe to call more than once. */
  dispose(): void;
};

/**
 * Creates a visually hidden native text input for a custom form control.
 * Supply the owning document explicitly so this remains safe during SSR and
 * works when a control lives inside an iframe. The text input participates in
 * required and custom validity checks; `type="hidden"` would be barred from
 * constraint validation.
 */
export function createFormBridge(ownerDocument: Document, options: FormBridgeOptions): FormBridge {
  const input = ownerDocument.createElement('input');
  input.type = 'text';
  input.name = options.name;
  input.defaultValue = options.defaultValue ?? options.value ?? '';
  input.value = options.value ?? input.defaultValue;
  input.required = options.required ?? false;
  input.disabled = options.disabled ?? false;
  input.tabIndex = -1;
  input.setAttribute('aria-hidden', 'true');
  input.setAttribute('data-tx-form-bridge', '');

  if (options.form) input.setAttribute('form', options.form);

  // Keep the proxy out of the accessibility tree and normal keyboard order;
  // the custom control remains the visible, labelled interaction point.
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

  let disposed = false;
  const onReset = (event: Event) => {
    if (event.target !== input.form || !options.onReset) return;
    queueMicrotask(() => {
      if (!disposed && !event.defaultPrevented) options.onReset?.(input.defaultValue);
    });
  };
  if (options.onReset) ownerDocument.addEventListener('reset', onReset, true);

  return {
    input,
    setValue(value) {
      input.value = value;
    },
    setValidity(message) {
      input.setCustomValidity(message);
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      input.removeEventListener('invalid', onInvalid);
      if (options.onReset) ownerDocument.removeEventListener('reset', onReset, true);
      input.remove();
    },
  };
}
