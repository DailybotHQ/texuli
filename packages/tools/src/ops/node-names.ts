/**
 * Names of operations that need Node. The remote MCP Function imports this
 * list (strings only) so it can answer those names with runtime-unavailable
 * without loading handlers, schemas or `@texuli/emojis/catalog`. A test
 * keeps the list equal to `texuliOps.list({ runtimes: ['node'] })`.
 */
export const TEXULI_NODE_OPERATION_NAMES: readonly string[] = Object.freeze([
  'ds.save',
  'document.export',
  'emoji.search',
  'emoji.get',
  'emoji.convert',
  'emoji.categories',
  'emoji.variants',
]);
