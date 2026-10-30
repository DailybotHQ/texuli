/**
 * `@texuli/tokens/components`: the component token registry of token contract
 * v2 (ADR-020), the exact `var()` expression every read must use, the read
 * guard adoption runs against component CSS, and a JSON Schema of the closed
 * vocabulary (`{ [component]: { [key]: string } }`) for design systems and agents.
 *
 * Component tokens are never declared, so they cost nothing until a theme,
 * design system or host sets them on its scope; every read falls back, one
 * level deep, to its registry default (system tokens `base.css` declares).
 */

import { BASE_SYSTEM_TOKENS, closingParen, systemVar } from '../system/base.ts';
import { COMPONENT_TOKEN_FAMILIES, COMPONENT_TOKENS, findComponentToken } from './registry.ts';

export {
  COMPONENT_IDS,
  COMPONENT_TOKEN_FAMILIES,
  COMPONENT_TOKENS,
  type ComponentToken,
  type ComponentTokenFamily,
  findComponentToken,
  getComponentTokens,
  isComponentTokenName,
} from './registry.ts';

/** The read fallback of one component token: its registry default (system or theme refs, no nested fallbacks). */
export function componentTokenFallback(component: string, key: string): string {
  const entry = findComponentToken(component, key);
  if (!entry) throw new RangeError(`Unknown component token ${component}.${key}`);
  return entry.default;
}

/**
 * The exact expression component CSS uses to read a component token, for
 * example `var(--tx-button-radius, var(--tx-shape-radius-lg))`.
 */
export function componentVar(component: string, key: string): string {
  return `var(--tx-${component}-${key}, ${componentTokenFallback(component, key)})`;
}

/** Every component token's read expression, keyed by custom property name. */
export function componentTokenFallbacks(): Record<string, string> {
  return Object.fromEntries(
    COMPONENT_TOKENS.map((entry) => [entry.token, componentVar(entry.component, entry.key)])
  );
}

/** One read of a component or base system token that is not in its exact read form. */
export interface TokenReadIssue {
  readonly token: string;
  readonly found: string;
  readonly expected: string;
}

const normalize = (text: string) =>
  text
    .replace(/\s+/g, ' ')
    .replace(/\(\s+/g, '(')
    .replace(/\s+\)/g, ')')
    .replace(/\s*,\s*/g, ', ')
    .trim();

/**
 * Check every `var()` read of a component token or a base system token in a
 * stylesheet (or Svelte/TS source): each must equal `componentVar` /
 * `systemVar` exactly (whitespace aside): a component read carries its one
 * registry fallback, a system read carries none. Returns the mismatches; an
 * empty list means the source is clean.
 */
export function checkTokenReads(source: string): TokenReadIssue[] {
  const expected = new Map<string, string>(Object.entries(componentTokenFallbacks()));
  for (const token of BASE_SYSTEM_TOKENS) expected.set(token.name, systemVar(token.name));
  const issues: TokenReadIssue[] = [];
  const pattern = /var\(\s*(--tx-[a-z0-9-]+)/g;
  for (const match of source.matchAll(pattern)) {
    const name = match[1] as string;
    const want = expected.get(name);
    if (want === undefined) continue;
    const start = match.index as number;
    const end = closingParen(source, start + 3);
    const found = normalize(end < 0 ? source.slice(start) : source.slice(start, end));
    if (found !== normalize(want)) issues.push({ token: name, found, expected: want });
  }
  return issues;
}

/**
 * Draft-07 JSON Schema of the component token vocabulary: an object keyed by
 * component id whose values map token keys to CSS value strings. Unknown
 * components and keys are refused.
 */
export function getComponentTokensJsonSchema(): Record<string, unknown> {
  return {
    $schema: 'http://json-schema.org/draft-07/schema#',
    $id: 'https://texuli.dev/schemas/component-tokens.json',
    title: 'TexuliComponentTokens',
    type: 'object',
    additionalProperties: false,
    properties: Object.fromEntries(
      COMPONENT_TOKEN_FAMILIES.map((entry) => [
        entry.component,
        {
          type: 'object',
          additionalProperties: false,
          properties: Object.fromEntries(
            entry.tokens.map((token) => [
              token.key,
              { type: 'string', minLength: 1, maxLength: 200, description: token.description },
            ])
          ),
        },
      ])
    ),
  };
}
