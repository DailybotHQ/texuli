import { CORE_FUNCTIONS } from './functions.ts';
import type {
  Expression,
  ExpressionDiagnostic,
  ExpressionFunctionTable,
  ExpressionNode,
  ExpressionType,
} from './types.ts';

/*
 * Static analysis: infers the type of every node and reports operands whose
 * type cannot work (a string in arithmetic, a list compared with `<`) and
 * fields the caller did not declare. The walk is bounded by the validated
 * AST (at most 1,000 nodes, depth 32).
 */

export interface ExpressionAnalysisOptions {
  /** Declared field types; when given, a field outside it is `unknown-field`. */
  readonly fields?: Readonly<Record<string, ExpressionType>>;
  /** The function table calls are typed against (default `CORE_FUNCTIONS`). */
  readonly functions?: ExpressionFunctionTable;
  /** The type the whole expression must have (`boolean` for a condition). */
  readonly expect?: ExpressionType;
}

export interface ExpressionAnalysis {
  readonly type: ExpressionType;
  readonly diagnostics: readonly ExpressionDiagnostic[];
}

/** Whether a value of type `actual` can stand where `expected` is needed. */
export function isAssignable(actual: ExpressionType, expected: ExpressionType): boolean {
  if (expected === 'any' || actual === 'any' || actual === 'null' || actual === expected) {
    return true;
  }
  // Dates are ISO strings: a string may be a date and a date reads as a string.
  return (
    (actual === 'date' && expected === 'string') || (actual === 'string' && expected === 'date')
  );
}

const NUMERIC: readonly ExpressionType[] = ['number', 'boolean'];
const ORDERED = (a: ExpressionType, b: ExpressionType): boolean => {
  if (a === 'any' || b === 'any' || a === 'null' || b === 'null') return true;
  if (a === 'number' && b === 'number') return true;
  if (a === 'boolean' && b === 'boolean') return true;
  const textual = (t: ExpressionType) => t === 'string' || t === 'date';
  return textual(a) && textual(b);
};

/** Infer an expression's type and report type and field problems. */
export function analyzeExpression(
  expression: Expression,
  options: ExpressionAnalysisOptions = {}
): ExpressionAnalysis {
  const functions = options.functions ?? CORE_FUNCTIONS;
  const fields = options.fields;
  const diagnostics: ExpressionDiagnostic[] = [];
  const report = (path: string, message: string, code: 'type' | 'unknown-field' = 'type') => {
    if (diagnostics.length < 20) diagnostics.push(Object.freeze({ code, path, message }));
  };
  const need = (
    type: ExpressionType,
    allowed: readonly ExpressionType[],
    path: string,
    what: string
  ) => {
    if (type === 'any' || type === 'null' || allowed.includes(type)) return;
    report(path, `${what} needs ${allowed.join(' or ')}, not ${type}.`);
  };

  const visit = (node: ExpressionNode, path: string): ExpressionType => {
    switch (node.op) {
      case 'num':
        return 'number';
      case 'str':
        return 'string';
      case 'bool':
        return 'boolean';
      case 'null':
        return 'null';
      case 'var':
      case 'field': {
        if (!fields) return 'any';
        if (!Object.hasOwn(fields, node.name)) {
          report(`${path}.name`, `There is no field "${node.name}".`, 'unknown-field');
          return 'any';
        }
        return fields[node.name] as ExpressionType;
      }
      case 'ref':
        return 'any';
      case 'range':
        return 'list';
      case 'add':
      case 'sub':
      case 'mul':
      case 'div':
      case 'mod':
        need(visit(node.left, `${path}.left`), NUMERIC, `${path}.left`, `"${node.op}"`);
        need(visit(node.right, `${path}.right`), NUMERIC, `${path}.right`, `"${node.op}"`);
        return 'number';
      case 'pow':
        need(visit(node.base, `${path}.base`), NUMERIC, `${path}.base`, '"pow"');
        need(visit(node.exponent, `${path}.exponent`), NUMERIC, `${path}.exponent`, '"pow"');
        return 'number';
      case 'neg':
        need(visit(node.value, `${path}.value`), NUMERIC, `${path}.value`, '"neg"');
        return 'number';
      case 'eq':
      case 'neq':
        visit(node.left, `${path}.left`);
        visit(node.right, `${path}.right`);
        return 'boolean';
      case 'lt':
      case 'lte':
      case 'gt':
      case 'gte': {
        const a = visit(node.left, `${path}.left`);
        const b = visit(node.right, `${path}.right`);
        if (!ORDERED(a, b)) report(path, `"${node.op}" cannot order ${a} and ${b}.`);
        return 'boolean';
      }
      case 'and':
      case 'or':
        node.args.forEach((arg, index) => {
          const at = `${path}.args[${index}]`;
          need(visit(arg, at), ['boolean', 'number'], at, `"${node.op}"`);
        });
        return 'boolean';
      case 'not':
        need(visit(node.value, `${path}.value`), ['boolean', 'number'], `${path}.value`, '"not"');
        return 'boolean';
      case 'if': {
        need(visit(node.test, `${path}.test`), ['boolean', 'number'], `${path}.test`, '"if"');
        const a = visit(node.ifTrue, `${path}.ifTrue`);
        const b = visit(node.ifFalse, `${path}.ifFalse`);
        if (a === b || b === 'null') return a;
        return a === 'null' ? b : 'any';
      }
      case 'min':
      case 'max':
        node.args.forEach((arg, index) => {
          const at = `${path}.args[${index}]`;
          need(visit(arg, at), ['number', 'boolean', 'list'], at, `"${node.op}"`);
        });
        return 'number';
      case 'concat':
        for (const [index, arg] of node.args.entries()) visit(arg, `${path}.args[${index}]`);
        return 'string';
      case 'round':
        need(visit(node.value, `${path}.value`), NUMERIC, `${path}.value`, '"round"');
        return 'number';
      case 'clamp':
        need(visit(node.value, `${path}.value`), NUMERIC, `${path}.value`, '"clamp"');
        need(visit(node.min, `${path}.min`), NUMERIC, `${path}.min`, '"clamp"');
        need(visit(node.max, `${path}.max`), NUMERIC, `${path}.max`, '"clamp"');
        return 'number';
      case 'call': {
        const fn = Object.hasOwn(functions, node.fn) ? functions[node.fn] : undefined;
        node.args.forEach((arg, index) => {
          const at = `${path}.args[${index}]`;
          const type = visit(arg, at);
          if (!fn || fn.params.length === 0) return;
          const expected = fn.params[Math.min(index, fn.params.length - 1)] as ExpressionType;
          if (!isAssignable(type, expected)) {
            report(at, `"${node.fn}" argument ${index + 1} needs ${expected}, not ${type}.`);
          }
        });
        return fn?.returns ?? 'any';
      }
      default:
        return 'any';
    }
  };

  const type = visit(expression.ast, '$');
  if (options.expect && !isAssignable(type, options.expect)) {
    if (!(options.expect === 'boolean' && type === 'number')) {
      report('$', `The expression is ${type}; ${options.expect} is needed here.`);
    }
  }
  return Object.freeze({ type, diagnostics: Object.freeze(diagnostics) });
}
