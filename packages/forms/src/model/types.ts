import type { ExpressionNode } from '@texuli/core/expression';

/*
 * The closed form schema (ADR-015, spec 0.8.0 `$defs.formSchema`): fields of
 * a closed type set, sections and steps, conditions as expression ASTs, and
 * a closed set of validation rules. Agents never send regular expressions or
 * code: formats are names, custom checks are names of validators the host
 * registered, and cross-field rules are expressions.
 */

/** Every field type. `file` is host-handled: the form collects files, the host uploads them. */
export const FORM_FIELD_TYPES = Object.freeze([
  'text',
  'textarea',
  'number',
  'email',
  'url',
  'date',
  'time',
  'select',
  'multiselect',
  'checkbox',
  'radio',
  'switch',
  'slider',
  'file',
  'tags',
] as const);
export type FormFieldType = (typeof FORM_FIELD_TYPES)[number];

/** The named formats a `format` rule may use (checked by owned, linear-time code). */
export const FORM_FORMATS = Object.freeze([
  'email',
  'url',
  'phone',
  'postal-code',
  'postal-code-us',
  'postal-code-ca',
  'postal-code-uk',
  'postal-code-de',
  'postal-code-fr',
  'postal-code-es',
  'postal-code-mx',
  'postal-code-br',
  'postal-code-co',
  'postal-code-in',
  'postal-code-jp',
  'postal-code-au',
  'digits',
  'alphanumeric',
  'slug',
  'iso-date',
  'time',
  'hex-color',
] as const);
export type FormFormat = (typeof FORM_FORMATS)[number];

/** The rules a field's `messages` can override. */
export const FORM_RULE_NAMES = Object.freeze([
  'required',
  'minLength',
  'maxLength',
  'min',
  'max',
  'step',
  'format',
  'minItems',
  'maxItems',
  'option',
  'fileType',
  'fileSize',
] as const);
export type FormRuleName = (typeof FORM_RULE_NAMES)[number];

/** `autocomplete` tokens a field may ask for (no payment, credential or one-time-code tokens). */
export const FORM_AUTOCOMPLETE = Object.freeze([
  'off',
  'name',
  'given-name',
  'family-name',
  'nickname',
  'email',
  'tel',
  'organization',
  'organization-title',
  'street-address',
  'address-level1',
  'address-level2',
  'postal-code',
  'country-name',
  'language',
  'url',
  'bday',
] as const);
export type FormAutocomplete = (typeof FORM_AUTOCOMPLETE)[number];

/** Size caps for schemas and values. */
export const FORM_LIMITS = Object.freeze({
  fields: 200,
  steps: 20,
  sections: 50,
  options: 200,
  rules: 50,
  /** Characters in a title or label. */
  label: 200,
  /** Characters in a description. */
  description: 2000,
  /** Characters in a placeholder, an option value or a message. */
  short: 300,
  /** Characters in any text answer. */
  valueLength: 10_000,
  /** Items in a multiple choice, tags or file answer. */
  items: 200,
  /** Accepted file types per file field. */
  accept: 20,
  /** Largest `maxSize` for a file field, in bytes (1 GiB). */
  maxFileSize: 1_073_741_824,
});

/** A field or rule name: a lowercase letter, then letters, digits or `_`. */
export const FORM_NAME = /^[a-z][A-Za-z0-9_]{0,63}$/;
/** A step, section or rule id: lowercase letters, digits and hyphens. */
export const FORM_ID = /^[a-z][a-z0-9-]{0,63}$/;
/** A host validator name. */
export const FORM_VALIDATOR_NAME = /^[a-z][A-Za-z0-9_-]{0,63}$/;

/** A choice of a select, radio or multiselect field. */
export interface FormOption {
  readonly value: string;
  readonly label: string;
  readonly description?: string;
}

/** Conditions on a field, step or section, as expression ASTs over earlier fields. */
export interface FormWhen {
  /** Shown only while true. Hidden fields are not validated or submitted. */
  readonly show?: ExpressionNode;
  /** Required while true (in addition to `required`). */
  readonly require?: ExpressionNode;
  /** Editable only while true. Disabled fields are not validated or submitted. */
  readonly enable?: ExpressionNode;
}

