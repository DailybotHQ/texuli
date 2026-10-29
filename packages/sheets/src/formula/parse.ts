import {
  type Expression,
  type ExpressionDiagnostic,
  type ExpressionDiagnosticCode,
  type ExpressionNode,
  type ExpressionReferenceDialect,
  parseExpression,
} from '@texuli/core/expression';
import { SHEET_FUNCTION_INFO, SHEET_FUNCTIONS } from './functions.ts';
import { type CellReference, formatReference, parseCellPart, parseReference } from './reference.ts';

/*
 * The sheet formula grammar of ADR-015: an owned, linear-time Pratt parser
 * from formula text into the `@texuli/core/expression` AST, which then goes
 * through `parseExpression` with the sheet reference dialect and the sheet
 * function table, so every node, depth and arity limit of the core holds.
 *
 *   formula  := "=" expr
 *   expr     := comparison of concatenations of sums of products of powers
 *   operators, loosest first: = <> < <= > >=   &   + -   * /   ^   %   unary -
 *   primary  := number | "string" | TRUE | FALSE | #REF! | ref | ref ":" ref
 *             | col ":" col | NAME "(" args ")" | "(" expr ")"
 *   ref      := [sheet "!"] ["$"] letters ["$"] digits
 *   sheet    := name | "'" chars with '' escapes "'"
 *
 * `^` is left-associative and unary minus binds tighter than `^` (so `-2^2`
 * is 4), as in other spreadsheets. There is no R1C1, no structured
 * reference, no array literal and no function that builds a reference from
 * text (no INDIRECT, no OFFSET): every dependency is visible in the AST.
 * One left-to-right scan makes the tokens and the parser visits each token
 * once; nesting stops at `FORMULA_LIMITS.depth`.
 */

/** Limits of formula text. */
export const FORMULA_LIMITS = Object.freeze({
  /** Characters of one formula, the leading `=` included. */
  length: 8192,
  /** Nesting of parentheses, calls and unary operators the parser follows. */
  depth: 32,
});

/** The error a formula that does not parse shows in its cell. */
export type FormulaParseError = '#NAME?' | '#VALUE!';

/** A parsed formula: the validated core expression and its static references. */
export interface SheetFormula {
  /** The formula text, with its leading `=`. */
  readonly source: string;
  readonly expression: Expression;
  /** Single-cell references, in source order (duplicates kept). */
  readonly refs: readonly CellReference[];
  /** Ranges (intervals, never expanded), in source order. */
  readonly ranges: readonly { readonly from: CellReference; readonly to: CellReference }[];
}

export type FormulaParseResult =
  | { readonly ok: true; readonly formula: SheetFormula; readonly diagnostics: readonly [] }
  | {
      readonly ok: false;
      readonly formula: null;
      /** What the cell shows: `#NAME?` for an unknown name or function, else `#VALUE!`. */
      readonly error: FormulaParseError;
      readonly diagnostics: readonly ExpressionDiagnostic[];
    };

/** The reference dialect sheets pass to `parseExpression`: A1 cells, column endpoints and `#REF!`. */
export const SHEET_REFERENCE_DIALECT: ExpressionReferenceDialect = Object.freeze({
  isRef: (ref: string) => ref === REF_ERROR || parseReference(ref, true) !== null,
});

/** The literal a deleted reference becomes in formula text and in the AST. */
export const REF_ERROR = '#REF!';

type TokenKind = 'num' | 'str' | 'bool' | 'ref' | 'col' | 'name' | 'referr' | 'op' | 'end';

/** One token with its source span. */
export interface FormulaToken {
  readonly kind: TokenKind;
  readonly text: string;
  readonly start: number;
  readonly end: number;
  readonly value?: number | string | boolean;
  readonly ref?: CellReference;
}

class FormulaSyntaxError extends Error {
  readonly code: ExpressionDiagnosticCode;
  readonly at: number;
  constructor(code: ExpressionDiagnosticCode, at: number, message: string) {
    super(message);
    this.code = code;
    this.at = at;
  }
}

const OPERATORS = [
  '<>',
  '<=',
  '>=',
  '<',
  '>',
  '=',
  '+',
  '-',
  '*',
  '/',
  '^',
  '&',
  '%',
  '(',
  ')',
  ',',
  ':',
];
const WORD_START = /[A-Za-z_$]/;
const WORD_PART = /[A-Za-z0-9_.$]/;
const DIGIT = /[0-9]/;

function isSpace(ch: string): boolean {
  return ch === ' ' || ch === '\t' || ch === '\n' || ch === '\r';
}

