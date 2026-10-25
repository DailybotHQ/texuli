/**
 * The closed formula grammar for calculator blocks. A formula is plain JSON:
 * every node names its operation in `op`, and there is no string syntax, no
 * function call by name and no way to reach host objects. Numbers and
 * conditions are separate node kinds.
 */

export type ArithmeticOp = 'add' | 'sub' | 'mul' | 'div';
export type ComparisonOp = 'lt' | 'lte' | 'gt' | 'gte' | 'eq' | 'neq';

/** An expression that evaluates to a number, or `null` when undefined. */
export type NumberFormula =
  | { op: 'num'; value: number }
  | { op: 'var'; name: string }
  | { op: ArithmeticOp; left: NumberFormula; right: NumberFormula }
  | { op: 'pow'; base: NumberFormula; exponent: NumberFormula }
  | { op: 'min' | 'max'; args: NumberFormula[] }
  | { op: 'round'; value: NumberFormula; digits?: number | undefined }
  | { op: 'clamp'; value: NumberFormula; min: NumberFormula; max: NumberFormula }
  | { op: 'if'; test: Condition; ifTrue: NumberFormula; ifFalse: NumberFormula };

/** An expression that evaluates to true, false, or `null` when an operand is undefined. */
export type Condition =
  | { op: ComparisonOp; left: NumberFormula; right: NumberFormula }
  | { op: 'and' | 'or'; args: Condition[] }
  | { op: 'not'; value: Condition };

/** Input values by variable name. Missing, `null` and non-finite inputs are undefined. */
export type FormulaInputs = Readonly<Record<string, number | null | undefined>>;

/** One problem with a formula, addressed like authoring diagnostics. */
export interface FormulaDiagnostic {
  code: string;
  path: (string | number)[];
  jsonPath: string;
  message: string;
  hint: string;
}

export type FormulaParseResult =
  | { success: true; formula: NumberFormula; variables: string[]; diagnostics: [] }
  | { success: false; formula: null; variables: []; diagnostics: FormulaDiagnostic[] };

/** How a calculator output is shown. */
export type FormulaUnit = 'number' | 'compact' | 'cents' | 'percent';
