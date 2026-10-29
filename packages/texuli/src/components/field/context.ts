import { getContext, setContext } from 'svelte';

/**
 * What a Field tells the control rendered inside it. A control that carries
 * its own visible label (DatePicker, DateRangePicker, TimeField) hides it and
 * names itself from the Field label instead, so the label is never shown twice.
 */
export interface FieldLabelContext {
  /** The control id the Field label points at (`<label for>`). */
  readonly id: string;
  /** The Field label's id, for controls named by `aria-labelledby`. */
  readonly labelId: string;
}

const KEY = Symbol('texuli.field');

export function setFieldLabelContext(value: FieldLabelContext): void {
  setContext(KEY, value);
}

/** The enclosing Field, or `undefined` outside one. */
export function getFieldLabelContext(): FieldLabelContext | undefined {
  return getContext<FieldLabelContext | undefined>(KEY);
}
