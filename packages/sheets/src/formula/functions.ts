import {
  daysToIsoDate,
  EXPRESSION_LIMITS,
  type ExpressionError,
  type ExpressionFunction,
  type ExpressionFunctionContext,
  type ExpressionFunctionTable,
  type ExpressionScalar,
  type ExpressionType,
  type ExpressionValue,
  expressionError,
  isExpressionError,
  isoDateToDays,
} from '@texuli/core/expression';
import { type CalendarDate, daysBetween, parseDate } from '@texuli/date';
import { compileCriteria } from './criteria.ts';
import { formatText } from './text-format.ts';

/*
 * The sheet function library (ADR-015): a closed table the core evaluator
 * calls. Every function is pure, bounded and total: work proportional to
 * input (scanning a range, a string) is charged as evaluation steps, and a
 * thrown exception becomes `#VALUE!` in the core. There is no RAND (sheets
 * stay deterministic), no INDIRECT or OFFSET (no reference built from text)
 * and no function that reaches the host besides TODAY and NOW, which read
 * the clock the host passed in.
 *
 * Ranges arrive as flat, row-major lists. Lookups that need a range's width
 * (INDEX, VLOOKUP) get it from the parser as a hidden first argument, so
 * the width is static like every reference.
 */

/** Documentation of one sheet function. */
export interface SheetFunctionInfo {
  readonly category: 'math' | 'logic' | 'info' | 'text' | 'lookup' | 'date';
  /** User-facing arity (the hidden width argument of a lookup is not counted). */
  readonly minArgs: number;
  readonly maxArgs: number;
  /** The argument whose range width a lookup receives as a hidden first argument. */
  readonly shaped?: number;
  readonly signature: string;
  readonly description: string;
  readonly example: string;
}

const NA = expressionError('#N/A');
const VALUE = expressionError('#VALUE!');
const NUM = expressionError('#NUM!');
const DIV0 = expressionError('#DIV/0!');
const REF = expressionError('#REF!');
const LIMIT = expressionError('#LIMIT!');

type List = readonly ExpressionScalar[];
const isList = (value: ExpressionValue): value is List => Array.isArray(value);

/**
 * Visit every scalar of the arguments, ranges flattened, charging one step
 * per range item (a plain loop: this is the hot path of every aggregate).
 */
function eachItem(
  args: readonly ExpressionValue[],
  context: ExpressionFunctionContext,
  visit: (value: ExpressionScalar, fromRange: boolean) => boolean | undefined
): void {
  for (const arg of args) {
    if (isList(arg)) {
      if (!context.charge(arg.length)) return;
      for (let i = 0; i < arg.length; i += 1) {
        if (visit(arg[i] as ExpressionScalar, true) === false) return;
      }
    } else if (!isExpressionError(arg)) {
      if (visit(arg, false) === false) return;
    }
  }
}

/** Numbers of the arguments: numbers anywhere, booleans written as arguments; text and blanks skipped. */
function numbers(
  args: readonly ExpressionValue[],
  context: ExpressionFunctionContext
): number[] | ExpressionError {
  const out: number[] = [];
  eachItem(args, context, (value, fromRange) => {
    if (typeof value === 'number') out.push(value);
    else if (typeof value === 'boolean' && !fromRange) out.push(value ? 1 : 0);
    return true;
  });
  return out;
}

function finite(n: number): number | ExpressionError {
  if (!Number.isFinite(n)) return NUM;
  return n === 0 ? 0 : n;
}

/** A scalar argument as a number: blanks are 0, booleans 1 or 0, text and lists are `#VALUE!`. */
function toNumber(value: ExpressionValue | undefined): number | ExpressionError {
  if (value === undefined || value === null) return 0;
  if (typeof value === 'number') return value;
  if (typeof value === 'boolean') return value ? 1 : 0;
  if (isExpressionError(value)) return value;
  if (isList(value)) return value.length === 1 ? toNumber(value[0]) : VALUE;
  return VALUE;
}

function toInteger(value: ExpressionValue | undefined): number | ExpressionError {
  const n = toNumber(value);
  return typeof n === 'number' ? Math.trunc(n) : n;
}

/** A scalar argument as text, charging its length. */
function toText(
  value: ExpressionValue | undefined,
  context: ExpressionFunctionContext
): string | ExpressionError {
  if (value === undefined || value === null) return '';
  if (isExpressionError(value)) return value;
  if (isList(value)) return value.length === 1 ? toText(value[0], context) : VALUE;
  if (typeof value === 'boolean') return value ? 'TRUE' : 'FALSE';
  if (typeof value === 'number') return numberText(value);
  return context.charge(value.length / 16) ? value : LIMIT;
}

/** The general display of a number: up to 15 significant digits, no float noise. */
export function numberText(value: number): string {
  if (!Number.isFinite(value)) return '#NUM!';
  if (value === 0) return '0';
  const rounded = Number(value.toPrecision(15));
  return String(rounded);
}

