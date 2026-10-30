// @texuli/core/expression: the closed expression language of ADR-015 — the
// JSON AST, its text form, static analysis and the bounded evaluator. Forms
// evaluate their conditions and rules with it; the planned sheets formula
// layer extends it through the reference dialect, its own function table and
// a shared recalculation budget (core-expression.md, "Extending").
export {
  analyzeExpression,
  type ExpressionAnalysis,
  type ExpressionAnalysisOptions,
  isAssignable,
} from './analyze.ts';
export {
  createExpressionBudget,
  type ExpressionBudget,
  type ExpressionEnv,
  type ExpressionEvaluateOptions,
  evaluateExpression,
} from './evaluate.ts';
export { CORE_FUNCTIONS, daysToIsoDate, isoDateToDays } from './functions.ts';
export {
  children as expressionChildren,
  EXPRESSION_OPS,
  type ExpressionParseOptions,
  parseExpression,
} from './parse.ts';
export { formatExpression, parseExpressionText } from './text.ts';
export {
  EXPRESSION_LIMITS,
  EXPRESSION_NAME,
  type Expression,
  type ExpressionArithmeticOp,
  type ExpressionComparisonOp,
  type ExpressionDiagnostic,
  type ExpressionDiagnosticCode,
  type ExpressionError,
  type ExpressionErrorCode,
  type ExpressionFunction,
  type ExpressionFunctionContext,
  type ExpressionFunctionTable,
  type ExpressionNode,
  type ExpressionOp,
  type ExpressionParseResult,
  type ExpressionReferenceDialect,
  type ExpressionScalar,
  type ExpressionType,
  type ExpressionValue,
} from './types.ts';
export {
  expressionError,
  isExpressionError,
  isTrue,
  roundHalfAway,
  toExpressionValue,
} from './values.ts';
