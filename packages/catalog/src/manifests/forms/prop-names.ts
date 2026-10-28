/**
 * Canonical public prop names for each form component.
 * Tests assert these equal the catalog schema `props[].name` lists.
 * Keep in sync with the Svelte `Props` / `$props()` surfaces in `texuli`.
 *
 * Only Texuli-authored props are listed (not the full HTML attribute rest surface).
 */

export const buttonPropNames = [
  'variant',
  'size',
  'href',
  'hrefTrust',
  'type',
  'disabled',
  'loading',
  'loadingLabel',
  'autoLoading',
  'label',
  'onclick',
  'class',
  'children',
] as const;

export const iconButtonPropNames = [
  'label',
  'variant',
  'href',
  'loading',
  'autoLoading',
  'disabled',
  'class',
  'children',
] as const;

export const buttonGroupPropNames = [
  'orientation',
  'attached',
  'label',
  'class',
  'children',
] as const;

export const inputPropNames = [
  'type',
  'value',
  'files',
  'ref',
  'clearable',
  'clearLabel',
  'disabled',
  'readonly',
  'onValueChange',
  'onClear',
  'class',
] as const;

export const inputGroupPropNames = [
  'start',
  'end',
  'inputProps',
  'value',
  'ref',
  'disabled',
  'readonly',
  'invalid',
  'clearable',
  'clearLabel',
  'onValueChange',
  'onClear',
  'class',
  'children',
] as const;

export const textareaPropNames = [
  'value',
  'ref',
  'autosize',
  'disabled',
  'readonly',
  'rows',
  'onValueChange',
  'class',
] as const;

export const textCounterPropNames = [
  'value',
  'tag',
  'type',
  'id',
  'name',
  'label',
  'placeholder',
  'maxlength',
  'showAfter',
  'rows',
  'disabled',
  'readonly',
  'required',
  'invalid',
  'autosize',
  'remainingLabel',
  'onValueChange',
  'class',
] as const;

export const fieldPropNames = [
  'label',
  'description',
  'error',
  'required',
  'disabled',
  'id',
  'hideLabel',
  'orientation',
  'class',
  'children',
] as const;

export const labelPropNames = ['required', 'size', 'srOnly', 'class', 'children'] as const;

export const descriptionPropNames = ['class', 'children'] as const;

export const fieldErrorPropNames = ['show', 'class', 'children'] as const;

export const formPropNames = [
  'layout',
  'noValidate',
  'onValidate',
  'onSubmitValues',
  'errors',
  'onErrorsChange',
  'class',
  'children',
  'formError',
] as const;

export const checkboxPropNames = [
  'checked',
  'defaultChecked',
  'indeterminate',
  'defaultIndeterminate',
  'name',
  'value',
  'disabled',
  'required',
  'id',
  'label',
  'description',
  'size',
  'onCheckedChange',
  'onIndeterminateChange',
  'class',
] as const;

export const radioPropNames = [
  'value',
  'disabled',
  'id',
  'label',
  'description',
  'size',
  'card',
  'class',
  'children',
] as const;

export const radioGroupPropNames = [
  'value',
  'onValueChange',
  'name',
  'required',
  'disabled',
  'readonly',
  'orientation',
  'variant',
  'size',
  'items',
  'loop',
  'class',
  'children',
] as const;

export const switchPropNames = [
  'checked',
  'defaultChecked',
  'name',
  'value',
  'disabled',
  'required',
  'id',
  'label',
  'description',
  'size',
  'onCheckedChange',
  'class',
] as const;

export const selectPropNames = [
  'open',
  'value',
  'defaultValue',
  'name',
  'disabled',
  'required',
  'form',
  'type',
  'items',
  'sideOffset',
  'positioning',
  'size',
  'variant',
  'onOpenChange',
  'onValueChange',
  'children',
] as const;

export const selectTriggerPropNames = ['size', 'variant', 'class', 'children'] as const;

export const selectValuePropNames = ['placeholder', 'class', 'children'] as const;

export const selectContentPropNames = ['size', 'class', 'children'] as const;

export const selectItemPropNames = [
  'value',
  'label',
  'disabled',
  'icon',
  'description',
  'class',
  'children',
] as const;

export const selectGroupPropNames = ['class', 'children'] as const;

export const selectLabelPropNames = ['class', 'children'] as const;

export const selectSeparatorPropNames = ['class'] as const;

export const selectPortalPropNames = ['children'] as const;

export const selectViewportPropNames = ['class', 'children'] as const;

/** `Combobox.Root` (styled): the primitive root's props plus size, variant and class. */
export const comboboxPropNames = [
  'value',
  'defaultValue',
  'inputValue',
  'defaultInputValue',
  'items',
  'loadOptions',
  'filter',
  'multiple',
  'disabled',
  'name',
  'required',
  'requiredMessage',
  'form',
  'open',
  'size',
  'variant',
  'class',
  'onValueChange',
  'onInputValueChange',
  'onOpenChange',
  'children',
] as const;

export const timeFieldPropNames = [
  'label',
  'description',
  'error',
  'value',
  'onValueChange',
  'locale',
  'hourCycle',
  'minuteStep',
  'disabled',
  'required',
  'name',
  'size',
  'labels',
  'class',
] as const;

/** `MultiSelect.Root`: the combobox root with `multiple` always on. */
export const multiSelectPropNames = comboboxPropNames.filter(
  (name) => name !== 'multiple'
) as readonly Exclude<(typeof comboboxPropNames)[number], 'multiple'>[];

/** Closed map of form component id → prop name list. */
export const FORMS_PROP_NAMES = {
  button: buttonPropNames,
  'icon-button': iconButtonPropNames,
  'button-group': buttonGroupPropNames,
  input: inputPropNames,
  'input-group': inputGroupPropNames,
  textarea: textareaPropNames,
  'text-counter': textCounterPropNames,
  field: fieldPropNames,
  label: labelPropNames,
  description: descriptionPropNames,
  'field-error': fieldErrorPropNames,
  form: formPropNames,
  checkbox: checkboxPropNames,
  radio: radioPropNames,
  'radio-group': radioGroupPropNames,
  switch: switchPropNames,
  select: selectPropNames,
  'select-trigger': selectTriggerPropNames,
  'select-value': selectValuePropNames,
  'select-content': selectContentPropNames,
  'select-item': selectItemPropNames,
  'select-group': selectGroupPropNames,
  'select-label': selectLabelPropNames,
  'select-separator': selectSeparatorPropNames,
  'select-portal': selectPortalPropNames,
  'select-viewport': selectViewportPropNames,
  combobox: comboboxPropNames,
  'multi-select': multiSelectPropNames,
  'time-field': timeFieldPropNames,
} as const satisfies Record<string, readonly string[]>;

export type FormsManifestId = keyof typeof FORMS_PROP_NAMES;
