import type { Condition, FormulaDiagnostic, FormulaParseResult, NumberFormula } from './types.ts';

/** Caps that keep parsing and evaluation small and linear. */
export const FORMULA_LIMITS = Object.freeze({
  nodes: 64,
  depth: 12,
  args: 8,
  exponent: 64,
  roundDigits: 6,
  literal: 1e15,
});

const NUMBER_OPS = [
  'num',
  'var',
  'add',
  'sub',
  'mul',
  'div',
  'pow',
  'min',
  'max',
  'round',
  'clamp',
  'if',
] as const;
const CONDITION_OPS = ['lt', 'lte', 'gt', 'gte', 'eq', 'neq', 'and', 'or', 'not'] as const;
const RESERVED_VARIABLE_NAMES = new Set(['constructor', 'prototype']);
const VARIABLE_NAME = /^[a-z][a-zA-Z0-9]{0,31}$/;

export function formulaJsonPath(path: readonly (string | number)[]): string {
  let result = '$';
  for (const segment of path) {
    result += typeof segment === 'number' ? `[${segment}]` : `[${JSON.stringify(segment)}]`;
  }
  return result;
}

function diagnostic(
  code: string,
  path: (string | number)[],
  message: string,
  hint: string
): FormulaDiagnostic {
  return { code, path, jsonPath: formulaJsonPath(path), message, hint };
}

function preflight(input: unknown): FormulaDiagnostic | null {
  const seen = new WeakSet<object>();
  const stack: { value: unknown; depth: number; path: (string | number)[] }[] = [
    { value: input, depth: 0, path: [] },
  ];
  let nodes = 0;
  let containers = 0;
  const tooLarge = (path: (string | number)[]) =>
    diagnostic(
      'formula-too-large',
      path,
      `A formula has at most ${FORMULA_LIMITS.nodes} nodes`,
      'Split the calculation into several outputs, or simplify it.'
    );
  while (stack.length > 0) {
    const current = stack.pop();
    if (!current) continue;
    const { value, path } = current;
    if (value === null || typeof value !== 'object') continue;
    if (seen.has(value)) {
      return diagnostic(
        'cyclic-formula',
        path,
        'A formula must not contain cycles',
        'Use plain JSON.'
      );
    }
    seen.add(value);
    containers += 1;
    if (containers > FORMULA_LIMITS.nodes * 2) return tooLarge(path);
    if (Array.isArray(value)) {
      if (value.length > FORMULA_LIMITS.nodes) return tooLarge(path);
      for (let i = value.length - 1; i >= 0; i -= 1) {
        stack.push({ value: value[i], depth: current.depth, path: [...path, i] });
      }
      continue;
    }
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) {
      return diagnostic(
        'invalid-container',
        path,
        'Formula nodes must be plain JSON objects',
        'Use plain JSON.'
      );
    }
    nodes += 1;
    if (nodes > FORMULA_LIMITS.nodes) return tooLarge(path);
    const depth = current.depth + 1;
    if (depth > FORMULA_LIMITS.depth) {
      return diagnostic(
        'formula-too-deep',
        path,
        `A formula nests at most ${FORMULA_LIMITS.depth} levels`,
        'Flatten the calculation, for example with min/max over several operands.'
      );
    }
    const keys = Object.keys(value);
    if (keys.length > 8) {
      return diagnostic(
        'invalid-formula',
        path,
        'A formula node has too many keys',
        'Use only the keys of its op.'
      );
    }
    for (const key of keys.reverse()) {
      stack.push({ value: (value as Record<string, unknown>)[key], depth, path: [...path, key] });
    }
  }
  return null;
}

