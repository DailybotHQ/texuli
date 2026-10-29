import {
  EXPRESSION_LIMITS,
  type ExpressionError,
  type ExpressionErrorCode,
  type ExpressionScalar,
  type ExpressionValue,
} from './types.ts';

/* Values: the error singletons, normalization of outside values and rounding. */

export const ERRORS: Readonly<Record<ExpressionErrorCode, ExpressionError>> = Object.freeze({
  '#DIV/0!': Object.freeze({ error: '#DIV/0!' }),
  '#VALUE!': Object.freeze({ error: '#VALUE!' }),
  '#REF!': Object.freeze({ error: '#REF!' }),
  '#NAME?': Object.freeze({ error: '#NAME?' }),
  '#NUM!': Object.freeze({ error: '#NUM!' }),
  '#N/A': Object.freeze({ error: '#N/A' }),
  '#CYCLE!': Object.freeze({ error: '#CYCLE!' }),
  '#LIMIT!': Object.freeze({ error: '#LIMIT!' }),
} as const);

/** The (frozen, shared) error value for a code. */
export function expressionError(code: ExpressionErrorCode): ExpressionError {
  return ERRORS[code];
}

/** Whether a value is an error value. */
export function isExpressionError(value: unknown): value is ExpressionError {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    typeof (value as { error?: unknown }).error === 'string' &&
    Object.hasOwn(ERRORS, (value as { error: string }).error)
  );
}

/** Only `true` is true: errors, `null` (unknown) and everything else are not. */
export function isTrue(value: ExpressionValue): boolean {
  return value === true;
}

export const LIMIT = ERRORS['#LIMIT!'];
export const VALUE = ERRORS['#VALUE!'];

function scalar(raw: unknown): ExpressionScalar | ExpressionError {
  if (raw === null || raw === undefined) return null;
  if (typeof raw === 'number') return Number.isFinite(raw) ? (raw === 0 ? 0 : raw) : null;
  if (typeof raw === 'string') return raw.length > EXPRESSION_LIMITS.stringLength ? LIMIT : raw;
  if (typeof raw === 'boolean') return raw;
  if (isExpressionError(raw)) return ERRORS[raw.error];
  return VALUE;
}

/** Normalize an outside value (an input or a function result) into an expression value. */
export function toExpressionValue(raw: unknown): ExpressionValue {
  if (!Array.isArray(raw)) return scalar(raw);
  if (raw.length > EXPRESSION_LIMITS.listItems) return LIMIT;
  const out: ExpressionScalar[] = [];
  for (const item of raw) {
    const value = scalar(item);
    if (isExpressionError(value)) return value;
    out.push(value);
  }
  return Object.freeze(out);
}

/** Rounds half away from zero to `digits` decimals (negative: tens, hundreds…). */
export function roundHalfAway(value: number, digits = 0): number | null {
  const factor = 10 ** Math.abs(digits);
  const scaled = digits >= 0 ? Math.abs(value) * factor : Math.abs(value) / factor;
  const rounded = Math.round(scaled + scaled * Number.EPSILON);
  const result = Math.sign(value) * (digits >= 0 ? rounded / factor : rounded * factor);
  if (!Number.isFinite(result)) return null;
  return result === 0 ? 0 : result;
}
