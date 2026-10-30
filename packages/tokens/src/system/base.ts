/**
 * The base model of token contract v2 (ADR-020 and its amendment).
 *
 * `@texuli/tokens/base.css` declares every system token default once, inside
 * `@layer tx.base` on every token scope (`:root`, `[data-tx-theme]`,
 * `[data-tx-scope]`), so derived tokens (space steps, radius steps, type
 * roles) resolve against the nearest theme. Reads then carry at most one
 * fallback level:
 *
 * - system tokens read plain: `systemVar('--tx-z-modal')` → `var(--tx-z-modal)`;
 * - component tokens (never declared, 0 B until a design system sets one) fall
 *   back to their registry default: `componentVar('button', 'radius')` →
 *   `var(--tx-button-radius, var(--tx-shape-radius-lg))`.
 *
 * The data-viz family is emitted per theme (`themeVariables`), not here.
 * `checkTokenReads` enforces the exact read forms.
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

/** Every system token `base.css` declares (all but the theme-emitted data-viz family). */
export const BASE_SYSTEM_TOKENS: readonly SystemToken[] = SYSTEM_TOKEN_FAMILIES.filter(
  (family) => family.emit === 'base'
).flatMap((family) => family.tokens);

const KNOWN = new Set(
  SYSTEM_TOKEN_FAMILIES.flatMap((family) => family.tokens.map((token) => token.name))
);

/** The selector the generated block declares the system defaults on (specificity 0). */
export const TOKEN_SCOPE_SELECTOR = ':where(:root, [data-tx-theme], [data-tx-scope])';
export const GENERATED_START =
  '/* @generated token-defaults: start (packages/tokens/scripts/generate.ts) */';
export const GENERATED_END = '/* @generated token-defaults: end */';

/** The `--name: value;` declarations of every base system token, family by family. */
export function renderSystemTokenDeclarations(indent = '    '): string {
  const lines: string[] = [];
  for (const family of SYSTEM_TOKEN_FAMILIES) {
    if (family.emit !== 'base') continue;
    lines.push(`${indent}/* ${family.title} */`);
    for (const token of family.tokens) lines.push(`${indent}${token.name}: ${token.value};`);
  }
  return `${lines.join('\n')}\n`;
}

/**
 * The exact expression CSS uses to read a system token: plain `var(name)`,
 * since `base.css` declares every default. Throws on a name outside the vocabulary.
 */
export function systemVar(name: string): string {
  if (!KNOWN.has(name)) throw new RangeError(`Unknown system token ${name}`);
  return `var(${name})`;
}