/**
 * Tokenize formula text (without its leading `=`). Linear: each character
 * is read once. `offset` shifts the reported spans (1 when the `=` was cut).
 */
export function tokenizeFormula(body: string, offset = 0): FormulaToken[] {
  const tokens: FormulaToken[] = [];
  let i = 0;
  const n = body.length;
  const push = (token: Omit<FormulaToken, 'start' | 'end'>, start: number, end: number) =>
    tokens.push({ ...token, start: start + offset, end: end + offset });
  const fail = (at: number, message: string): never => {
    throw new FormulaSyntaxError('syntax', at + offset, message);
  };
  while (i < n) {
    const ch = body[i] as string;
    if (isSpace(ch)) {
      i += 1;
      continue;
    }
    const start = i;
    if (DIGIT.test(ch) || (ch === '.' && DIGIT.test(body[i + 1] ?? ''))) {
      while (i < n && DIGIT.test(body[i] as string)) i += 1;
      if (body[i] === '.') {
        i += 1;
        while (i < n && DIGIT.test(body[i] as string)) i += 1;
      }
      if (body[i] === 'e' || body[i] === 'E') {
        let j = i + 1;
        if (body[j] === '+' || body[j] === '-') j += 1;
        if (DIGIT.test(body[j] ?? '')) {
          while (j < n && DIGIT.test(body[j] as string)) j += 1;
          i = j;
        }
      }
      const text = body.slice(start, i);
      const value = Number(text);
      if (!Number.isFinite(value)) fail(start, `The number ${text.slice(0, 24)} is too large.`);
      push({ kind: 'num', text, value }, start, i);
      continue;
    }
    if (ch === '"') {
      let value = '';
      i += 1;
      for (;;) {
        if (i >= n) fail(start, 'A string is not closed.');
        const c = body[i] as string;
        if (c === '"') {
          if (body[i + 1] === '"') {
            value += '"';
            i += 2;
            continue;
          }
          i += 1;
          break;
        }
        // Copy the run up to the next quote in one slice (linear).
        const next = body.indexOf('"', i);
        const stop = next < 0 ? n : next;
        value += body.slice(i, stop);
        i = stop;
      }
      push({ kind: 'str', text: body.slice(start, i), value }, start, i);
      continue;
    }
    if (ch === '#') {
      if (body.startsWith('#REF!', i)) {
        i += 5;
        push({ kind: 'referr', text: REF_ERROR }, start, i);
        continue;
      }
      fail(start, 'Only the #REF! error can be written in a formula.');
    }
    // A sheet prefix: 'quoted name'! or name!
    let sheet: string | null = null;
    if (ch === "'") {
      i += 1;
      let name = '';
      for (;;) {
        if (i >= n) fail(start, 'A quoted sheet name is not closed.');
        const c = body[i] as string;
        if (c === "'") {
          if (body[i + 1] === "'") {
            name += "'";
            i += 2;
            continue;
          }
          i += 1;
          break;
        }
        const next = body.indexOf("'", i);
        const stop = next < 0 ? n : next;
        name += body.slice(i, stop);
        i = stop;
      }
      if (body[i] !== '!') fail(i, 'A quoted sheet name is followed by "!".');
      i += 1;
      sheet = name;
    } else if (WORD_START.test(ch)) {
      while (i < n && WORD_PART.test(body[i] as string)) i += 1;
      if (body[i] === '!') {
        sheet = body.slice(start, i);
        i += 1;
      } else {
        const word = body.slice(start, i);
        const upper = word.toUpperCase();
        if (upper === 'TRUE' || upper === 'FALSE') {
          push({ kind: 'bool', text: word, value: upper === 'TRUE' }, start, i);
          continue;
        }
        const ref = parseCellPart(word, null, true);
        if (ref && body[skipSpace(body, i)] !== '(') {
          push({ kind: ref.row === null ? 'col' : 'ref', text: word, ref }, start, i);
          continue;
        }
        push({ kind: 'name', text: word }, start, i);
        continue;
      }
    }
    if (sheet !== null) {
      const partStart = i;
      while (i < n && WORD_PART.test(body[i] as string)) i += 1;
      const ref = parseReference(`${sheetPrefixText(sheet)}${body.slice(partStart, i)}`, true);
      if (!ref) fail(start, 'A sheet name is followed by a cell such as A1.');
      const parsed = ref as CellReference;
      push(
        { kind: parsed.row === null ? 'col' : 'ref', text: body.slice(start, i), ref: parsed },
        start,
        i
      );
      continue;
    }
    const op = OPERATORS.find((candidate) => body.startsWith(candidate, i));
    if (!op) fail(start, `Unexpected "${ch}".`);
    i += (op as string).length;
    push({ kind: 'op', text: op as string }, start, i);
  }
  push({ kind: 'end', text: '' }, n, n);
  return tokens;
}