/** A help link shown under a field; its `href` passes the URL policy at the schema's tier. */
export interface FormLink {
  readonly label: string;
  readonly href: string;
}

/** One field. Which members apply depends on `type` (the validator refuses the rest). */
export interface FormField {
  readonly name: string;
  readonly type: FormFieldType;
  readonly label: string;
  readonly description?: string;
  readonly placeholder?: string;
  readonly default?: FormValue;
  readonly options?: readonly FormOption[];
  readonly required?: boolean;
  readonly when?: FormWhen;
  readonly minLength?: number;
  readonly maxLength?: number;
  /** A number for number and slider; `YYYY-MM-DD` for date; `HH:MM` for time. */
  readonly min?: number | string;
  readonly max?: number | string;
  readonly step?: number;
  readonly minItems?: number;
  readonly maxItems?: number;
  readonly format?: FormFormat;
  /** The name of a validator the host registered (sync or async). */
  readonly validator?: string;
  readonly messages?: Readonly<Partial<Record<FormRuleName, string>>>;
  /** Visible rows of a textarea (2–20). */
  readonly rows?: number;
  /** Accepted file types: MIME types (`image/png`, `image/*`) or extensions (`.pdf`). */
  readonly accept?: readonly string[];
  /** Largest accepted file, in bytes. */
  readonly maxSize?: number;
  readonly autocomplete?: FormAutocomplete;
  readonly link?: FormLink;
}

export interface FormSection {
  readonly id: string;
  readonly title?: string;
  readonly description?: string;
  readonly when?: Pick<FormWhen, 'show'>;
  readonly fields: readonly FormField[];
}

export interface FormStep {
  readonly id: string;
  readonly title: string;
  readonly description?: string;
  readonly when?: Pick<FormWhen, 'show'>;
  readonly fields?: readonly FormField[];
  readonly sections?: readonly FormSection[];
}

/** A cross-field rule: it fails when `test` is false (unknown passes; `required` covers empties). */
export interface FormRule {
  readonly id: string;
  readonly test: ExpressionNode;
  readonly message: string;
  /** The field the message attaches to; without one it is a form-level error. */
  readonly field?: string;
}

/**
 * A form: exactly one of `fields` (one page), `sections` (one page with
 * groups) or `steps` (a multi-step flow).
 */
export interface FormSchema {
  readonly title: string;
  readonly description?: string;
  readonly submitLabel?: string;
  readonly fields?: readonly FormField[];
  readonly sections?: readonly FormSection[];
  readonly steps?: readonly FormStep[];
  readonly rules?: readonly FormRule[];
}

/** File metadata kept in a value (the `File` objects stay with the view and the host). */
export interface FormFile {
  readonly name: string;
  readonly size: number;
  readonly type: string;
  /** A host reference once uploaded. */
  readonly ref?: string;
}

/**
 * A typed answer: strings for text, email, url, textarea, select and radio
 * (`''` or `null` when empty); numbers for number and slider; `YYYY-MM-DD`
 * for date and `HH:MM` for time; booleans for checkbox and switch; string
 * lists for multiselect and tags; file metadata for file.
 */
export type FormValue = string | number | boolean | null | readonly string[] | readonly FormFile[];

export type FormValues = Readonly<Record<string, FormValue>>;

/** One problem in a schema, addressed by JSON path. */
export interface FormSchemaIssue {
  readonly code: FormSchemaIssueCode;
  readonly path: string;
  readonly message: string;
}

export type FormSchemaIssueCode =
  | 'shape'
  | 'unknown-member'
  | 'missing'
  | 'text'
  | 'too-long'
  | 'too-many'
  | 'name'
  | 'duplicate'
  | 'type'
  | 'not-applicable'
  | 'range'
  | 'option'
  | 'default'
  | 'expression'
  | 'forward-reference'
  | 'url'
  | 'layout';
