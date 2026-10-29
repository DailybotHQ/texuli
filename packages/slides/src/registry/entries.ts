import type {
  DeckItemRendererProps,
  DeckLazyRenderer,
  DeckSlideRendererProps,
} from '../stage/renderers.ts';

/**
 * The registry's painters, imported on first use. One set for every registry
 * (they hold no options: the options reach them through the render context),
 * so a painter that loaded for one registry paints at once for the others,
 * and a server build can preload them all (`../stage/ssr-preload.ts`).
 */
export const REGISTRY_RENDERER_ENTRIES = Object.freeze({
  slide: {
    load: () => import('../components/ComponentSlide.svelte'),
  } as unknown as DeckLazyRenderer<DeckSlideRendererProps>,
  item: {
    load: () => import('../components/ComponentItem.svelte'),
  } as unknown as DeckLazyRenderer<DeckItemRendererProps>,
  free: {
    load: () => import('../components/FreeSlide.svelte'),
  } as unknown as DeckLazyRenderer<DeckSlideRendererProps>,
});