function parseVarName(
  value: unknown,
  path: (string | number)[]
): { ok: true; name: string } | { ok: false; diagnostic: FormulaDiagnostic } {
  if (typeof value !== 'string' || !VARIABLE_NAME.test(value)) {
    return {
      ok: false,
      diagnostic: diagnostic(
        'invalid-formula',
        path,
        'Use a lowerCamelCase name of at most 32 characters',
        'Rename the variable.'
      ),
    };
  }
  if (RESERVED_VARIABLE_NAMES.has(value)) {
    return {
      ok: false,
      diagnostic: diagnostic(
        'invalid-formula',
        path,
        '"constructor" and "prototype" are reserved; choose another name',
        'Rename the variable.'
      ),
    };
  }
  return { ok: true, name: value };
}

type Kind = 'number' | 'condition';

function parseNode(
  input: unknown,
  path: (string | number)[],
  kind: Kind
): { ok: true; node: NumberFormula | Condition } | { ok: false; diagnostics: FormulaDiagnostic[] } {
  if (input === null || typeof input !== 'object' || Array.isArray(input)) {
    return {
      ok: false,
      diagnostics: [
        diagnostic('invalid-formula', path, 'Expected a formula node object', 'Use plain JSON.'),
      ],
    };
  }
  const record = input as Record<string, unknown>;
  const op = record.op;
  if (typeof op !== 'string') {
    return {
      ok: false,
      diagnostics: [diagnostic('invalid-formula', [...path, 'op'], 'op is required', 'Set op.')],
    };
  }

  const isNumberOp = (NUMBER_OPS as readonly string[]).includes(op);
  const isConditionOp = (CONDITION_OPS as readonly string[]).includes(op);

  if (kind === 'number' && isConditionOp) {
    return {
      ok: false,
      diagnostics: [
        diagnostic(
          'type-mismatch',
          path,
          `Expected a number here, got the condition "${op}"`,
          'Turn a condition into a number with { "op": "if", "test": …, "ifTrue": …, "ifFalse": … }.'
        ),
      ],
    };
  }
  if (kind === 'condition' && isNumberOp) {
    return {
      ok: false,
      diagnostics: [
        diagnostic(
          'type-mismatch',
          path,
          `Expected a condition here, got the number expression "${op}"`,
          'Compare two numbers with lt, lte, gt, gte, eq or neq.'
        ),
      ],
    };
  }
  if (!isNumberOp && !isConditionOp) {
    return {
      ok: false,
      diagnostics: [
        diagnostic(
          'unknown-op',
          path,
          `Unknown formula op ${JSON.stringify(op)}`,
          `Use one of ${(kind === 'condition' ? CONDITION_OPS : NUMBER_OPS).join(', ')}.`
        ),
      ],
    };
  }

  const child = (
    key: string,
    expected: Kind
  ):
    | { ok: true; node: NumberFormula | Condition }
    | { ok: false; diagnostics: FormulaDiagnostic[] } =>
    parseNode(record[key], [...path, key], expected);

  switch (op) {
    case 'num': {
      if (typeof record.value !== 'number' || !Number.isFinite(record.value)) {
        return {
          ok: false,
          diagnostics: [
            diagnostic(
              'invalid-formula',
              [...path, 'value'],
              'num.value must be a finite number',
              'Use a finite literal.'
            ),
          ],
        };
      }
      if (Math.abs(record.value) > FORMULA_LIMITS.literal) {
        return {
          ok: false,
          diagnostics: [
            diagnostic(
              'invalid-formula',
              [...path, 'value'],
              `Literal magnitude is at most ${FORMULA_LIMITS.literal}`,
              'Use a smaller number.'
            ),
          ],
        };
      }
      return { ok: true, node: { op: 'num', value: record.value } };
    }
    case 'var': {
      const name = parseVarName(record.name, [...path, 'name']);
      if (!name.ok) return { ok: false, diagnostics: [name.diagnostic] };
      return { ok: true, node: { op: 'var', name: name.name } };
    }
    case 'add':
    case 'sub':
    case 'mul':
    case 'div': {
      const left = child('left', 'number');
      if (!left.ok) return left;
      const right = child('right', 'number');
      if (!right.ok) return right;
      return {
        ok: true,
        node: {
          op,
          left: left.node as NumberFormula,
          right: right.node as NumberFormula,
        },
      };
    }
    case 'pow': {
      const base = child('base', 'number');
      if (!base.ok) return base;
      const exponent = child('exponent', 'number');
      if (!exponent.ok) return exponent;
      return {
        ok: true,
        node: {
          op: 'pow',
          base: base.node as NumberFormula,
          exponent: exponent.node as NumberFormula,
        },
      };
    }
    case 'min':
    case 'max': {
      if (
        !Array.isArray(record.args) ||
        record.args.length < 2 ||
        record.args.length > FORMULA_LIMITS.args
      ) {
        return {
          ok: false,
          diagnostics: [
            diagnostic(
              'invalid-formula',
              [...path, 'args'],
              `args must have 2–${FORMULA_LIMITS.args} number formulas`,
              'Pass a short args array.'
            ),
          ],
        };
      }
      const args: NumberFormula[] = [];
      for (let i = 0; i < record.args.length; i += 1) {
        const parsed = parseNode(record.args[i], [...path, 'args', i], 'number');
        if (!parsed.ok) return parsed;
        args.push(parsed.node as NumberFormula);
      }
      return { ok: true, node: { op, args } };
    }
    case 'round': {
      const value = child('value', 'number');
      if (!value.ok) return value;
      let digits: number | undefined;
      if (record.digits !== undefined) {
        if (
          typeof record.digits !== 'number' ||
          !Number.isInteger(record.digits) ||
          Math.abs(record.digits) > FORMULA_LIMITS.roundDigits
        ) {
          return {
            ok: false,
            diagnostics: [
              diagnostic(
                'invalid-formula',
                [...path, 'digits'],
                `digits must be an integer from −${FORMULA_LIMITS.roundDigits} to ${FORMULA_LIMITS.roundDigits}`,
                'Adjust digits.'
              ),
            ],
          };
        }
        digits = record.digits;
      }
      return {
        ok: true,
        node:
          digits === undefined
            ? { op: 'round', value: value.node as NumberFormula }
            : { op: 'round', value: value.node as NumberFormula, digits },
      };
    }
    case 'clamp': {
      const value = child('value', 'number');
      if (!value.ok) return value;
      const min = child('min', 'number');
      if (!min.ok) return min;
      const max = child('max', 'number');
      if (!max.ok) return max;
      return {
        ok: true,
        node: {
          op: 'clamp',
          value: value.node as NumberFormula,
          min: min.node as NumberFormula,
          max: max.node as NumberFormula,
        },
      };
    }
    case 'if': {
      const test = child('test', 'condition');
      if (!test.ok) return test;
      const ifTrue = child('ifTrue', 'number');
      if (!ifTrue.ok) return ifTrue;
      const ifFalse = child('ifFalse', 'number');
      if (!ifFalse.ok) return ifFalse;
      return {
        ok: true,
        node: {
          op: 'if',
          test: test.node as Condition,
          ifTrue: ifTrue.node as NumberFormula,
          ifFalse: ifFalse.node as NumberFormula,
        },
      };
    }
    case 'lt':
    case 'lte':
    case 'gt':
    case 'gte':
    case 'eq':
    case 'neq': {
      const left = child('left', 'number');
      if (!left.ok) return left;
      const right = child('right', 'number');
      if (!right.ok) return right;
      return {
        ok: true,
        node: {
          op,
          left: left.node as NumberFormula,
          right: right.node as NumberFormula,
        },
      };
    }
    case 'and':
    case 'or': {
      if (
        !Array.isArray(record.args) ||
        record.args.length < 2 ||
        record.args.length > FORMULA_LIMITS.args
      ) {
        return {
          ok: false,
          diagnostics: [
            diagnostic(
              'invalid-formula',
              [...path, 'args'],
              `args must have 2–${FORMULA_LIMITS.args} conditions`,
              'Pass a short args array.'
            ),
          ],
        };
      }
      const args: Condition[] = [];
      for (let i = 0; i < record.args.length; i += 1) {
        const parsed = parseNode(record.args[i], [...path, 'args', i], 'condition');
        if (!parsed.ok) return parsed;
        args.push(parsed.node as Condition);
      }
      return { ok: true, node: { op, args } };
    }
    case 'not': {
      const value = child('value', 'condition');
      if (!value.ok) return value;
      return { ok: true, node: { op: 'not', value: value.node as Condition } };
    }
    default:
      return {
        ok: false,
        diagnostics: [
          diagnostic(
            'unknown-op',
            path,
            `Unknown formula op ${JSON.stringify(op)}`,
            'Use a known op.'
          ),
        ],
      };
  }
}

