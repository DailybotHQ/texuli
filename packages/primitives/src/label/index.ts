/**
 * `@texuli/primitives/label` (T-prim-label): Label and Field, headless.
 * `Label.Root` names a control; `Field.*` wires a control to its label,
 * description and error (`aria-describedby`, `aria-invalid`).
 */

export {
  controlAttributes,
  type FieldState,
  fieldDataAttributes,
  joinIds,
  shouldPreventLabelSelection,
} from './attributes.ts';
export { type FieldContextValue, fieldContext } from './context.ts';
export { default as FieldControl } from './FieldControl.svelte';
export { default as FieldDescription } from './FieldDescription.svelte';
export { default as FieldError } from './FieldError.svelte';
export { default as FieldLabel } from './FieldLabel.svelte';
export { default as FieldRoot } from './FieldRoot.svelte';
export * as Field from './field-parts.ts';
export { default as LabelRoot } from './LabelRoot.svelte';
export * as Label from './label-parts.ts';
