/**
 * The closed expression language of ADR-015: one JSON AST, one bounded
 * evaluator. Every node names its operation in `op`. The base is the
 * blueprint spec's `numberFormula` and `condition` shapes (ADR-008), which
 * stay valid expressions; the extensions add strings, booleans, null,
 * field references, calls to a closed function table, and the `ref` and
 * `range` reference nodes a dialect (the planned sheets formula layer) can
 * enable. There is no loop, no closure, no dynamic reference and no way to
 * reach host objects.
 */

/** Binary arithmetic. */
export type ExpressionArithmeticOp = 'add' | 'sub' | 'mul' | 'div' | 'mod';
/** Comparisons; numbers compare numerically, strings by code unit (so ISO dates sort). */
export type ExpressionComparisonOp = 'lt' | 'lte' | 'gt' | 'gte' | 'eq' | 'neq';

/** One node of the closed expression AST. */
export type ExpressionNode =
  | { readonly op: 'num'; readonly value: number }
  | { readonly op: 'str'; readonly value: string }
  | { readonly op: 'bool'; readonly value: boolean }
  | { readonly op: 'null' }
  | { readonly op: 'var'; readonly name: string }
  | { readonly op: 'field'; readonly name: string }
  | { readonly op: 'ref'; readonly ref: string }
  | { readonly op: 'range'; readonly from: string; readonly to: string }
  | {
      readonly op: ExpressionArithmeticOp;
      readonly left: ExpressionNode;
      readonly right: ExpressionNode;
    }
  | { readonly op: 'pow'; readonly base: ExpressionNode; readonly exponent: ExpressionNode }
  | { readonly op: 'neg'; readonly value: ExpressionNode }
  | {
      readonly op: ExpressionComparisonOp;
      readonly left: ExpressionNode;
      readonly right: ExpressionNode;
    }
  | { readonly op: 'and' | 'or'; readonly args: readonly ExpressionNode[] }
  | { readonly op: 'not'; readonly value: ExpressionNode }
  | {
      readonly op: 'if';
      readonly test: ExpressionNode;
      readonly ifTrue: ExpressionNode;
      readonly ifFalse: ExpressionNode;
    }
  | { readonly op: 'min' | 'max' | 'concat'; readonly args: readonly ExpressionNode[] }
  | { readonly op: 'round'; readonly value: ExpressionNode; readonly digits?: number }
  | {
      readonly op: 'clamp';
      readonly value: ExpressionNode;
      readonly min: ExpressionNode;
      readonly max: ExpressionNode;
    }
  | { readonly op: 'call'; readonly fn: string; readonly args: readonly ExpressionNode[] };

/** Every `op` the AST knows. */
export type ExpressionOp = ExpressionNode['op'];

/** The error codes an evaluation can produce (spreadsheet-style values, never exceptions). */
export type ExpressionErrorCode =
  | '#DIV/0!'
  | '#VALUE!'
  | '#REF!'
  | '#NAME?'
  | '#NUM!'
  | '#N/A'
  | '#CYCLE!'
  | '#LIMIT!';

/** An error value. Errors propagate through operators and calls. */
export interface ExpressionError {
  readonly error: ExpressionErrorCode;
}

/** A scalar value. Dates are ISO `YYYY-MM-DD` strings. */
export type ExpressionScalar = number | string | boolean | null;

/**
 * A value an expression reads or produces: a scalar, a flat list of scalars
 * (multiple-choice answers, a sheet range) or an error.
 */
export type ExpressionValue = ExpressionScalar | readonly ExpressionScalar[] | ExpressionError;

/** The static types the analyzer knows. `any` accepts everything. */
export type ExpressionType = 'number' | 'string' | 'boolean' | 'date' | 'list' | 'null' | 'any';

/** What a function receives besides its arguments. */
export interface ExpressionFunctionContext {
  /**
   * Charge `steps` evaluation steps (for work proportional to input size).
   * Returns `false` once the budget is spent; return `#LIMIT!` then.
   */
  charge(steps: number): boolean;
  /** The host clock in milliseconds, or `undefined` when the host gave none. */
  now(): number | undefined;
}

