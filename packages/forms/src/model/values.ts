import { type ExpressionType, isoDateToDays } from '@texuli/core/expression';
import {
  FORM_LIMITS,
  type FormField,
  type FormFieldType,
  type FormFile,
  type FormValue,
  type FormValues,
} from './types.ts';

/* Typed values: what each field type holds, its empty value and coercion. */

const TEXT_TYPES: ReadonlySet<FormFieldType> = new Set([
  'text',
  'textarea',
  'email',
  'url',
  'password',
]);
const CHOICE_TYPES: ReadonlySet<FormFieldType> = new Set(['select', 'radio']);
const LIST_TYPES: ReadonlySet<FormFieldType> = new Set(['multiselect', 'tags']);

export const isTextType = (type: FormFieldType) => TEXT_TYPES.has(type);
export const isChoiceType = (type: FormFieldType) => CHOICE_TYPES.has(type);
export const isListType = (type: FormFieldType) => LIST_TYPES.has(type);
export const isNumericType = (type: FormFieldType) => type === 'number' || type === 'slider';
export const isToggleType = (type: FormFieldType) => type === 'checkbox' || type === 'switch';
export const hasOptions = (type: FormFieldType) => isChoiceType(type) || type === 'multiselect';
/** Credential fields: never in drafts, masked in summaries, opt-in for agent output. */
export const isSecretType = (type: FormFieldType) => type === 'password' || type === 'otp';

/** A field's answer, read as an own member only (never an inherited one). */
export function ownValue(values: FormValues, name: string): FormValue | undefined {
  return Object.hasOwn(values, name) ? values[name] : undefined;
}

/** The expression type a field's value has inside conditions and rules. */
export function expressionTypeOf(type: FormFieldType): ExpressionType {
  if (isNumericType(type)) return 'number';
  if (isToggleType(type)) return 'boolean';
  if (type === 'date') return 'date';
  if (isListType(type) || type === 'file') return 'list';
  if (type === 'custom') return 'any';
  return 'string';
}

/** The value a field starts with when nothing else is given. */
export function emptyValue(field: Pick<FormField, 'type' | 'min' | 'max'>): FormValue {
  if (isTextType(field.type) || field.type === 'otp') return '';
  if (isToggleType(field.type)) return false;
  if (isListType(field.type) || field.type === 'file') return Object.freeze([]);
  if (field.type === 'slider') return typeof field.min === 'number' ? field.min : 0;
  return null;
}

const TIME = /^(?:[01]\d|2[0-3]):[0-5]\d$/;
const COLOR = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;

/** A local date and time, `YYYY-MM-DDTHH:MM` (no seconds, no zone), or `undefined`. */
export function isoDateTime(raw: unknown): string | undefined {
  if (typeof raw !== 'string' || raw.length !== 16 || raw[10] !== 'T') return undefined;
  return isoDateToDays(raw.slice(0, 10)) !== null && TIME.test(raw.slice(11)) ? raw : undefined;
}

/** A bounded JSON value (a custom field's answer), frozen, or `undefined`. */
function coerceJson(raw: unknown): FormValue | undefined {
  let size = 0;
  const walk = (value: unknown, depth: number): unknown => {
    if (depth > FORM_LIMITS.customDepth) throw value;
    if (value === null || typeof value === 'boolean') {
      size += 5;
      return value;
    }
    if (typeof value === 'number') {
      if (!Number.isFinite(value)) throw value;
      size += 8;
      return value === 0 ? 0 : value;
    }
    if (typeof value === 'string') {
      size += value.length + 2;
      if (size > FORM_LIMITS.customValue) throw value;
      return value;
    }
    if (Array.isArray(value)) {
      size += 2;
      return Object.freeze(value.map((item) => walk(item, depth + 1)));
    }
    if (typeof value === 'object' && Object.getPrototypeOf(value) === Object.prototype) {
      const out: Record<string, unknown> = {};
      for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
        size += key.length + 3;
        Object.defineProperty(out, key, {
          value: walk(item, depth + 1),
          enumerable: true,
          writable: false,
          configurable: false,
        });
      }
      return Object.freeze(out);
    }
    throw value;
  };
  try {
    const value = walk(raw, 0);
    return size > FORM_LIMITS.customValue ? undefined : (value as FormValue);
  } catch {
    return undefined;
  }
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

