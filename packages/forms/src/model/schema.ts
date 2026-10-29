import {
  analyzeExpression,
  CORE_FUNCTIONS,
  type Expression,
  type ExpressionType,
  parseExpression,
} from '@texuli/core/expression';
import { type HrefTrust, safeHref } from '@texuli/core/url-policy';
import {
  FORM_AUTOCOMPLETE,
  FORM_FIELD_TYPES,
  FORM_FORMATS,
  FORM_ID,
  FORM_LIMITS,
  FORM_NAME,
  FORM_RULE_NAMES,
  FORM_VALIDATOR_NAME,
  type FormField,
  type FormFieldType,
  type FormOption,
  type FormRule,
  type FormSchema,
  type FormSchemaIssue,
  type FormSchemaIssueCode,
  type FormSection,
  type FormStep,
} from './types.ts';
import {
  coerceValue,
  expressionTypeOf,
  hasOptions,
  isListType,
  isNumericType,
  isTextType,
} from './values.ts';

/*
 * The schema validator: reads an untrusted value as a form schema and returns
 * a compiled form, or issues with JSON paths. Closed: unknown members,
 * types, formats and autocomplete tokens are refused; each constraint must
 * apply to its field type; names are unique; help links pass the URL policy
 * at the given tier; every condition and rule is a valid expression of the
 * core language over declared fields, typed boolean, and a condition may
 * only read fields declared before it (so visibility resolves in one pass,
 * with no cycles). The walk is linear in the schema, which the caps bound.
 */

/** A compiled field: the field plus its place and its compiled conditions. */
export interface CompiledField {
  readonly field: FormField;
  /** Document order across the whole form. */
  readonly index: number;
  /** Index into `CompiledForm.steps`. */
  readonly step: number;
  /** Index into `CompiledForm.sections`, or -1. */
  readonly section: number;
  readonly show: Expression | null;
  readonly require: Expression | null;
  readonly enable: Expression | null;
}

export interface CompiledSection {
  readonly id: string;
  readonly title: string | undefined;
  readonly description: string | undefined;
  readonly step: number;
  readonly show: Expression | null;
  readonly fields: readonly string[];
}

export interface CompiledStep {
  readonly id: string;
  readonly title: string;
  readonly description: string | undefined;
  readonly show: Expression | null;
  readonly fields: readonly string[];
  readonly sections: readonly number[];
}

export interface CompiledRule {
  readonly rule: FormRule;
  readonly test: Expression;
}

/** A validated form, ready for `createFormController` and the view. */
export interface CompiledForm {
  readonly schema: FormSchema;
  readonly fields: readonly CompiledField[];
  readonly byName: ReadonlyMap<string, CompiledField>;
  readonly sections: readonly CompiledSection[];
  /** At least one; a one-page form has a single step with the form's title. */
  readonly steps: readonly CompiledStep[];
  readonly rules: readonly CompiledRule[];
  /** Whether the schema declared `steps`. */
  readonly multiStep: boolean;
}

export interface FormSchemaOptions {
  /** The tier help links are checked at: `untrusted` (default, agent or user schemas) or `developer`. */
  readonly tier?: HrefTrust;
  /** When given, `validator` names must be in this list (the validators the host registered). */
  readonly validators?: readonly string[];
}

export type FormSchemaResult =
  | { readonly ok: true; readonly form: CompiledForm; readonly issues: readonly [] }
  | { readonly ok: false; readonly form: null; readonly issues: readonly FormSchemaIssue[] };

const FORM_MEMBERS = [
  'title',
  'description',
  'submitLabel',
  'fields',
  'sections',
  'steps',
  'rules',
];
const STEP_MEMBERS = ['id', 'title', 'description', 'when', 'fields', 'sections'];
const SECTION_MEMBERS = ['id', 'title', 'description', 'when', 'fields'];
const RULE_MEMBERS = ['id', 'test', 'message', 'field'];
const FIELD_MEMBERS = [
  'name',
  'type',
  'label',
  'description',
  'placeholder',
  'default',
  'options',
  'required',
  'when',
  'minLength',
  'maxLength',
  'min',
  'max',
  'step',
  'minItems',
  'maxItems',
  'format',
  'validator',
  'messages',
  'rows',
  'accept',
  'maxSize',
  'autocomplete',
  'link',
];

