/**
 * Machine-readable `--tx-*` renames for codemods (ADR-020). Token contract v2
 * is additive, so nothing is renamed or removed yet and the list is empty. A
 * later rename keeps the old name as an alias for one minor and adds an entry
 * here; `@texuli/tokens/renames.json` is generated from this list.
 */

/** One renamed custom property. */
export interface TokenRename {
  /** The old name, still accepted as an alias until `removeIn`. */
  readonly from: string;
  /** The new name. */
  readonly to: string;
  /** The package version that introduced the rename (`0.9.0`). */
  readonly since: string;
  /** The version that removes the alias, one minor later (`0.10.0`). */
  readonly removeIn: string;
}

/** Every rename, oldest first. Empty: contract v2 renames nothing. */
export const TOKEN_RENAMES: readonly TokenRename[] = [];

const tokenName = { type: 'string', pattern: '^--tx-[a-z0-9-]+$' } as const;
const version = { type: 'string', pattern: '^\\d+\\.\\d+\\.\\d+$' } as const;

/** Draft-07 JSON Schema of `renames.json`. */
export const TOKEN_RENAMES_JSON_SCHEMA = {
  $schema: 'http://json-schema.org/draft-07/schema#',
  $id: 'https://texuli.dev/schemas/token-renames.json',
  title: 'TexuliTokenRenames',
  type: 'array',
  items: {
    type: 'object',
    required: ['from', 'to', 'since', 'removeIn'],
    additionalProperties: false,
    properties: { from: tokenName, to: tokenName, since: version, removeIn: version },
  },
} as const;

/** The `renames.json` text (stable formatting, trailing newline). */
export function renderTokenRenamesJson(renames: readonly TokenRename[] = TOKEN_RENAMES): string {
  return `${JSON.stringify(renames, null, 2)}\n`;
}
