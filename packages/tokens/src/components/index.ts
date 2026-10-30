/**
 * `@texuli/tokens/components`: the component token registry of token contract
 * v2 (ADR-020), its `base.css` declarations and a JSON Schema of the closed
 * vocabulary (`{ [component]: { [key]: string } }`) for design systems and agents.
 */

import { renderDeclarations } from '../system/render.ts';
import { COMPONENT_TOKEN_FAMILIES } from './registry.ts';

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

/** The `base.css` declarations of every component token default. */
export function renderComponentTokenDeclarations(indent = '    '): string {
  return renderDeclarations(
    COMPONENT_TOKEN_FAMILIES.map((entry) => ({
      comment: `Component: ${entry.component}`,
      entries: entry.tokens.map((token) => [token.token, token.default] as const),
    })),
    indent
  );
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
