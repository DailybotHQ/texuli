import { CORE_FUNCTIONS } from './functions.ts';
import {
  EXPRESSION_LIMITS,
  type Expression,
  type ExpressionError,
  type ExpressionFunctionContext,
  type ExpressionFunctionTable,
  type ExpressionNode,
  type ExpressionScalar,
  type ExpressionValue,
} from './types.ts';
import {
  ERRORS,
  isExpressionError,
  LIMIT,
  roundHalfAway,
  toExpressionValue,
  VALUE,
} from './values.ts';

/*
 * The bounded evaluator of ADR-015. Pure and total: it never throws and
 * never loops. Every node visit costs one step, and functions charge extra
 * steps for work proportional to their input (scanning a string, reading a
 * range), so the step counts make the limits deterministic. Running out of
 * steps, or producing a string or list past its cap, is the `#LIMIT!`
 * value. Logic is three-valued: a comparison with an empty (`null`)
 * operand is `null` ("unknown"), `and`, `or` and `not` keep unknowns, and
 * only `true` counts as true (`isTrue`).
 */

/**
 * A step budget shared by every expression of one recalculation pass
 * (default `EXPRESSION_LIMITS.passSteps`, 10,000,000). Once spent, every
 * further evaluation in the pass is `#LIMIT!`.
 */
export interface ExpressionBudget {
  readonly limit: number;
  /** Steps spent so far. */
  readonly used: number;
  readonly exhausted: boolean;
  /** Spend steps; returns false (and marks the budget exhausted) past the limit. */
  spend(steps: number): boolean;
}

/** Make a budget for one recalculation pass. */
export function createExpressionBudget(
  limit: number = EXPRESSION_LIMITS.passSteps
): ExpressionBudget {
  const cap = Number.isFinite(limit) && limit > 0 ? Math.floor(limit) : 0;
  let used = 0;
  let exhausted = cap === 0;
  return {
    limit: cap,
    get used() {
      return used;
    },
    get exhausted() {
      return exhausted;
    },
    spend(steps: number): boolean {
      if (exhausted) return false;
      used += steps;
      if (used > cap) exhausted = true;
      return !exhausted;
    },
  };
}

/**
 * Where an expression reads its inputs. Every method is optional; a
 * missing `field` reads `null`, a missing `ref` or `range` is `#REF!`.
 * Returned values are normalized: non-finite numbers become `null`,
 * strings and lists past their caps become `#LIMIT!`, anything else that
 * is not a scalar, a flat list or an error value becomes `#VALUE!`.
 */
export interface ExpressionEnv {
  /** A `field` or `var` value by name. */
  field?(name: string): unknown;
  /** A dialect reference (`ref` node), such as a sheet cell. */
  ref?(ref: string): unknown;
  /** A dialect interval (`range` node) as a flat list, such as `A1:B3`. */
  range?(from: string, to: string): unknown;
  /** The host clock for `today()` (milliseconds or a Date). */
  now?(): number | Date;
}

export interface ExpressionEvaluateOptions {
  /** The closed function table (default `CORE_FUNCTIONS`); unknown names are `#NAME?`. */
  readonly functions?: ExpressionFunctionTable;
  /** The recalculation pass this evaluation belongs to. */
  readonly budget?: ExpressionBudget;
  /** Steps for this expression (default and maximum `EXPRESSION_LIMITS.steps`). */
  readonly steps?: number;
  /**
   * How empty (`null`) operands behave in arithmetic and comparisons:
   * `null` (default, forms) keeps them unknown; `zero` (spreadsheets) reads
   * them as 0 or the empty string.
   */
  readonly blank?: 'null' | 'zero';
  /** Compare strings ignoring case (spreadsheet `=` semantics). Default false. */
  readonly caseInsensitive?: boolean;
}

interface Run {
  left: number;
  exhausted: boolean;
  readonly budget: ExpressionBudget | undefined;
  readonly env: ExpressionEnv;
  readonly functions: ExpressionFunctionTable;
  readonly zero: boolean;
  readonly ci: boolean;
  readonly context: ExpressionFunctionContext;
}

function charge(run: Run, steps: number): boolean {
  if (run.exhausted) return false;
  const cost = Number.isFinite(steps) && steps > 0 ? Math.ceil(steps) : 0;
  run.left -= cost;
  if (run.left < 0 || (run.budget && !run.budget.spend(cost))) run.exhausted = true;
  return !run.exhausted;
}

const isList = (value: ExpressionValue): value is readonly ExpressionScalar[] =>
  Array.isArray(value);

function num(run: Run, value: ExpressionValue): number | null | ExpressionError {
  if (isExpressionError(value)) return value;
  if (typeof value === 'number') return value;
  if (typeof value === 'boolean') return value ? 1 : 0;
  if (value === null) return run.zero ? 0 : null;
  return VALUE;
}

