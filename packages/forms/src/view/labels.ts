import type { Component, Snippet } from 'svelte';
import type { FormValidator } from '../model/controller.ts';
import type { FormField, FormValue, FormValues } from '../model/types.ts';

/** Interface text of `SchemaForm`. Every string is localizable; `{name}` placeholders are filled in. */
export const DEFAULT_SCHEMA_FORM_LABELS = Object.freeze({
  next: 'Next',
  back: 'Back',
  submit: 'Submit',
  submitting: 'Sending…',
  submitted: 'Thank you. Your answers were sent.',
  /** The step navigation's name; `{title}` is the form title, so two forms' landmarks differ. */
  progress: '{title} progress',
  stepOf: 'Step {current} of {total}: {title}',
  errorSummary: 'There is a problem',
  errorCountOne: '1 answer needs attention.',
  errorCount: '{count} answers need attention.',
  draftSaving: 'Saving draft…',
  draftSaved: 'Draft saved',
  draftRestored: 'Your saved draft was restored.',
  draftError: 'The draft could not be saved.',
  checking: 'Checking…',
  selectPlaceholder: 'Choose an option',
  /** The empty choice of an optional select (G118). */
  selectNone: 'None',
  tagsInput: 'Add a tag',
  /** The reveal toggle of a password field (a toggle button: pressed while shown). */
  showPassword: 'Show password',
  /** The parts of a datetime field, after its label ("Starts Date"). */
  date: 'Date',
  time: 'Time',
  /** Said while a field's control loads (G119). */
  loading: 'Loading…',
  /** Shown for a custom field no painter was given for. */
  customMissing: 'This field cannot be shown here.',
});

export type SchemaFormLabels = { readonly [K in keyof typeof DEFAULT_SCHEMA_FORM_LABELS]: string };

/** What `SchemaForm`'s `onSubmit` receives: the submitted values and the files of submitted file fields. */
export interface SchemaFormSubmission {
  readonly values: FormValues;
  readonly files: Readonly<Record<string, readonly File[]>>;
}

/**
 * What a host painter receives for one `custom` field (G113). Put `props` on
 * the focusable control (or use `id`, `labelId` and `describedBy` yourself)
 * so the label, the error summary links and focus-on-error reach it; call
 * `setValue` on change and `blur` when focus leaves the control.
 */
export interface SchemaFormCustomField {
  readonly field: FormField;
  readonly name: string;
  readonly kind: string;
  /** The field's scalar `config` (`{}` when it has none). */
  readonly config: Readonly<Record<string, string | number | boolean>>;
  readonly value: FormValue | undefined;
  setValue(value: unknown): void;
  /** Mark the field touched and validate it. */
  blur(): void;
  readonly error: string | undefined;
  readonly invalid: boolean;
  readonly required: boolean;
  /** Disabled by the form (`disabled`) or by the field's `when.enable`. */
  readonly disabled: boolean;
  readonly readOnly: boolean;
  /** A host validator is running. */
  readonly pending: boolean;
  /** The control id (`<form id>-field-<name>`). */
  readonly id: string;
  /** The id of the visible label the form paints. */
  readonly labelId: string;
  /** Description and error ids, space-separated, or `undefined`. */
  readonly describedBy: string | undefined;
  readonly props: {
    readonly id: string;
    readonly 'aria-labelledby': string;
    readonly 'aria-describedby': string | undefined;
    readonly 'aria-invalid': true | undefined;
    readonly 'aria-required': true | undefined;
    readonly disabled: true | undefined;
  };
  readonly labels: SchemaFormLabels;
}

export type SchemaFormCustomSnippet = Snippet<[SchemaFormCustomField]>;

/** A painter with options: a snippet or a component, and the validator for its fields. */
export interface SchemaFormCustomEntry {
  readonly render?: SchemaFormCustomSnippet;
  readonly component?: Component<{ field: SchemaFormCustomField }>;
  /** Validates every field this entry paints (sync or async; a message means invalid). */
  readonly validate?: FormValidator;
}

/** Custom field painters keyed by field name or by kind (the name wins). */
export type SchemaFormCustomFields = Readonly<
  Record<string, SchemaFormCustomSnippet | SchemaFormCustomEntry>
>;

/** What the `actions` snippet receives (G115): the state and the moves of the action row. */
export interface SchemaFormActions {
  /** Submitting, or checking a step (validators or `onStep`). */
  readonly submitting: boolean;
  /** The form-level `disabled` flag. */
  readonly disabled: boolean;
  readonly readOnly: boolean;
  /** On the last visible step (submit), or not (next). */
  readonly last: boolean;
  /** Position among the visible steps (0-based) and how many there are. */
  readonly step: number;
  readonly steps: number;
  /** The submit button text (the schema's `submitLabel`, or `labels.submit`). */
  readonly submitLabel: string;
  back(): Promise<void>;
  next(): Promise<void>;
  /** Next on an earlier step, submit on the last: what a submit button does. */
  submit(): Promise<void>;
}
