import {
  type ExpressionError,
  type ExpressionFunctionContext,
  type ExpressionScalar,
  expressionError,
} from '@texuli/core/expression';

/*
 * Criteria for SUMIF, COUNTIF and AVERAGEIF: a value (`10`, `TRUE`) or text
 * with an optional comparison (`">5"`, `"<>done"`, `"=east"`) and, for
 * equality, the wildcards `*` (any run), `?` (one character) and `~`
 * (escapes the next one). Text compares ignoring case. The matcher never
 * backtracks: a pattern splits at `*` into segments, the first anchors at
 * the start, the last at the end, and each middle segment takes its
 * leftmost match, which is exact for star patterns. Work is charged as
 * steps (text length times pattern units), so a hostile pattern over long
 * cells ends in `#LIMIT!` instead of a stall.
 */

/** Characters of a criteria text. */
export const CRITERIA_MAX_LENGTH = 255;

/** A compiled criterion: true or false per value, or `null` once the step budget is spent. */
export type CriteriaMatcher = (
  value: ExpressionScalar,
  context: ExpressionFunctionContext
) => boolean | null;

type Unit = string | null; // null is `?`

interface Pattern {
  readonly segments: readonly (readonly Unit[])[];
  readonly star: boolean;
  readonly units: number;
}

function compilePattern(text: string): Pattern {
  const segments: Unit[][] = [[]];
  let star = false;
  let units = 0;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i] as string;
    const current = segments[segments.length - 1] as Unit[];
    if (ch === '~' && i + 1 < text.length) {
      current.push((text[i + 1] as string).toLowerCase());
      units += 1;
      i += 1;
    } else if (ch === '*') {
      star = true;
      segments.push([]);
    } else {
      current.push(ch === '?' ? null : ch.toLowerCase());
      units += 1;
    }
  }
  return { segments, star, units };
}

function matchesAt(text: string, at: number, segment: readonly Unit[]): boolean {
  if (at + segment.length > text.length) return false;
  for (let k = 0; k < segment.length; k += 1) {
    const unit = segment[k];
    if (unit !== null && text[at + k] !== unit) return false;
  }
  return true;
}

function find(text: string, from: number, segment: readonly Unit[]): number {
  if (!segment.includes(null)) return text.indexOf(segment.join(''), from);
  for (let at = from; at + segment.length <= text.length; at += 1) {
    if (matchesAt(text, at, segment)) return at;
  }
  return -1;
}

function wildcard(text: string, pattern: Pattern): boolean {
  const { segments } = pattern;
  const first = segments[0] as readonly Unit[];
  if (!pattern.star) return text.length === first.length && matchesAt(text, 0, first);
  const last = segments[segments.length - 1] as readonly Unit[];
  if (first.length + last.length > text.length) return false;
  if (!matchesAt(text, 0, first)) return false;
  if (!matchesAt(text, text.length - last.length, last)) return false;
  let at = first.length;
  const end = text.length - last.length;
  for (let s = 1; s < segments.length - 1; s += 1) {
    const segment = segments[s] as readonly Unit[];
    if (segment.length === 0) continue;
    const found = find(text, at, segment);
    if (found < 0 || found + segment.length > end) return false;
    at = found + segment.length;
  }
  return true;
}

const NUMERIC = /^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d{1,3})?$/;
const isBlank = (value: ExpressionScalar) => value === null || value === '';

/** Compile one criterion; `#VALUE!` when the text is longer than `CRITERIA_MAX_LENGTH`. */
export function compileCriteria(criterion: ExpressionScalar): CriteriaMatcher | ExpressionError {
  if (criterion === null) return (value) => isBlank(value);
  if (typeof criterion === 'number') return (value) => value === criterion;
  if (typeof criterion === 'boolean') return (value) => value === criterion;
  if (criterion.length > CRITERIA_MAX_LENGTH) return expressionError('#VALUE!');
  const op = /^(<=|>=|<>|<|>|=)/.exec(criterion)?.[1] ?? '';
  const operand = criterion.slice(op.length);
  const equality = op === '' || op === '=' || op === '<>';
  const negate = op === '<>';
  if (operand === '') {
    if (op === '' || op === '=') return (value) => isBlank(value);
    if (op === '<>') return (value) => !isBlank(value);
    return () => false;
  }
  if (NUMERIC.test(operand)) {
    const n = Number(operand);
    return (value) => {
      if (typeof value !== 'number') return negate;
      if (op === '<') return value < n;
      if (op === '<=') return value <= n;
      if (op === '>') return value > n;
      if (op === '>=') return value >= n;
      return negate ? value !== n : value === n;
    };
  }
  const upper = operand.toUpperCase();
  if (equality && (upper === 'TRUE' || upper === 'FALSE')) {
    const flag = upper === 'TRUE';
    return (value) => (typeof value === 'boolean' && value === flag) !== negate;
  }
  if (!equality) {
    const key = operand.toLowerCase();
    return (value, context) => {
      if (typeof value !== 'string') return false;
      if (!context.charge(value.length / 16)) return null;
      const text = value.toLowerCase();
      if (op === '<') return text < key;
      if (op === '<=') return text <= key;
      if (op === '>') return text > key;
      return text >= key;
    };
  }
  const pattern = compilePattern(operand);
  return (value, context) => {
    if (typeof value !== 'string') return negate;
    if (!context.charge(1 + (value.length * Math.max(1, pattern.units)) / 64)) return null;
    return wildcard(value.toLowerCase(), pattern) !== negate;
  };
}