function finite(value: number): number | ExpressionError {
  if (!Number.isFinite(value)) return ERRORS['#NUM!'];
  return value === 0 ? 0 : value;
}

/** Kleene truth: true, false, null (unknown) or an error. */
function truth(value: ExpressionValue): boolean | null | ExpressionError {
  if (isExpressionError(value)) return value;
  if (typeof value === 'boolean') return value;
  if (value === null) return null;
  if (typeof value === 'number') return value !== 0;
  return VALUE;
}

function compare(
  run: Run,
  op: 'lt' | 'lte' | 'gt' | 'gte' | 'eq' | 'neq',
  a: ExpressionValue,
  b: ExpressionValue
): ExpressionValue {
  if (isExpressionError(a)) return a;
  if (isExpressionError(b)) return b;
  if (run.zero) {
    if (a === null) a = typeof b === 'string' ? '' : typeof b === 'boolean' ? false : 0;
    if (b === null) b = typeof a === 'string' ? '' : typeof a === 'boolean' ? false : 0;
  }
  if (op === 'eq' || op === 'neq') {
    const same = equal(run, a, b);
    if (isExpressionError(same)) return same;
    return op === 'eq' ? same : !same;
  }
  if (a === null || b === null) return null;
  let order: number;
  if (typeof a === 'number' && typeof b === 'number') order = a < b ? -1 : a > b ? 1 : 0;
  else if (typeof a === 'string' && typeof b === 'string') {
    if (!charge(run, Math.min(a.length, b.length) / 16)) return LIMIT;
    const x = run.ci ? a.toLowerCase() : a;
    const y = run.ci ? b.toLowerCase() : b;
    order = x < y ? -1 : x > y ? 1 : 0;
  } else if (typeof a === 'boolean' && typeof b === 'boolean') order = Number(a) - Number(b);
  else return VALUE;
  if (op === 'lt') return order < 0;
  if (op === 'lte') return order <= 0;
  if (op === 'gt') return order > 0;
  return order >= 0;
}

function equal(run: Run, a: ExpressionValue, b: ExpressionValue): boolean | ExpressionError {
  if (isList(a) || isList(b)) {
    if (!isList(a) || !isList(b)) return false;
    if (a.length !== b.length) return false;
    if (!charge(run, a.length)) return LIMIT;
    for (let index = 0; index < a.length; index += 1) {
      const same = equal(run, a[index] ?? null, b[index] ?? null);
      if (same !== true) return same;
    }
    return true;
  }
  if (typeof a === 'string' && typeof b === 'string') {
    if (!charge(run, Math.min(a.length, b.length) / 16)) return LIMIT;
    return run.ci ? a.toLowerCase() === b.toLowerCase() : a === b;
  }
  return a === b;
}

function text(value: ExpressionScalar): string {
  if (value === null) return '';
  return String(value);
}