function skipSpace(text: string, from: number): number {
  let i = from;
  while (i < text.length && isSpace(text[i] as string)) i += 1;
  return i;
}

function sheetPrefixText(sheet: string): string {
  return `'${sheet.replace(/'/g, "''")}'!`;
}

const INFIX: Readonly<Record<string, number>> = Object.freeze({
  '=': 10,
  '<>': 10,
  '<': 10,
  '<=': 10,
  '>': 10,
  '>=': 10,
  '&': 20,
  '+': 30,
  '-': 30,
  '*': 40,
  '/': 40,
  '^': 50,
  '%': 60,
});
const UNARY_POWER = 55;

const BINARY_OP: Readonly<Record<string, ExpressionNode['op']>> = Object.freeze({
  '=': 'eq',
  '<>': 'neq',
  '<': 'lt',
  '<=': 'lte',
  '>': 'gt',
  '>=': 'gte',
  '+': 'add',
  '-': 'sub',
  '*': 'mul',
  '/': 'div',
});

function refText(ref: CellReference): string {
  return formatReference({ ...ref, colAbsolute: false, rowAbsolute: false });
}

/** Columns a range argument spans (1 for anything that is not a range literal). */
function widthOf(node: ExpressionNode): number {
  if (node.op !== 'range') return 1;
  const from = parseReference(node.from, true);
  const to = parseReference(node.to, true);
  if (!from || !to) return 1;
  return Math.abs(to.col - from.col) + 1;
}

class Parser {
  private index = 0;
  private depth = 0;
  readonly refs: CellReference[] = [];
  readonly ranges: { from: CellReference; to: CellReference }[] = [];
  readonly names: string[] = [];
  private readonly tokens: readonly FormulaToken[];

  constructor(tokens: readonly FormulaToken[]) {
    this.tokens = tokens;
  }

  private peek(): FormulaToken {
    return this.tokens[this.index] as FormulaToken;
  }

  private next(): FormulaToken {
    const token = this.tokens[this.index] as FormulaToken;
    if (token.kind !== 'end') this.index += 1;
    return token;
  }

  private isOp(text: string): boolean {
    const token = this.peek();
    return token.kind === 'op' && token.text === text;
  }

  private expect(text: string): void {
    const token = this.next();
    if (token.kind !== 'op' || token.text !== text) {
      throw new FormulaSyntaxError('syntax', token.start, `Expected "${text}".`);
    }
  }

  private enter(at: number): void {
    this.depth += 1;
    if (this.depth > FORMULA_LIMITS.depth) {
      throw new FormulaSyntaxError(
        'too-deep',
        at,
        `Formulas nest at most ${FORMULA_LIMITS.depth} levels.`
      );
    }
  }

  parseFormula(): ExpressionNode {
    const node = this.parseExpr(0);
    const token = this.peek();
    if (token.kind !== 'end') {
      throw new FormulaSyntaxError('syntax', token.start, `Unexpected "${token.text}".`);
    }
    return node;
  }

  parseExpr(rbp: number): ExpressionNode {
    let left = this.parsePrefix();
    for (;;) {
      const token = this.peek();
      if (token.kind !== 'op') break;
      const lbp = INFIX[token.text];
      if (lbp === undefined || lbp <= rbp) break;
      this.next();
      if (token.text === '%') {
        left = { op: 'div', left, right: { op: 'num', value: 100 } };
        continue;
      }
      this.enter(token.start);
      // Left-associative: the right side binds tighter than this operator.
      const right = this.parseExpr(lbp);
      this.depth -= 1;
      if (token.text === '&') left = { op: 'concat', args: [left, right] };
      else if (token.text === '^') left = { op: 'pow', base: left, exponent: right };
      else left = { op: BINARY_OP[token.text], left, right } as ExpressionNode;
    }
    return left;
  }

