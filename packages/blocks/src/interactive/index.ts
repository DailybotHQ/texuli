/**
 * `@texuli/blocks` interactive family: poll, quiz, calculator, checklist.
 *
 * The closed formula engine is also re-exported here for compatibility.
 * Prefer `@texuli/blocks/formula` for a cold start that must not pull
 * interactive renderers (Protoyard adoption).
 */

// Light engine — same surface as `@texuli/blocks/formula`.
export {
  type ArithmeticOp,
  type ComparisonOp,
  type Condition,
  evaluateCondition,
  evaluateFormula,
  FORMULA_LIMITS,
  type FormatFormulaOptions,
  type FormulaDiagnostic,
  type FormulaInputs,
  type FormulaParseResult,
  type FormulaUnit,
  formatFormulaValue,
  formulaJsonPath,
  formulaVariables,
  type NumberFormula,
  type ParseFormulaOptions,
  parseFormula,
  roundTo,
} from '../core/formula/index.ts';
export { checkInteractiveBlock, type InteractiveBlockCheck } from './check.ts';
export {
  INTERACTIVE_BLOCK_TYPES,
  type InteractiveBlockViewProps,
  type InteractiveFamilyBlock,
  type InteractiveFamilyBlockType,
  isInteractiveFamilyBlock,
  loadInteractiveFamily,
} from './family.ts';
export {
  DEFAULT_INTERACTIVE_BLOCK_LABELS,
  type InteractiveBlockLabelOverrides,
  type InteractiveBlockLabels,
  resolveInteractiveBlockLabels,
} from './labels.ts';
export {
  type CalculatorBlock,
  type CalculatorInput,
  type ChecklistBlock,
  type ChecklistItem,
  evaluateCalculator,
  type InteractiveBlock,
  type InteractiveBlockType,
  type PollBlock,
  type PollOption,
  parseInteractiveBlock,
  type QuizBlock,
  type QuizOption,
  type QuizQuestion,
} from './schema.ts';
