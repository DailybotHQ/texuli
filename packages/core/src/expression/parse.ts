import { CORE_FUNCTIONS } from './functions.ts';
import {
  EXPRESSION_LIMITS,
  EXPRESSION_NAME,
  type Expression,
  type ExpressionDiagnostic,
  type ExpressionDiagnosticCode,
  type ExpressionFunctionTable,
  type ExpressionNode,
  type ExpressionOp,
  type ExpressionParseResult,
  type ExpressionReferenceDialect,
} from './types.ts';

/*
 * The JSON-form parser: reads an untrusted value as an expression AST and
 * returns a frozen, normalized copy, or diagnostics. Closed by construction:
 * unknown ops and unknown members are refused, names follow
 * `EXPRESSION_NAME`, functions must be in the caller's table with a legal
 * arity, and the node, depth, argument and string limits hold. The walk is
 * recursive but bounded by the depth limit, so a hostile 100,000-level
 * object costs 33 frames and stops.
 */

type MemberKind = 'node' | 'nodes' | 'number' | 'string' | 'boolean' | 'name' | 'ref' | 'digits';

const BINARY = { left: 'node', right: 'node' } as const;
const LIST = { args: 'nodes' } as const;

/** The members each op takes (all required except `digits`). */
const MEMBERS: Readonly<Record<ExpressionOp, Readonly<Record<string, MemberKind>>>> = Object.freeze(
  {
    num: { value: 'number' },
    str: { value: 'string' },
    bool: { value: 'boolean' },
    null: {},
    var: { name: 'name' },
    field: { name: 'name' },
    ref: { ref: 'ref' },
    range: { from: 'ref', to: 'ref' },
    add: BINARY,
    sub: BINARY,
    mul: BINARY,
    div: BINARY,
    mod: BINARY,
    pow: { base: 'node', exponent: 'node' },
    neg: { value: 'node' },
    lt: BINARY,
    lte: BINARY,
    gt: BINARY,
    gte: BINARY,
    eq: BINARY,
    neq: BINARY,
    and: LIST,
    or: LIST,
    not: { value: 'node' },
    if: { test: 'node', ifTrue: 'node', ifFalse: 'node' },
    min: LIST,
    max: LIST,
    concat: LIST,
    round: { value: 'node', digits: 'digits' },
    clamp: { value: 'node', min: 'node', max: 'node' },
    call: { fn: 'name', args: 'nodes' },
  }
);

const OPTIONAL = new Set(['digits']);

/** Every op of the AST, in a stable order. */
export const EXPRESSION_OPS: readonly ExpressionOp[] = Object.freeze(
  Object.keys(MEMBERS) as ExpressionOp[]
);

/** Options for `parseExpression` and `parseExpressionText`. */
export interface ExpressionParseOptions {
  /** The closed function table calls may name (default `CORE_FUNCTIONS`). */
  readonly functions?: ExpressionFunctionTable;
  /** Enables `ref` and `range` nodes; without it they are refused (`refs-disabled`). */
  readonly references?: ExpressionReferenceDialect;
}

const MAX_DIAGNOSTICS = 20;
const MAX_REF_LENGTH = 256;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** Turns a validated AST into an `Expression` with its dependencies. */
export function summarize(ast: ExpressionNode, nodes: number, depth: number): Expression {
  const fields = new Set<string>();
  const functions = new Set<string>();
  const refs = new Set<string>();
  const ranges: { from: string; to: string }[] = [];
  const stack: ExpressionNode[] = [ast];
  while (stack.length > 0) {
    const node = stack.pop() as ExpressionNode;
    switch (node.op) {
      case 'var':
      case 'field':
        fields.add(node.name);
        break;
      case 'ref':
        refs.add(node.ref);
        break;
      case 'range':
        ranges.push(Object.freeze({ from: node.from, to: node.to }));
        break;
      case 'call':
        functions.add(node.fn);
        break;
      default:
        break;
    }
    for (const child of children(node)) stack.push(child);
  }
  const sorted = (set: Set<string>) => Object.freeze([...set].sort());
  return Object.freeze({
    ast,
    nodes,
    depth,
    fields: sorted(fields),
    functions: sorted(functions),
    refs: sorted(refs),
    ranges: Object.freeze(ranges.reverse()),
  });
}

