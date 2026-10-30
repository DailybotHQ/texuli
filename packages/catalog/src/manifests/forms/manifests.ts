import { manifestData } from '../../manifest/data.ts';
import type { CatalogManifest } from '../../manifest/types.ts';
import {
  buttonGroupPropNames,
  buttonPropNames,
  checkboxPropNames,
  comboboxPropNames,
  descriptionPropNames,
  fieldErrorPropNames,
  fieldPropNames,
  formPropNames,
  iconButtonPropNames,
  inputGroupPropNames,
  inputPropNames,
  labelPropNames,
  multiSelectPropNames,
  radioGroupPropNames,
  radioPropNames,
  selectContentPropNames,
  selectGroupPropNames,
  selectItemPropNames,
  selectLabelPropNames,
  selectPortalPropNames,
  selectPropNames,
  selectSeparatorPropNames,
  selectTriggerPropNames,
  selectValuePropNames,
  selectViewportPropNames,
  switchPropNames,
  textareaPropNames,
  textCounterPropNames,
  timeFieldPropNames,
} from './prop-names.ts';

const PKG = 'texuli';

/* @__NO_SIDE_EFFECTS__ */
function propsFrom(
  names: readonly string[],
  detail: Record<
    string,
    {
      kind: CatalogManifest['props'][number]['kind'];
      required?: boolean;
      description?: string;
      enumValues?: readonly string[];
      default?: unknown;
      trust?: 'developer' | 'untrusted';
    }
  >
): CatalogManifest['props'] {
  return names.map((name) => {
    const meta = detail[name];
    if (!meta) throw new Error(`Missing prop detail for "${name}"`);
    return {
      name,
      kind: meta.kind,
      ...(meta.required ? { required: true } : {}),
      ...(meta.description ? { description: meta.description } : {}),
      ...(meta.enumValues ? { enumValues: meta.enumValues } : {}),
      ...(meta.default !== undefined ? { default: meta.default } : {}),
      ...(meta.trust ? { trust: meta.trust } : {}),
    };
  });
}

const buttonVariants = ['default', 'secondary', 'outline', 'ghost', 'destructive', 'link'] as const;
const buttonSizes = ['sm', 'md', 'lg', 'icon'] as const;
const choiceSizes = ['sm', 'md'] as const;
const selectSizes = ['sm', 'md', 'lg'] as const;
const selectVariants = ['outline', 'soft'] as const;
const fieldOrientations = ['vertical', 'horizontal'] as const;
const radioOrientations = ['vertical', 'horizontal'] as const;
const radioVariants = ['default', 'card'] as const;

export const buttonManifest = /* @__PURE__ */ manifestData({
  id: 'button',
  package: PKG,
  label: 'Button',
  summary: 'A pressable action control with loading and optional link rendering.',
  tier: 'app',
  agentEmittable: false,
  useWhen: ['Primary and secondary actions', 'Submit and reset controls in forms'],
  dontUseWhen: [
    'An icon-only control (use icon-button)',
    'A toggleable filter chip (use chip)',
    'Navigation that is not an action (use a link or nav item)',
  ],
  a11y: [
    'Real button or link element with an accessible name',
    'Busy state exposes aria-busy and aria-disabled, keeps focus and blocks further activation',
    'Rejected href schemes render as a non-interactive control',
  ],
  props: propsFrom(buttonPropNames, {
    variant: { kind: 'enum', enumValues: buttonVariants, default: 'default' },
    size: { kind: 'enum', enumValues: buttonSizes, default: 'md' },
    href: { kind: 'string', description: 'Optional link target (URL policy)', trust: 'developer' },
    hrefTrust: {
      kind: 'enum',
      enumValues: ['developer', 'untrusted'],
      default: 'developer',
    },
    type: {
      kind: 'enum',
      enumValues: ['button', 'submit', 'reset'],
      default: 'button',
    },
    disabled: { kind: 'boolean', default: false },
    loading: { kind: 'boolean', default: false },
    loadingLabel: { kind: 'string', description: 'Accessible name while loading' },
    autoLoading: {
      kind: 'boolean',
      default: true,
      description: 'Show pending when onclick returns a promise',
    },
    label: {
      kind: 'string',
      description: 'Plain-text label, escaped; replaces children when both are given',
    },
    onclick: { kind: 'event', description: 'Activated handler; may return a promise' },
    class: { kind: 'string' },
    children: { kind: 'slot', description: 'The visible label (an inline-text node in a tree)' },
  }),
  examples: [
    { id: 'default', title: 'Default button', props: { variant: 'default' } },
    { id: 'loading', title: 'Loading button', props: { loading: true, loadingLabel: 'Saving' } },
    {
      id: 'labelled',
      title: 'Labelled submit button',
      props: { type: 'submit', label: 'Save changes' },
    },
  ],
  related: ['icon-button', 'button-group', 'form', 'inline-text'],
});

