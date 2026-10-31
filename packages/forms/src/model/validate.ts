import {
  createExpressionBudget,
  type Expression,
  type ExpressionBudget,
  type ExpressionEnv,
  evaluateExpression,
  isoDateToDays,
  isTrue,
} from '@texuli/core/expression';
import { matchesFormat } from './formats.ts';
import type { CompiledField, CompiledForm } from './schema.ts';
import type { FormField, FormFile, FormRuleName, FormValue, FormValues } from './types.ts';
import {
  codePoints,
  expressionValueOf,
  isEmptyValue,
  isListType,
  isNumericType,
  isoDateTime,
  isTextType,
  ownValue,
} from './values.ts';

/*
 * Pure form logic: which fields show, which are required and enabled (one
 * pass in document order, since conditions read earlier fields only; a
 * hidden or disabled field reads as empty to the fields after it), and the
 * closed validation rules with their messages. One recalculation shares
 * one expression budget (ADR-015: 10,000,000 steps).
 */

/** Default messages; `{label}`, `{min}`, `{max}` and `{count}` are filled in. */
export const DEFAULT_FORM_MESSAGES = Object.freeze({
  required: '{label} is required.',
  minLength: 'Use at least {min} characters.',
  maxLength: 'Use at most {max} characters.',
  min: 'Enter {min} or more.',
  max: 'Enter {max} or less.',
  step: 'Enter a value in steps of {step}.',
  format: 'Enter a valid {format}.',
  minItems: 'Choose at least {min}.',
  maxItems: 'Choose at most {max}.',
  option: 'Choose one of the options.',
  fileType: 'This file type is not accepted.',
  fileSize: 'Each file must be {max} or smaller.',
  invalid: 'Enter a valid value.',
  validatorMissing: 'This answer cannot be checked right now.',
  validatorFailed: 'This answer could not be checked. Try again.',
  stepFailed: 'This step could not be checked. Try again.',
  minDate: 'Choose {min} or later.',
  maxDate: 'Choose {max} or earlier.',
});

export type FormMessages = { readonly [K in keyof typeof DEFAULT_FORM_MESSAGES]: string };

/** Human names of the formats, for the `{format}` placeholder. */
const FORMAT_NAMES: Readonly<Record<string, string>> = {
  email: 'email address',
  url: 'https:// web address',
  phone: 'phone number',
  'iso-date': 'date (YYYY-MM-DD)',
  time: 'time (HH:MM)',
  'hex-color': 'color like #3366ff',
  digits: 'number using digits only',
  alphanumeric: 'value using letters and digits only',
  slug: 'value using lowercase letters, digits and hyphens',
};

/** Fill `{name}` placeholders with plain text (no patterns, no markup). */
export function formatMessage(
  template: string,
  values: Readonly<Record<string, string | number>>
): string {
  let out = '';
  let i = 0;
  while (i < template.length) {
    const open = template.indexOf('{', i);
    if (open === -1) break;
    const close = template.indexOf('}', open);
    if (close === -1) break;
    const key = template.slice(open + 1, close);
    out += template.slice(i, open);
    out += Object.hasOwn(values, key) ? String(values[key]) : template.slice(open, close + 1);
    i = close + 1;
  }
  return out + template.slice(i);
}

function bytes(size: number): string {
  if (size >= 1_048_576) return `${Math.round((size / 1_048_576) * 10) / 10} MB`;
  if (size >= 1024) return `${Math.round(size / 1024)} KB`;
  return `${size} B`;
}

function acceptsFile(accept: readonly string[], file: FormFile): boolean {
  const name = file.name.toLowerCase();
  const type = file.type.toLowerCase();
  return accept.some((rule) => {
    if (rule.startsWith('.')) return name.endsWith(rule);
    if (rule.endsWith('/*')) return type.startsWith(rule.slice(0, -1));
    return type === rule;
  });
}

/**
 * The first closed-rule problem with one value, as a message, or `null`.
 * `required` is the effective requirement (static or by condition). Host
 * validators are not run here (see the controller).
 */