  private parsePrefix(): ExpressionNode {
    const token = this.next();
    switch (token.kind) {
      case 'num':
        return { op: 'num', value: token.value as number };
      case 'str':
        return { op: 'str', value: token.value as string };
      case 'bool':
        return { op: 'bool', value: token.value as boolean };
      case 'referr':
        return { op: 'ref', ref: REF_ERROR };
      case 'ref':
      case 'col':
        return this.reference(token);
      case 'name':
        return this.call(token);
      case 'op': {
        if (token.text === '-' || token.text === '+') {
          this.enter(token.start);
          const value = this.parseExpr(UNARY_POWER);
          this.depth -= 1;
          return token.text === '-' ? { op: 'neg', value } : value;
        }
        if (token.text === '(') {
          this.enter(token.start);
          const inner = this.parseExpr(0);
          this.expect(')');
          this.depth -= 1;
          return inner;
        }
        throw new FormulaSyntaxError('syntax', token.start, `Unexpected "${token.text}".`);
      }
      case 'end':
        throw new FormulaSyntaxError('syntax', token.start, 'The formula ends too early.');
      default:
        throw new FormulaSyntaxError('syntax', token.start, `Unexpected "${token.text}".`);
    }
  }

  private reference(token: FormulaToken): ExpressionNode {
    const from = token.ref as CellReference;
    if (!this.isOp(':')) {
      if (token.kind === 'col') {
        throw new FormulaSyntaxError(
          'bad-ref',
          token.start,
          `A column such as ${token.text} stands only in a range (${token.text}:${token.text}).`
        );
      }
      this.refs.push(from);
      return { op: 'ref', ref: refText(from) };
    }
    this.next();
    const end = this.next();
    if ((end.kind !== 'ref' && end.kind !== 'col') || end.kind !== token.kind) {
      throw new FormulaSyntaxError(
        'bad-ref',
        end.start,
        token.kind === 'col'
          ? 'A whole-column range is two columns, such as A:C.'
          : 'A range is two cells, such as A1:B3.'
      );
    }
    const raw = end.ref as CellReference;
    if (raw.sheet !== null && raw.sheet !== from.sheet) {
      throw new FormulaSyntaxError('bad-ref', end.start, 'A range stays on one sheet.');
    }
    const to: CellReference = { ...raw, sheet: from.sheet };
    // Normalize to top-left and bottom-right.
    const a: CellReference = {
      ...from,
      col: Math.min(from.col, to.col),
      row: from.row === null || to.row === null ? null : Math.min(from.row, to.row),
    };
    const b: CellReference = {
      ...to,
      col: Math.max(from.col, to.col),
      row: from.row === null || to.row === null ? null : Math.max(from.row, to.row),
    };
    this.ranges.push({ from: a, to: b });
    return { op: 'range', from: refText(a), to: refText(b) };
  }

  private call(token: FormulaToken): ExpressionNode {
    const name = token.text.toUpperCase();
    if (!this.isOp('(')) {
      throw new FormulaSyntaxError(
        'bad-name',
        token.start,
        `"${token.text.slice(0, 32)}" is not a cell or a known name.`
      );
    }
    const info = Object.hasOwn(SHEET_FUNCTION_INFO, name) ? SHEET_FUNCTION_INFO[name] : undefined;
    if (!info) {
      this.names.push(name);
      throw new FormulaSyntaxError(
        'unknown-function',
        token.start,
        `${token.text.slice(0, 32)} is not a sheet function.`
      );
    }
    this.next();
    this.enter(token.start);
    const args: ExpressionNode[] = [];
    if (!this.isOp(')')) {
      for (;;) {
        args.push(this.parseExpr(0));
        if (this.isOp(',')) {
          this.next();
          continue;
        }
        break;
      }
    }
    this.expect(')');
    this.depth -= 1;
    if (args.length < info.minArgs || args.length > info.maxArgs) {
      throw new FormulaSyntaxError(
        'arity',
        token.start,
        info.minArgs === info.maxArgs
          ? `${name} takes ${info.minArgs} argument${info.minArgs === 1 ? '' : 's'}.`
          : `${name} takes ${info.minArgs} to ${info.maxArgs} arguments.`
      );
    }
    if (name === 'IF') {
      return {
        op: 'if',
        test: args[0] as ExpressionNode,
        ifTrue: args[1] as ExpressionNode,
        ifFalse: args[2] ?? { op: 'bool', value: false },
      };
    }
    if (info.shaped !== undefined) {
      // Lookups that need a range's width get it as a hidden first argument.
      const target = args[info.shaped] as ExpressionNode;
      return { op: 'call', fn: name, args: [{ op: 'num', value: widthOf(target) }, ...args] };
    }
    return { op: 'call', fn: name, args };
  }
}

/** Chains longer than this are rebalanced so their depth grows with log2 of the terms. */
const CHAIN_BALANCE_AT = 8;

