/**
 * Lazy `@texuli/blocks` family renderers by family name: each family (and
 * its renderer) is its own chunk, loaded the first time a document shows a
 * block of that family.
 */
import type { BlockFamily } from '@texuli/document/model';
import type { Component } from 'svelte';

// biome-ignore lint/suspicious/noExplicitAny: every family view takes `block: unknown` and `oninvalid`; their other props differ.
type FamilyView = Component<any>;

const LOADERS: Record<BlockFamily, () => Promise<{ default: FamilyView }>> = {
  text: () => import('@texuli/blocks/text').then((m) => m.loadTextFamily()),
  media: () => import('@texuli/blocks/media').then((m) => m.loadMediaFamily()),
  data: () => import('@texuli/blocks/data').then((m) => m.loadDataFamily()),
  structure: () => import('@texuli/blocks/structure').then((m) => m.loadStructureFamily()),
  code: () => import('@texuli/blocks/code').then((m) => m.loadCodeFamily()),
  diagram: () => import('@texuli/blocks/diagram').then((m) => m.loadDiagramFamily()),
  interactive: () => import('@texuli/blocks/interactive').then((m) => m.loadInteractiveFamily()),
  map: () => import('@texuli/blocks/map').then((m) => m.loadMapFamily()),
  embed: () => import('@texuli/blocks/embed').then((m) => m.loadEmbedFamily()),
};

const loaded = new Map<BlockFamily, Promise<FamilyView>>();

/** The renderer of a `@texuli/blocks` family (loaded once). */
export function loadBlockFamily(family: BlockFamily): Promise<FamilyView> {
  const loader = LOADERS[family];
  if (!loader) return Promise.reject(new Error(`Unknown block family ${String(family)}`));
  let pending = loaded.get(family);
  if (!pending) {
    pending = loader().then((module) => module.default);
    pending.catch(() => loaded.delete(family));
    loaded.set(family, pending);
  }
  return pending;
}