export const iconButtonManifest = /* @__PURE__ */ manifestData({
  id: 'icon-button',
  package: PKG,
  label: 'IconButton',
  summary: 'An icon-only button that requires an accessible name.',
  tier: 'app',
  agentEmittable: false,
  useWhen: ['Toolbar and dense chrome actions that are icon-only'],
  dontUseWhen: ['Actions with a visible text label (use button)'],
  a11y: 'label is required and becomes aria-label on the control.',
  props: propsFrom(iconButtonPropNames, {
    label: { kind: 'string', required: true, description: 'Accessible name' },
    variant: { kind: 'enum', enumValues: buttonVariants, default: 'ghost' },
    href: { kind: 'string', trust: 'developer' },
    loading: { kind: 'boolean', default: false },
    autoLoading: { kind: 'boolean', default: true },
    disabled: { kind: 'boolean', default: false },
    class: { kind: 'string' },
    children: { kind: 'slot', description: 'Icon content' },
  }),
  examples: [{ id: 'close', title: 'Close icon button', props: { label: 'Close' } }],
  related: ['button', 'button-group'],
});

export const buttonGroupManifest = /* @__PURE__ */ manifestData({
  id: 'button-group',
  package: PKG,
  label: 'ButtonGroup',
  summary: 'Groups related buttons with shared borders and orientation.',
  tier: 'app',
  agentEmittable: false,
  useWhen: ['Cluster related actions that share a single decision'],
  dontUseWhen: ['Unrelated actions across a toolbar (use a plain flex row)'],
  a11y: 'role=group with an optional accessible label.',
  props: propsFrom(buttonGroupPropNames, {
    orientation: {
      kind: 'enum',
      enumValues: ['horizontal', 'vertical'],
      default: 'horizontal',
    },
    attached: { kind: 'boolean', default: true, description: 'Share borders between buttons' },
    label: { kind: 'string', description: 'Accessible name for the group' },
    class: { kind: 'string' },
    children: { kind: 'slot' },
  }),
  examples: [
    {
      id: 'attached',
      title: 'Attached horizontal group',
      props: { orientation: 'horizontal', attached: true, label: 'View mode' },
    },
  ],
  related: ['button', 'icon-button'],
});

export const inputManifest = /* @__PURE__ */ manifestData({
  id: 'input',
  package: PKG,
  label: 'Input',
  summary: 'A single-line text (or file) control with optional clear.',
  tier: 'app',
  agentEmittable: false,
  useWhen: ['Short free-text fields', 'Native file selection'],
  dontUseWhen: [
    'Multi-line text (use textarea)',
    'A labeled field with description and error (wrap in field)',
  ],
  a11y: [
    'Pair with Field or an external label via id/for',
    'Clear control has an accessible name when clearable',
  ],
  props: propsFrom(inputPropNames, {
    type: { kind: 'string', default: 'text', description: 'Native input type' },
    value: { kind: 'string', description: 'Controlled value (bind:value)' },
    files: { kind: 'unknown', description: 'FileList when type=file (bind:files)' },
    ref: { kind: 'unknown', description: 'Element ref for the native input' },
    clearable: { kind: 'boolean', default: false },
    clearLabel: { kind: 'string', default: 'Clear' },
    disabled: { kind: 'boolean', default: false },
    readonly: { kind: 'boolean', default: false },
    onValueChange: { kind: 'event' },
    onClear: { kind: 'event' },
    class: { kind: 'string' },
  }),
  examples: [
    { id: 'text', title: 'Text input', props: { type: 'text', clearable: true } },
    { id: 'email', title: 'Email input', props: { type: 'email' } },
  ],
  related: ['input-group', 'textarea', 'field', 'text-counter'],
});

export const inputGroupManifest = /* @__PURE__ */ manifestData({
  id: 'input-group',
  package: PKG,
  label: 'InputGroup',
  summary: 'An input with start/end adornments and optional clear.',
  tier: 'app',
  agentEmittable: false,
  useWhen: ['Inputs with a unit, icon or trailing action'],
  dontUseWhen: ['A bare input with no adornment (use input)'],
  a11y: 'Invalid state marks the control aria-invalid; clear has an accessible name.',
  props: propsFrom(inputGroupPropNames, {
    start: { kind: 'slot', description: 'Start adornment' },
    end: { kind: 'slot', description: 'End adornment' },
    inputProps: { kind: 'object', description: 'Native attributes for the inner input' },
    value: { kind: 'string' },
    ref: { kind: 'unknown' },
    disabled: { kind: 'boolean', default: false },
    readonly: { kind: 'boolean', default: false },
    invalid: { kind: 'boolean', default: false },
    clearable: { kind: 'boolean', default: false },
    clearLabel: { kind: 'string', default: 'Clear' },
    onValueChange: { kind: 'event' },
    onClear: { kind: 'event' },
    class: { kind: 'string' },
    children: { kind: 'slot' },
  }),
  examples: [{ id: 'search', title: 'Search group', props: { clearable: true } }],
  related: ['input', 'field'],
});