function evaluate(run: Run, node: ExpressionNode, depth: number): ExpressionValue {
  if (depth > EXPRESSION_LIMITS.depth || !charge(run, 1)) return LIMIT;
  const next = depth + 1;
  switch (node.op) {
    case 'num':
    case 'str':
    case 'bool':
      return node.value;
    case 'null':
      return null;
    case 'var':
    case 'field':
      return run.env.field ? toExpressionValue(run.env.field(node.name)) : null;
    case 'ref':
      return run.env.ref ? toExpressionValue(run.env.ref(node.ref)) : ERRORS['#REF!'];
    case 'range': {
      if (!run.env.range) return ERRORS['#REF!'];
      const value = toExpressionValue(run.env.range(node.from, node.to));
      if (isList(value) && !charge(run, value.length)) return LIMIT;
      return value;
    }
    case 'add':
    case 'sub':
    case 'mul':
    case 'div':
    case 'mod': {
      const a = num(run, evaluate(run, node.left, next));
      if (isExpressionError(a)) return a;
      const b = num(run, evaluate(run, node.right, next));
      if (isExpressionError(b)) return b;
      if (a === null || b === null) return null;
      if (node.op === 'add') return finite(a + b);
      if (node.op === 'sub') return finite(a - b);
      if (node.op === 'mul') return finite(a * b);
      if (b === 0) return ERRORS['#DIV/0!'];
      if (node.op === 'div') return finite(a / b);
      return finite(a - b * Math.floor(a / b));
    }
    case 'pow': {
      const a = num(run, evaluate(run, node.base, next));
      if (isExpressionError(a)) return a;
      const b = num(run, evaluate(run, node.exponent, next));
      if (isExpressionError(b)) return b;
      if (a === null || b === null) return null;
      if (Math.abs(b) > EXPRESSION_LIMITS.exponent) return ERRORS['#NUM!'];
      return finite(a ** b);
    }
    case 'neg': {
      const a = num(run, evaluate(run, node.value, next));
      if (isExpressionError(a) || a === null) return a;
      return finite(-a);
    }
    case 'lt':
    case 'lte':
    case 'gt':
    case 'gte':
    case 'eq':
    case 'neq': {
      const a = evaluate(run, node.left, next);
      if (isExpressionError(a)) return a;
      return compare(run, node.op, a, evaluate(run, node.right, next));
    }
    case 'and':
    case 'or': {
      const stop = node.op === 'or';
      let unknown = false;
      for (const arg of node.args) {
        const value = truth(evaluate(run, arg, next));
        if (isExpressionError(value)) return value;
        if (value === stop) return stop;
        if (value === null) unknown = true;
      }
      return unknown ? null : !stop;
    }
    case 'not': {
      const value = truth(evaluate(run, node.value, next));
      if (isExpressionError(value) || value === null) return value;
      return !value;
    }
    case 'if': {
      const test = truth(evaluate(run, node.test, next));
      if (isExpressionError(test)) return test;
      return evaluate(run, test === true ? node.ifTrue : node.ifFalse, next);
    }
    case 'min':
    case 'max': {
      let result: number | null = null;
      for (const arg of node.args) {
        const value = evaluate(run, arg, next);
        if (isExpressionError(value)) return value;
        const items = isList(value) ? value : [value];
        for (const item of items) {
          if (isList(value) && typeof item !== 'number') continue;
          const n = num(run, item);
          if (isExpressionError(n)) return n;
          if (n === null) {
            if (isList(value)) continue;
            return null;
          }
          result =
            result === null ? n : node.op === 'min' ? Math.min(result, n) : Math.max(result, n);
        }
      }
      return result;
    }
    case 'concat': {
      let out = '';
      for (const arg of node.args) {
        const value = evaluate(run, arg, next);
        if (isExpressionError(value)) return value;
        const part = isList(value) ? value.map(text).join(', ') : text(value);
        if (out.length + part.length > EXPRESSION_LIMITS.stringLength) return LIMIT;
        if (!charge(run, part.length / 16)) return LIMIT;
        out += part;
      }
      return out;
    }
    case 'round': {
      const value = num(run, evaluate(run, node.value, next));
      if (isExpressionError(value) || value === null) return value;
      const rounded = roundHalfAway(value, node.digits ?? 0);
      return rounded === null ? ERRORS['#NUM!'] : rounded;
    }
    case 'clamp': {
      const value = num(run, evaluate(run, node.value, next));
      if (isExpressionError(value)) return value;
      const min = num(run, evaluate(run, node.min, next));
      if (isExpressionError(min)) return min;
      const max = num(run, evaluate(run, node.max, next));
      if (isExpressionError(max)) return max;
      if (value === null || min === null || max === null) return null;
      if (min > max) return ERRORS['#NUM!'];
      return Math.min(max, Math.max(min, value));
    }
    case 'call': {
      const fn = Object.hasOwn(run.functions, node.fn) ? run.functions[node.fn] : undefined;
      if (!fn || node.args.length < fn.minArgs || node.args.length > fn.maxArgs) {
        return ERRORS['#NAME?'];
      }
      const args: ExpressionValue[] = [];
      for (const arg of node.args) {
        const value = evaluate(run, arg, next);
        if (run.exhausted) return LIMIT;
        if (isExpressionError(value) && !fn.acceptsErrors) return value;
        args.push(value);
      }
      let result: unknown;
      try {
        result = fn.call(Object.freeze(args), run.context);
      } catch {
        return VALUE;
      }
      if (run.exhausted) return LIMIT;
      const value = toExpressionValue(result);
      if (isList(value) && !charge(run, value.length)) return LIMIT;
      return value;
    }
    default:
      return VALUE;
  }
}

/**
 * Evaluate a validated expression (from `parseExpression` or
 * `parseExpressionText`). Never throws: errors are values, and running past
 * the per-expression or per-pass step limit is `#LIMIT!`.
 */
export function evaluateExpression(
  expression: Expression,
  env: ExpressionEnv = {},
  options: ExpressionEvaluateOptions = {}
): ExpressionValue {
  const cap = Math.min(
    EXPRESSION_LIMITS.steps,
    options.steps !== undefined && Number.isFinite(options.steps)
      ? Math.max(0, options.steps)
      : Infinity
  );
  const budget = options.budget;
  if (budget?.exhausted) return LIMIT;
  const run: Run = {
    left: cap,
    exhausted: false,
    budget,
    env,
    functions: options.functions ?? CORE_FUNCTIONS,
    zero: options.blank === 'zero',
    ci: options.caseInsensitive === true,
    context: {
      charge: (steps: number) => charge(run, steps),
      now: () => {
        const raw = env.now?.();
        const ms = raw instanceof Date ? raw.getTime() : raw;
        return typeof ms === 'number' && Number.isFinite(ms) ? ms : undefined;
      },
    },
  };
  const value = evaluate(run, expression.ast, 1);
  return run.exhausted ? LIMIT : value;
}
