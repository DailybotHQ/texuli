/**
 * `@texuli/blocks` formula — closed AST for calculator blocks.
 * Formulas are data, never code: no string syntax, no host objects.
 */

export {
  evaluateCondition,
  evaluateFormula,
  type FormatFormulaOptions,
  formatFormulaValue,
  roundTo,
} from './evaluate.ts';
export {
  FORMULA_LIMITS,
  formulaJsonPath,
  formulaVariables,
  type ParseFormulaOptions,
  parseFormula,
} from './parse.ts';
export type {
  ArithmeticOp,
  ComparisonOp,
  Condition,
  FormulaDiagnostic,
  FormulaInputs,
  FormulaParseResult,
  FormulaUnit,
  NumberFormula,
} from './types.ts';