export const textareaManifest = /* @__PURE__ */ manifestData({
  id: 'textarea',
  package: PKG,
  label: 'Textarea',
  summary: 'A multi-line text control with optional autosize.',
  tier: 'app',
  agentEmittable: false,
  useWhen: ['Longer free-text fields (notes, comments, descriptions)'],
  dontUseWhen: ['A single-line value (use input)'],
  a11y: 'Pair with Field or an external label; autosize disables manual resize.',
  props: propsFrom(textareaPropNames, {
    value: { kind: 'string' },
    ref: { kind: 'unknown' },
    autosize: { kind: 'boolean', default: false },
    disabled: { kind: 'boolean', default: false },
    readonly: { kind: 'boolean', default: false },
    rows: { kind: 'number', default: 3 },
    onValueChange: { kind: 'event' },
    class: { kind: 'string' },
  }),
  examples: [{ id: 'autosize', title: 'Autosize textarea', props: { autosize: true, rows: 3 } }],
  related: ['input', 'text-counter', 'field'],
});

export const textCounterManifest = /* @__PURE__ */ manifestData({
  id: 'text-counter',
  package: PKG,
  label: 'TextCounter',
  summary: 'An input or textarea that shows remaining characters near the limit.',
  tier: 'app',
  agentEmittable: false,
  useWhen: ['Bounded free-text with a visible remaining count'],
  dontUseWhen: ['Unbounded text without a max length'],
  a11y: 'Remaining count is exposed via aria-describedby while focused near the limit.',
  props: propsFrom(textCounterPropNames, {
    value: { kind: 'string' },
    tag: { kind: 'enum', enumValues: ['input', 'textarea'], default: 'input' },
    type: { kind: 'string', default: 'text' },
    id: { kind: 'string' },
    name: { kind: 'string' },
    label: { kind: 'string' },
    placeholder: { kind: 'string' },
    maxlength: { kind: 'number', default: 256 },
    showAfter: {
      kind: 'number',
      default: 20,
      description: 'Show the count once this many characters remain',
    },
    rows: { kind: 'number', default: 3 },
    disabled: { kind: 'boolean', default: false },
    readonly: { kind: 'boolean', default: false },
    required: { kind: 'boolean', default: false },
    invalid: { kind: 'boolean', default: false },
    autosize: { kind: 'boolean', default: false },
    remainingLabel: { kind: 'string', default: 'characters left' },
    onValueChange: { kind: 'event' },
    class: { kind: 'string' },
  }),
  examples: [
    {
      id: 'near-limit',
      title: 'Near limit',
      props: { maxlength: 80, showAfter: 20, label: 'Summary' },
    },
  ],
  related: ['input', 'textarea', 'field'],
});

export const fieldManifest = /* @__PURE__ */ manifestData({
  id: 'field',
  package: PKG,
  label: 'Field',
  summary: 'Label, description and error wiring for a single control.',
  tier: 'app',
  agentEmittable: false,
  useWhen: ['Compose a labeled control with optional help and error text'],
  dontUseWhen: ['Standalone chrome without a form control'],
  a11y: [
    'Generates id and aria-describedby for the control snippet',
    'Marks aria-invalid when error is present',
    'hideLabel keeps the label available to assistive tech',
  ],
  props: propsFrom(fieldPropNames, {
    label: { kind: 'string', required: true },
    description: { kind: 'string' },
    error: { kind: 'string', description: 'Error message; marks the control invalid' },
    required: { kind: 'boolean', default: false },
    disabled: { kind: 'boolean', default: false },
    id: { kind: 'string' },
    hideLabel: { kind: 'boolean', default: false },
    orientation: {
      kind: 'enum',
      enumValues: fieldOrientations,
      default: 'vertical',
    },
    class: { kind: 'string' },
    children: {
      kind: 'slot',
      required: true,
      description: 'Control snippet receiving FieldControl',
    },
  }),
  examples: [
    {
      id: 'vertical',
      title: 'Vertical field',
      props: {
        label: 'Email',
        description: 'Work address',
        required: true,
      },
    },
  ],
  related: ['label', 'description', 'field-error', 'form', 'input'],
});

export const labelManifest = /* @__PURE__ */ manifestData({
  id: 'label',
  package: PKG,
  label: 'Label',
  summary: 'A form label with optional required marker and sr-only mode.',
  tier: 'app',
  agentEmittable: false,
  useWhen: ['Label a control outside Field'],
  dontUseWhen: ['A full field stack (use field)'],
  a11y: 'srOnly keeps the label for assistive tech while hiding it visually.',
  props: propsFrom(labelPropNames, {
    required: { kind: 'boolean', default: false },
    size: { kind: 'enum', enumValues: ['sm', 'md'], default: 'md' },
    srOnly: { kind: 'boolean', default: false },
    class: { kind: 'string' },
    children: { kind: 'slot', description: 'The label text (an inline-text node in a tree)' },
  }),
  examples: [{ id: 'required', title: 'Required label', props: { required: true } }],
  related: ['field', 'description', 'inline-text'],
});