/** The child nodes of a node, in member order. */
export function children(node: ExpressionNode): readonly ExpressionNode[] {
  switch (node.op) {
    case 'add':
    case 'sub':
    case 'mul':
    case 'div':
    case 'mod':
    case 'lt':
    case 'lte':
    case 'gt':
    case 'gte':
    case 'eq':
    case 'neq':
      return [node.left, node.right];
    case 'pow':
      return [node.base, node.exponent];
    case 'neg':
    case 'not':
    case 'round':
      return [node.value];
    case 'clamp':
      return [node.value, node.min, node.max];
    case 'if':
      return [node.test, node.ifTrue, node.ifFalse];
    case 'and':
    case 'or':
    case 'min':
    case 'max':
    case 'concat':
    case 'call':
      return node.args;
    default:
      return [];
  }
}

/**
 * Parse an untrusted value as an expression AST (the JSON form). Never
 * throws; on success the AST is a frozen copy holding only known members.
 */
export function parseExpression(
  input: unknown,
  options: ExpressionParseOptions = {}
): ExpressionParseResult {
  const functions = options.functions ?? CORE_FUNCTIONS;
  const references = options.references;
  const diagnostics: ExpressionDiagnostic[] = [];
  let nodes = 0;
  let maxDepth = 0;
  let stopped = false;

  const report = (code: ExpressionDiagnosticCode, path: string, message: string): void => {
    if (diagnostics.length < MAX_DIAGNOSTICS) diagnostics.push({ code, path, message });
    if (code === 'too-many-nodes' || diagnostics.length >= MAX_DIAGNOSTICS) stopped = true;
  };

  const visit = (value: unknown, path: string, depth: number): ExpressionNode | null => {
    if (stopped) return null;
    if (depth > EXPRESSION_LIMITS.depth) {
      report('too-deep', path, `Expressions nest at most ${EXPRESSION_LIMITS.depth} levels.`);
      return null;
    }
    nodes += 1;
    if (nodes > EXPRESSION_LIMITS.nodes) {
      report('too-many-nodes', path, `An expression has at most ${EXPRESSION_LIMITS.nodes} nodes.`);
      return null;
    }
    if (depth > maxDepth) maxDepth = depth;
    if (!isRecord(value)) {
      report('not-a-node', path, 'An expression node is an object with an "op".');
      return null;
    }
    const op = value.op;
    if (typeof op !== 'string' || !Object.hasOwn(MEMBERS, op)) {
      report(
        'unknown-op',
        `${path}.op`,
        `Unknown op ${typeof op === 'string' ? `"${op.slice(0, 32)}"` : ''}.`.replace(' .', '.')
      );
      return null;
    }
    const members = MEMBERS[op as ExpressionOp];
    for (const key of Object.keys(value)) {
      if (key !== 'op' && !Object.hasOwn(members, key)) {
        report(
          'unknown-member',
          `${path}.${key.slice(0, 32)}`,
          `"${op}" takes no "${key.slice(0, 32)}".`
        );
      }
    }
    const out: Record<string, unknown> = { op };
    for (const [member, kind] of Object.entries(members)) {
      const at = `${path}.${member}`;
      if (!Object.hasOwn(value, member) || value[member] === undefined) {
        if (!OPTIONAL.has(member)) report('missing-member', at, `"${op}" needs "${member}".`);
        continue;
      }
      const raw = value[member];
      switch (kind) {
        case 'node': {
          const child = visit(raw, at, depth + 1);
          if (child) out[member] = child;
          break;
        }
        case 'nodes': {
          if (!Array.isArray(raw)) {
            report('bad-member', at, `"${member}" is a list of expressions.`);
            break;
          }
          const min = op === 'call' ? 0 : 1;
          if (raw.length < min || raw.length > EXPRESSION_LIMITS.args) {
            report(
              'bad-member',
              at,
              `"${member}" holds ${min} to ${EXPRESSION_LIMITS.args} expressions.`
            );
            break;
          }
          const list: ExpressionNode[] = [];
          for (let index = 0; index < raw.length && !stopped; index += 1) {
            const child = visit(raw[index], `${at}[${index}]`, depth + 1);
            if (child) list.push(child);
          }
          out[member] = Object.freeze(list);
          break;
        }
        case 'number':
          if (typeof raw !== 'number' || !Number.isFinite(raw)) {
            report('bad-member', at, '"value" is a finite number.');
          } else out[member] = raw === 0 ? 0 : raw;
          break;
        case 'string':
          if (typeof raw !== 'string') report('bad-member', at, '"value" is a string.');
          else if (raw.length > EXPRESSION_LIMITS.stringLength) {
            report(
              'too-long',
              at,
              `Strings hold at most ${EXPRESSION_LIMITS.stringLength} characters.`
            );
          } else out[member] = raw;
          break;
        case 'boolean':
          if (typeof raw !== 'boolean') report('bad-member', at, '"value" is true or false.');
          else out[member] = raw;
          break;
        case 'name':
          if (typeof raw !== 'string' || !EXPRESSION_NAME.test(raw)) {
            report('bad-name', at, 'A name is a letter or _, then up to 63 letters, digits or _.');
          } else out[member] = raw;
          break;
        case 'digits':
          if (
            typeof raw !== 'number' ||
            !Number.isInteger(raw) ||
            Math.abs(raw) > EXPRESSION_LIMITS.roundDigits
          ) {
            report(
              'bad-member',
              at,
              `"digits" is an integer from -${EXPRESSION_LIMITS.roundDigits} to ${EXPRESSION_LIMITS.roundDigits}.`
            );
          } else out[member] = raw === 0 ? 0 : raw;
          break;
        case 'ref':
          if (!references) {
            report('refs-disabled', at, 'References are not part of this dialect.');
          } else if (
            typeof raw !== 'string' ||
            raw.length === 0 ||
            raw.length > MAX_REF_LENGTH ||
            !references.isRef(raw)
          ) {
            report('bad-ref', at, 'Not a reference this dialect accepts.');
          } else out[member] = raw;
          break;
      }
    }
    if (op === 'call' && typeof out.fn === 'string') {
      const fn = Object.hasOwn(functions, out.fn) ? functions[out.fn] : undefined;
      if (!fn) {
        report('unknown-function', `${path}.fn`, `"${out.fn}" is not in the function table.`);
      } else if (Array.isArray(out.args)) {
        const count = (out.args as unknown[]).length;
        if (count < fn.minArgs || count > fn.maxArgs) {
          report(
            'arity',
            `${path}.args`,
            fn.minArgs === fn.maxArgs
              ? `"${out.fn}" takes ${fn.minArgs} argument${fn.minArgs === 1 ? '' : 's'}.`
              : `"${out.fn}" takes ${fn.minArgs} to ${fn.maxArgs} arguments.`
          );
        }
      }
    }
    return Object.freeze(out) as unknown as ExpressionNode;
  };

  const ast = visit(input, '$', 1);
  if (diagnostics.length > 0 || !ast) {
    return Object.freeze({
      ok: false,
      expression: null,
      diagnostics: Object.freeze(diagnostics),
    }) as ExpressionParseResult;
  }
  return Object.freeze({
    ok: true,
    expression: summarize(ast, nodes, maxDepth),
    diagnostics: Object.freeze([]) as readonly [],
  });
}