/**
 * Rebalance long left-nested chains of `+`/`-` and `&` (associative for
 * values that reach them: subtraction becomes adding a negation), so a
 * long sum like `=B2+B3+…+B90` stays inside the core depth limit. Short
 * chains keep their left-to-right shape. Iterative along each chain; the
 * terms themselves are bounded by the parser's nesting limit.
 */
function balance(node: ExpressionNode): ExpressionNode {
  const additive = node.op === 'add' || node.op === 'sub';
  const textual = node.op === 'concat' && node.args.length === 2;
  if (additive || textual) {
    const terms: ExpressionNode[] = [];
    let current: ExpressionNode = node;
    for (;;) {
      if (additive && (current.op === 'add' || current.op === 'sub')) {
        terms.push(current.op === 'sub' ? { op: 'neg', value: current.right } : current.right);
        current = current.left;
      } else if (textual && current.op === 'concat' && current.args.length === 2) {
        terms.push(current.args[1] as ExpressionNode);
        current = current.args[0] as ExpressionNode;
      } else break;
    }
    terms.push(current);
    terms.reverse();
    if (terms.length > CHAIN_BALANCE_AT) {
      const join = (from: number, to: number): ExpressionNode => {
        if (to - from === 1) return balance(terms[from] as ExpressionNode);
        const mid = (from + to) >> 1;
        const left = join(from, mid);
        const right = join(mid, to);
        return additive ? { op: 'add', left, right } : { op: 'concat', args: [left, right] };
      };
      return join(0, terms.length);
    }
  }
  return mapChildren(node, balance);
}

function mapChildren(
  node: ExpressionNode,
  map: (child: ExpressionNode) => ExpressionNode
): ExpressionNode {
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
      return { ...node, left: map(node.left), right: map(node.right) };
    case 'pow':
      return { op: 'pow', base: map(node.base), exponent: map(node.exponent) };
    case 'neg':
    case 'not':
      return { ...node, value: map(node.value) };
    case 'if':
      return {
        op: 'if',
        test: map(node.test),
        ifTrue: map(node.ifTrue),
        ifFalse: map(node.ifFalse),
      };
    case 'and':
    case 'or':
    case 'min':
    case 'max':
    case 'concat':
    case 'call':
      return { ...node, args: node.args.map(map) } as ExpressionNode;
    default:
      return node;
  }
}

function failure(code: ExpressionDiagnosticCode, at: number, message: string): FormulaParseResult {
  return Object.freeze({
    ok: false,
    formula: null,
    error: code === 'unknown-function' || code === 'bad-name' ? '#NAME?' : '#VALUE!',
    diagnostics: Object.freeze([Object.freeze({ code, path: `@${at}`, message })]),
  }) as FormulaParseResult;
}

/**
 * Parse formula text (with its leading `=`). Never throws; linear in the
 * text, which is capped at `FORMULA_LIMITS.length` characters. On success
 * the formula holds the validated core expression and its references.
 */
export function parseFormula(source: unknown): FormulaParseResult {
  if (typeof source !== 'string' || !source.startsWith('=')) {
    return failure('syntax', 0, 'A formula starts with "=".');
  }
  if (source.length > FORMULA_LIMITS.length) {
    return failure('too-long', 0, `A formula has at most ${FORMULA_LIMITS.length} characters.`);
  }
  let ast: ExpressionNode;
  let parser: Parser;
  try {
    parser = new Parser(tokenizeFormula(source.slice(1), 1));
    ast = parser.parseFormula();
  } catch (cause) {
    if (cause instanceof FormulaSyntaxError) return failure(cause.code, cause.at, cause.message);
    return failure('syntax', 0, 'The formula could not be read.');
  }
  const checked = parseExpression(balance(ast), {
    functions: SHEET_FUNCTIONS,
    references: SHEET_REFERENCE_DIALECT,
  });
  if (!checked.ok) {
    return Object.freeze({
      ok: false,
      formula: null,
      error: '#VALUE!',
      diagnostics: checked.diagnostics,
    }) as FormulaParseResult;
  }
  return Object.freeze({
    ok: true,
    formula: Object.freeze({
      source,
      expression: checked.expression,
      refs: Object.freeze(parser.refs.map((ref) => Object.freeze(ref))),
      ranges: Object.freeze(parser.ranges.map((range) => Object.freeze(range))),
    }),
    diagnostics: Object.freeze([]) as readonly [],
  });
}

/** Whether a cell input is a formula (a string that starts with `=` and has more after it). */
export function isFormulaInput(input: unknown): input is string {
  return typeof input === 'string' && input.length > 1 && input.startsWith('=');
}