export const descriptionManifest = /* @__PURE__ */ manifestData({
  id: 'description',
  package: PKG,
  label: 'Description',
  summary: 'Help text associated with a field control.',
  tier: 'app',
  agentEmittable: false,
  useWhen: ['Short guidance under a label'],
  dontUseWhen: ['An error message (use field-error)'],
  a11y: 'Wire via aria-describedby from Field or the host.',
  props: propsFrom(descriptionPropNames, {
    class: { kind: 'string' },
    children: { kind: 'slot' },
  }),
  examples: [{ id: 'help', title: 'Help text', props: {} }],
  related: ['field', 'label', 'field-error'],
});

export const fieldErrorManifest = /* @__PURE__ */ manifestData({
  id: 'field-error',
  package: PKG,
  label: 'FieldError',
  summary: 'An alert-role error message for a field.',
  tier: 'app',
  agentEmittable: false,
  useWhen: ['Surface a validation error next to a control'],
  dontUseWhen: ['Help text that is not an error (use description)'],
  a11y: 'role=alert; show=false renders nothing while the host keeps aria wiring.',
  props: propsFrom(fieldErrorPropNames, {
    show: { kind: 'boolean', default: true },
    class: { kind: 'string' },
    children: { kind: 'slot' },
  }),
  examples: [{ id: 'message', title: 'Error message', props: { show: true } }],
  related: ['field', 'form'],
});

export const formManifest = /* @__PURE__ */ manifestData({
  id: 'form',
  package: PKG,
  label: 'Form',
  summary: 'A form shell with layout, validation hook and error map.',
  tier: 'app',
  agentEmittable: false,
  useWhen: ['Collect and validate a set of fields before submit'],
  dontUseWhen: ['A single control with no submit (use field alone)'],
  a11y: [
    'Native constraint validation runs unless noValidate is set',
    'Field errors map back onto controls after onValidate',
  ],
  props: propsFrom(formPropNames, {
    layout: { kind: 'enum', enumValues: ['stack', 'grid'], default: 'stack' },
    noValidate: { kind: 'boolean', default: false },
    onValidate: {
      kind: 'event',
      description: 'Return a field→message map (or Promise) to block submit',
    },
    onSubmitValues: {
      kind: 'event',
      description: 'Called after validation succeeds with FormData values',
    },
    errors: { kind: 'object', description: 'Controlled field→message map (bind:errors)' },
    onErrorsChange: { kind: 'event' },
    class: { kind: 'string' },
    children: { kind: 'slot' },
    formError: { kind: 'slot', description: 'Form-level error snippet (e.g. _form message)' },
  }),
  examples: [{ id: 'stack', title: 'Stacked form', props: { layout: 'stack' } }],
  related: ['field', 'button', 'input'],
});

export const checkboxManifest = /* @__PURE__ */ manifestData({
  id: 'checkbox',
  package: PKG,
  label: 'Checkbox',
  summary: 'A binary or indeterminate checkbox with optional label.',
  tier: 'app',
  agentEmittable: false,
  useWhen: ['Independent on/off choices', 'Select-all with indeterminate'],
  dontUseWhen: [
    'A single exclusive choice in a set (use radio-group)',
    'A switch-style setting (use switch)',
  ],
  a11y: 'Visible label is wired with for; description uses aria-describedby.',
  props: propsFrom(checkboxPropNames, {
    checked: { kind: 'boolean', default: false },
    defaultChecked: { kind: 'boolean', default: false },
    indeterminate: { kind: 'boolean', default: false },
    defaultIndeterminate: { kind: 'boolean', default: false },
    name: { kind: 'string' },
    value: { kind: 'string', default: 'on' },
    disabled: { kind: 'boolean', default: false },
    required: { kind: 'boolean', default: false },
    id: { kind: 'string' },
    label: { kind: 'string' },
    description: { kind: 'string' },
    size: { kind: 'enum', enumValues: choiceSizes, default: 'md' },
    onCheckedChange: { kind: 'event' },
    onIndeterminateChange: { kind: 'event' },
    class: { kind: 'string' },
  }),
  examples: [
    { id: 'labeled', title: 'Labeled checkbox', props: { label: 'Subscribe to updates' } },
    {
      id: 'indeterminate',
      title: 'Indeterminate',
      props: { indeterminate: true, label: 'Select all' },
    },
  ],
  related: ['switch', 'radio-group'],
});

