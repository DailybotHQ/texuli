/**
 * Serialize token defaults for `base.css`. The defaults are declared on every
 * scope element (the root, any `[data-tx-theme]` element `applyTheme` writes,
 * and any `[data-tx-scope]`), so values that read theme tokens (density,
 * radius, shadows, roles) resolve against the nearest scope, not only `:root`.
 */

import { SYSTEM_TOKEN_FAMILIES } from './families.ts';

/** The selector the token defaults are declared on (zero specificity). */
export const TOKEN_SCOPE_SELECTOR = ':where(:root, [data-tx-theme], [data-tx-scope])';

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

/** The `base.css` declarations of every `base`-emitted system family. */
export function renderSystemTokenDeclarations(indent = '    '): string {
  return renderDeclarations(
    SYSTEM_TOKEN_FAMILIES.filter((family) => family.emit === 'base').map((family) => ({
      comment: `System: ${family.title.toLowerCase()}`,
      entries: family.tokens.map((token) => [token.name, token.value] as const),
    })),
    indent
  );
}