export function checkFieldValue(
  field: FormField,
  value: FormValue | undefined,
  required: boolean,
  messages: FormMessages = DEFAULT_FORM_MESSAGES
): string | null {
  const say = (
    rule: FormRuleName | 'invalid' | 'minDate' | 'maxDate',
    values: Record<string, string | number> = {}
  ) => {
    const custom =
      rule in (field.messages ?? {}) ? field.messages?.[rule as FormRuleName] : undefined;
    return formatMessage(custom ?? messages[rule], { label: field.label, ...values });
  };
  if (isEmptyValue(value)) return required ? say('required') : null;
  const type = field.type;
  if (isTextType(type) && typeof value === 'string') {
    const length = codePoints(value);
    if (field.minLength !== undefined && length < field.minLength)
      return say('minLength', { min: field.minLength });
    if (field.maxLength !== undefined && length > field.maxLength)
      return say('maxLength', { max: field.maxLength });
    const format = type === 'email' ? 'email' : type === 'url' ? 'url' : field.format;
    const protocols = type === 'url' ? (field.protocols ?? ['https']) : undefined;
    if (format && !matchesFormat(format, value.trim(), protocols ? { protocols } : {})) {
      const name =
        format === 'url' && protocols
          ? protocols.length > 1
            ? 'web address (http:// or https://)'
            : `${protocols[0]}:// web address`
          : (FORMAT_NAMES[format] ?? format.replace(/-/g, ' '));
      return say('format', { format: name });
    }
    return null;
  }
  if (type === 'otp') {
    const length = field.length ?? 6;
    if (typeof value !== 'string' || value.length !== length || !/^\d+$/.test(value))
      return say('format', { format: `${length}-digit code` });
    return null;
  }
  if (type === 'color') {
    return typeof value === 'string' && /^#(?:[0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(value)
      ? null
      : say('invalid');
  }
  if (type === 'datetime') {
    if (isoDateTime(value) === undefined) return say('invalid');
    const text = value as string;
    if (typeof field.min === 'string' && text < field.min)
      return say('minDate', { min: field.min });
    if (typeof field.max === 'string' && text > field.max)
      return say('maxDate', { max: field.max });
    return null;
  }
  if (type === 'custom') return null;
  if (isNumericType(type)) {
    if (typeof value !== 'number') return say('invalid');
    if (typeof field.min === 'number' && value < field.min) return say('min', { min: field.min });
    if (typeof field.max === 'number' && value > field.max) return say('max', { max: field.max });
    if (field.step !== undefined) {
      const base = typeof field.min === 'number' ? field.min : 0;
      const ratio = (value - base) / field.step;
      if (Math.abs(ratio - Math.round(ratio)) > 1e-9 * Math.max(1, Math.abs(ratio))) {
        return say('step', { step: field.step });
      }
    }
    return null;
  }
  if (type === 'date' || type === 'time') {
    if (typeof value !== 'string' || (type === 'date' && isoDateToDays(value) === null))
      return say('invalid');
    if (typeof field.min === 'string' && value < field.min)
      return say(type === 'date' ? 'minDate' : 'min', { min: field.min });
    if (typeof field.max === 'string' && value > field.max)
      return say(type === 'date' ? 'maxDate' : 'max', { max: field.max });
    return null;
  }
  if (type === 'select' || type === 'radio') {
    if (typeof value !== 'string' || !field.options?.some((option) => option.value === value))
      return say('option');
    return null;
  }
  if (isListType(type) || type === 'file') {
    if (!Array.isArray(value)) return say('invalid');
    if (field.minItems !== undefined && value.length < field.minItems)
      return say('minItems', { min: field.minItems });
    if (field.maxItems !== undefined && value.length > field.maxItems)
      return say('maxItems', { max: field.maxItems });
    if (type === 'multiselect') {
      const known = new Set(field.options?.map((option) => option.value));
      if (!(value as readonly string[]).every((item) => known.has(item))) return say('option');
    }
    if (type === 'tags') {
      for (const tag of value as readonly string[]) {
        const length = codePoints(tag);
        if (field.minLength !== undefined && length < field.minLength)
          return say('minLength', { min: field.minLength });
        if (field.maxLength !== undefined && length > field.maxLength)
          return say('maxLength', { max: field.maxLength });
        if (field.format && !matchesFormat(field.format, tag)) {
          return say('format', {
            format: FORMAT_NAMES[field.format] ?? field.format.replace(/-/g, ' '),
          });
        }
      }
    }
    if (type === 'file') {
      for (const file of value as readonly FormFile[]) {
        if (field.accept && !acceptsFile(field.accept, file)) return say('fileType');
        if (field.maxSize !== undefined && file.size > field.maxSize)
          return say('fileSize', { max: bytes(field.maxSize) });
      }
    }
    return null;
  }
  if (type === 'checkbox' || type === 'switch')
    return typeof value === 'boolean' ? null : say('invalid');
  return null;
}

/** The computed state of one field. */
export interface FormFieldState {
  readonly visible: boolean;
  readonly required: boolean;
  readonly enabled: boolean;
}

/** Which steps, sections and fields show, and which fields are required and enabled. */
export interface FormLogicState {
  readonly fields: Readonly<Record<string, FormFieldState>>;
  readonly sections: readonly boolean[];
  readonly steps: readonly boolean[];
}

export interface FormLogicOptions {
  /** The host clock for `today()` in conditions. */
  readonly now?: () => number;
  /** A budget shared with other evaluations of this recalculation. */
  readonly budget?: ExpressionBudget;
}