export const radioManifest = /* @__PURE__ */ manifestData({
  id: 'radio',
  package: PKG,
  label: 'Radio',
  summary: 'One option inside a RadioGroup.',
  tier: 'app',
  agentEmittable: false,
  useWhen: ['A single exclusive option inside radio-group'],
  dontUseWhen: ['Independent toggles (use checkbox or switch)'],
  a11y: 'value is required; card layout keeps the label associated with the control.',
  props: propsFrom(radioPropNames, {
    value: { kind: 'string', required: true },
    disabled: { kind: 'boolean', default: false },
    id: { kind: 'string' },
    label: { kind: 'string' },
    description: { kind: 'string' },
    size: { kind: 'enum', enumValues: choiceSizes, default: 'md' },
    card: { kind: 'boolean', default: false },
    class: { kind: 'string' },
    children: { kind: 'slot' },
  }),
  examples: [{ id: 'option', title: 'Radio option', props: { value: 'mail', label: 'Email' } }],
  related: ['radio-group', 'checkbox'],
});

export const radioGroupManifest = /* @__PURE__ */ manifestData({
  id: 'radio-group',
  package: PKG,
  label: 'RadioGroup',
  summary: 'A set of exclusive radio options with keyboard roving.',
  tier: 'app',
  agentEmittable: false,
  useWhen: ['Pick exactly one option from a short closed set'],
  dontUseWhen: ['Many options with search (use select or combobox)', 'Independent toggles'],
  a11y: 'Arrow keys move focus; Space selects; loop wraps at the ends.',
  props: propsFrom(radioGroupPropNames, {
    value: { kind: 'string' },
    onValueChange: { kind: 'event' },
    name: { kind: 'string' },
    required: { kind: 'boolean', default: false },
    disabled: { kind: 'boolean', default: false },
    readonly: { kind: 'boolean', default: false },
    orientation: {
      kind: 'enum',
      enumValues: radioOrientations,
      default: 'vertical',
    },
    variant: { kind: 'enum', enumValues: radioVariants, default: 'default' },
    size: { kind: 'enum', enumValues: choiceSizes, default: 'md' },
    items: {
      kind: 'array',
      description: 'Convenience option list; use children with Radio for custom layouts',
    },
    loop: { kind: 'boolean', default: true },
    class: { kind: 'string' },
    children: { kind: 'slot' },
  }),
  examples: [
    {
      id: 'vertical',
      title: 'Vertical group',
      props: {
        orientation: 'vertical',
        items: [
          { value: 'mail', label: 'Email' },
          { value: 'sms', label: 'SMS' },
        ],
      },
    },
  ],
  related: ['radio', 'select', 'checkbox'],
});

export const switchManifest = /* @__PURE__ */ manifestData({
  id: 'switch',
  package: PKG,
  label: 'Switch',
  summary: 'An immediate on/off setting control.',
  tier: 'app',
  agentEmittable: false,
  useWhen: ['Settings that take effect immediately'],
  dontUseWhen: ['A form agreement that must be submitted (use checkbox)'],
  a11y: 'role=switch with aria-checked; label wires the accessible name.',
  props: propsFrom(switchPropNames, {
    checked: { kind: 'boolean', default: false },
    defaultChecked: { kind: 'boolean', default: false },
    name: { kind: 'string' },
    value: { kind: 'string', default: 'on' },
    disabled: { kind: 'boolean', default: false },
    required: { kind: 'boolean', default: false },
    id: { kind: 'string' },
    label: { kind: 'string' },
    description: { kind: 'string' },
    size: { kind: 'enum', enumValues: choiceSizes, default: 'md' },
    onCheckedChange: { kind: 'event' },
    class: { kind: 'string' },
  }),
  examples: [
    { id: 'labeled', title: 'Labeled switch', props: { label: 'Dark mode', checked: true } },
  ],
  related: ['checkbox'],
});

export const selectManifest = /* @__PURE__ */ manifestData({
  id: 'select',
  package: PKG,
  label: 'Select',
  summary: 'A single-value select root with size and variant chrome.',
  tier: 'app',
  agentEmittable: false,
  useWhen: ['Pick one value from a moderate closed list'],
  dontUseWhen: [
    'A short exclusive set that fits on the page (use radio-group)',
    'Free text with suggestions (use combobox)',
  ],
  a11y: [
    'Trigger is a real button; listbox opens on ArrowDown/Enter/Space',
    'Typeahead highlights matching items; Escape closes and restores focus',
  ],
  props: propsFrom(selectPropNames, {
    open: { kind: 'boolean', default: false },
    value: { kind: 'string' },
    defaultValue: { kind: 'string' },
    name: { kind: 'string' },
    disabled: { kind: 'boolean', default: false },
    required: { kind: 'boolean', default: false },
    form: { kind: 'string', description: 'Associated form id' },
    type: { kind: 'enum', enumValues: ['single'], default: 'single' },
    items: {
      kind: 'array',
      description: 'Optional value/label catalog when items are not registered by Select.Item',
    },
    sideOffset: { kind: 'number', default: 4 },
    positioning: { kind: 'boolean', default: true },
    size: { kind: 'enum', enumValues: selectSizes, default: 'md' },
    variant: { kind: 'enum', enumValues: selectVariants, default: 'outline' },
    onOpenChange: { kind: 'event' },
    onValueChange: { kind: 'event' },
    children: { kind: 'slot' },
  }),
  examples: [
    {
      id: 'outline',
      title: 'Outline select',
      props: { size: 'md', variant: 'outline', defaultValue: '' },
    },
  ],
  related: [
    'select-trigger',
    'select-value',
    'select-content',
    'select-item',
    'radio-group',
    'field',
  ],
});

