/**
 * `@texuli/blocks/interactive/engine` — Svelte-free interactive parsers + formula.
 * Prefer `@texuli/blocks/formula` when only the calculator AST is needed.
 */

import type { Block, FieldIssue } from '../core/index.ts';
import type { InteractiveBlockLabelOverrides } from './labels.ts';
import {
  INTERACTIVE_BLOCK_TYPES,
  type InteractiveBlock,
  type InteractiveBlockType,
} from './schema.ts';

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
  INTERACTIVE_BLOCK_TYPES,
  type InteractiveBlock,
  type InteractiveBlockType,
  type PollBlock,
  type PollOption,
  parseInteractiveBlock,
  type QuizBlock,
  type QuizOption,
  type QuizQuestion,
} from './schema.ts';

export type InteractiveFamilyBlock = InteractiveBlock;
export type InteractiveFamilyBlockType = InteractiveBlockType;

export function isInteractiveFamilyBlock(block: Block): block is InteractiveFamilyBlock {
  return (INTERACTIVE_BLOCK_TYPES as readonly string[]).includes(block.type);
}

export interface InteractiveBlockViewProps {
  block: unknown;
  labels?: InteractiveBlockLabelOverrides;
  oninvalid?: (issues: FieldIssue[]) => void;
}