/** Variable names a formula reads, sorted and unique. */
export function formulaVariables(formula: NumberFormula | Condition): string[] {
  const names = new Set<string>();
  const visit = (node: NumberFormula | Condition): void => {
    switch (node.op) {
      case 'num':
        return;
      case 'var':
        names.add(node.name);
        return;
      case 'add':
      case 'sub':
      case 'mul':
      case 'div':
      case 'lt':
      case 'lte':
      case 'gt':
      case 'gte':
      case 'eq':
      case 'neq':
        visit(node.left);
        visit(node.right);
        return;
      case 'pow':
        visit(node.base);
        visit(node.exponent);
        return;
      case 'min':
      case 'max':
      case 'and':
      case 'or':
        for (const arg of node.args) visit(arg);
        return;
      case 'round':
      case 'not':
        visit(node.value);
        return;
      case 'clamp':
        visit(node.value);
        visit(node.min);
        visit(node.max);
        return;
      case 'if':
        visit(node.test);
        visit(node.ifTrue);
        visit(node.ifFalse);
    }
  };
  visit(formula);
  return [...names].sort();
}

function variablePaths(
  node: unknown,
  path: (string | number)[],
  out: { name: string; path: (string | number)[] }[]
): void {
  if (node === null || typeof node !== 'object') return;
  if (Array.isArray(node)) {
    node.forEach((child, i) => {
      variablePaths(child, [...path, i], out);
    });
    return;
  }
  const record = node as Record<string, unknown>;
  if (record.op === 'var' && typeof record.name === 'string') {
    out.push({ name: record.name, path: [...path, 'name'] });
    return;
  }
  for (const [key, child] of Object.entries(record)) variablePaths(child, [...path, key], out);
}

