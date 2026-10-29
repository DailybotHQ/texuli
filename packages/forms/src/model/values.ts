import { type ExpressionType, isoDateToDays } from '@texuli/core/expression';
import {
  FORM_LIMITS,
  type FormField,
  type FormFieldType,
  type FormFile,
  type FormValue,
} from './types.ts';

/* Typed values: what each field type holds, its empty value and coercion. */

const TEXT_TYPES: ReadonlySet<FormFieldType> = new Set(['text', 'textarea', 'email', 'url']);
const CHOICE_TYPES: ReadonlySet<FormFieldType> = new Set(['select', 'radio']);
const LIST_TYPES: ReadonlySet<FormFieldType> = new Set(['multiselect', 'tags']);

export const isTextType = (type: FormFieldType) => TEXT_TYPES.has(type);
export const isChoiceType = (type: FormFieldType) => CHOICE_TYPES.has(type);
export const isListType = (type: FormFieldType) => LIST_TYPES.has(type);
export const isNumericType = (type: FormFieldType) => type === 'number' || type === 'slider';
export const isToggleType = (type: FormFieldType) => type === 'checkbox' || type === 'switch';
export const hasOptions = (type: FormFieldType) => isChoiceType(type) || type === 'multiselect';

/** The expression type a field's value has inside conditions and rules. */
export function expressionTypeOf(type: FormFieldType): ExpressionType {
  if (isNumericType(type)) return 'number';
  if (isToggleType(type)) return 'boolean';
  if (type === 'date') return 'date';
  if (isListType(type) || type === 'file') return 'list';
  return 'string';
}

/** The value a field starts with when nothing else is given. */
export function emptyValue(field: Pick<FormField, 'type' | 'min' | 'max'>): FormValue {
  if (isTextType(field.type)) return '';
  if (isToggleType(field.type)) return false;
  if (isListType(field.type) || field.type === 'file') return Object.freeze([]);
  if (field.type === 'slider') return typeof field.min === 'number' ? field.min : 0;
  return null;
}

const TIME = /^(?:[01]\d|2[0-3]):[0-5]\d$/;

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
  return false;
}

/** The value an expression reads for a field (file answers read as their names). */
export function expressionValueOf(value: FormValue | undefined): unknown {
  if (Array.isArray(value)) {
    return value.map((item: string | FormFile) => (typeof item === 'string' ? item : item.name));
  }
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
