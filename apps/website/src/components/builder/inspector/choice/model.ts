/**
 * Framework-free model for enum and boolean inspector fields. Whether a
 * value is acceptable is decided by the renderer itself (`sanitizeProps`,
 * the check the player runs at paint), so the inspector flags exactly the
 * values the paint would refuse. Imports only `@texuli/catalog`, so it can
 * move into a future `@texuli/builder` unchanged.
 */
import type { CatalogPropSchema } from '@texuli/catalog';
import { sanitizeProps } from '@texuli/catalog/render/renderer';

export type ChoiceProp = CatalogPropSchema & { kind: 'enum' | 'boolean' };

export function isChoiceProp(prop: CatalogPropSchema): prop is ChoiceProp {
  return prop.kind === 'boolean' || (prop.kind === 'enum' && Array.isArray(prop.enumValues));
}

export type ChoiceReading =
  | { state: 'unset' }
  | { state: 'set'; value: string | boolean }
  | { state: 'invalid'; raw: unknown; message: string };

/** Read a prop value the way the renderer will: unset, accepted, or refused with its reason. */
export function readChoice(prop: ChoiceProp, value: unknown): ChoiceReading {
  if (value === undefined) return { state: 'unset' };
  const result = sanitizeProps({ [prop.name]: value }, [prop], '', 'inspector');
  if (result.props && Object.hasOwn(result.props, prop.name)) {
    return { state: 'set', value: value as string | boolean };
  }
  const reason = result.diagnostics.find((diagnostic) => diagnostic.message)?.message;
  return { state: 'invalid', raw: value, message: reason ?? `Prop "${prop.name}" was refused.` };
}

export interface ChoiceIssue {
  severity: 'error' | 'warning';
  message: string;
}

/**
 * What the inspector shows under the field. `pinned` is the value the
 * player forces for this prop (the media `trust` prop), when there is one.
 */
export function choiceIssues(prop: ChoiceProp, value: unknown, pinned?: string): ChoiceIssue[] {
  const reading = readChoice(prop, value);
  const issues: ChoiceIssue[] = [];
  if (reading.state === 'invalid') {
    issues.push({
      severity: 'error',
      message: `${reading.message} The value ${showRaw(reading.raw)} will be refused at paint.`,
    });
  }
  if (reading.state === 'unset' && prop.required === true) {
    issues.push({ severity: 'error', message: 'Required: choose a value.' });
  }
  if (pinned !== undefined && reading.state === 'set' && reading.value !== pinned) {
    issues.push({
      severity: 'warning',
      message: `The player always paints this as “${pinned}”; a blueprint cannot change it.`,
    });
  }
  return issues;
}

/** Radios for up to four values, a select above that (builder-design §5.3). */
export function enumControl(prop: ChoiceProp): 'radio' | 'select' {
  return (prop.enumValues?.length ?? 0) <= 4 ? 'radio' : 'select';
}

export type ChoiceInput = { ok: true; value: string | undefined } | { ok: false };

/**
 * The value for an enum input. `''` means "not set" and is allowed only for
 * optional props; anything outside the closed set is refused.
 */
export function enumInput(prop: ChoiceProp, input: string): ChoiceInput {
  if (input === '') return prop.required === true ? { ok: false } : { ok: true, value: undefined };
  return prop.enumValues?.includes(input) ? { ok: true, value: input } : { ok: false };
}

/** The state a boolean switch shows: the value, else the default, else off. */
export function switchChecked(prop: ChoiceProp, value: unknown): boolean {
  if (typeof value === 'boolean') return value;
  return prop.default === true;
}

/** Placeholder text for an unset prop with a schema default (never written to the payload). */
export function defaultText(prop: ChoiceProp): string | undefined {
  if (prop.default === undefined) return undefined;
  const shown =
    prop.kind === 'boolean' ? (prop.default === true ? 'on' : 'off') : String(prop.default);
  return `Default: ${shown}. A default is not saved.`;
}

const RAW_LIMIT = 60;

/** A refused value as short plain text (never markup): JSON, truncated. */
export function showRaw(raw: unknown): string {
  let text: string;
  try {
    text = JSON.stringify(raw) ?? String(raw);
  } catch {
    text = String(raw);
  }
  const chars = [...text];
  return chars.length > RAW_LIMIT ? `${chars.slice(0, RAW_LIMIT).join('')}…` : text;
}