function truthy(value: ExpressionValue | undefined): boolean | ExpressionError {
  if (value === undefined || value === null) return false;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  if (isExpressionError(value)) return value;
  if (isList(value)) return value.length === 1 ? truthy(value[0]) : VALUE;
  const upper = value.toUpperCase();
  if (upper === 'TRUE') return true;
  if (upper === 'FALSE') return false;
  return VALUE;
}

/** Equality used by lookups: numbers numerically, text ignoring case, blanks only match blanks. */
function same(a: ExpressionScalar, b: ExpressionScalar): boolean {
  if (typeof a === 'string' && typeof b === 'string') return a.toLowerCase() === b.toLowerCase();
  return a === b;
}

/** Ordering used by approximate lookups: numbers before text before booleans. */
function order(a: ExpressionScalar, b: ExpressionScalar): number | null {
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  if (typeof a === 'string' && typeof b === 'string') {
    const x = a.toLowerCase();
    const y = b.toLowerCase();
    return x < y ? -1 : x > y ? 1 : 0;
  }
  if (typeof a === 'boolean' && typeof b === 'boolean') return Number(a) - Number(b);
  return null;
}

const ISO_DAY = /^\d{4}-\d{2}-\d{2}/;

/** A date argument (ISO `YYYY-MM-DD`, or the date part of an ISO date-time). */
function toDate(value: ExpressionValue | undefined): CalendarDate | ExpressionError {
  if (typeof value !== 'string' || !ISO_DAY.test(value)) {
    return isExpressionError(value) ? value : VALUE;
  }
  const day = value.slice(0, 10);
  try {
    const date = parseDate(day);
    return date.toString() === day ? date : VALUE;
  } catch {
    return VALUE;
  }
}

const fn = (definition: ExpressionFunction): ExpressionFunction => Object.freeze(definition);
const ANY: readonly ExpressionType[] = ['any'];

function variadic(
  call: (args: readonly ExpressionValue[], context: ExpressionFunctionContext) => ExpressionValue,
  returns: ExpressionType = 'number',
  min = 1
): ExpressionFunction {
  return fn({ minArgs: min, maxArgs: EXPRESSION_LIMITS.args, params: ANY, returns, call });
}

function fixed(
  min: number,
  max: number,
  call: (args: readonly ExpressionValue[], context: ExpressionFunctionContext) => ExpressionValue,
  returns: ExpressionType = 'any',
  acceptsErrors = false
): ExpressionFunction {
  return fn({ minArgs: min, maxArgs: max, params: ANY, returns, call, acceptsErrors });
}

function roundWith(
  args: readonly ExpressionValue[],
  mode: (scaled: number) => number
): ExpressionValue {
  const value = toNumber(args[0]);
  if (isExpressionError(value)) return value;
  const digits = args.length > 1 ? toInteger(args[1]) : 0;
  if (isExpressionError(digits)) return digits;
  if (Math.abs(digits) > EXPRESSION_LIMITS.roundDigits) return NUM;
  const factor = 10 ** Math.abs(digits);
  const scaled = digits >= 0 ? Math.abs(value) * factor : Math.abs(value) / factor;
  // Snap float noise (2.675 * 100 = 267.49999…) before rounding away or toward zero.
  const snapped = Number(scaled.toPrecision(15));
  const rounded = mode(snapped);
  return finite(Math.sign(value) * (digits >= 0 ? rounded / factor : rounded * factor));
}

/** AND (`stop` false) and OR (`stop` true): blanks and text in ranges are skipped. */
function logical(
  args: readonly ExpressionValue[],
  context: ExpressionFunctionContext,
  stop: boolean
): ExpressionValue {
  let seen = false;
  let result: ExpressionValue = null;
  eachItem(args, context, (value, fromRange) => {
    if (value === null || (fromRange && typeof value === 'string')) return true;
    const test = truthy(value);
    if (isExpressionError(test)) {
      result = test;
      return false;
    }
    seen = true;
    if (test === stop) {
      result = stop;
      return false;
    }
    return true;
  });
  if (result !== null) return result;
  return seen ? !stop : VALUE;
}

/** The criteria aggregates: SUMIF, COUNTIF and AVERAGEIF. */
function conditional(
  args: readonly ExpressionValue[],
  context: ExpressionFunctionContext,
  mode: 'sum' | 'count' | 'average'
): ExpressionValue {
  const range = args[0] ?? null;
  const tested: List = isList(range) ? range : [range as ExpressionScalar];
  const criterion = args[1] ?? null;
  if (isList(criterion)) return VALUE;
  const match = compileCriteria(criterion as ExpressionScalar);
  if (isExpressionError(match)) return match;
  const target = mode === 'count' ? tested : args.length > 2 ? args[2] : tested;
  const values: List = isList(target ?? null) ? (target as List) : [target as ExpressionScalar];
  if (!context.charge(tested.length)) return LIMIT;
  let sum = 0;
  let count = 0;
  for (let i = 0; i < tested.length; i += 1) {
    const hit = match(tested[i] ?? null, context);
    if (hit === null) return LIMIT;
    if (!hit) continue;
    if (mode === 'count') {
      count += 1;
      continue;
    }
    const value = values[i] ?? null;
    if (typeof value === 'number') {
      sum += value;
      count += 1;
    }
  }
  if (mode === 'count') return count;
  if (mode === 'sum') return finite(sum);
  return count === 0 ? DIV0 : finite(sum / count);
}

