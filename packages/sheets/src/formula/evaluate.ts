import {
  type ExpressionBudget,
  type ExpressionEnv,
  type ExpressionValue,
  evaluateExpression,
  expressionError,
} from '@texuli/core/expression';
import { SHEET_FUNCTIONS } from './functions.ts';
import { REF_ERROR, type SheetFormula } from './parse.ts';

/** Options for one formula evaluation. */
export interface FormulaEvaluateOptions {
  /** The recalculation pass this evaluation belongs to (`createExpressionBudget`). */
  readonly budget?: ExpressionBudget;
  /** Steps for this formula (default and maximum: the core's 100,000). */
  readonly steps?: number;
}

/**
 * Evaluate a parsed formula with spreadsheet semantics: the sheet function
 * table, blanks read as 0 or empty text, and text compared ignoring case.
 * `env.ref` and `env.range` read cells (`A1`, `Sheet2!B3`, `A1:B3`, `A:C`);
 * `env.now` is the host clock for TODAY and NOW. Never throws; errors and
 * `#LIMIT!` are values.
 */
export function evaluateFormula(
  formula: SheetFormula,
  env: ExpressionEnv,
  options: FormulaEvaluateOptions = {}
): ExpressionValue {
  const read = env.ref;
  const cells: ExpressionEnv = {
    ...env,
    // A deleted reference (`#REF!` in the text) never reaches the host.
    ref: (ref) =>
      ref === REF_ERROR ? expressionError('#REF!') : read ? read(ref) : expressionError('#REF!'),
  };
  return evaluateExpression(formula.expression, cells, {
    functions: SHEET_FUNCTIONS,
    blank: 'zero',
    caseInsensitive: true,
    ...(options.budget ? { budget: options.budget } : {}),
    ...(options.steps !== undefined ? { steps: options.steps } : {}),
  });
}
