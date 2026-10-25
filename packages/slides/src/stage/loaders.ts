import {
  loadCodeFamily,
  loadDataFamily,
  loadInteractiveFamily,
  loadMediaFamily,
  loadStructureFamily,
  loadTextFamily,
} from '@texuli/blocks';
import type { Component } from 'svelte';
import type { DeckBlockCatalogId } from '../grammar/index.ts';

export interface DeckBlockRendererProps {
  block: unknown;
  /** Avatar adapter for the media family; other families ignore it. */
  resolveAvatar?: (id: string) => string | undefined;
  /** The deck's reveal step; the code family steps its highlights by it, others ignore it. */
  hostStep?: number;
}

type FamilyLoader = () => Promise<{ default: Component<DeckBlockRendererProps> }>;

const FAMILY_LOADERS: Record<DeckBlockCatalogId, FamilyLoader> = {
  'blocks-text': loadTextFamily,
  'blocks-data': loadDataFamily,
  'blocks-structure': loadStructureFamily,
  'blocks-media': loadMediaFamily,
  'blocks-code': loadCodeFamily,
  'blocks-interactive': loadInteractiveFamily,
};

const LOADED = new Map<DeckBlockCatalogId, Component<DeckBlockRendererProps>>();

/** Load one lazy block family on demand; importers can keep unused families out of their first paint. */
export async function loadDeckBlockFamily(
  catalogId: DeckBlockCatalogId
): Promise<Component<DeckBlockRendererProps>> {
  const load = FAMILY_LOADERS[catalogId];
  if (!load) throw new Error(`Unsupported deck block family: ${catalogId}`);
  const module = await load();
  LOADED.set(catalogId, module.default);
  return module.default;
}

/**
 * A family that already loaded, synchronously, so a revisited slide renders
 * its blocks at once instead of flashing a loading status.
 */
export function loadedDeckBlockFamily(
  catalogId: DeckBlockCatalogId
): Component<DeckBlockRendererProps> | undefined {
  return LOADED.get(catalogId);
}