const MS_PER_DAY = 86_400_000;

function clockDate(context: ExpressionFunctionContext): CalendarDate | ExpressionError {
  const now = context.now();
  if (now === undefined) return NA;
  const day = new Date(Math.floor(now / MS_PER_DAY) * MS_PER_DAY).toISOString().slice(0, 10);
  return parseDate(day);
}

/** The closed sheet function table, by upper-case name. */
export const SHEET_FUNCTIONS: ExpressionFunctionTable = Object.freeze({
  // ── Math and aggregates ─────────────────────────────────────
  SUM: variadic((args, context) => {
    const list = numbers(args, context);
    if (isExpressionError(list)) return list;
    let total = 0;
    for (const n of list) total += n;
    return finite(total);
  }),
  AVERAGE: variadic((args, context) => {
    const list = numbers(args, context);
    if (isExpressionError(list)) return list;
    if (list.length === 0) return DIV0;
    let total = 0;
    for (const n of list) total += n;
    return finite(total / list.length);
  }),
  MIN: variadic((args, context) => {
    const list = numbers(args, context);
    if (isExpressionError(list)) return list;
    let out = Infinity;
    for (const n of list) if (n < out) out = n;
    return list.length === 0 ? 0 : out;
  }),
  MAX: variadic((args, context) => {
    const list = numbers(args, context);
    if (isExpressionError(list)) return list;
    let out = -Infinity;
    for (const n of list) if (n > out) out = n;
    return list.length === 0 ? 0 : out;
  }),
  COUNT: variadic((args, context) => {
    let count = 0;
    eachItem(args, context, (value) => {
      if (typeof value === 'number') count += 1;
      return true;
    });
    return count;
  }),
  COUNTA: variadic((args, context) => {
    let count = 0;
    eachItem(args, context, (value) => {
      if (value !== null) count += 1;
      return true;
    });
    return count;
  }),
  COUNTBLANK: fixed(
    1,
    1,
    (args, context) => {
      let count = 0;
      eachItem(args, context, (value) => {
        if (value === null || value === '') count += 1;
        return true;
      });
      return count;
    },
    'number'
  ),
  PRODUCT: variadic((args, context) => {
    const list = numbers(args, context);
    if (isExpressionError(list)) return list;
    let total = 1;
    for (const n of list) total *= n;
    return list.length === 0 ? 0 : finite(total);
  }),
  MEDIAN: variadic((args, context) => {
    const list = numbers(args, context);
    if (isExpressionError(list)) return list;
    if (list.length === 0) return NUM;
    // n log n on at most 10,000 numbers per argument list; charged as such.
    if (!context.charge(list.length * 4)) return LIMIT;
    list.sort((a, b) => a - b);
    const mid = list.length >> 1;
    return list.length % 2 === 1
      ? (list[mid] as number)
      : finite(((list[mid - 1] as number) + (list[mid] as number)) / 2);
  }),
  ROUND: fixed(1, 2, (args) => roundWith(args, Math.round), 'number'),
  ROUNDUP: fixed(1, 2, (args) => roundWith(args, Math.ceil), 'number'),
  ROUNDDOWN: fixed(1, 2, (args) => roundWith(args, Math.floor), 'number'),
  INT: fixed(
    1,
    1,
    ([value]) => {
      const n = toNumber(value);
      return isExpressionError(n) ? n : finite(Math.floor(n));
    },
    'number'
  ),
  MOD: fixed(
    2,
    2,
    ([a, b]) => {
      const x = toNumber(a);
      if (isExpressionError(x)) return x;
      const y = toNumber(b);
      if (isExpressionError(y)) return y;
      if (y === 0) return DIV0;
      return finite(x - y * Math.floor(x / y));
    },
    'number'
  ),
  ABS: fixed(
    1,
    1,
    ([value]) => {
      const n = toNumber(value);
      return isExpressionError(n) ? n : Math.abs(n);
    },
    'number'
  ),
  POWER: fixed(
    2,
    2,
    ([a, b]) => {
      const x = toNumber(a);
      if (isExpressionError(x)) return x;
      const y = toNumber(b);
      if (isExpressionError(y)) return y;
      if (Math.abs(y) > EXPRESSION_LIMITS.exponent) return NUM;
      if (x === 0 && y < 0) return DIV0;
      return finite(x ** y);
    },
    'number'
  ),
  SQRT: fixed(
    1,
    1,
    ([value]) => {
      const n = toNumber(value);
      if (isExpressionError(n)) return n;
      return n < 0 ? NUM : Math.sqrt(n);
    },
    'number'
  ),
  SUMIF: fixed(2, 3, (args, context) => conditional(args, context, 'sum'), 'number'),
  COUNTIF: fixed(2, 2, (args, context) => conditional(args, context, 'count'), 'number'),
  AVERAGEIF: fixed(2, 3, (args, context) => conditional(args, context, 'average'), 'number'),

  // ── Logic (IF compiles to the core `if` node and evaluates lazily) ──
  IFS: fixed(
    2,
    EXPRESSION_LIMITS.args,
    (args) => {
      if (args.length % 2 !== 0) return VALUE;
      for (let i = 0; i < args.length; i += 2) {
        const test = truthy(args[i]);
        if (isExpressionError(test)) return test;
        if (test) return args[i + 1] ?? null;
      }
      return NA;
    },
    'any',
    true
  ),
  AND: variadic((args, context) => logical(args, context, false), 'boolean'),
  OR: variadic((args, context) => logical(args, context, true), 'boolean'),
  NOT: fixed(
    1,
    1,
    ([value]) => {
      const test = truthy(value);
      return isExpressionError(test) ? test : !test;
    },
    'boolean'
  ),
  IFERROR: fixed(
    2,
    2,
    ([value, fallback]) => (isExpressionError(value) ? (fallback ?? null) : (value ?? null)),
    'any',
    true
  ),

  // ── Information ─────────────────────────────────────────────
  ISBLANK: fixed(1, 1, ([value]) => value === null || value === undefined, 'boolean', true),
  ISNUMBER: fixed(1, 1, ([value]) => typeof value === 'number', 'boolean', true),
  ISTEXT: fixed(1, 1, ([value]) => typeof value === 'string', 'boolean', true),
  ISERROR: fixed(1, 1, ([value]) => isExpressionError(value), 'boolean', true),
  NA: fixed(0, 0, () => NA),

  // ── Text ────────────────────────────────────────────────────
  CONCAT: variadic((args, context) => {
    let length = 0;
    const parts: string[] = [];
    const state: { failure: ExpressionError | null } = { failure: null };
    eachItem(args, context, (value) => {
      const text = toText(value, context);
      if (isExpressionError(text)) state.failure = text;
      else {
        length += text.length;
        if (length > EXPRESSION_LIMITS.stringLength) state.failure = LIMIT;
        else parts.push(text);
      }
      return state.failure === null;
    });
    return state.failure ?? parts.join('');
  }, 'string'),
  LEN: fixed(
    1,
    1,
    ([value], context) => {
      const text = toText(value, context);
      return isExpressionError(text) ? text : text.length;
    },
    'number'
  ),
  LEFT: fixed(
    1,
    2,
    ([value, count], context) => {
      const text = toText(value, context);
      if (isExpressionError(text)) return text;
      const n = count === undefined ? 1 : toInteger(count);
      if (isExpressionError(n)) return n;
      return n < 0 ? VALUE : text.slice(0, n);
    },
    'string'
  ),
  RIGHT: fixed(
    1,
    2,
    ([value, count], context) => {
      const text = toText(value, context);
      if (isExpressionError(text)) return text;
      const n = count === undefined ? 1 : toInteger(count);
      if (isExpressionError(n)) return n;
      if (n < 0) return VALUE;
      return n === 0 ? '' : text.slice(Math.max(0, text.length - n));
    },
    'string'
  ),
  MID: fixed(
    3,
    3,
    ([value, start, count], context) => {
      const text = toText(value, context);
      if (isExpressionError(text)) return text;
      const from = toInteger(start);
      if (isExpressionError(from)) return from;
      const n = toInteger(count);
      if (isExpressionError(n)) return n;
      if (from < 1 || n < 0) return VALUE;
      return text.slice(from - 1, from - 1 + n);
    },
    'string'
  ),
  UPPER: fixed(
    1,
    1,
    ([value], context) => {
      const text = toText(value, context);
      return isExpressionError(text)
        ? text
        : text.toUpperCase().slice(0, EXPRESSION_LIMITS.stringLength);
    },
    'string'
  ),
  LOWER: fixed(
    1,
    1,
    ([value], context) => {
      const text = toText(value, context);
      return isExpressionError(text)
        ? text
        : text.toLowerCase().slice(0, EXPRESSION_LIMITS.stringLength);
    },
    'string'
  ),
  TRIM: fixed(
    1,
    1,
    ([value], context) => {
      const text = toText(value, context);
      return isExpressionError(text) ? text : text.trim().replace(/ {2,}/g, ' ');
    },
    'string'
  ),
  TEXT: fixed(
    2,
    2,
    ([value, format], context) => {
      const pattern = toText(format, context);
      if (isExpressionError(pattern)) return pattern;
      if (isExpressionError(value) || isList(value ?? null)) return VALUE;
      return formatText((value ?? null) as ExpressionScalar, pattern);
    },
    'string'
  ),
  SUBSTITUTE: fixed(
    3,
    4,
    ([value, from, to, instance], context) => {
      const text = toText(value, context);
      if (isExpressionError(text)) return text;
      const old = toText(from, context);
      if (isExpressionError(old)) return old;
      const next = toText(to, context);
      if (isExpressionError(next)) return next;
      if (old === '') return text;
      if (instance !== undefined) {
        const nth = toInteger(instance);
        if (isExpressionError(nth)) return nth;
        if (nth < 1) return VALUE;
        let at = -1;
        for (let k = 0; k < nth; k += 1) {
          at = text.indexOf(old, at + 1);
          if (at < 0) return text;
        }
        const out = text.slice(0, at) + next + text.slice(at + old.length);
        return out.length > EXPRESSION_LIMITS.stringLength ? LIMIT : out;
      }
      // Count first, so a hostile replacement cannot build a huge string.
      let hits = 0;
      for (let at = text.indexOf(old); at >= 0; at = text.indexOf(old, at + old.length)) hits += 1;
      if (text.length + hits * (next.length - old.length) > EXPRESSION_LIMITS.stringLength) {
        return LIMIT;
      }
      return text.split(old).join(next);
    },
    'string'
  ),
  VALUE: fixed(
    1,
    1,
    ([value], context) => {
      if (typeof value === 'number') return value;
      const text = toText(value, context);
      if (isExpressionError(text)) return text;
      const trimmed = text.trim();
      const percent = trimmed.endsWith('%');
      const body = percent ? trimmed.slice(0, -1) : trimmed;
      if (body.length === 0 || body.length > 64) return VALUE;
      if (!/^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d{1,3})?$/.test(body)) return VALUE;
      const n = Number(body);
      return finite(percent ? n / 100 : n);
    },
    'number'
  ),

  // ── Lookup ──────────────────────────────────────────────────
  INDEX: fixed(
    3,
    4,
    ([width, range, row, col], context) => {
      const w = toInteger(width);
      if (isExpressionError(w) || w < 1) return REF;
      const list: List = isList(range ?? null) ? (range as List) : [range as ExpressionScalar];
      if (!context.charge(1)) return LIMIT;
      const height = Math.ceil(list.length / w);
      let r = toInteger(row);
      if (isExpressionError(r)) return r;
      let c = col === undefined ? 1 : toInteger(col);
      if (isExpressionError(c)) return c;
      // One index into a single row picks a column.
      if (col === undefined && height === 1 && w > 1) {
        c = r;
        r = 1;
      }
      if (r < 1 || c < 1 || r > height || c > w) return REF;
      return list[(r - 1) * w + (c - 1)] ?? null;
    },
    'any'
  ),
  MATCH: fixed(
    2,
    3,
    ([key, range, type], context) => {
      if (isList(key ?? null)) return VALUE;
      const needle = (key ?? null) as ExpressionScalar;
      const list: List = isList(range ?? null) ? (range as List) : [range as ExpressionScalar];
      const mode = type === undefined ? 1 : toInteger(type);
      if (isExpressionError(mode)) return mode;
      if (!context.charge(list.length)) return LIMIT;
      if (mode === 0) {
        const at = list.findIndex((item) => same(item, needle));
        return at < 0 ? NA : at + 1;
      }
      // Sorted lookups: the last item not past the key, scanning once.
      let found = -1;
      for (let i = 0; i < list.length; i += 1) {
        const cmp = order(list[i] ?? null, needle);
        if (cmp === null) continue;
        if (mode > 0 ? cmp <= 0 : cmp >= 0) found = i;
        else break;
      }
      return found < 0 ? NA : found + 1;
    },
    'number'
  ),
  VLOOKUP: fixed(
    4,
    5,
    ([width, key, range, col, approximate], context) => {
      const w = toInteger(width);
      if (isExpressionError(w) || w < 1) return REF;
      if (isList(key ?? null)) return VALUE;
      const needle = (key ?? null) as ExpressionScalar;
      const list: List = isList(range ?? null) ? (range as List) : [range as ExpressionScalar];
      const c = toInteger(col);
      if (isExpressionError(c)) return c;
      if (c < 1) return VALUE;
      if (c > w) return REF;
      const approx = approximate === undefined ? true : truthy(approximate);
      if (isExpressionError(approx)) return approx;
      const rows = Math.ceil(list.length / w);
      if (!context.charge(rows)) return LIMIT;
      let found = -1;
      for (let r = 0; r < rows; r += 1) {
        const item = list[r * w] ?? null;
        if (!approx) {
          if (same(item, needle)) {
            found = r;
            break;
          }
          continue;
        }
        const cmp = order(item, needle);
        if (cmp === null) continue;
        if (cmp <= 0) found = r;
        else break;
      }
      return found < 0 ? NA : (list[found * w + (c - 1)] ?? null);
    },
    'any'
  ),
  XLOOKUP: fixed(
    3,
    4,
    ([key, lookup, values, missing], context) => {
      if (isList(key ?? null)) return VALUE;
      const needle = (key ?? null) as ExpressionScalar;
      const keys: List = isList(lookup ?? null) ? (lookup as List) : [lookup as ExpressionScalar];
      const out: List = isList(values ?? null) ? (values as List) : [values as ExpressionScalar];
      if (keys.length !== out.length) return VALUE;
      if (!context.charge(keys.length)) return LIMIT;
      const at = keys.findIndex((item) => same(item, needle));
      if (at < 0) return missing === undefined ? NA : (missing ?? null);
      return out[at] ?? null;
    },
    'any'
  ),

  // ── Dates (ISO YYYY-MM-DD text, on @texuli/date) ───────────
  DATE: fixed(
    3,
    3,
    ([yearArg, monthArg, dayArg]) => {
      const year = toInteger(yearArg);
      if (isExpressionError(year)) return year;
      const month = toInteger(monthArg);
      if (isExpressionError(month)) return month;
      const day = toInteger(dayArg);
      if (isExpressionError(day)) return day;
      if (Math.abs(year) > 9999 || Math.abs(month) > 120_000 || Math.abs(day) > 4_000_000) {
        return NUM;
      }
      // Months and days past their range roll over (DATE(2026, 13, 1) is 2027-01-01).
      const total = year * 12 + (month - 1);
      const y = Math.floor(total / 12);
      if (y < 1 || y > 9999) return NUM;
      const first = isoDateToDays(
        `${String(y).padStart(4, '0')}-${String(total - y * 12 + 1).padStart(2, '0')}-01`
      );
      if (first === null) return NUM;
      const text = daysToIsoDate(first + day - 1);
      return text === null || text < '0001' ? NUM : text;
    },
    'date'
  ),
  YEAR: fixed(
    1,
    1,
    ([value]) => {
      const date = toDate(value);
      return isExpressionError(date) ? date : date.year;
    },
    'number'
  ),
  MONTH: fixed(
    1,
    1,
    ([value]) => {
      const date = toDate(value);
      return isExpressionError(date) ? date : date.month;
    },
    'number'
  ),
  DAY: fixed(
    1,
    1,
    ([value]) => {
      const date = toDate(value);
      return isExpressionError(date) ? date : date.day;
    },
    'number'
  ),
  DAYS: fixed(
    2,
    2,
    ([end, start]) => {
      const a = toDate(end);
      if (isExpressionError(a)) return a;
      const b = toDate(start);
      if (isExpressionError(b)) return b;
      return daysBetween(b, a);
    },
    'number'
  ),
  EDATE: fixed(
    2,
    2,
    ([start, months]) => {
      const date = toDate(start);
      if (isExpressionError(date)) return date;
      const n = toInteger(months);
      if (isExpressionError(n)) return n;
      if (Math.abs(n) > 120_000) return NUM;
      const total = date.year * 12 + date.month - 1 + n;
      if (total < 12 || total >= 120_000) return NUM;
      return date.add({ months: n }).toString();
    },
    'date'
  ),
  TODAY: fixed(
    0,
    0,
    (_args, context) => {
      const date = clockDate(context);
      return isExpressionError(date) ? date : date.toString();
    },
    'date'
  ),
  NOW: fixed(
    0,
    0,
    (_args, context) => {
      const now = context.now();
      if (now === undefined) return NA;
      const iso = new Date(now).toISOString();
      return `${iso.slice(0, 19)}Z`;
    },
    'string'
  ),
});

