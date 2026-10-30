import { type ExpressionParseOptions, parseExpression } from './parse.ts';
import {
  EXPRESSION_LIMITS,
  type ExpressionDiagnosticCode,
  type ExpressionNode,
  type ExpressionParseResult,
} from './types.ts';

/*
 * The text form: a small infix syntax that compiles to the same JSON AST,
 * for developers writing conditions by hand and for tests and docs. One
 * left-to-right scan makes the tokens; a recursive-descent parser with an
 * explicit nesting bound builds the tree, then `parseExpression` validates
 * it (names, the function table, arity, node and depth limits). Both
 * passes are linear in the source, which is capped at
 * `EXPRESSION_LIMITS.sourceLength` characters.
 *
 *   or      := and (("or" | "||") and)*
 *   and     := not (("and" | "&&") not)*
 *   not     := ("not" | "!") not | compare
 *   compare := concat (("==" | "=" | "!=" | "<>" | "<" | "<=" | ">" | ">=") concat)?
 *   concat  := sum ("&" sum)*
 *   sum     := product (("+" | "-") product)*
 *   product := unary (("*" | "/" | "%") unary)*
 *   unary   := "-" unary | power
 *   power   := primary ("^" unary)?
 *   primary := number | string | "true" | "false" | "null" | name | name "(" args ")" | "(" or ")"
 */

type TokenKind = 'num' | 'str' | 'name' | 'op' | 'end';
interface Token {
  readonly kind: TokenKind;
  readonly text: string;
  readonly value?: number | string;
  readonly at: number;
}

class TextSyntaxError extends Error {
  readonly code: ExpressionDiagnosticCode;
  readonly at: number;
  constructor(code: ExpressionDiagnosticCode, at: number, message: string) {
    super(message);
    this.code = code;
    this.at = at;
  }
}

const OPERATORS = [
  '==',
  '!=',
  '<>',
  '<=',
  '>=',
  '&&',
  '||',
  '<',
  '>',
  '=',
  '!',
  '+',
  '-',
  '*',
  '/',
  '%',
  '^',
  '&',
  '(',
  ')',
  ',',
];

const ESCAPES: Readonly<Record<string, string>> = { n: '\n', t: '\t', r: '\r' };

function isDigit(code: number): boolean {
  return code >= 48 && code <= 57;
}
function isNameStart(code: number): boolean {
  return (code >= 65 && code <= 90) || (code >= 97 && code <= 122) || code === 95;
}

function tokenize(source: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  while (i < source.length) {
    const code = source.charCodeAt(i);
    if (code === 32 || code === 9 || code === 10 || code === 13) {
      i += 1;
      continue;
    }
    const start = i;
    if (isDigit(code) || (code === 46 && isDigit(source.charCodeAt(i + 1)))) {
      while (isDigit(source.charCodeAt(i))) i += 1;
      if (source[i] === '.') {
        i += 1;
        while (isDigit(source.charCodeAt(i))) i += 1;
      }
      if (source[i] === 'e' || source[i] === 'E') {
        let j = i + 1;
        if (source[j] === '+' || source[j] === '-') j += 1;
        if (isDigit(source.charCodeAt(j))) {
          i = j;
          while (isDigit(source.charCodeAt(i))) i += 1;
        }
      }
      const text = source.slice(start, i);
      const value = Number(text);
      if (!Number.isFinite(value))
        throw new TextSyntaxError('syntax', start, 'Number out of range.');
      tokens.push({ kind: 'num', text, value, at: start });
      continue;
    }
    if (code === 34 || code === 39) {
      const quote = source[i];
      i += 1;
      let out = '';
      let closed = false;
      while (i < source.length) {
        const ch = source[i] as string;
        if (ch === quote) {
          closed = true;
          i += 1;
          break;
        }
        if (ch === '\\') {
          const next = source[i + 1];
          if (next === undefined) break;
          out += ESCAPES[next] ?? next;
          i += 2;
          continue;
        }
        out += ch;
        i += 1;
      }
      if (!closed) throw new TextSyntaxError('syntax', start, 'Unterminated string.');
      if (out.length > EXPRESSION_LIMITS.stringLength) {
        throw new TextSyntaxError('too-long', start, 'String too long.');
      }
      tokens.push({ kind: 'str', text: source.slice(start, i), value: out, at: start });
      continue;
    }
    if (isNameStart(code)) {
      while (i < source.length) {
        const c = source.charCodeAt(i);
        if (!isNameStart(c) && !isDigit(c)) break;
        i += 1;
      }
      tokens.push({ kind: 'name', text: source.slice(start, i), at: start });
      continue;
    }
    const op = OPERATORS.find((candidate) => source.startsWith(candidate, i));
    if (!op) {
      throw new TextSyntaxError('syntax', start, `Unexpected character "${source[i]}".`);
    }
    tokens.push({ kind: 'op', text: op, at: start });
    i += op.length;
  }
  tokens.push({ kind: 'end', text: '', at: source.length });
  return tokens;
}

