/**
 * Idle prefetch. The stage mounts the active slide and its neighbours; while
 * the browser is idle it warms what the slides after those will need (the
 * block families of their free-slide blocks and whatever the host renderers
 * prefetch), so a step never waits on a lazy chunk. Failures are ignored:
 * the slide loads its code again when it mounts.
 */
import type { DeckSlide } from '@texuli/deck/model';
import { BLOCK_CATALOG_IDS, type DeckBlockCatalogId } from '../grammar/index.ts';
import { loadDeckBlockFamily } from './loaders.ts';
import type { DeckRenderers } from './renderers.ts';

export { whenIdle } from './idle.ts';

const MAX_DEPTH = 12;

function collectTypes(list: unknown, into: Set<string>, depth: number): void {
  if (!Array.isArray(list) || depth > MAX_DEPTH) return;
  for (const value of list) {
    if (value === null || typeof value !== 'object') continue;
    const block = value as Record<string, unknown>;
    if (typeof block.type === 'string' && block.type !== 'component') into.add(block.type);
    collectTypes(block.blocks, into, depth + 1);
    collectTypes(block.children, into, depth + 1);
    if (Array.isArray(block.columns)) {
      for (const column of block.columns) collectTypes(column, into, depth + 1);
    }
    if (Array.isArray(block.panels)) {
      for (const panel of block.panels) {
        if (panel && typeof panel === 'object') {
          collectTypes((panel as { blocks?: unknown }).blocks, into, depth + 1);
        }
      }
    }
  }
}

/** The block families a slide paints with (free slides; nested containers included). */
export function slideBlockFamilies(slide: DeckSlide): DeckBlockCatalogId[] {
  if (slide.layout !== 'free') return [];
  const types = new Set<string>();
  collectTypes(slide.blocks, types, 0);
  const ids = BLOCK_CATALOG_IDS as Readonly<Record<string, DeckBlockCatalogId>>;
  return [
    ...new Set(
      [...types]
        .filter((type) => Object.hasOwn(ids, type))
        .map((type) => ids[type] as DeckBlockCatalogId)
    ),
  ];
}

export interface PrefetchOptions {
  renderers?: readonly DeckRenderers[];
  loadFamily?: (id: DeckBlockCatalogId) => Promise<unknown>;
}

/** Start loading what `slides` need; resolves when every load settled. */
export function prefetchDeckSlides(
  slides: readonly DeckSlide[],
  options: PrefetchOptions = {}
): Promise<void> {
  const loadFamily = options.loadFamily ?? loadDeckBlockFamily;
  const families = new Set(slides.flatMap((slide) => slideBlockFamilies(slide)));
  const work: Promise<unknown>[] = [...families].map((id) => loadFamily(id));
  for (const renderers of options.renderers ?? []) {
    if (!renderers.prefetch) continue;
    for (const slide of slides) {
      try {
        const pending = renderers.prefetch(slide);
        if (pending) work.push(pending);
      } catch {
        // A failing host prefetch is not the stage's concern.
      }
    }
  }
  return Promise.allSettled(work).then(() => undefined);
}