export const selectTriggerManifest = /* @__PURE__ */ manifestData({
  id: 'select-trigger',
  package: PKG,
  label: 'Select.Trigger',
  summary: 'The button that opens a Select listbox.',
  tier: 'app',
  agentEmittable: false,
  useWhen: ['Compose a Select with custom trigger content'],
  dontUseWhen: ['A standalone button outside Select'],
  a11y: 'aria-haspopup=listbox and aria-expanded reflect open state.',
  props: propsFrom(selectTriggerPropNames, {
    size: { kind: 'enum', enumValues: selectSizes, default: 'md' },
    variant: { kind: 'enum', enumValues: selectVariants, default: 'outline' },
    class: { kind: 'string' },
    children: { kind: 'slot' },
  }),
  examples: [
    { id: 'default', title: 'Default trigger', props: { size: 'md', variant: 'outline' } },
  ],
  related: ['select', 'select-value'],
});

export const selectValueManifest = /* @__PURE__ */ manifestData({
  id: 'select-value',
  package: PKG,
  label: 'Select.Value',
  summary: 'Shows the selected label or a placeholder inside the trigger.',
  tier: 'app',
  agentEmittable: false,
  useWhen: ['Display the current Select value'],
  dontUseWhen: ['Static text outside Select'],
  a11y: 'Placeholder is visible text inside the trigger name.',
  props: propsFrom(selectValuePropNames, {
    placeholder: { kind: 'string', default: 'Select…' },
    class: { kind: 'string' },
    children: { kind: 'slot' },
  }),
  examples: [{ id: 'placeholder', title: 'Placeholder', props: { placeholder: 'Choose a plan' } }],
  related: ['select', 'select-trigger'],
});

export const selectContentManifest = /* @__PURE__ */ manifestData({
  id: 'select-content',
  package: PKG,
  label: 'Select.Content',
  summary: 'The positioned listbox surface for Select items.',
  tier: 'app',
  agentEmittable: false,
  useWhen: ['Wrap Select items and groups'],
  dontUseWhen: ['A free-floating popover (use popover)'],
  a11y: 'role=listbox; focus stays in the trigger while the list is open.',
  props: propsFrom(selectContentPropNames, {
    size: { kind: 'enum', enumValues: selectSizes, default: 'md' },
    class: { kind: 'string' },
    children: { kind: 'slot' },
  }),
  examples: [{ id: 'md', title: 'Medium content', props: { size: 'md' } }],
  related: ['select', 'select-item', 'select-viewport'],
});

export const selectItemManifest = /* @__PURE__ */ manifestData({
  id: 'select-item',
  package: PKG,
  label: 'Select.Item',
  summary: 'One selectable option inside Select.Content.',
  tier: 'app',
  agentEmittable: false,
  useWhen: ['Declare a Select option with value and label'],
  dontUseWhen: ['A radio option outside Select (use radio)'],
  a11y: 'role=option; disabled items are skipped by keyboard.',
  props: propsFrom(selectItemPropNames, {
    value: { kind: 'string', required: true },
    label: { kind: 'string', description: 'Accessible and display label when children omitted' },
    disabled: { kind: 'boolean', default: false },
    icon: { kind: 'slot' },
    description: { kind: 'string' },
    class: { kind: 'string' },
    children: { kind: 'slot' },
  }),
  examples: [
    {
      id: 'option',
      title: 'Option',
      props: { value: 'pro', label: 'Pro', description: 'For growing teams' },
    },
  ],
  related: ['select', 'select-content', 'select-group'],
});

export const selectGroupManifest = /* @__PURE__ */ manifestData({
  id: 'select-group',
  package: PKG,
  label: 'Select.Group',
  summary: 'Groups related Select items under an optional label.',
  tier: 'app',
  agentEmittable: false,
  useWhen: ['Cluster related options inside a long Select'],
  dontUseWhen: ['A single flat list of options'],
  a11y: 'role=group; pair with Select.Label for an accessible name.',
  props: propsFrom(selectGroupPropNames, {
    class: { kind: 'string' },
    children: { kind: 'slot' },
  }),
  examples: [{ id: 'group', title: 'Group', props: {} }],
  related: ['select-label', 'select-item'],
});

export const selectLabelManifest = /* @__PURE__ */ manifestData({
  id: 'select-label',
  package: PKG,
  label: 'Select.Label',
  summary: 'A non-interactive heading inside a Select group.',
  tier: 'app',
  agentEmittable: false,
  useWhen: ['Name a Select.Group'],
  dontUseWhen: ['A selectable option (use select-item)'],
  a11y: 'Not focusable; provides visible structure only.',
  props: propsFrom(selectLabelPropNames, {
    class: { kind: 'string' },
    children: { kind: 'slot' },
  }),
  examples: [{ id: 'label', title: 'Group label', props: {} }],
  related: ['select-group'],
});