const info = (
  category: SheetFunctionInfo['category'],
  minArgs: number,
  maxArgs: number,
  signature: string,
  description: string,
  example: string,
  shaped?: number
): SheetFunctionInfo =>
  Object.freeze({
    category,
    minArgs,
    maxArgs,
    signature,
    description,
    example,
    ...(shaped === undefined ? {} : { shaped }),
  });

const MANY = EXPRESSION_LIMITS.args;

/** Every sheet function with its arity, signature, description and an example. */
export const SHEET_FUNCTION_INFO: Readonly<Record<string, SheetFunctionInfo>> = Object.freeze({
  SUM: info(
    'math',
    1,
    MANY,
    'SUM(value, …)',
    'Adds the numbers; text and blanks are skipped.',
    '=SUM(B2:B9)'
  ),
  AVERAGE: info(
    'math',
    1,
    MANY,
    'AVERAGE(value, …)',
    'The mean of the numbers; #DIV/0! when there are none.',
    '=AVERAGE(B2:B9)'
  ),
  MIN: info(
    'math',
    1,
    MANY,
    'MIN(value, …)',
    'The smallest number (0 when there are none).',
    '=MIN(B2:B9)'
  ),
  MAX: info(
    'math',
    1,
    MANY,
    'MAX(value, …)',
    'The largest number (0 when there are none).',
    '=MAX(B2:B9)'
  ),
  COUNT: info('math', 1, MANY, 'COUNT(value, …)', 'How many values are numbers.', '=COUNT(B2:B9)'),
  COUNTA: info(
    'math',
    1,
    MANY,
    'COUNTA(value, …)',
    'How many values are not blank.',
    '=COUNTA(A2:A9)'
  ),
  COUNTBLANK: info(
    'math',
    1,
    1,
    'COUNTBLANK(range)',
    'How many cells are blank or empty text.',
    '=COUNTBLANK(C2:C9)'
  ),
  PRODUCT: info(
    'math',
    1,
    MANY,
    'PRODUCT(value, …)',
    'Multiplies the numbers.',
    '=PRODUCT(B2, C2)'
  ),
  MEDIAN: info(
    'math',
    1,
    MANY,
    'MEDIAN(value, …)',
    'The middle number; #NUM! when there are none.',
    '=MEDIAN(B2:B9)'
  ),
  ROUND: info(
    'math',
    1,
    2,
    'ROUND(number, [digits])',
    'Rounds half away from zero to a number of digits (negative: tens, hundreds).',
    '=ROUND(B2, 2)'
  ),
  ROUNDUP: info(
    'math',
    1,
    2,
    'ROUNDUP(number, [digits])',
    'Rounds away from zero.',
    '=ROUNDUP(B2, 0)'
  ),
  ROUNDDOWN: info(
    'math',
    1,
    2,
    'ROUNDDOWN(number, [digits])',
    'Rounds toward zero.',
    '=ROUNDDOWN(B2, 1)'
  ),
  INT: info('math', 1, 1, 'INT(number)', 'Rounds down to an integer.', '=INT(B2)'),
  MOD: info(
    'math',
    2,
    2,
    'MOD(number, divisor)',
    'The remainder, with the sign of the divisor; #DIV/0! for 0.',
    '=MOD(B2, 7)'
  ),
  ABS: info('math', 1, 1, 'ABS(number)', 'The absolute value.', '=ABS(B2)'),
  POWER: info(
    'math',
    2,
    2,
    'POWER(number, exponent)',
    'A number raised to a power (exponent at most ±64).',
    '=POWER(2, 10)'
  ),
  SQRT: info(
    'math',
    1,
    1,
    'SQRT(number)',
    'The square root; #NUM! for a negative number.',
    '=SQRT(B2)'
  ),
  SUMIF: info(
    'math',
    2,
    3,
    'SUMIF(range, criteria, [sum_range])',
    'Adds the cells whose partner matches the criteria (">5", "<>done", "a*", 10).',
    '=SUMIF(C2:C9, "paid", B2:B9)'
  ),
  COUNTIF: info(
    'math',
    2,
    2,
    'COUNTIF(range, criteria)',
    'How many cells match the criteria.',
    '=COUNTIF(C2:C9, ">=100")'
  ),
  AVERAGEIF: info(
    'math',
    2,
    3,
    'AVERAGEIF(range, criteria, [average_range])',
    'The mean of the cells whose partner matches the criteria.',
    '=AVERAGEIF(C2:C9, "east", B2:B9)'
  ),
  IF: info(
    'logic',
    2,
    3,
    'IF(test, then, [else])',
    'One of two values; only the chosen branch is evaluated.',
    '=IF(B2>100, "high", "low")'
  ),
  IFS: info(
    'logic',
    2,
    MANY,
    'IFS(test, value, …)',
    'The value of the first true test; #N/A when none is true.',
    '=IFS(B2>90, "A", B2>80, "B", TRUE, "C")'
  ),
  AND: info('logic', 1, MANY, 'AND(test, …)', 'TRUE when every test is true.', '=AND(B2>0, C2<10)'),
  OR: info('logic', 1, MANY, 'OR(test, …)', 'TRUE when any test is true.', '=OR(B2>0, C2<10)'),
  NOT: info('logic', 1, 1, 'NOT(test)', 'The opposite truth value.', '=NOT(D2)'),
  IFERROR: info(
    'logic',
    2,
    2,
    'IFERROR(value, fallback)',
    'The value, or the fallback when it is an error.',
    '=IFERROR(B2/C2, 0)'
  ),
  ISBLANK: info('info', 1, 1, 'ISBLANK(value)', 'Whether a value is blank.', '=ISBLANK(B2)'),
  ISNUMBER: info('info', 1, 1, 'ISNUMBER(value)', 'Whether a value is a number.', '=ISNUMBER(B2)'),
  ISTEXT: info('info', 1, 1, 'ISTEXT(value)', 'Whether a value is text.', '=ISTEXT(A2)'),
  ISERROR: info('info', 1, 1, 'ISERROR(value)', 'Whether a value is an error.', '=ISERROR(B2/C2)'),
  NA: info('info', 0, 0, 'NA()', 'The #N/A error.', '=NA()'),
  CONCAT: info(
    'text',
    1,
    MANY,
    'CONCAT(text, …)',
    'Joins text (ranges row by row); at most 32,768 characters.',
    '=CONCAT(A2, " ", B2)'
  ),
  LEN: info('text', 1, 1, 'LEN(text)', 'The number of characters.', '=LEN(A2)'),
  LEFT: info(
    'text',
    1,
    2,
    'LEFT(text, [count])',
    'The first characters (1 by default).',
    '=LEFT(A2, 3)'
  ),
  RIGHT: info(
    'text',
    1,
    2,
    'RIGHT(text, [count])',
    'The last characters (1 by default).',
    '=RIGHT(A2, 4)'
  ),
  MID: info(
    'text',
    3,
    3,
    'MID(text, start, count)',
    'Characters from a 1-based start.',
    '=MID(A2, 2, 3)'
  ),
  UPPER: info('text', 1, 1, 'UPPER(text)', 'Upper case.', '=UPPER(A2)'),
  LOWER: info('text', 1, 1, 'LOWER(text)', 'Lower case.', '=LOWER(A2)'),
  TRIM: info(
    'text',
    1,
    1,
    'TRIM(text)',
    'Removes outer spaces and collapses runs of spaces.',
    '=TRIM(A2)'
  ),
  TEXT: info(
    'text',
    2,
    2,
    'TEXT(value, format)',
    'A number or date as text in one of the closed formats (see the docs).',
    '=TEXT(B2, "#,##0.00")'
  ),
  SUBSTITUTE: info(
    'text',
    3,
    4,
    'SUBSTITUTE(text, old, new, [instance])',
    'Replaces every (or the nth) occurrence of a text.',
    '=SUBSTITUTE(A2, "-", " ")'
  ),
  VALUE: info(
    'text',
    1,
    1,
    'VALUE(text)',
    'A number from plain decimal text ("12.5", "40%").',
    '=VALUE(A2)'
  ),
  INDEX: info(
    'lookup',
    2,
    3,
    'INDEX(range, row, [column])',
    'The cell at a 1-based row and column of a range; #REF! outside it.',
    '=INDEX(A2:C9, 3, 2)',
    0
  ),
  MATCH: info(
    'lookup',
    2,
    3,
    'MATCH(key, range, [type])',
    'The 1-based position of a key: 0 exact, 1 (default) largest not above, -1 smallest not below.',
    '=MATCH("Lima", A2:A9, 0)'
  ),
  VLOOKUP: info(
    'lookup',
    3,
    4,
    'VLOOKUP(key, range, column, [approximate])',
    'Finds a key in the first column and returns a column of that row; FALSE for an exact match.',
    '=VLOOKUP("Lima", A2:C9, 3, FALSE)',
    1
  ),
  XLOOKUP: info(
    'lookup',
    3,
    4,
    'XLOOKUP(key, lookup_range, return_range, [if_not_found])',
    'Exact lookup in one range, the partner in another.',
    '=XLOOKUP("Lima", A2:A9, C2:C9, "none")'
  ),
  DATE: info(
    'date',
    3,
    3,
    'DATE(year, month, day)',
    'The ISO date (YYYY-MM-DD); months and days past their range roll over.',
    '=DATE(2026, 11, 2)'
  ),
  YEAR: info('date', 1, 1, 'YEAR(date)', 'The year of an ISO date.', '=YEAR(A2)'),
  MONTH: info('date', 1, 1, 'MONTH(date)', 'The month (1–12) of an ISO date.', '=MONTH(A2)'),
  DAY: info('date', 1, 1, 'DAY(date)', 'The day of the month of an ISO date.', '=DAY(A2)'),
  DAYS: info('date', 2, 2, 'DAYS(end, start)', 'Whole days from start to end.', '=DAYS(B2, A2)'),
  EDATE: info(
    'date',
    2,
    2,
    'EDATE(date, months)',
    'The date a number of months later (or earlier), clamped to the month end.',
    '=EDATE(A2, 3)'
  ),
  TODAY: info(
    'date',
    0,
    0,
    'TODAY()',
    "The host clock's UTC day; #N/A when the host gave no clock.",
    '=TODAY()'
  ),
  NOW: info(
    'date',
    0,
    0,
    'NOW()',
    'The host clock as an ISO date-time (UTC); #N/A without a clock.',
    '=NOW()'
  ),
});

/** Every function name, sorted. */
export const SHEET_FUNCTION_NAMES: readonly string[] = Object.freeze(
  Object.keys(SHEET_FUNCTION_INFO).sort()
);
