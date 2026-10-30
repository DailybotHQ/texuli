/**
 * Lazy access to `block-shapes.ts` (the block catalog notes, fixtures and
 * shape derivation): a separate chunk, so the remote Function's main bundle
 * does not carry it until a `block.*` call or a blueprint validation needs
 * it. `BLOCK_TYPES` comes from the validator's own list and stays eager.
 */
import { BLOCK_FAMILY_TYPES } from '@texuli/catalog/render/renderer';

type BlockShapes = typeof import('./block-shapes.ts');

/** Every block type the validator accepts, in its family order. */
export const BLOCK_TYPES: readonly string[] = Object.freeze(
  Object.values(BLOCK_FAMILY_TYPES).flat()
);

let loading: Promise<BlockShapes> | undefined;
let loaded: BlockShapes | undefined;

/** Load the shapes module once per process or isolate. */
export function loadBlockShapes(): Promise<BlockShapes> {
  loading ??= import('./block-shapes.ts').then((module) => {
    loaded = module;
    return module;
  });
  return loading;
}

/** The shapes module when it has loaded, for synchronous callers (the draft's block check). */
export function loadedBlockShapes(): BlockShapes | undefined {
  return loaded;
}
