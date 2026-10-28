/**
 * The MathML node tree the owned TeX subset produces (ADR-009, math policy).
 * A renderer walks it with a closed tag and attribute allowlist; no string of
 * markup is ever produced, so nothing here reaches an HTML sink.
 */

/** The MathML Core elements the converter emits. */
export const MATH_TAGS = [
  'math',
  'mrow',
  'mi',
  'mn',
  'mo',
  'mtext',
  'mspace',
  'msup',
  'msub',
  'msubsup',
  'mfrac',
  'msqrt',
  'mroot',
  'mover',
  'munder',
  'munderover',
  'mtable',
  'mtr',
  'mtd',
  'mstyle',
] as const;
export type MathTag = (typeof MATH_TAGS)[number];

/** The attributes the converter may set (values are always from its own tables). */
export const MATH_ATTRIBUTES = [
  'display',
  'alttext',
  'mathvariant',
  'stretchy',
  'fence',
  'separator',
  'largeop',
  'movablelimits',
  'accent',
  'accentunder',
  'linethickness',
  'width',
  'columnalign',
  'displaystyle',
  'scriptlevel',
  'form',
  'lspace',
  'rspace',
] as const;
export type MathAttribute = (typeof MATH_ATTRIBUTES)[number];

export interface MathNode {
  tag: MathTag;
  attrs?: Partial<Record<MathAttribute, string>>;
  /** Token elements (`mi`, `mn`, `mo`, `mtext`) carry text; the others carry children. */
  text?: string;
  children?: MathNode[];
}

export const MATH_CODES = Object.freeze({
  /** A command or environment outside the subset (`\href`, `\color`, macros…). */
  unsupported: 'tex-unsupported',
  /** Unbalanced braces, a missing argument, a double script… */
  syntax: 'tex-syntax',
  /** Over a size, nesting or node bound. */
  limit: 'tex-limit',
} as const);
export type MathCode = (typeof MATH_CODES)[keyof typeof MATH_CODES];

export interface MathIssue {
  code: MathCode;
  message: string;
  /** UTF-16 offset in the TeX source. */
  offset: number;
}

export interface MathResult {
  /** True when the whole source converted. */
  ok: boolean;
  /**
   * The `math` root. When `ok` is false it holds the TeX source as `mtext`,
   * so a failed formula still shows what the author wrote.
   */
  node: MathNode;
  issues: MathIssue[];
}

export interface TexToMathOptions {
  /** Block (`$$`) math; default false (inline). */
  display?: boolean;
}

/** Bounds per formula (hostile input stays cheap). */
export const MATH_LIMITS = Object.freeze({
  /** TeX source length in UTF-16 units. */
  source: 2_000,
  /** Nested groups, environments and fractions. */
  depth: 16,
  /** Output nodes. */
  nodes: 2_000,
  /** Rows and cells of one environment. */
  rows: 50,
  cells: 400,
});