function coerceFile(raw: unknown): FormFile | undefined {
  if (!isRecord(raw)) return undefined;
  const { name, size, type, ref } = raw;
  if (typeof name !== 'string' || name.length === 0 || name.length > 255) return undefined;
  if (typeof size !== 'number' || !Number.isFinite(size) || size < 0) return undefined;
  const mime = typeof type === 'string' && type.length <= 255 ? type : '';
  const file: FormFile =
    typeof ref === 'string' && ref.length > 0 && ref.length <= 512
      ? { name, size, type: mime, ref }
      : { name, size, type: mime };
  return Object.freeze(file);
}

/**
 * Coerce an outside value (a default, a host value, a restored draft) into
 * the field's type, or `undefined` when it cannot be. Strings longer than
 * `FORM_LIMITS.valueLength` and lists past `FORM_LIMITS.items` are refused.
 */
export function coerceValue(
  field: Pick<FormField, 'type' | 'options'>,
  raw: unknown
): FormValue | undefined {
  const type = field.type;
  if (raw === undefined) return undefined;
  if (isTextType(type)) {
    if (raw === null) return '';
    return typeof raw === 'string' && raw.length <= FORM_LIMITS.valueLength ? raw : undefined;
  }
  if (type === 'otp') {
    if (raw === null) return '';
    return typeof raw === 'string' && raw.length <= FORM_LIMITS.short ? raw : undefined;
  }
  if (type === 'color') {
    if (raw === null || raw === '') return null;
    return typeof raw === 'string' && COLOR.test(raw) ? raw.toLowerCase() : undefined;
  }
  if (type === 'datetime') {
    if (raw === null || raw === '') return null;
    return isoDateTime(raw);
  }
  if (type === 'custom') return coerceJson(raw);
  if (isNumericType(type)) {
    if (raw === null || raw === '') return null;
    return typeof raw === 'number' && Number.isFinite(raw) ? (raw === 0 ? 0 : raw) : undefined;
  }
  if (isToggleType(type)) return typeof raw === 'boolean' ? raw : undefined;
  if (type === 'date') {
    if (raw === null || raw === '') return null;
    return isoDateToDays(raw) !== null ? (raw as string) : undefined;
  }
  if (type === 'time') {
    if (raw === null || raw === '') return null;
    return typeof raw === 'string' && TIME.test(raw) ? raw : undefined;
  }
  if (isChoiceType(type)) {
    if (raw === null || raw === '') return null;
    return typeof raw === 'string' && raw.length <= FORM_LIMITS.short ? raw : undefined;
  }
  if (isListType(type)) {
    if (raw === null) return Object.freeze([]);
    if (!Array.isArray(raw) || raw.length > FORM_LIMITS.items) return undefined;
    if (!raw.every((item) => typeof item === 'string' && item.length <= FORM_LIMITS.short)) {
      return undefined;
    }
    return Object.freeze([...(raw as string[])]);
  }
  if (type === 'file') {
    if (raw === null) return Object.freeze([]);
    if (!Array.isArray(raw) || raw.length > FORM_LIMITS.items) return undefined;
    const files: FormFile[] = [];
    for (const item of raw) {
      const file = coerceFile(item);
      if (!file) return undefined;
      files.push(file);
    }
    return Object.freeze(files);
  }
  return undefined;
}

/** Empty for `required`: blank text, null, an empty list, or an unchecked checkbox or switch. */
export function isEmptyValue(value: FormValue | undefined): boolean {
  if (value === null || value === undefined || value === false) return true;
  if (typeof value === 'string') return value.trim().length === 0;
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === 'object') return Object.keys(value).length === 0;
  return false;
}

/** The value an expression reads for a field (file answers read as their names). */
export function expressionValueOf(value: FormValue | undefined): unknown {
  if (Array.isArray(value)) {
    return (value as readonly unknown[]).map((item) => {
      if (typeof item === 'string' || typeof item === 'number' || typeof item === 'boolean')
        return item;
      const name = (item as { name?: unknown } | null)?.name;
      return typeof name === 'string' ? name : null;
    });
  }
  // A custom field's object answer is opaque to expressions.
  if (typeof value === 'object' && value !== null) return null;
  return value ?? null;
}

/** Characters in a string, counted in code points. */
export function codePoints(value: string): number {
  let count = 0;
  for (let i = 0; i < value.length; i += 1) {
    const code = value.charCodeAt(i);
    if (code >= 0xd800 && code <= 0xdbff && i + 1 < value.length) {
      const next = value.charCodeAt(i + 1);
      if (next >= 0xdc00 && next <= 0xdfff) i += 1;
    }
    count += 1;
  }
  return count;
}