/** Which field types each constraint applies to. */
const APPLIES: Readonly<Record<string, (type: FormFieldType) => boolean>> = {
  options: hasOptions,
  minLength: (t) => isTextType(t) || t === 'tags',
  maxLength: (t) => isTextType(t) || t === 'tags',
  min: (t) => isNumericType(t) || t === 'date' || t === 'time',
  max: (t) => isNumericType(t) || t === 'date' || t === 'time',
  step: isNumericType,
  minItems: (t) => isListType(t) || t === 'file',
  maxItems: (t) => isListType(t) || t === 'file',
  format: (t) => t === 'text' || t === 'textarea' || t === 'tags',
  placeholder: (t) => isTextType(t) || t === 'number' || t === 'select' || t === 'tags',
  rows: (t) => t === 'textarea',
  accept: (t) => t === 'file',
  maxSize: (t) => t === 'file',
  autocomplete: (t) => isTextType(t) || t === 'number' || t === 'date' || t === 'select',
  default: (t) => t !== 'file',
};

const ACCEPT = /^(?:[a-z]+\/(?:\*|[a-z0-9][a-z0-9.+-]{0,63})|\.[a-z0-9]{1,10})$/;
const ISO_TIME = /^(?:[01]\d|2[0-3]):[0-5]\d$/;
const MAX_ISSUES = 50;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** Validate and compile a form schema. Never throws. */
export function validateFormSchema(
  input: unknown,
  options: FormSchemaOptions = {}
): FormSchemaResult {
  const tier: HrefTrust = options.tier ?? 'untrusted';
  const allowedValidators = options.validators ? new Set(options.validators) : null;
  const issues: FormSchemaIssue[] = [];
  const report = (code: FormSchemaIssueCode, path: string, message: string) => {
    if (issues.length < MAX_ISSUES) issues.push(Object.freeze({ code, path, message }));
  };
  const full = () => issues.length >= MAX_ISSUES;

  const closed = (value: Record<string, unknown>, allowed: readonly string[], path: string) => {
    for (const key of Object.keys(value)) {
      if (!allowed.includes(key)) {
        report(
          'unknown-member',
          `${path}.${key.slice(0, 64)}`,
          `"${key.slice(0, 64)}" is not part of a form schema here.`
        );
      }
    }
  };

  const text = (
    value: unknown,
    path: string,
    max: number,
    required: boolean
  ): string | undefined => {
    if (value === undefined) {
      if (required) report('missing', path, 'This text is required.');
      return undefined;
    }
    if (typeof value !== 'string') {
      report('shape', path, 'Expected a string.');
      return undefined;
    }
    if (required && value.trim().length === 0) {
      report('missing', path, 'This text cannot be blank.');
      return undefined;
    }
    if (value.length > max) {
      report('too-long', path, `At most ${max} characters.`);
      return undefined;
    }
    for (let i = 0; i < value.length; i += 1) {
      const code = value.charCodeAt(i);
      if ((code < 32 && code !== 9 && code !== 10 && code !== 13) || code === 127) {
        report('text', path, 'Control characters are not allowed.');
        return undefined;
      }
    }
    return value;
  };

  const integer = (value: unknown, path: string, min: number, max: number): number | undefined => {
    if (value === undefined) return undefined;
    if (typeof value !== 'number' || !Number.isInteger(value) || value < min || value > max) {
      report('range', path, `An integer from ${min} to ${max}.`);
      return undefined;
    }
    return value;
  };

  // Field types declared so far, in document order (conditions read only these).
  const declared: Record<string, ExpressionType> = {};
  const names = new Set<string>();
  const fields: CompiledField[] = [];
  const sections: CompiledSection[] = [];
  const steps: CompiledStep[] = [];
  // Steps and sections share one id space; rules have their own.
  const ids = new Set<string>();
  const ruleIds = new Set<string>();

  const condition = (
    value: unknown,
    path: string,
    scope: Readonly<Record<string, ExpressionType>>,
    allFields: ReadonlySet<string> | null
  ): Expression | null => {
    const parsed = parseExpression(value, { functions: CORE_FUNCTIONS });
    if (!parsed.ok) {
      for (const d of parsed.diagnostics.slice(0, 5)) {
        report('expression', `${path}${d.path.slice(1)}`, d.message);
      }
      return null;
    }
    const analysis = analyzeExpression(parsed.expression, {
      fields: scope,
      functions: CORE_FUNCTIONS,
      expect: 'boolean',
    });
    let ok = true;
    for (const d of analysis.diagnostics.slice(0, 5)) {
      ok = false;
      const name = d.code === 'unknown-field' ? /"([^"]+)"/.exec(d.message)?.[1] : undefined;
      if (name && allFields?.has(name)) {
        report(
          'forward-reference',
          `${path}${d.path.slice(1)}`,
          `"${name}" is declared later (or is this field); conditions read earlier fields only.`
        );
      } else report('expression', `${path}${d.path.slice(1)}`, d.message);
    }
    return ok ? parsed.expression : null;
  };

  const whenOf = (
    value: unknown,
    path: string,
    allowed: readonly ('show' | 'require' | 'enable')[]
  ): { show: Expression | null; require: Expression | null; enable: Expression | null } => {
    const out = { show: null, require: null, enable: null } as {
      show: Expression | null;
      require: Expression | null;
      enable: Expression | null;
    };
    if (value === undefined) return out;
    if (!isRecord(value)) {
      report('shape', path, 'Expected an object with show, require or enable.');
      return out;
    }
    closed(value, allowed, path);
    for (const key of allowed) {
      if (value[key] !== undefined)
        out[key] = condition(value[key], `${path}.${key}`, declared, allNames);
    }
    return out;
  };

  const optionsOf = (value: unknown, path: string): FormOption[] | undefined => {
    if (!Array.isArray(value) || value.length === 0) {
      report('shape', path, 'A list of at least one option.');
      return undefined;
    }
    if (value.length > FORM_LIMITS.options) {
      report('too-many', path, `At most ${FORM_LIMITS.options} options.`);
      return undefined;
    }
    const seen = new Set<string>();
    const out: FormOption[] = [];
    value.forEach((raw, index) => {
      const at = `${path}[${index}]`;
      if (!isRecord(raw)) {
        report('shape', at, 'An option is { value, label }.');
        return;
      }
      closed(raw, ['value', 'label', 'description'], at);
      const optionValue = text(raw.value, `${at}.value`, FORM_LIMITS.short, true);
      const label = text(raw.label, `${at}.label`, FORM_LIMITS.label, true);
      const description = text(
        raw.description,
        `${at}.description`,
        FORM_LIMITS.description,
        false
      );
      if (optionValue !== undefined && seen.has(optionValue)) {
        report('duplicate', `${at}.value`, `The option "${optionValue.slice(0, 64)}" repeats.`);
      }
      if (optionValue !== undefined) seen.add(optionValue);
      if (optionValue !== undefined && label !== undefined) {
        out.push(
          Object.freeze(
            description ? { value: optionValue, label, description } : { value: optionValue, label }
          )
        );
      }
    });
    return out;
  };

  const bound = (
    type: FormFieldType,
    value: unknown,
    path: string
  ): number | string | undefined => {
    if (value === undefined) return undefined;
    if (isNumericType(type)) {
      if (typeof value === 'number' && Number.isFinite(value)) return value;
      report('range', path, 'A finite number.');
    } else if (type === 'date') {
      if (coerceValue({ type: 'date' }, value)) return value as string;
      report('range', path, 'A date written YYYY-MM-DD.');
    } else if (type === 'time') {
      if (typeof value === 'string' && ISO_TIME.test(value)) return value;
      report('range', path, 'A time written HH:MM (24-hour).');
    }
    return undefined;
  };

  const fieldOf = (raw: unknown, path: string, step: number, section: number): FormField | null => {
    if (!isRecord(raw)) {
      report('shape', path, 'A field is an object with name, type and label.');
      return null;
    }
    closed(raw, FIELD_MEMBERS, path);
    const name = raw.name;
    if (typeof name !== 'string' || !FORM_NAME.test(name)) {
      report(
        'name',
        `${path}.name`,
        'A field name is a lowercase letter, then up to 63 letters, digits or _.'
      );
      return null;
    }
    if (names.has(name)) {
      report('duplicate', `${path}.name`, `The field "${name}" is declared twice.`);
      return null;
    }
    names.add(name);
    const type = raw.type;
    if (typeof type !== 'string' || !(FORM_FIELD_TYPES as readonly string[]).includes(type)) {
      report('type', `${path}.type`, `The type is one of ${FORM_FIELD_TYPES.join(', ')}.`);
      return null;
    }
    const t = type as FormFieldType;
    for (const [member, applies] of Object.entries(APPLIES)) {
      if (raw[member] !== undefined && !applies(t)) {
        report(
          'not-applicable',
          `${path}.${member}`,
          `"${member}" does not apply to a ${t} field.`
        );
      }
    }
    const out: Record<string, unknown> = { name, type: t };
    const label = text(raw.label, `${path}.label`, FORM_LIMITS.label, true);
    if (label !== undefined) out.label = label;
    const description = text(
      raw.description,
      `${path}.description`,
      FORM_LIMITS.description,
      false
    );
    if (description !== undefined) out.description = description;
    if (APPLIES.placeholder?.(t)) {
      const placeholder = text(raw.placeholder, `${path}.placeholder`, FORM_LIMITS.short, false);
      if (placeholder !== undefined) out.placeholder = placeholder;
    }
    if (raw.required !== undefined) {
      if (typeof raw.required !== 'boolean') report('shape', `${path}.required`, 'true or false.');
      else out.required = raw.required;
    }
    let options: FormOption[] | undefined;
    if (hasOptions(t)) {
      options = optionsOf(raw.options, `${path}.options`);
      if (options) out.options = Object.freeze(options);
    }
    if (APPLIES.minLength?.(t)) {
      const minLength = integer(raw.minLength, `${path}.minLength`, 0, FORM_LIMITS.valueLength);
      const maxLength = integer(raw.maxLength, `${path}.maxLength`, 1, FORM_LIMITS.valueLength);
      if (minLength !== undefined) out.minLength = minLength;
      if (maxLength !== undefined) out.maxLength = maxLength;
      if (minLength !== undefined && maxLength !== undefined && minLength > maxLength) {
        report('range', `${path}.minLength`, 'minLength is above maxLength.');
      }
    }
    if (APPLIES.min?.(t)) {
      const min = bound(t, raw.min, `${path}.min`);
      const max = bound(t, raw.max, `${path}.max`);
      if (min !== undefined) out.min = min;
      if (max !== undefined) out.max = max;
      if (min !== undefined && max !== undefined && min > max) {
        report('range', `${path}.min`, 'min is above max.');
      }
    }
    if (APPLIES.step?.(t) && raw.step !== undefined) {
      if (typeof raw.step !== 'number' || !Number.isFinite(raw.step) || raw.step <= 0) {
        report('range', `${path}.step`, 'A number above 0.');
      } else out.step = raw.step;
    }
    if (APPLIES.minItems?.(t)) {
      const minItems = integer(raw.minItems, `${path}.minItems`, 0, FORM_LIMITS.items);
      const maxItems = integer(raw.maxItems, `${path}.maxItems`, 1, FORM_LIMITS.items);
      if (minItems !== undefined) out.minItems = minItems;
      if (maxItems !== undefined) out.maxItems = maxItems;
      if (minItems !== undefined && maxItems !== undefined && minItems > maxItems) {
        report('range', `${path}.minItems`, 'minItems is above maxItems.');
      }
    }
    if (APPLIES.format?.(t) && raw.format !== undefined) {
      if (
        typeof raw.format !== 'string' ||
        !(FORM_FORMATS as readonly string[]).includes(raw.format)
      ) {
        report(
          'type',
          `${path}.format`,
          `A named format: ${FORM_FORMATS.join(', ')}. Patterns are never accepted.`
        );
      } else out.format = raw.format;
    }
    if (raw.validator !== undefined) {
      if (typeof raw.validator !== 'string' || !FORM_VALIDATOR_NAME.test(raw.validator)) {
        report('name', `${path}.validator`, 'A validator name the host registered.');
      } else if (allowedValidators && !allowedValidators.has(raw.validator)) {
        report('name', `${path}.validator`, `The host has no validator "${raw.validator}".`);
      } else out.validator = raw.validator;
    }
    if (raw.messages !== undefined) {
      if (!isRecord(raw.messages))
        report('shape', `${path}.messages`, 'An object of rule names to text.');
      else {
        closed(raw.messages, FORM_RULE_NAMES, `${path}.messages`);
        const messages: Record<string, string> = {};
        for (const rule of FORM_RULE_NAMES) {
          const message = text(
            raw.messages[rule],
            `${path}.messages.${rule}`,
            FORM_LIMITS.short,
            false
          );
          if (message !== undefined) messages[rule] = message;
        }
        out.messages = Object.freeze(messages);
      }
    }
    if (APPLIES.rows?.(t)) {
      const rows = integer(raw.rows, `${path}.rows`, 2, 20);
      if (rows !== undefined) out.rows = rows;
    }
    if (t === 'file') {
      if (raw.accept !== undefined) {
        if (
          !Array.isArray(raw.accept) ||
          raw.accept.length === 0 ||
          raw.accept.length > FORM_LIMITS.accept
        ) {
          report('shape', `${path}.accept`, `A list of 1 to ${FORM_LIMITS.accept} file types.`);
        } else if (!raw.accept.every((item) => typeof item === 'string' && ACCEPT.test(item))) {
          report(
            'type',
            `${path}.accept`,
            'File types are MIME types (image/png, image/*) or extensions (.pdf).'
          );
        } else out.accept = Object.freeze([...(raw.accept as string[])]);
      }
      const maxSize = integer(raw.maxSize, `${path}.maxSize`, 1, FORM_LIMITS.maxFileSize);
      if (maxSize !== undefined) out.maxSize = maxSize;
    }
    if (APPLIES.autocomplete?.(t) && raw.autocomplete !== undefined) {
      if (
        typeof raw.autocomplete !== 'string' ||
        !(FORM_AUTOCOMPLETE as readonly string[]).includes(raw.autocomplete)
      ) {
        report('type', `${path}.autocomplete`, `One of ${FORM_AUTOCOMPLETE.join(', ')}.`);
      } else out.autocomplete = raw.autocomplete;
    }
    if (raw.link !== undefined) {
      if (!isRecord(raw.link)) report('shape', `${path}.link`, 'A link is { label, href }.');
      else {
        closed(raw.link, ['label', 'href'], `${path}.link`);
        const linkLabel = text(raw.link.label, `${path}.link.label`, FORM_LIMITS.label, true);
        const href = typeof raw.link.href === 'string' ? safeHref(raw.link.href, tier) : undefined;
        if (href === undefined)
          report('url', `${path}.link.href`, `The URL policy (${tier}) refuses this link.`);
        if (linkLabel !== undefined && href !== undefined)
          out.link = Object.freeze({ label: linkLabel, href });
      }
    }
    if (APPLIES.default?.(t) && raw.default !== undefined) {
      const value = coerceValue({ type: t, options }, raw.default);
      const known = (v: unknown) => !options || options.some((option) => option.value === v);
      const inOptions =
        value === undefined || value === null || !hasOptions(t)
          ? true
          : Array.isArray(value)
            ? value.every(known)
            : known(value);
      if (value === undefined || !inOptions) {
        report(
          'default',
          `${path}.default`,
          `Not a valid ${t} value${hasOptions(t) ? ' from the options' : ''}.`
        );
      } else out.default = value;
    }
    // Conditions read earlier fields only: compile them before declaring this one.
    const when = whenOf(raw.when, `${path}.when`, ['show', 'require', 'enable']);
    if (raw.when !== undefined && isRecord(raw.when))
      out.when = Object.freeze({ ...pick(raw.when, ['show', 'require', 'enable'], when) });
    declared[name] = expressionTypeOf(t);
    const field = Object.freeze(out) as unknown as FormField;
    fields.push(
      Object.freeze({
        field,
        index: fields.length,
        step,
        section,
        show: when.show,
        require: when.require,
        enable: when.enable,
      })
    );
    return field;
  };

  const fieldList = (raw: unknown, path: string, step: number, section: number): FormField[] => {
    if (!Array.isArray(raw)) {
      report('shape', path, 'A list of fields.');
      return [];
    }
    if (fields.length + raw.length > FORM_LIMITS.fields) {
      report('too-many', path, `A form has at most ${FORM_LIMITS.fields} fields.`);
      return [];
    }
    const out: FormField[] = [];
    raw.forEach((item, index) => {
      if (full()) return;
      const field = fieldOf(item, `${path}[${index}]`, step, section);
      if (field) out.push(field);
    });
    return out;
  };

  const idOf = (value: unknown, path: string, space: Set<string> = ids): string | undefined => {
    if (typeof value !== 'string' || !FORM_ID.test(value)) {
      report(
        'name',
        path,
        'An id is lowercase letters, digits and hyphens, starting with a letter.'
      );
      return undefined;
    }
    if (space.has(value)) {
      report('duplicate', path, `The id "${value}" is used twice.`);
      return undefined;
    }
    space.add(value);
    return value;
  };

  const sectionOf = (raw: unknown, path: string, step: number): FormSection | null => {
    if (!isRecord(raw)) {
      report('shape', path, 'A section is an object with id and fields.');
      return null;
    }
    closed(raw, SECTION_MEMBERS, path);
    const id = idOf(raw.id, `${path}.id`);
    const title = text(raw.title, `${path}.title`, FORM_LIMITS.label, false);
    const description = text(
      raw.description,
      `${path}.description`,
      FORM_LIMITS.description,
      false
    );
    const when = whenOf(raw.when, `${path}.when`, ['show']);
    const index = sections.length;
    if (sections.length >= FORM_LIMITS.sections) {
      report('too-many', path, `A form has at most ${FORM_LIMITS.sections} sections.`);
      return null;
    }
    const placeholder = {
      id: id ?? '',
      title,
      description,
      step,
      show: when.show,
      fields: [] as string[],
    };
    sections.push(placeholder);
    const list = fieldList(raw.fields, `${path}.fields`, step, index);
    if (Array.isArray(raw.fields) && raw.fields.length === 0)
      report('shape', `${path}.fields`, 'A section holds at least one field.');
    placeholder.fields = list.map((field) => field.name);
    sections[index] = Object.freeze({ ...placeholder, fields: Object.freeze(placeholder.fields) });
    const out: Record<string, unknown> = { id, fields: Object.freeze(list) };
    if (title !== undefined) out.title = title;
    if (description !== undefined) out.description = description;
    if (isRecord(raw.when)) out.when = Object.freeze(pick(raw.when, ['show'], when));
    return Object.freeze(out) as unknown as FormSection;
  };

  /** Fields and sections of one page (the whole form, or one step). */
  const pageOf = (raw: Record<string, unknown>, path: string, step: number) => {
    const hasFields = raw.fields !== undefined;
    const hasSections = raw.sections !== undefined;
    if (hasFields === hasSections) {
      report('layout', path, 'Give exactly one of "fields" or "sections".');
      return {};
    }
    if (hasFields) {
      const list = fieldList(raw.fields, `${path}.fields`, step, -1);
      if (Array.isArray(raw.fields) && raw.fields.length === 0)
        report('shape', `${path}.fields`, 'At least one field.');
      return { fields: Object.freeze(list) };
    }
    if (!Array.isArray(raw.sections) || raw.sections.length === 0) {
      report('shape', `${path}.sections`, 'A list of at least one section.');
      return {};
    }
    const list: FormSection[] = [];
    raw.sections.forEach((item, index) => {
      if (full()) return;
      const section = sectionOf(item, `${path}.sections[${index}]`, step);
      if (section) list.push(section);
    });
    return { sections: Object.freeze(list) };
  };

  // Names of every field anywhere, so a forward reference is told apart from a typo.
  const allNames = collectNames(input);

  if (!isRecord(input)) {
    return fail([{ code: 'shape', path: '$', message: 'A form schema is an object.' }]);
  }
  closed(input, FORM_MEMBERS, '$');
  const schema: Record<string, unknown> = {};
  const title = text(input.title, '$.title', FORM_LIMITS.label, true);
  if (title !== undefined) schema.title = title;
  const description = text(input.description, '$.description', FORM_LIMITS.description, false);
  if (description !== undefined) schema.description = description;
  const submitLabel = text(input.submitLabel, '$.submitLabel', FORM_LIMITS.label, false);
  if (submitLabel !== undefined) schema.submitLabel = submitLabel;

  const multiStep = input.steps !== undefined;
  if (multiStep) {
    if (input.fields !== undefined || input.sections !== undefined) {
      report('layout', '$', 'A form with steps keeps its fields inside the steps.');
    }
    if (!Array.isArray(input.steps) || input.steps.length === 0) {
      report('shape', '$.steps', 'A list of at least one step.');
    } else if (input.steps.length > FORM_LIMITS.steps) {
      report('too-many', '$.steps', `At most ${FORM_LIMITS.steps} steps.`);
    } else {
      const list: FormStep[] = [];
      input.steps.forEach((raw, index) => {
        if (full()) return;
        const path = `$.steps[${index}]`;
        if (!isRecord(raw)) {
          report('shape', path, 'A step is an object with id, title and fields or sections.');
          return;
        }
        closed(raw, STEP_MEMBERS, path);
        const id = idOf(raw.id, `${path}.id`);
        const stepTitle = text(raw.title, `${path}.title`, FORM_LIMITS.label, true);
        const stepDescription = text(
          raw.description,
          `${path}.description`,
          FORM_LIMITS.description,
          false
        );
        const when = whenOf(raw.when, `${path}.when`, ['show']);
        const firstSection = sections.length;
        const firstField = fields.length;
        const page = pageOf(raw, path, index);
        const out: Record<string, unknown> = { id, title: stepTitle, ...page };
        if (stepDescription !== undefined) out.description = stepDescription;
        if (isRecord(raw.when)) out.when = Object.freeze(pick(raw.when, ['show'], when));
        list.push(Object.freeze(out) as unknown as FormStep);
        steps.push(
          Object.freeze({
            id: id ?? '',
            title: stepTitle ?? '',
            description: stepDescription,
            show: when.show,
            fields: Object.freeze(fields.slice(firstField).map((f) => f.field.name)),
            sections: Object.freeze(range(firstSection, sections.length)),
          })
        );
      });
      schema.steps = Object.freeze(list);
    }
  } else {
    Object.assign(schema, pageOf(input, '$', 0));
    steps.push(
      Object.freeze({
        id: 'form',
        title: title ?? '',
        description,
        show: null,
        fields: Object.freeze(fields.map((f) => f.field.name)),
        sections: Object.freeze(range(0, sections.length)),
      })
    );
  }

  const rules: CompiledRule[] = [];
  if (input.rules !== undefined) {
    if (!Array.isArray(input.rules)) report('shape', '$.rules', 'A list of rules.');
    else if (input.rules.length > FORM_LIMITS.rules)
      report('too-many', '$.rules', `At most ${FORM_LIMITS.rules} rules.`);
    else {
      const list: FormRule[] = [];
      input.rules.forEach((raw, index) => {
        if (full()) return;
        const path = `$.rules[${index}]`;
        if (!isRecord(raw)) {
          report('shape', path, 'A rule is { id, test, message, field? }.');
          return;
        }
        closed(raw, RULE_MEMBERS, path);
        const id = idOf(raw.id, `${path}.id`, ruleIds);
        const message = text(raw.message, `${path}.message`, FORM_LIMITS.short, true);
        let field: string | undefined;
        if (raw.field !== undefined) {
          if (typeof raw.field !== 'string' || !names.has(raw.field)) {
            report('name', `${path}.field`, 'The field a rule reports on must be declared.');
          } else field = raw.field;
        }
        // Rules run after every field is known, so they may read any field.
        const test = condition(raw.test, `${path}.test`, declared, null);
        if (id && message !== undefined && test) {
          const rule = Object.freeze(
            field ? { id, test: test.ast, message, field } : { id, test: test.ast, message }
          );
          list.push(rule);
          rules.push(Object.freeze({ rule, test }));
        }
      });
      schema.rules = Object.freeze(list);
    }
  }

  if (issues.length > 0) return fail(issues);
  const frozen = Object.freeze(schema) as unknown as FormSchema;
  const form: CompiledForm = Object.freeze({
    schema: frozen,
    fields: Object.freeze(fields),
    byName: new Map(fields.map((entry) => [entry.field.name, entry])),
    sections: Object.freeze(sections),
    steps: Object.freeze(steps),
    rules: Object.freeze(rules),
    multiStep,
  });
  return Object.freeze({ ok: true, form, issues: Object.freeze([]) as readonly [] });
}

