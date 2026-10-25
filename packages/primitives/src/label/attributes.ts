/**
 * Pure attribute helpers for Label and Field (T-prim-label). Framework-free:
 * the Svelte parts call these, and tests exercise them without a DOM.
 */

/** What a field knows about itself. */
export interface FieldState {
  controlId: string;
  labelId: string;
  descriptionId: string;
  errorId: string;
  invalid: boolean;
  disabled: boolean;
  required: boolean;
  /** A `Field.Description` is mounted. */
  hasDescription: boolean;
  /** A `Field.Error` is mounted. */
  hasError: boolean;
}

/** `data-*` hooks shared by every field part. */
export function fieldDataAttributes(state: Pick<FieldState, 'invalid' | 'disabled' | 'required'>) {
  return {
    'data-invalid': state.invalid ? '' : undefined,
    'data-disabled': state.disabled ? '' : undefined,
    'data-required': state.required ? '' : undefined,
  };
}

/** Joins id references, dropping empty ones and repeats; `undefined` when none remain. */
export function joinIds(...ids: (string | undefined | null | false)[]): string | undefined {
  const seen = new Set<string>();
  for (const value of ids) {
    if (!value) continue;
    for (const id of value.split(/\s+/)) if (id) seen.add(id);
  }
  return seen.size > 0 ? [...seen].join(' ') : undefined;
}

/**
 * The control's wiring. `aria-describedby` names only parts that are mounted
 * (no dangling id references): the description, then the error while the
 * field is invalid. `extraDescribedBy` keeps the author's own references.
 */
export function controlAttributes(state: FieldState, extraDescribedBy?: string) {
  const showsError = state.invalid && state.hasError;
  return {
    id: state.controlId,
    'aria-describedby': joinIds(
      state.hasDescription && state.descriptionId,
      showsError && state.errorId,
      extraDescribedBy
    ),
    'aria-invalid': state.invalid ? ('true' as const) : undefined,
    'aria-errormessage': showsError ? state.errorId : undefined,
    'aria-required': state.required ? ('true' as const) : undefined,
    required: state.required || undefined,
    disabled: state.disabled || undefined,
    ...fieldDataAttributes(state),
  };
}

const INTERACTIVE =
  'button, input, select, textarea, a[href], [contenteditable=""], [contenteditable="true"]';

/**
 * A double-click on a label selects its text in most browsers. Like native
 * labels in desktop UIs, a label should not: prevent the selection unless
 * the press lands on an interactive element inside the label.
 */
export function shouldPreventLabelSelection(
  event: Pick<MouseEvent, 'detail' | 'target' | 'defaultPrevented'>
): boolean {
  if (event.defaultPrevented || event.detail < 2) return false;
  const target = event.target;
  if (!target || typeof (target as Element).closest !== 'function') return true;
  return (target as Element).closest(INTERACTIVE) === null;
}