export const selectSeparatorManifest = /* @__PURE__ */ manifestData({
  id: 'select-separator',
  package: PKG,
  label: 'Select.Separator',
  summary: 'A visual divider between Select groups or items.',
  tier: 'app',
  agentEmittable: false,
  useWhen: ['Separate option clusters inside Select'],
  dontUseWhen: ['Page-level section breaks'],
  a11y: 'Decorative separator; not in the tab order.',
  props: propsFrom(selectSeparatorPropNames, {
    class: { kind: 'string' },
  }),
  examples: [{ id: 'divider', title: 'Divider', props: {} }],
  related: ['select-group', 'select-content'],
});

export const selectPortalManifest = /* @__PURE__ */ manifestData({
  id: 'select-portal',
  package: PKG,
  label: 'Select.Portal',
  summary: 'Portals Select.Content out of overflow-clipped ancestors.',
  tier: 'app',
  agentEmittable: false,
  useWhen: ['Select must escape a scroll or overflow container'],
  dontUseWhen: ['Inline content that fits in-flow'],
  a11y: 'Does not change roles; children keep listbox semantics.',
  props: propsFrom(selectPortalPropNames, {
    children: { kind: 'slot' },
  }),
  examples: [{ id: 'portal', title: 'Portal', props: {} }],
  related: ['select-content'],
});

export const selectViewportManifest = /* @__PURE__ */ manifestData({
  id: 'select-viewport',
  package: PKG,
  label: 'Select.Viewport',
  summary: 'Scrollable viewport inside Select.Content.',
  tier: 'app',
  agentEmittable: false,
  useWhen: ['Long option lists that need an internal scroll region'],
  dontUseWhen: ['Short lists that fit without scrolling'],
  a11y: 'Keeps option focus management inside the listbox.',
  props: propsFrom(selectViewportPropNames, {
    class: { kind: 'string' },
    children: { kind: 'slot' },
  }),
  examples: [{ id: 'viewport', title: 'Viewport', props: {} }],
  related: ['select-content', 'select-item'],
});

const comboboxSizes = ['sm', 'md', 'lg'] as const;
const comboboxVariants = ['outline', 'soft'] as const;

/** Prop details shared by Combobox.Root and MultiSelect.Root. */
const comboboxPropDetail = {
  value: {
    kind: 'unknown',
    description: 'Selected value (a string, or a string array when multiple)',
  },
  defaultValue: {
    kind: 'unknown',
    description: 'Starting selection; a form reset restores it',
  },
  inputValue: { kind: 'string', description: 'Text in the input (bindable)' },
  defaultInputValue: { kind: 'string', default: '' },
  items: { kind: 'array', description: 'Options as { value, label, disabled? }' },
  loadOptions: {
    kind: 'unknown',
    description:
      'Function prop the host passes: (query, signal) => Promise<items> for remote options. Not agent-emittable (functions are not data).',
  },
  filter: {
    kind: 'unknown',
    description:
      'Function prop the host passes: (item, query) => boolean. Replaces the default match (label contains the query, ignoring case); runs on the trimmed, non-empty query; unused with loadOptions. createFoldedFilter builds an accent-insensitive one. Not agent-emittable (functions are not data).',
  },
  multiple: { kind: 'boolean', default: false },
  disabled: {
    kind: 'boolean',
    default: false,
    description: 'Not interactive, not submitted, not validated',
  },
  name: {
    kind: 'string',
    description: 'Form field name: submits the value (one entry per value when multiple)',
  },
  required: {
    kind: 'boolean',
    default: false,
    description: 'Blocks form submission until a value is selected',
  },
  requiredMessage: {
    kind: 'string',
    description:
      'Translated message when required blocks submission (default: the browser message)',
  },
  form: { kind: 'string', description: 'Associated form id' },
  open: { kind: 'boolean', default: false },
  size: { kind: 'enum', enumValues: comboboxSizes, default: 'md' },
  variant: { kind: 'enum', enumValues: comboboxVariants, default: 'outline' },
  class: { kind: 'string' },
  onValueChange: { kind: 'event' },
  onInputValueChange: { kind: 'event' },
  onOpenChange: { kind: 'event' },
  children: { kind: 'slot' },
} as const;