function fail(issues: readonly FormSchemaIssue[]): FormSchemaResult {
  return Object.freeze({ ok: false, form: null, issues: Object.freeze([...issues]) });
}

function range(from: number, to: number): number[] {
  return Array.from({ length: Math.max(0, to - from) }, (_, i) => from + i);
}

/** Keep the conditions that compiled, as their normalized ASTs. */
function pick(
  raw: Record<string, unknown>,
  keys: readonly string[],
  compiled: Readonly<Record<string, Expression | null>>
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key of keys) {
    const expression = compiled[key];
    if (raw[key] !== undefined && expression) out[key] = expression.ast;
  }
  return out;
}

/** Every field name anywhere in a raw schema (bounded by the caps). */
function collectNames(input: unknown): ReadonlySet<string> {
  const out = new Set<string>();
  const addFields = (list: unknown) => {
    if (!Array.isArray(list)) return;
    for (const field of list.slice(0, FORM_LIMITS.fields)) {
      if (isRecord(field) && typeof field.name === 'string') out.add(field.name);
    }
  };
  const addPage = (page: unknown) => {
    if (!isRecord(page)) return;
    addFields(page.fields);
    if (Array.isArray(page.sections)) {
      for (const section of page.sections.slice(0, FORM_LIMITS.sections)) {
        if (isRecord(section)) addFields(section.fields);
      }
    }
  };
  addPage(input);
  if (isRecord(input) && Array.isArray(input.steps)) {
    for (const step of input.steps.slice(0, FORM_LIMITS.steps)) addPage(step);
  }
  return out;
}

/**
 * The `validateDraft` adapter (`checkForm` in `@texuli/catalog/validate`,
 * spec 0.8.0): validates a `schema-form` node's schema at the draft's tier
 * and, when given, against the validator names the host registered.
 */
export function checkFormDraft(
  schema: unknown,
  tier: HrefTrust,
  validators?: readonly string[]
): { ok: boolean; issues: readonly FormSchemaIssue[] } {
  const result = validateFormSchema(schema, { tier, ...(validators ? { validators } : {}) });
  return { ok: result.ok, issues: result.issues };
}