const COMPARE: Readonly<Record<string, ExpressionNode['op']>> = {
  '==': 'eq',
  '=': 'eq',
  '!=': 'neq',
  '<>': 'neq',
  '<': 'lt',
  '<=': 'lte',
  '>': 'gt',
  '>=': 'gte',
};

/** Names that are syntax, not fields. */
const KEYWORDS = new Set(['and', 'or', 'not', 'true', 'false', 'null']);

function build(tokens: Token[]): ExpressionNode {
  let index = 0;
  let level = 0;
  let nodes = 0;
  const peek = () => tokens[index] as Token;
  const take = () => tokens[index++] as Token;
  const isOp = (text: string) => peek().kind === 'op' && peek().text === text;
  const isWord = (text: string) => peek().kind === 'name' && peek().text === text;
  const expect = (text: string) => {
    if (!isOp(text)) throw new TextSyntaxError('syntax', peek().at, `Expected "${text}".`);
    take();
  };
  const node = (value: Record<string, unknown>): ExpressionNode => {
    nodes += 1;
    if (nodes > EXPRESSION_LIMITS.nodes) {
      throw new TextSyntaxError(
        'too-many-nodes',
        peek().at,
        `An expression has at most ${EXPRESSION_LIMITS.nodes} nodes.`
      );
    }
    return value as unknown as ExpressionNode;
  };
  const enter = () => {
    level += 1;
    if (level > EXPRESSION_LIMITS.depth) {
      throw new TextSyntaxError(
        'too-deep',
        peek().at,
        `Expressions nest at most ${EXPRESSION_LIMITS.depth} levels.`
      );
    }
  };
  const leave = () => {
    level -= 1;
  };

  // A chain of the same associative op becomes one list node.
  const chain = (
    op: 'and' | 'or' | 'concat',
    first: ExpressionNode,
    next: () => ExpressionNode,
    more: () => boolean
  ) => {
    const args = [first];
    while (more()) {
      take();
      args.push(next());
    }
    if (args.length === 1) return first;
    // Past the argument cap, nest: (a, …, b) → op(op(a, …), …).
    let current = args.slice(0, EXPRESSION_LIMITS.args);
    let rest = args.slice(EXPRESSION_LIMITS.args);
    let out = node({ op, args: current });
    while (rest.length > 0) {
      current = [out, ...rest.slice(0, EXPRESSION_LIMITS.args - 1)];
      rest = rest.slice(EXPRESSION_LIMITS.args - 1);
      out = node({ op, args: current });
    }
    return out;
  };

  const parseOr = (): ExpressionNode =>
    chain('or', parseAnd(), parseAnd, () => isWord('or') || isOp('||'));
  const parseAnd = (): ExpressionNode =>
    chain('and', parseNot(), parseNot, () => isWord('and') || isOp('&&'));
  const parseNot = (): ExpressionNode => {
    if (isWord('not') || isOp('!')) {
      take();
      enter();
      const value = parseNot();
      leave();
      return node({ op: 'not', value });
    }
    return parseCompare();
  };
  const parseCompare = (): ExpressionNode => {
    const left = parseConcat();
    const token = peek();
    const op = token.kind === 'op' ? COMPARE[token.text] : undefined;
    if (!op) return left;
    take();
    const right = parseConcat();
    const after = peek();
    if (after.kind === 'op' && COMPARE[after.text]) {
      throw new TextSyntaxError('syntax', after.at, 'Comparisons do not chain; use "and".');
    }
    return node({ op, left, right });
  };
  const parseConcat = (): ExpressionNode => chain('concat', parseSum(), parseSum, () => isOp('&'));
  const parseSum = (): ExpressionNode => {
    let left = parseProduct();
    while (isOp('+') || isOp('-')) {
      const op = take().text === '+' ? 'add' : 'sub';
      left = node({ op, left, right: parseProduct() });
    }
    return left;
  };
  const parseProduct = (): ExpressionNode => {
    let left = parseUnary();
    while (isOp('*') || isOp('/') || isOp('%')) {
      const text = take().text;
      const op = text === '*' ? 'mul' : text === '/' ? 'div' : 'mod';
      left = node({ op, left, right: parseUnary() });
    }
    return left;
  };
  const parseUnary = (): ExpressionNode => {
    if (isOp('-')) {
      take();
      enter();
      const value = parseUnary();
      leave();
      return node({ op: 'neg', value });
    }
    if (isOp('+')) {
      take();
      enter();
      const value = parseUnary();
      leave();
      return value;
    }
    return parsePower();
  };
  const parsePower = (): ExpressionNode => {
    const base = parsePrimary();
    if (!isOp('^')) return base;
    take();
    enter();
    const exponent = parseUnary();
    leave();
    return node({ op: 'pow', base, exponent });
  };
  const parseArgs = (): ExpressionNode[] => {
    expect('(');
    const args: ExpressionNode[] = [];
    if (isOp(')')) {
      take();
      return args;
    }
    enter();
    for (;;) {
      args.push(parseOr());
      if (args.length > EXPRESSION_LIMITS.args) {
        throw new TextSyntaxError(
          'syntax',
          peek().at,
          `At most ${EXPRESSION_LIMITS.args} arguments.`
        );
      }
      if (isOp(',')) {
        take();
        continue;
      }
      break;
    }
    leave();
    expect(')');
    return args;
  };
  const parsePrimary = (): ExpressionNode => {
    const token = take();
    if (token.kind === 'num') return node({ op: 'num', value: token.value });
    if (token.kind === 'str') return node({ op: 'str', value: token.value });
    if (token.kind === 'op' && token.text === '(') {
      enter();
      const inner = parseOr();
      leave();
      expect(')');
      return inner;
    }
    if (token.kind === 'name') {
      if (token.text === 'true' || token.text === 'false') {
        return node({ op: 'bool', value: token.text === 'true' });
      }
      if (token.text === 'null') return node({ op: 'null' });
      if (KEYWORDS.has(token.text)) {
        throw new TextSyntaxError('syntax', token.at, `Unexpected "${token.text}".`);
      }
      if (!isOp('(')) return node({ op: 'field', name: token.text });
      const args = parseArgs();
      return call(token, args);
    }
    throw new TextSyntaxError(
      'syntax',
      token.at,
      token.kind === 'end' ? 'Unexpected end of expression.' : `Unexpected "${token.text}".`
    );
  };
  const call = (token: Token, args: ExpressionNode[]): ExpressionNode => {
    const name = token.text;
    const arity = (min: number, max: number) => {
      if (args.length < min || args.length > max) {
        throw new TextSyntaxError(
          'arity',
          token.at,
          min === max
            ? `"${name}" takes ${min} arguments.`
            : `"${name}" takes ${min} to ${max} arguments.`
        );
      }
    };
    switch (name) {
      case 'if': {
        arity(3, 3);
        const [test, ifTrue, ifFalse] = args;
        return node({ op: 'if', test, ifTrue, ifFalse });
      }
      case 'min':
      case 'max':
      case 'concat':
        arity(1, EXPRESSION_LIMITS.args);
        return node({ op: name, args });
      case 'clamp': {
        arity(3, 3);
        const [value, min, max] = args;
        return node({ op: 'clamp', value, min, max });
      }
      case 'round': {
        arity(1, 2);
        const [value, digits] = args;
        if (!digits) return node({ op: 'round', value });
        const literal =
          digits.op === 'num'
            ? digits.value
            : digits.op === 'neg' && digits.value.op === 'num'
              ? -digits.value.value
              : undefined;
        if (literal === undefined) {
          throw new TextSyntaxError('syntax', token.at, '"round" digits must be a number literal.');
        }
        return node({ op: 'round', value, digits: literal });
      }
      default:
        return node({ op: 'call', fn: name, args });
    }
  };

  const tree = parseOr();
  const rest = peek();
  if (rest.kind !== 'end')
    throw new TextSyntaxError('syntax', rest.at, `Unexpected "${rest.text}".`);
  return tree;
}