export const comboboxManifest = /* @__PURE__ */ manifestData({
  id: 'combobox',
  package: PKG,
  label: 'Combobox',
  summary: 'A text input that filters a list of options, for one value or several.',
  tier: 'app',
  agentEmittable: false,
  useWhen: [
    'Pick from a long list by typing to filter',
    'Options loaded from a server as the user types',
  ],
  dontUseWhen: [
    'A short closed list (use select or radio-group)',
    'Several values shown as chips (use multi-select)',
  ],
  a11y: [
    'The input keeps focus; aria-activedescendant tracks the highlighted option',
    'Arrow keys move, Enter selects, Escape closes; empty, loading and error states are announced',
    'With required, a rejected form moves focus to the input',
  ],
  props: propsFrom(comboboxPropNames, comboboxPropDetail),
  examples: [
    {
      id: 'form-field',
      title: 'Required form field',
      props: { name: 'city', required: true, requiredMessage: 'Choose a city.', size: 'md' },
    },
  ],
  related: ['multi-select', 'select', 'field', 'form'],
});

export const multiSelectManifest = /* @__PURE__ */ manifestData({
  id: 'multi-select',
  package: PKG,
  label: 'MultiSelect',
  summary: 'A combobox for several values, shown as removable chips.',
  tier: 'app',
  agentEmittable: false,
  useWhen: ['Choose several values from a long list by typing'],
  dontUseWhen: ['One value (use combobox or select)', 'A few independent options (use checkbox)'],
  a11y: [
    'Chips can be removed with their button or Backspace from an empty input',
    'Submits one form entry per selected value',
  ],
  props: propsFrom(multiSelectPropNames, comboboxPropDetail),
  examples: [
    {
      id: 'tags',
      title: 'Tags field',
      props: { name: 'tags', variant: 'outline', size: 'md' },
    },
  ],
  related: ['combobox', 'checkbox', 'field', 'form'],
});

export const timeFieldManifest = /* @__PURE__ */ manifestData({
  id: 'time-field',
  package: PKG,
  label: 'TimeField',
  summary:
    'A labelled time of day typed or stepped by segment (hour, minute, AM/PM), with a 24-hour HH:mm value.',
  tier: 'app',
  agentEmittable: false,
  useWhen: ['A time of day on its own, such as a reminder or an opening hour'],
  dontUseWhen: [
    'A date, or a date and time (use the date pickers)',
    'A duration (use a number field)',
  ],
  a11y: [
    'A labelled group of native number inputs (hour, minute) and an AM/PM select; arrows step the segments',
    'Description and error are linked to the group; an error marks it invalid',
  ],
  props: propsFrom(timeFieldPropNames, {
    label: { kind: 'string', required: true, description: 'Visible label and accessible name' },
    description: { kind: 'string', description: 'Help text under the field' },
    error: { kind: 'string', description: 'Error text; also marks the field invalid' },
    value: {
      kind: 'string',
      description: 'The time as HH:mm (24-hour), or null when empty (bind:value)',
    },
    onValueChange: { kind: 'event' },
    locale: { kind: 'string', default: 'en-US' },
    hourCycle: {
      kind: 'number',
      description: '12 shows AM/PM, 24 does not; default the locale cycle',
    },
    minuteStep: {
      kind: 'number',
      default: 1,
      description: 'Minutes the arrow keys move on the minute segment',
    },
    disabled: { kind: 'boolean', default: false },
    required: { kind: 'boolean', default: false },
    name: { kind: 'string', description: 'Form field name: submits the value' },
    size: { kind: 'enum', enumValues: ['sm', 'md'], default: 'md' },
    labels: {
      kind: 'object',
      description: 'Segment names (hour, minute, dayPeriod) for translation',
    },
    class: { kind: 'string' },
  }),
  examples: [
    {
      id: 'reminder',
      title: 'Reminder time',
      props: { label: 'Reminder', value: '09:30', minuteStep: 15, name: 'reminder' },
    },
  ],
  related: ['field', 'input', 'form'],
});

/** Every form manifest in stable id order. */
export const FORMS_MANIFESTS: readonly CatalogManifest[] = /* @__PURE__ */ Object.freeze([
  buttonManifest,
  buttonGroupManifest,
  checkboxManifest,
  comboboxManifest,
  descriptionManifest,
  fieldManifest,
  fieldErrorManifest,
  formManifest,
  iconButtonManifest,
  inputManifest,
  inputGroupManifest,
  labelManifest,
  multiSelectManifest,
  radioManifest,
  radioGroupManifest,
  selectManifest,
  selectContentManifest,
  selectGroupManifest,
  selectItemManifest,
  selectLabelManifest,
  selectPortalManifest,
  selectSeparatorManifest,
  selectTriggerManifest,
  selectValueManifest,
  selectViewportManifest,
  switchManifest,
  textCounterManifest,
  textareaManifest,
  timeFieldManifest,
]);

/** Map of component id → expected prop names for type/schema parity tests. */
export { FORMS_PROP_NAMES as FORMS_PROP_NAME_MAP } from './prop-names.ts';

export const formsManifestsById = /* @__PURE__ */ Object.freeze(
  /* @__PURE__ */ Object.fromEntries(
    /* @__PURE__ */ FORMS_MANIFESTS.map((manifest) => [manifest.id, manifest])
  ) as Record<string, CatalogManifest>
);
