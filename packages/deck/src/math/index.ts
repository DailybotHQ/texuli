/**
 * @texuli/deck/math: the owned TeX subset → MathML node tree (ADR-009, math
 * policy). No third-party code and no markup strings: `texToMath` returns a
 * tree of MathML Core elements from a closed allowlist (`MATH_TAGS`,
 * `MATH_ATTRIBUTES`), which a renderer walks. Commands that would link,
 * color, load, label or define macros (`\href`, `\color`, `\html*`, `\def`…)
 * are refused, and bounds (`MATH_LIMITS`) keep hostile input cheap.
 *
 * Block math (`$$…$$`) is converted by the deck Markdown dialect; inline
 * `$…$` stays inside text blocks as written (an `@texuli/blocks` opt-in is a
 * follow-up).
 */
export { mathText, texToMath } from './parse.ts';
export {
  MATH_ATTRIBUTES,
  MATH_CODES,
  MATH_LIMITS,
  MATH_TAGS,
  type MathAttribute,
  type MathCode,
  type MathIssue,
  type MathNode,
  type MathResult,
  type MathTag,
  type TexToMathOptions,
} from './types.ts';
