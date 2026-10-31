import type { CompiledForm } from './schema.ts';
import type { FormField, FormFile, FormValue, FormValues } from './types.ts';
import { isEmptyValue, ownValue } from './values.ts';

/*
 * Answers as text, for summaries, confirmations, notifications and agent
 * transcripts: option labels instead of values, dates and times as people
 * read them, and credential answers masked. Plain text in, plain text out:
 * nothing here is markup, and the Markdown writer escapes every label and
 * answer.
 */

export interface FormatFormValueOptions {
  /** Text of a checked checkbox or switch (default `Yes`). */
  readonly yes?: string;
  /** Text of an unchecked checkbox or switch (default `No`). */
  readonly no?: string;
}

/** A password answer always shows as eight dots, so its length is not told. */
const PASSWORD_MASK = '••••••••';

/** One answer as plain text (`''` when empty). Password and otp answers are masked. */
export function formatFormValue(
  field: Pick<FormField, 'type'> & Partial<FormField>,
  value: FormValue | undefined,
  options: FormatFormValueOptions = {}
): string {
  if (field.type === 'checkbox' || field.type === 'switch') {
    return value === true ? (options.yes ?? 'Yes') : (options.no ?? 'No');
  }
  if (isEmptyValue(value)) return '';
  const label = (item: string) => field.options?.find((option) => option.value === item)?.label;
  switch (field.type) {
    case 'password':
      return PASSWORD_MASK;
    case 'otp':
      return '•'.repeat(typeof value === 'string' ? value.length : 6);
    case 'select':
    case 'radio':
      return typeof value === 'string' ? (label(value) ?? value) : '';
    case 'multiselect':
    case 'tags':
      return Array.isArray(value)
        ? (value as readonly unknown[])
            .filter((item): item is string => typeof item === 'string')
            .map((item) => (field.type === 'multiselect' ? (label(item) ?? item) : item))
            .join(', ')
        : '';
    case 'file':
      return Array.isArray(value)
        ? (value as readonly FormFile[]).map((file) => file?.name ?? '').join(', ')
        : '';
    case 'datetime':
      return typeof value === 'string' ? value.replace('T', ' ') : '';
    case 'custom':
      return typeof value === 'string' ? value : JSON.stringify(value);
    default:
      return typeof value === 'string' || typeof value === 'number' ? String(value) : '';
  }
}

/** Escape the characters Markdown reads as syntax inside a line. */
function escapeMarkdown(text: string): string {
  return text.replace(/[\\`*_[\]<>|~]/g, (char) => `\\${char}`).replace(/[\r\n]+/g, ' ');
}

/**
 * The answers as a Markdown list, one `- **Label**: answer` line per field
 * present in `values`, in schema order (pass `submittedValues` or the
 * values `onSubmit` received to list only what was sent).
 */
export function formValuesToMarkdown(
  form: CompiledForm,
  values: FormValues,
  options: FormatFormValueOptions = {}
): string {
  let out = '';
  for (const { field } of form.fields) {
    const value = ownValue(values, field.name);
    if (value === undefined) continue;
    out += `- **${escapeMarkdown(field.label)}**: ${escapeMarkdown(formatFormValue(field, value, options))}\n`;
  }
  return out;
}