/** Evaluate every condition of a form for some values, in one pass. */
export function computeFormLogic(
  form: CompiledForm,
  values: FormValues,
  options: FormLogicOptions = {}
): FormLogicState {
  const budget = options.budget ?? createExpressionBudget();
  const effective = new Map<string, unknown>();
  const env: ExpressionEnv = {
    field: (name) => (effective.has(name) ? effective.get(name) : null),
    ...(options.now ? { now: options.now } : {}),
  };
  const holds = (expression: Expression | null) =>
    expression === null || isTrue(evaluateExpression(expression, env, { budget }));
  const steps: boolean[] = [];
  const sections: boolean[] = [];
  const fields: Record<string, FormFieldState> = {};
  // Steps and sections read the fields before them, so each is decided when
  // the walk reaches it, in document order.
  let stepCursor = 0;
  let sectionCursor = 0;
  const reach = (step: number, section: number) => {
    while (stepCursor < form.steps.length && stepCursor <= step) {
      steps[stepCursor] = holds(form.steps[stepCursor]?.show ?? null);
      stepCursor += 1;
    }
    while (sectionCursor < form.sections.length && sectionCursor <= section) {
      const entry = form.sections[sectionCursor];
      sections[sectionCursor] = (steps[entry?.step ?? 0] ?? true) && holds(entry?.show ?? null);
      sectionCursor += 1;
    }
  };
  for (const entry of form.fields) {
    reach(entry.step, entry.section);
    const container =
      entry.section >= 0 ? (sections[entry.section] ?? true) : (steps[entry.step] ?? true);
    const visible = container && holds(entry.show);
    const enabled = visible && holds(entry.enable);
    const required =
      visible &&
      enabled &&
      (entry.field.required === true || (entry.require !== null && holds(entry.require)));
    fields[entry.field.name] = Object.freeze({ visible, required, enabled });
    effective.set(
      entry.field.name,
      visible && enabled ? expressionValueOf(ownValue(values, entry.field.name)) : null
    );
  }
  reach(form.steps.length, form.sections.length);
  return Object.freeze({
    fields: Object.freeze(fields),
    sections: Object.freeze(sections),
    steps: Object.freeze(steps),
  });
}

/** A field's logic state, read as an own member only. */
function ownState(logic: FormLogicState, name: string): FormFieldState | undefined {
  return Object.hasOwn(logic.fields, name) ? logic.fields[name] : undefined;
}

/** The values a submission carries: visible, enabled fields only. */
export function submittedValues(
  form: CompiledForm,
  values: FormValues,
  logic: FormLogicState
): FormValues {
  const out: Record<string, FormValue> = {};
  for (const entry of form.fields) {
    const name = entry.field.name;
    const state = ownState(logic, name);
    const value = ownValue(values, name);
    if (state?.visible && state.enabled && value !== undefined) out[name] = value;
  }
  return Object.freeze(out);
}

export interface FormValidation {
  /** Field errors by name. */
  readonly errors: Readonly<Record<string, string>>;
  /** Rule errors that name no field. */
  readonly formErrors: readonly string[];
}

/**
 * Validate the closed rules of the given fields (default: every visible,
 * enabled field) and the cross-field rules. A rule fails only when its test
 * is `false`; an unknown result passes, since `required` covers empties.
 */
export function validateFormValues(
  form: CompiledForm,
  values: FormValues,
  options: FormLogicOptions & {
    readonly logic?: FormLogicState;
    readonly fields?: readonly string[];
    readonly messages?: FormMessages;
    readonly rules?: boolean;
  } = {}
): FormValidation {
  const budget = options.budget ?? createExpressionBudget();
  const logic = options.logic ?? computeFormLogic(form, values, { ...options, budget });
  const scope = options.fields ? new Set(options.fields) : null;
  const errors: Record<string, string> = {};
  const formErrors: string[] = [];
  for (const entry of form.fields) {
    const name = entry.field.name;
    if (scope && !scope.has(name)) continue;
    const state = ownState(logic, name);
    if (!state?.visible || !state.enabled) continue;
    const error = checkFieldValue(
      entry.field,
      ownValue(values, name),
      state.required,
      options.messages
    );
    if (error) errors[name] = error;
  }
  if (options.rules !== false) {
    const env: ExpressionEnv = {
      field: (name) => {
        const state = ownState(logic, name);
        return state?.visible && state.enabled ? expressionValueOf(ownValue(values, name)) : null;
      },
      ...(options.now ? { now: options.now } : {}),
    };
    for (const { rule, test } of form.rules) {
      if (rule.field && scope && !scope.has(rule.field)) continue;
      if (!rule.field && scope) continue;
      if (rule.field && (errors[rule.field] || !logic.fields[rule.field]?.visible)) continue;
      if (evaluateExpression(test, env, { budget }) !== false) continue;
      if (rule.field) errors[rule.field] = rule.message;
      else formErrors.push(rule.message);
    }
  }
  return Object.freeze({ errors: Object.freeze(errors), formErrors: Object.freeze(formErrors) });
}

/** The visible fields of one step, in order. */
export function stepFields(form: CompiledForm, step: number, logic: FormLogicState): string[] {
  const names = form.steps[step]?.fields ?? [];
  return names.filter((name) => logic.fields[name]?.visible);
}

/** The compiled field for a name. */
export function fieldEntry(form: CompiledForm, name: string): CompiledField | undefined {
  return form.byName.get(name);
}
