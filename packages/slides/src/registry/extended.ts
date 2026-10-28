/**
 * The free-slide extensions, without the validators: which items the
 * registry's free renderer paints itself (`$$` math, images measured at
 * paint, and the diagram, map and embed families through the player).
 * Light on purpose: the renderer table imports it eagerly.
 */
import { DIAGRAM_BLOCK_TYPES, EMBED_BLOCK_TYPES, MAP_BLOCK_TYPES } from '@texuli/blocks';
import { type Block, safeParseBlock } from '@texuli/blocks/core';

type Bag = Record<string, unknown>;

function isBag(value: unknown): value is Bag {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/** Block types the player paints for a free slide (diagram, map, embed families). */
const PLAYER_FAMILIES: Readonly<Record<string, readonly string[]>> = Object.freeze({
  'blocks-diagram': DIAGRAM_BLOCK_TYPES,
  'blocks-map': MAP_BLOCK_TYPES,
  'blocks-embed': EMBED_BLOCK_TYPES,
});

/** The `blocks-*` id that paints a block type through the player, if any. */
export function playerFamilyOf(type: unknown): string | undefined {
  if (typeof type !== 'string') return undefined;
  return Object.keys(PLAYER_FAMILIES).find((id) => PLAYER_FAMILIES[id]?.includes(type));
}

/** True for an image or figure block that leaves out `width` or `height`. */
export function isUnsizedImage(block: unknown): boolean {
  return (
    isBag(block) &&
    (block.type === 'image' || block.type === 'figure') &&
    (block.width === undefined || block.height === undefined)
  );
}

/** A copy with stand-in dimensions, so the media schema checks everything else. */
export function withStandInSize(block: Bag): Bag {
  return { ...block, width: block.width ?? 1, height: block.height ?? 1 };
}

/** How the extended free-slide renderer paints one item, when the core path cannot. */
export type ExtendedItem =
  | { kind: 'math'; tex: string }
  | { kind: 'image'; block: Block }
  | { kind: 'family'; id: string; block: Bag };

/** The extended paint of a free-slide item, or `undefined` for the core paths. */
export function extendedItem(item: unknown): ExtendedItem | undefined {
  if (!isBag(item)) return undefined;
  if (item.type === 'math' && typeof item.tex === 'string') return { kind: 'math', tex: item.tex };
  if (isUnsizedImage(item)) {
    const parsed = safeParseBlock(withStandInSize(stripSteps(item)));
    return parsed.success ? { kind: 'image', block: parsed.data } : undefined;
  }
  const family = playerFamilyOf(item.type);
  if (family) return { kind: 'family', id: family, block: stripSteps(item) };
  return undefined;
}

function stripSteps(block: Bag): Bag {
  const out: Bag = { ...block };
  for (const key of ['step', 'fragment', 'reveal']) delete out[key];
  return out;
}