/**
 * Parse expression text (`age >= 18 and country == "CO"`) into a validated
 * expression. Names read fields (`{ op: "field" }`); `if`, `min`, `max`,
 * `concat`, `round` and `clamp` map to their AST ops, and other calls must
 * be in the function table. Never throws.
 */
export function parseExpressionText(
  source: string,
  options: ExpressionParseOptions = {}
): ExpressionParseResult {
  const fail = (
    code: ExpressionDiagnosticCode,
    at: number,
    message: string
  ): ExpressionParseResult =>
    Object.freeze({
      ok: false,
      expression: null,
      diagnostics: Object.freeze([Object.freeze({ code, path: `@${at}`, message })]),
    });
  if (typeof source !== 'string') return fail('syntax', 0, 'Expression text is a string.');
  if (source.length > EXPRESSION_LIMITS.sourceLength) {
    return fail(
      'too-long',
      0,
      `Expression text is at most ${EXPRESSION_LIMITS.sourceLength} characters.`
    );
  }
  let tree: ExpressionNode;
  try {
    tree = build(tokenize(source));
  } catch (error) {
    if (error instanceof TextSyntaxError) return fail(error.code, error.at, error.message);
    return fail('syntax', 0, 'Unreadable expression.');
  }
  return parseExpression(tree, options);
}

