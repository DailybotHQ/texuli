import {
  DECK_CATALOG_LAYOUT_IDS,
  DECK_FORMAT_VERSION,
  DECK_LAYOUTS,
  type Deck,
  type DeckCatalogLayoutId,
  type DeckMeta,
  type DeckSlide,
  type FreeSlide,
  type LayoutProps,
  parseDeck,
} from '../model/index.ts';
import type { DeckDiagnostic } from '../schema/index.ts';

export type DeckBuildResult =
  | { ok: true; deck: Deck; diagnostics: DeckDiagnostic[] }
  | { ok: false; diagnostics: DeckDiagnostic[] };

export type SlideOptions = Pick<DeckSlide, 'id'> & Partial<Pick<DeckSlide, 'title' | 'notes'>>;

function catalogSlide<Id extends DeckCatalogLayoutId>(
  layout: Id,
  props: LayoutProps[Id],
  options: SlideOptions
): DeckSlide {
  return { ...options, layout, props } as DeckSlide;
}

function sl<Id extends DeckCatalogLayoutId>(layout: Id) {
  return (props: LayoutProps[Id], options: SlideOptions): DeckSlide =>
    catalogSlide(layout, props, options);
}

/** Typed slide constructors. All output is checked again by `deck(...).build()`. */
export const slide = Object.freeze({
  layout: <Id extends DeckCatalogLayoutId>(
    layout: Id,
    props: LayoutProps[Id],
    options: SlideOptions
  ) => catalogSlide(layout, props, options),
  titleHero: sl('title-hero'),
  sectionDivider: sl('section-divider'),
  twoColumnSplit: sl('two-column-split'),
  threeColumnCards: sl('three-column-cards'),
  imageLeft: sl('image-left'),
  imageRight: sl('image-right'),
  imageCentered: sl('image-centered'),
  imageFullBleed: sl('image-full-bleed'),
  quote: sl('quote'),
  codeWithCallout: sl('code-with-callout'),
  bigStat: sl('big-stat'),
  comparisonTable: sl('comparison-table'),
  processSteps: sl('process-steps'),
  timeline: sl('timeline'),
  teamAvatars: sl('team-avatars'),
  closingCta: sl('closing-cta'),
  videoCentered: sl('video-centered'),
  videoLeft: sl('video-left'),
  videoRight: sl('video-right'),
  chart: sl('chart'),
  free(options: SlideOptions & Pick<FreeSlide, 'blocks'> & Partial<Pick<FreeSlide, 'master'>>) {
    return { ...options, layout: 'free', blocks: options.blocks } as FreeSlide;
  },
  component(component: string, props: Record<string, unknown>, options: SlideOptions): DeckSlide {
    return { ...options, layout: 'component', component: { component, props } } as DeckSlide;
  },
});

export interface DeckBuilderOptions extends Pick<Deck, 'style' | 'navigation' | 'outline'> {}

/** Start a typed immutable-by-convention deck builder for the v2 model. */
export function deck(meta: DeckMeta, options: DeckBuilderOptions = {}) {
  const slides: DeckSlide[] = [];
  const add = (value: DeckSlide) => {
    slides.push(value);
    return api;
  };
  const api = {
    slide: add,
    add,
    build(): DeckBuildResult {
      const parsed = parseDeck({
        formatVersion: DECK_FORMAT_VERSION,
        meta,
        ...options,
        slides: structuredClone(slides),
      });
      return parsed.ok && parsed.deck
        ? { ok: true, deck: parsed.deck, diagnostics: parsed.issues }
        : { ok: false, diagnostics: parsed.issues };
    },
  };
  return api;
}

/** Catalog order is the stable order used by generated capability output. */
export const authoringLayoutIds: readonly DeckCatalogLayoutId[] = DECK_CATALOG_LAYOUT_IDS;
export { DECK_LAYOUTS };
