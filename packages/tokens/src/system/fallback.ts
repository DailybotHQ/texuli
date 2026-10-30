/**
 * The fallback model of token contract v2 (ADR-020, PLAN_011 performance
 * contract: no eager bytes for tokens nothing reads).
 *
 * - A system token whose default is a plain literal (`2.25rem`, `50`, `72ch`)
 *   is **emitted** by `base.css` on `:root`: it is the stable hook a design
 *   system overrides, and it inherits into every scope.
 * - A system token whose default is derived from other variables
 *   (`--tx-space-4` → `calc(var(--tx-space-unit) * 4)`, `--tx-type-label-size`
 *   → `var(--tx-font-size-sm, 0.875rem)`) is **fallback-only**: no stylesheet
 *   declares it, and every read carries the derivation as its fallback, so it
 *   resolves where it is read and exists on a page only when a theme, design
 *   system or host sets it.
 * - Component tokens are always fallback-only (see `componentVar`).
 *
 * Reads must use `systemVar(name)` (and `componentVar`) verbatim; the token
 * read guard (`checkTokenReads` in `@texuli/tokens/components`) enforces it.
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

/** True when a default reads other variables (derived), so it stays fallback-only. */
export function isDerivedValue(value: string): boolean {
  return value.includes('var(');
}

const BASE_TOKENS: readonly SystemToken[] = SYSTEM_TOKEN_FAMILIES.filter(
  (family) => family.emit === 'base'
).flatMap((family) => family.tokens);

/** System tokens `base.css` declares on `:root` (their default is a plain literal). */
export const EMITTED_SYSTEM_TOKENS: readonly SystemToken[] = BASE_TOKENS.filter(
  (token) => !isDerivedValue(token.value)
);

/** System tokens no stylesheet declares; reads carry their derivation as the fallback. */
export const FALLBACK_SYSTEM_TOKENS: readonly SystemToken[] = BASE_TOKENS.filter((token) =>
  isDerivedValue(token.value)
);

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
 * The exact expression CSS uses to read a system token: `var(--tx-z-modal)`
 * for emitted tokens, `var(--tx-type-label-size, var(--tx-font-size-sm,
 * 0.875rem))` for fallback-only ones. Throws on a name outside the vocabulary.
 */
export function systemVar(name: string): string {
  if (!KNOWN.has(name)) throw new RangeError(`Unknown system token ${name}`);
  const fallback = FALLBACK_BY_NAME.get(name);
  return fallback === undefined ? `var(${name})` : `var(${name}, ${expandTokenRefs(fallback)})`;
}
