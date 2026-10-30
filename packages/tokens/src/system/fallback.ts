/**
 * The fallback model of token contract v2 (ADR-020, PLAN_011 performance
 * contract: 0 B eager for tokens nothing reads).
 *
 * No stylesheet declares a token contract v2 token: `base.css` is unchanged.
 * Every read carries the registry default as its fallback, so a token
 * resolves where it is read (density and radius follow the nearest theme) and
 * exists on a page only when a theme, design system or host sets it:
 *
 * - system tokens: `systemVar('--tx-z-modal')` → `var(--tx-z-modal, 60)`;
 *   `systemVar('--tx-type-label-size')` →
 *   `var(--tx-type-label-size, var(--tx-font-size-sm, 0.875rem))`;
 * - component tokens: `componentVar('button', 'radius')` in
 *   `@texuli/tokens/components`.
 *
 * The data-viz family is the exception: themes emit it (`themeVariables`).
 * Reads must use these expressions verbatim; `checkTokenReads` enforces it.
 */

import { SYSTEM_TOKEN_FAMILIES, type SystemToken } from './families.ts';

/** The index just past the `)` closing the `(` at `open`, or -1. */
export function closingParen(text: string, open: number): number {
  let depth = 0;
  for (let i = open; i < text.length; i += 1) {
    if (text[i] === '(') depth += 1;
    else if (text[i] === ')') {
      depth -= 1;
      if (depth === 0) return i + 1;
    }
  }
  return -1;
}

const BASE_TOKENS: readonly SystemToken[] = SYSTEM_TOKEN_FAMILIES.filter(
  (family) => family.emit === 'fallback'
).flatMap((family) => family.tokens);

/** Every system token read with a fallback (all but the theme-emitted data-viz family). */
export const FALLBACK_SYSTEM_TOKENS: readonly SystemToken[] = BASE_TOKENS;

const FALLBACK_BY_NAME = new Map(FALLBACK_SYSTEM_TOKENS.map((token) => [token.name, token.value]));
const KNOWN = new Set(
  SYSTEM_TOKEN_FAMILIES.flatMap((family) => family.tokens.map((token) => token.name))
);

/**
 * Expand every bare `var(--tx-…)` of a fallback-only system token into its
 * `systemVar` form, so the expression works when no stylesheet declares it.
 */
export function expandTokenRefs(value: string): string {
  let out = '';
  let i = 0;
  while (i < value.length) {
    const at = value.indexOf('var(', i);
    if (at < 0) {
      out += value.slice(i);
      break;
    }
    const end = closingParen(value, at + 3);
    if (end < 0) throw new Error(`unbalanced var() in ${value}`);
    const inner = value.slice(at + 4, end - 1).trim();
    const comma = inner.indexOf(',');
    out += value.slice(i, at);
    if (comma < 0) out += FALLBACK_BY_NAME.has(inner) ? systemVar(inner) : `var(${inner})`;
    else
      out += `var(${inner.slice(0, comma).trim()}, ${expandTokenRefs(inner.slice(comma + 1).trim())})`;
    i = end;
  }
  return out;
}

/**
 * The exact expression CSS uses to read a system token, with its default as
 * the fallback (`var(--tx-z-modal, 60)`); data-viz tokens, which themes emit,
 * read bare (`var(--tx-chart-1)`). Throws on a name outside the vocabulary.
 */
export function systemVar(name: string): string {
  if (!KNOWN.has(name)) throw new RangeError(`Unknown system token ${name}`);
  const fallback = FALLBACK_BY_NAME.get(name);
  return fallback === undefined ? `var(${name})` : `var(${name}, ${expandTokenRefs(fallback)})`;
}