const PRECEDENCE: Readonly<Partial<Record<ExpressionNode['op'], number>>> = {
  or: 1,
  and: 2,
  not: 3,
  lt: 4,
  lte: 4,
  gt: 4,
  gte: 4,
  eq: 4,
  neq: 4,
  concat: 5,
  add: 6,
  sub: 6,
  mul: 7,
  div: 7,
  mod: 7,
  neg: 8,
  pow: 9,
};

const SYMBOL: Readonly<Partial<Record<ExpressionNode['op'], string>>> = {
  lt: '<',
  lte: '<=',
  gt: '>',
  gte: '>=',
  eq: '==',
  neq: '!=',
  add: '+',
  sub: '-',
  mul: '*',
  div: '/',
  mod: '%',
  pow: '^',
};

function quote(value: string): string {
  return `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n').replace(/\t/g, '\\t').replace(/\r/g, '\\r')}"`;
}

/**
 * Print an AST as expression text that parses back to an equivalent
 * expression (`var` prints as a plain name, which reads back as `field`;
 * `ref` and `range` print their dialect text).
 */
export function formatExpression(ast: ExpressionNode): string {
  const wrap = (child: ExpressionNode, parent: number, right = false): string => {
    const own = PRECEDENCE[child.op] ?? 10;
    const text = formatExpression(child);
    return own < parent || (right && own === parent) ? `(${text})` : text;
  };
  switch (ast.op) {
    case 'num':
      return ast.value < 0 ? `(${String(ast.value)})` : String(ast.value);
    case 'str':
      return quote(ast.value);
    case 'bool':
      return String(ast.value);
    case 'null':
      return 'null';
    case 'var':
    case 'field':
      return ast.name;
    case 'ref':
      return ast.ref;
    case 'range':
      return `${ast.from}:${ast.to}`;
    case 'and':
    case 'or':
      return ast.args
        .map((arg) => wrap(arg, (PRECEDENCE[ast.op] as number) + 1))
        .join(` ${ast.op} `);
    case 'concat':
      return ast.args.length === 1
        ? `concat(${formatExpression(ast.args[0] as ExpressionNode)})`
        : ast.args.map((arg) => wrap(arg, 6)).join(' & ');
    case 'not':
      return `not ${wrap(ast.value, 3)}`;
    case 'neg':
      return `-${wrap(ast.value, 8)}`;
    case 'pow':
      return `${wrap(ast.base, 10)} ^ ${wrap(ast.exponent, 8)}`;
    case 'if':
      return `if(${formatExpression(ast.test)}, ${formatExpression(ast.ifTrue)}, ${formatExpression(ast.ifFalse)})`;
    case 'min':
    case 'max':
      return `${ast.op}(${ast.args.map(formatExpression).join(', ')})`;
    case 'round':
      return ast.digits === undefined
        ? `round(${formatExpression(ast.value)})`
        : `round(${formatExpression(ast.value)}, ${ast.digits})`;
    case 'clamp':
      return `clamp(${formatExpression(ast.value)}, ${formatExpression(ast.min)}, ${formatExpression(ast.max)})`;
    case 'call':
      return `${ast.fn}(${ast.args.map(formatExpression).join(', ')})`;
    default: {
      const own = PRECEDENCE[ast.op] as number;
      const symbol = SYMBOL[ast.op] as string;
      const node = ast as { left: ExpressionNode; right: ExpressionNode };
      const comparison = own === 4;
      return `${wrap(node.left, comparison ? 5 : own)} ${symbol} ${wrap(node.right, comparison ? 5 : own, true)}`;
    }
  }
}
