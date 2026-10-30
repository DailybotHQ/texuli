import type {
  ExpressionFunction,
  ExpressionFunctionContext,
  ExpressionFunctionTable,
  ExpressionScalar,
  ExpressionValue,
} from './types.ts';
import { ERRORS, isExpressionError, LIMIT, VALUE } from './values.ts';

/*
 * The core function table: small, pure, bounded functions for text, lists,
 * numbers and ISO dates. Forms evaluate with it; a dialect (the planned
 * sheets formula layer) passes its own table, which can spread this one.
 * Functions that scan their input charge one step per 16 code units or one
 * per list item, so a hostile 32 KB string costs what it reads.
 */

const isList = (value: ExpressionValue): value is readonly ExpressionScalar[] =>
  Array.isArray(value);

function str(value: ExpressionValue, context: ExpressionFunctionContext): string | null {
  if (value === null) return '';
  if (typeof value === 'string') return context.charge(value.length / 16) ? value : null;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return null;
}

function scan<T>(
  context: ExpressionFunctionContext,
  values: readonly ExpressionValue[],
  run: (...texts: string[]) => T
): T | typeof VALUE | typeof LIMIT {
  const texts: string[] = [];
  for (const value of values) {
    const text = str(value, context);
    if (text === null) return isList(value) || isExpressionError(value) ? VALUE : LIMIT;
    texts.push(text);
  }
  return run(...texts);
}

const fn = (definition: ExpressionFunction): ExpressionFunction => Object.freeze(definition);

// ISO calendar days (proleptic Gregorian), without Date parsing quirks.
const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

function daysInMonth(year: number, month: number): number {
  if (month === 2) return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0 ? 29 : 28;
  return [4, 6, 9, 11].includes(month) ? 30 : 31;
}

/** Days since 1970-01-01 for a valid `YYYY-MM-DD`, else null. */
export function isoDateToDays(value: unknown): number | null {
  if (typeof value !== 'string' || value.length !== 10) return null;
  const match = ISO_DATE.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1 || day > daysInMonth(year, month)) return null;
  // Howard Hinnant's days_from_civil.
  const y = month <= 2 ? year - 1 : year;
  const era = Math.floor(y / 400);
  const yoe = y - era * 400;
  const mp = (month + 9) % 12;
  const doy = Math.floor((153 * mp + 2) / 5) + day - 1;
  const doe = yoe * 365 + Math.floor(yoe / 4) - Math.floor(yoe / 100) + doy;
  return era * 146097 + doe - 719468;
}

/** The `YYYY-MM-DD` of a day count since 1970-01-01 (years 0000–9999), else null. */
export function daysToIsoDate(days: number): string | null {
  if (!Number.isInteger(days)) return null;
  const z = days + 719468;
  const era = Math.floor(z / 146097);
  const doe = z - era * 146097;
  const yoe = Math.floor(
    (doe - Math.floor(doe / 1460) + Math.floor(doe / 36524) - Math.floor(doe / 146096)) / 365
  );
  const doy = doe - (365 * yoe + Math.floor(yoe / 4) - Math.floor(yoe / 100));
  const mp = Math.floor((5 * doy + 2) / 153);
  const day = doy - Math.floor((153 * mp + 2) / 5) + 1;
  const month = mp < 10 ? mp + 3 : mp - 9;
  const year = yoe + era * 400 + (month <= 2 ? 1 : 0);
  if (year < 0 || year > 9999) return null;
  const pad = (n: number, width: number) => String(n).padStart(width, '0');
  return `${pad(year, 4)}-${pad(month, 2)}-${pad(day, 2)}`;
}

function dateArg(value: ExpressionValue): number | null | typeof VALUE {
  if (value === null) return null;
  const days = isoDateToDays(value);
  return days === null ? VALUE : days;
}

function numArg(value: ExpressionValue): number | null | typeof VALUE {
  if (value === null) return null;
  if (typeof value === 'number') return value;
  return VALUE;
}

function isEmptyValue(value: ExpressionValue): boolean {
  if (value === null) return true;
  if (typeof value === 'string') return value.trim().length === 0;
  if (isList(value)) return value.length === 0;
  return false;
}

