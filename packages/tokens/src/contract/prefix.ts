/** CSS custom-property namespace for every Texuli token. */
export const TX_PREFIX = '--tx-';

/** Dataset / attribute namespace for mode and component hooks. */
export const TX_DATA_PREFIX = 'tx';

/** Convert camelCase or PascalCase token ids to kebab-case. */
export function toKebabCase(token: string): string {
  return token
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/[\s_]+/g, '-')
    .toLowerCase();
}

/**
 * Map a semantic or style token name to a `--tx-*` custom property.
 * Example: `tokenToCssVar('primaryForeground')` → `'--tx-primary-foreground'`.
 */
export function tokenToCssVar(token: string): string {
  return `${TX_PREFIX}${toKebabCase(token)}`;
}

/**
 * Map a semantic role plus optional interaction state to a `--tx-*` name.
 * Default state omits the suffix: `primary` → `--tx-primary`,
 * `primary` + `hover` → `--tx-primary-hover`.
 */
export function semanticTokenToCssVar(role: string, state: string = 'default'): string {
  const base = toKebabCase(role);
  if (state === 'default' || state === '') return `${TX_PREFIX}${base}`;
  return `${TX_PREFIX}${base}-${toKebabCase(state)}`;
}
