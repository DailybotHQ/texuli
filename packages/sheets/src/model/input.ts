import { isExpressionError } from '@texuli/core/expression';
import { numberText } from '../formula/functions.ts';
import { isFormulaInput } from '../formula/parse.ts';
import type { SheetInput, SheetValue } from './types.ts';

/*
 * Inputs as people type them and values as cells show them. Typed text
 * becomes a number only when it is plain decimal (`12`, `-3.5`, `1e3`,
 * `40%`), a boolean only for TRUE or FALSE, a formula only when it starts
 * with `=`; everything else stays text. A leading `'` keeps text literal.
 */

const DECIMAL = /^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d{1,3})?$/;

/** Read what someone typed into a cell. Empty text is a blank cell (`null`). */
export function parseSheetInput(text: string): SheetInput {
  if (typeof text !== 'string' || text.length === 0) return null;
  if (text.startsWith('=') || text.startsWith("'")) return text;
  const trimmed = text.trim();
  const upper = trimmed.toUpperCase();
  if (upper === 'TRUE') return true;
  if (upper === 'FALSE') return false;
  const percent = trimmed.endsWith('%');
  const body = percent ? trimmed.slice(0, -1) : trimmed;
  if (body.length > 0 && body.length <= 64 && DECIMAL.test(body)) {
    const n = Number(body);
    if (Number.isFinite(n)) return percent ? Number((n / 100).toPrecision(15)) : n;
  }
  return text;
}

/** The text an editor shows for an input (formulas as written, booleans upper case). */
export function inputText(input: SheetInput): string {
  if (input === null) return '';
  if (typeof input === 'boolean') return input ? 'TRUE' : 'FALSE';
  if (typeof input === 'number') return numberText(input);
  return input;
}

/** The value of an input that is not a formula (a leading `'` is dropped from text). */
export function literalValue(input: SheetInput): SheetValue {
  if (typeof input === 'string' && input.startsWith("'")) return input.slice(1);
  if (typeof input === 'number' && !Number.isFinite(input)) return null;
  return input;
}

/** Whether an input is a formula. */
export function isFormula(input: SheetInput): input is string {
  return isFormulaInput(input);
}

/** The text a cell shows for a value: numbers in general format, errors as their code. */
export function displayValue(value: SheetValue): string {
  if (value === null) return '';
  if (isExpressionError(value)) return value.error;
  if (typeof value === 'boolean') return value ? 'TRUE' : 'FALSE';
  if (typeof value === 'number') return numberText(value);
  return value;
}
