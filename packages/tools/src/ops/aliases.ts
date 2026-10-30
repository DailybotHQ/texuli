import { LEGACY_DOCUMENT_INPUT, routeLegacyDocument } from './document.ts';
import { THEME_SEARCH_PROPERTIES } from './themes.ts';
import type { OperationAlias } from './types.ts';

/** The release that removes the 0.8 tool names (one minor after 0.9.0). */
export const ALIASES_REMOVED_IN = '0.10.0';

/**
 * The seven 0.8 MCP tool names, kept as deprecated aliases for one minor.
 * Each resolves to an operation; `theme` and `document` route by input.
 */
export const TEXULI_ALIASES: readonly OperationAlias[] = Object.freeze([
  { name: 'deck', targets: ['deck.run'], removeIn: ALIASES_REMOVED_IN },
  {
    name: 'document',
    targets: ['document.run', 'document.export'],
    removeIn: ALIASES_REMOVED_IN,
    input: LEGACY_DOCUMENT_INPUT,
    route: routeLegacyDocument,
  },
  { name: 'catalog', targets: ['catalog.search'], removeIn: ALIASES_REMOVED_IN },
  { name: 'component', targets: ['component.get'], removeIn: ALIASES_REMOVED_IN },
  { name: 'validate', targets: ['catalog.validate'], removeIn: ALIASES_REMOVED_IN },
  { name: 'example', targets: ['example.search'], removeIn: ALIASES_REMOVED_IN },
  {
    name: 'theme',
    targets: ['theme.search', 'theme.get'],
    removeIn: ALIASES_REMOVED_IN,
    input: {
      type: 'object',
      properties: {
        id: {
          type: 'string',
          minLength: 1,
          maxLength: 64,
          pattern: '^[a-z0-9][a-z0-9-]*$',
          description: 'Read this theme (theme.get); every other argument is then ignored.',
        },
        ...THEME_SEARCH_PROPERTIES,
      },
      additionalProperties: false,
    },
    route: (input) =>
      typeof input.id === 'string'
        ? { name: 'theme.get', input: { id: input.id } }
        : { name: 'theme.search', input },
  },
]);