/**
 * One entry of a closed function table. Arguments arrive evaluated; an error
 * argument short-circuits the call unless `acceptsErrors` is set. `call`
 * must be pure, bounded and total: a thrown exception becomes `#VALUE!`.
 */
export interface ExpressionFunction {
  readonly minArgs: number;
  readonly maxArgs: number;
  /** Parameter types by position; the last one repeats for variadic functions. */
  readonly params: readonly ExpressionType[];
  readonly returns: ExpressionType;
  /** Pass error arguments through instead of short-circuiting (for an `IFERROR`). */
  readonly acceptsErrors?: boolean;
  readonly description?: string;
  call(args: readonly ExpressionValue[], context: ExpressionFunctionContext): ExpressionValue;
}

/** A closed function table: names to functions. Expressions can only name these. */
export type ExpressionFunctionTable = Readonly<Record<string, ExpressionFunction>>;

/** A problem with an expression, addressed like authoring diagnostics. */
export interface ExpressionDiagnostic {
  readonly code: ExpressionDiagnosticCode;
  /** A JSON path into the AST (`$.args[0].left`) or a text offset (`@12`). */
  readonly path: string;
  readonly message: string;
}

export type ExpressionDiagnosticCode =
  | 'not-a-node'
  | 'unknown-op'
  | 'unknown-member'
  | 'missing-member'
  | 'bad-member'
  | 'bad-name'
  | 'unknown-function'
  | 'arity'
  | 'refs-disabled'
  | 'bad-ref'
  | 'too-many-nodes'
  | 'too-deep'
  | 'too-long'
  | 'syntax'
  | 'unknown-field'
  | 'type';

/**
 * Lets a dialect enable `ref` and `range` nodes. The forms dialect leaves it
 * out (references are refused); the planned sheets formula layer passes a
 * checker for its reference syntax.
 */
export interface ExpressionReferenceDialect {
  /** Whether `ref` is a reference this dialect accepts (for example `A1` or `Sheet2!B3`). */
  isRef(ref: string): boolean;
}

/** A validated, frozen expression: the AST plus what it depends on. */
export interface Expression {
  readonly ast: ExpressionNode;
  /** Node count (at most `EXPRESSION_LIMITS.nodes`). */
  readonly nodes: number;
  /** Nesting depth (at most `EXPRESSION_LIMITS.depth`). */
  readonly depth: number;
  /** Field and var names read, sorted and unique. */
  readonly fields: readonly string[];
  /** Function names called, sorted and unique. */
  readonly functions: readonly string[];
  /** `ref` nodes, sorted and unique (empty unless a dialect enabled them). */
  readonly refs: readonly string[];
  /** `range` nodes in source order (an interval each, never expanded). */
  readonly ranges: readonly { readonly from: string; readonly to: string }[];
}

export type ExpressionParseResult =
  | { readonly ok: true; readonly expression: Expression; readonly diagnostics: readonly [] }
  | {
      readonly ok: false;
      readonly expression: null;
      readonly diagnostics: readonly ExpressionDiagnostic[];
    };

/** The limits of ADR-015. Exceeding one is a diagnostic at parse time or `#LIMIT!` at run time. */
export const EXPRESSION_LIMITS = Object.freeze({
  /** AST nodes per expression. */
  nodes: 1000,
  /** Nesting depth per expression. */
  depth: 32,
  /** Evaluation steps per expression. */
  steps: 100_000,
  /** Evaluation steps per recalculation pass (an `ExpressionBudget`). */
  passSteps: 10_000_000,
  /** UTF-16 code units in any string value. */
  stringLength: 32_768,
  /** Items in any list value. */
  listItems: 10_000,
  /** Characters of expression text the text parser reads. */
  sourceLength: 16_384,
  /** Arguments of one `and`, `or`, `min`, `max`, `concat` or `call`. */
  args: 64,
  /** Largest absolute `pow` exponent. */
  exponent: 64,
  /** `round` digits range (±). */
  roundDigits: 12,
});

/** Field, var and function names: a letter or underscore, then letters, digits or underscores. */
export const EXPRESSION_NAME = /^[A-Za-z_][A-Za-z0-9_]{0,63}$/;