export interface ParseFormulaOptions {
  /** Known input names. When given, any other variable is an unknown-variable diagnostic. */
  variables?: readonly string[];
}

/** Validates untrusted formula JSON. Never throws and never executes anything. */
export function parseFormula(
  input: unknown,
  options: ParseFormulaOptions = {}
): FormulaParseResult {
  const failed = (diagnostics: FormulaDiagnostic[]): FormulaParseResult => ({
    success: false,
    formula: null,
    variables: [],
    diagnostics,
  });
  const size = preflight(input);
  if (size) return failed([size]);
  const parsed = parseNode(input, [], 'number');
  if (!parsed.ok) return failed(parsed.diagnostics);
  const formula = parsed.node as NumberFormula;
  if (options.variables) {
    const known = new Set(options.variables);
    const found: { name: string; path: (string | number)[] }[] = [];
    variablePaths(formula, [], found);
    const unknown = found.filter((ref) => !known.has(ref.name));
    if (unknown.length > 0) {
      return failed(
        unknown.map((ref) =>
          diagnostic(
            'unknown-variable',
            ref.path,
            `Unknown variable "${ref.name}"`,
            known.size > 0
              ? `Use one of the calculator inputs: ${[...known].sort().join(', ')}.`
              : 'Add a calculator input with this name.'
          )
        )
      );
    }
  }
  return {
    success: true,
    formula,
    variables: formulaVariables(formula),
    diagnostics: [],
  };
}
