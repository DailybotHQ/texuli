/**
 * Serialize the emitted system token defaults for `base.css`. Only plain
 * literals are declared, on `:root`; they inherit into every scope, and a
 * design system overrides them on its own scope element.
 */

import { isDerivedValue } from './fallback.ts';
import { SYSTEM_TOKEN_FAMILIES } from './families.ts';

/** The selector the emitted token defaults are declared on. */
export const TOKEN_SCOPE_SELECTOR = ':root';

/** Markers around the generated blocks inside `base.css`. */
export const GENERATED_START =
  '/* @generated token-defaults: start (packages/tokens/scripts/generate.ts) */';
export const GENERATED_END = '/* @generated token-defaults: end */';

/** One `base.css` declaration block for a list of `[name, value]` pairs. */
export function renderDeclarations(
  groups: readonly {
    readonly comment: string;
    readonly entries: readonly (readonly [string, string])[];
  }[],
  indent = '    '
): string {
  return groups
    .map(
      (group) =>
        `${indent}/* ${group.comment} */\n${group.entries
          .map(([name, value]) => `${indent}${name}: ${value};`)
          .join('\n')}`
    )
    .join('\n')
    .concat('\n');
}

/** The `base.css` declarations of the emitted system tokens (derived ones stay fallback-only). */
export function renderSystemTokenDeclarations(indent = '    '): string {
  return renderDeclarations(
    SYSTEM_TOKEN_FAMILIES.filter((family) => family.emit === 'base')
      .map((family) => ({
        comment: `System: ${family.title.toLowerCase()}`,
        entries: family.tokens
          .filter((token) => !isDerivedValue(token.value))
          .map((token) => [token.name, token.value] as const),
      }))
      .filter((group) => group.entries.length > 0),
    indent
  );
}