/** The core function table (ADR-015). Names are case-sensitive. */
export const CORE_FUNCTIONS: ExpressionFunctionTable = Object.freeze({
  len: fn({
    minArgs: 1,
    maxArgs: 1,
    params: ['any'],
    returns: 'number',
    description: 'Characters in a string, or items in a list; 0 for empty.',
    call: ([value = null], context) => {
      if (isList(value)) return value.length;
      const text = str(value, context);
      return text === null ? LIMIT : text.length;
    },
  }),
  lower: fn({
    minArgs: 1,
    maxArgs: 1,
    params: ['string'],
    returns: 'string',
    description: 'Lowercase.',
    call: (args, context) => scan(context, args, (s) => s.toLowerCase()),
  }),
  upper: fn({
    minArgs: 1,
    maxArgs: 1,
    params: ['string'],
    returns: 'string',
    description: 'Uppercase.',
    call: (args, context) => scan(context, args, (s) => s.toUpperCase()),
  }),
  trim: fn({
    minArgs: 1,
    maxArgs: 1,
    params: ['string'],
    returns: 'string',
    description: 'Removes leading and trailing whitespace.',
    call: (args, context) => scan(context, args, (s) => s.trim()),
  }),
  contains: fn({
    minArgs: 2,
    maxArgs: 2,
    params: ['string', 'string'],
    returns: 'boolean',
    description:
      'Whether the first string contains the second (case-sensitive; use lower for both).',
    call: (args, context) => scan(context, args, (s, part) => s.includes(part as string)),
  }),
  startsWith: fn({
    minArgs: 2,
    maxArgs: 2,
    params: ['string', 'string'],
    returns: 'boolean',
    description: 'Whether the first string starts with the second.',
    call: (args, context) => scan(context, args, (s, part) => s.startsWith(part as string)),
  }),
  endsWith: fn({
    minArgs: 2,
    maxArgs: 2,
    params: ['string', 'string'],
    returns: 'boolean',
    description: 'Whether the first string ends with the second.',
    call: (args, context) => scan(context, args, (s, part) => s.endsWith(part as string)),
  }),
  isEmpty: fn({
    minArgs: 1,
    maxArgs: 1,
    params: ['any'],
    returns: 'boolean',
    description: 'True for null, a blank string or an empty list.',
    call: ([value = null]) => isEmptyValue(value),
  }),
  coalesce: fn({
    minArgs: 1,
    maxArgs: 16,
    params: ['any'],
    returns: 'any',
    description: 'The first argument that is not empty, else null.',
    call: (args) => args.find((value) => !isEmptyValue(value)) ?? null,
  }),
  includes: fn({
    minArgs: 2,
    maxArgs: 2,
    params: ['list', 'any'],
    returns: 'boolean',
    description: 'Whether a list (a multiple choice or tags answer) holds a value.',
    call: ([list = null, item = null], context) => {
      if (list === null) return false;
      if (!isList(list) || isList(item)) return VALUE;
      if (!context.charge(list.length)) return LIMIT;
      return list.includes(item as ExpressionScalar);
    },
  }),
  count: fn({
    minArgs: 1,
    maxArgs: 1,
    params: ['list'],
    returns: 'number',
    description: 'Items in a list that are not null.',
    call: ([list = null], context) => {
      if (list === null) return 0;
      if (!isList(list)) return VALUE;
      if (!context.charge(list.length)) return LIMIT;
      return list.filter((item) => item !== null).length;
    },
  }),
  sum: fn({
    minArgs: 1,
    maxArgs: 1,
    params: ['list'],
    returns: 'number',
    description: 'The sum of the numbers in a list (other items are skipped).',
    call: ([list = null], context) => {
      if (list === null) return 0;
      if (!isList(list)) return typeof list === 'number' ? list : VALUE;
      if (!context.charge(list.length)) return LIMIT;
      let total = 0;
      for (const item of list) if (typeof item === 'number') total += item;
      return Number.isFinite(total) ? total : ERRORS['#NUM!'];
    },
  }),
  abs: fn({
    minArgs: 1,
    maxArgs: 1,
    params: ['number'],
    returns: 'number',
    description: 'Absolute value.',
    call: ([value = null]) => {
      const n = numArg(value);
      return n === null || n === VALUE ? n : Math.abs(n as number);
    },
  }),
  floor: fn({
    minArgs: 1,
    maxArgs: 1,
    params: ['number'],
    returns: 'number',
    description: 'Rounds down to an integer.',
    call: ([value = null]) => {
      const n = numArg(value);
      return n === null || n === VALUE ? n : Math.floor(n as number);
    },
  }),
  ceil: fn({
    minArgs: 1,
    maxArgs: 1,
    params: ['number'],
    returns: 'number',
    description: 'Rounds up to an integer.',
    call: ([value = null]) => {
      const n = numArg(value);
      return n === null || n === VALUE ? n : Math.ceil(n as number);
    },
  }),
  number: fn({
    minArgs: 1,
    maxArgs: 1,
    params: ['any'],
    returns: 'number',
    description: 'A number from a number or a plain decimal string ("12.5"); null when blank.',
    call: ([value = null]) => {
      if (value === null || typeof value === 'number') return value;
      if (typeof value !== 'string') return VALUE;
      const text = value.trim();
      if (text === '') return null;
      if (text.length > 64 || !/^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d{1,3})?$/.test(text))
        return VALUE;
      const n = Number(text);
      return Number.isFinite(n) ? n : ERRORS['#NUM!'];
    },
  }),
  today: fn({
    minArgs: 0,
    maxArgs: 0,
    params: [],
    returns: 'date',
    description: "The host clock's UTC day as YYYY-MM-DD; #N/A when the host gave no clock.",
    call: (_args, context) => {
      const now = context.now();
      if (now === undefined) return ERRORS['#N/A'];
      return daysToIsoDate(Math.floor(now / 86_400_000)) ?? ERRORS['#NUM!'];
    },
  }),
  date: fn({
    minArgs: 3,
    maxArgs: 3,
    params: ['number', 'number', 'number'],
    returns: 'date',
    description: 'The YYYY-MM-DD for a year, month (1–12) and day; #NUM! when not a real day.',
    call: (args) => {
      const [y, m, d] = args;
      if (![y, m, d].every((n) => typeof n === 'number' && Number.isInteger(n))) return VALUE;
      const text = `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      return isoDateToDays(text) === null ? ERRORS['#NUM!'] : text;
    },
  }),
  isDate: fn({
    minArgs: 1,
    maxArgs: 1,
    params: ['any'],
    returns: 'boolean',
    description: 'Whether a value is a real calendar day written YYYY-MM-DD.',
    call: ([value = null]) => isoDateToDays(value) !== null,
  }),
  daysBetween: fn({
    minArgs: 2,
    maxArgs: 2,
    params: ['date', 'date'],
    returns: 'number',
    description: 'Whole days from the first date to the second (negative when earlier).',
    call: ([a = null, b = null]) => {
      const x = dateArg(a);
      const y = dateArg(b);
      if (x === VALUE || y === VALUE) return VALUE;
      if (x === null || y === null) return null;
      return (y as number) - (x as number);
    },
  }),
  addDays: fn({
    minArgs: 2,
    maxArgs: 2,
    params: ['date', 'number'],
    returns: 'date',
    description: 'The date a number of days after (or before, when negative) a date.',
    call: ([a = null, n = null]) => {
      const x = dateArg(a);
      if (x === VALUE) return VALUE;
      if (x === null || n === null) return null;
      if (typeof n !== 'number' || !Number.isInteger(n)) return VALUE;
      return daysToIsoDate((x as number) + n) ?? ERRORS['#NUM!'];
    },
  }),
  year: fn({
    minArgs: 1,
    maxArgs: 1,
    params: ['date'],
    returns: 'number',
    description: 'The year of a date.',
    call: ([a = null]) =>
      dateArg(a) === VALUE ? VALUE : a === null ? null : Number((a as string).slice(0, 4)),
  }),
  month: fn({
    minArgs: 1,
    maxArgs: 1,
    params: ['date'],
    returns: 'number',
    description: 'The month (1–12) of a date.',
    call: ([a = null]) =>
      dateArg(a) === VALUE ? VALUE : a === null ? null : Number((a as string).slice(5, 7)),
  }),
  day: fn({
    minArgs: 1,
    maxArgs: 1,
    params: ['date'],
    returns: 'number',
    description: 'The day of the month of a date.',
    call: ([a = null]) =>
      dateArg(a) === VALUE ? VALUE : a === null ? null : Number((a as string).slice(8, 10)),
  }),
});
