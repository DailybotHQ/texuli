import type { FormValues } from '../model/types.ts';

/** Interface text of `SchemaForm`. Every string is localizable; `{name}` placeholders are filled in. */
export const DEFAULT_SCHEMA_FORM_LABELS = Object.freeze({
  next: 'Next',
  back: 'Back',
  submit: 'Submit',
  submitting: 'Sending…',
  submitted: 'Thank you. Your answers were sent.',
  progress: 'Progress',
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
  tagsInput: 'Add a tag',
});

export type SchemaFormLabels = { readonly [K in keyof typeof DEFAULT_SCHEMA_FORM_LABELS]: string };

/** What `SchemaForm`'s `onSubmit` receives: the submitted values and the files of submitted file fields. */
export interface SchemaFormSubmission {
  readonly values: FormValues;
  readonly files: Readonly<Record<string, readonly File[]>>;
}
