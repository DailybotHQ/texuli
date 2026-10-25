/**
 * Schema-agnostic form helpers for Field/Form (no Zod dependency).
 * Map field names to messages, apply native custom validity, and read FormData.
 */

/** Field name → human-readable error message. */
export type FieldErrorMap = Record<string, string>;

/** Result of a validate pass: errors by field name (empty map = valid). */
export type ValidateResult = FieldErrorMap | null | undefined;

/**
 * Normalize unknown validation output into a flat error map.
 * Accepts `{ field: 'msg' }`, `[['field','msg']]`, or a single string under `_form`.
 */
export function toFieldErrorMap(value: unknown): FieldErrorMap {
  if (value == null) return {};
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed ? { _form: trimmed } : {};
  }
  if (Array.isArray(value)) {
    const out: FieldErrorMap = {};
    for (const entry of value) {
      if (Array.isArray(entry) && entry.length >= 2) {
        const key = String(entry[0] ?? '');
        const msg = String(entry[1] ?? '').trim();
        if (key && msg) out[key] = msg;
      }
    }
    return out;
  }
  if (typeof value === 'object') {
    const out: FieldErrorMap = {};
    for (const [key, msg] of Object.entries(value as Record<string, unknown>)) {
      if (typeof msg === 'string' && msg.trim()) out[key] = msg.trim();
    }
    return out;
  }
  return {};
}

/** True when the map has no field messages. */
export function isValidErrorMap(errors: FieldErrorMap): boolean {
  return Object.keys(errors).length === 0;
}

/** Read a form as a plain string record (File values become their names). */
export function formDataToRecord(form: HTMLFormElement | FormData): Record<string, string> {
  const data = form instanceof FormData ? form : new FormData(form);
  const out: Record<string, string> = {};
  data.forEach((value, key) => {
    if (typeof value === 'string') out[key] = value;
    else if (value instanceof File) out[key] = value.name;
  });
  return out;
}

/**
 * Apply or clear `setCustomValidity` on a control so native reportValidity
 * can surface schema-agnostic messages.
 */
export function setNativeCustomValidity(
  control: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | null | undefined,
  message: string | null | undefined
): void {
  if (!control || typeof control.setCustomValidity !== 'function') return;
  control.setCustomValidity(message?.trim() ? message.trim() : '');
}

/** Clear custom validity on every named control in a form. */
export function clearNativeCustomValidity(form: HTMLFormElement): void {
  const controls = form.querySelectorAll<
    HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
  >('input[name], textarea[name], select[name]');
  for (const control of controls) setNativeCustomValidity(control, '');
}

/**
 * Apply an error map onto named controls (by `name` attribute).
 * Unknown keys are ignored (callers may show them via FieldError props).
 */
export function applyNativeCustomValidity(form: HTMLFormElement, errors: FieldErrorMap): void {
  clearNativeCustomValidity(form);
  for (const [name, message] of Object.entries(errors)) {
    if (name === '_form') continue;
    const control = form.elements.namedItem(name);
    if (
      control instanceof HTMLInputElement ||
      control instanceof HTMLTextAreaElement ||
      control instanceof HTMLSelectElement
    ) {
      setNativeCustomValidity(control, message);
    } else if (control instanceof RadioNodeList && control[0] instanceof HTMLInputElement) {
      setNativeCustomValidity(control[0], message);
    }
  }
}

/** First error message for a field, or undefined. */
export function fieldMessage(errors: FieldErrorMap, name: string): string | undefined {
  const msg = errors[name];
  return msg && msg.trim() ? msg : undefined;
}
