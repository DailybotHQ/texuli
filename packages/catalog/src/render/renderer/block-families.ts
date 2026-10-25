/**
 * Which block `type` values each `blocks-*` catalog id renders. A block of
 * another family passes the block schema but would paint the family's inert
 * "invalid" notice, so the renderer checks the family before it emits a
 * node (audit G05). Kept as literals so the renderer core stays free of the
 * block parsers; tests hold it equal to the `*_BLOCK_TYPES` lists in
 * `@texuli/blocks`.
 */
export const BLOCK_FAMILY_TYPES: Readonly<Record<string, readonly string[]>> = Object.freeze({
  'blocks-text': ['heading', 'text', 'list', 'quote', 'callout'],
  'blocks-data': ['table', 'stat', 'kpi', 'chart'],
  'blocks-media': ['image', 'figure', 'video', 'gallery'],
  'blocks-diagram': ['flow', 'tree', 'board', 'terminal'],
  'blocks-embed': ['embed-app', 'link-preview'],
  'blocks-structure': ['columns', 'grid', 'tabs', 'accordion', 'cards', 'divider', 'cta'],
  'blocks-code': ['code'],
  'blocks-interactive': ['poll', 'quiz', 'calculator', 'checklist'],
  'blocks-map': ['map'],
});

/** The `blocks-*` id that renders block `type`, if any. */
export function blockFamilyIdFor(type: string): string | undefined {
  for (const [id, types] of Object.entries(BLOCK_FAMILY_TYPES)) {
    if (types.includes(type)) return id;
  }
  return undefined;
}

/**
 * A message when `props.block` is not a block the `id` family renders, or
 * `null` when it is (or when `id` is not a `blocks-*` id). A `blocks-*` id
 * with no known family is refused.
 */
export function blockFamilyMismatch(
  id: string,
  props: Readonly<Record<string, unknown>>
): string | null {
  // Own keys only: an id such as "constructor" must not reach Object.prototype.
  if (!Object.hasOwn(BLOCK_FAMILY_TYPES, id)) {
    // A block id with no known family cannot be checked, so it fails closed.
    return id.startsWith('blocks-') ? `"${id}" has no known block family.` : null;
  }
  const types = BLOCK_FAMILY_TYPES[id] ?? [];
  const block = props.block;
  const type =
    block !== null && typeof block === 'object' && !Array.isArray(block)
      ? (block as Record<string, unknown>).type
      : undefined;
  if (typeof type === 'string' && types.includes(type)) return null;
  if (typeof type !== 'string') return `"${id}" needs a block with a "type" string.`;
  const owner = blockFamilyIdFor(type);
  return owner
    ? `A "${type}" block renders with "${owner}", not "${id}".`
    : `"${type}" is not a block type "${id}" renders.`;
}
