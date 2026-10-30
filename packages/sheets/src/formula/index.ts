/**
 * @texuli/sheets/formula: the sheet formula language of ADR-015, framework-
 * free and DOM-free. A linear-time parser from `=SUM(A1:B3)` text into the
 * `@texuli/core/expression` AST (validated by the core with the sheet
 * reference dialect and function table), the closed function library, the
 * criteria and TEXT formats it uses, reference helpers and the reference
 * rewriter structural edits use.
 */
export { CRITERIA_MAX_LENGTH, type CriteriaMatcher, compileCriteria } from './criteria.ts';
export { evaluateFormula, type FormulaEvaluateOptions } from './evaluate.ts';
export {
  numberText,
  SHEET_FUNCTION_INFO,
  SHEET_FUNCTION_NAMES,
  SHEET_FUNCTIONS,
  type SheetFunctionInfo,
} from './functions.ts';
export {
  FORMULA_LIMITS,
  type FormulaParseError,
  type FormulaParseResult,
  type FormulaToken,
  isFormulaInput,
  parseFormula,
  REF_ERROR,
  SHEET_REFERENCE_DIALECT,
  type SheetFormula,
  tokenizeFormula,
} from './parse.ts';
export {
  type CellReference,
  cellAddress,
  columnIndex,
  columnName,
  formatReference,
  isSheetName,
  parseCellAddress,
  parseCellPart,
  parseReference,
  quoteSheetName,
  REFERENCE_LIMITS,
} from './reference.ts';
export { type ReferenceTarget, type ReferenceVisitor, rewriteFormula } from './rewrite.ts';
export { formatText, SHEET_TEXT_FORMATS } from './text-format.ts';
