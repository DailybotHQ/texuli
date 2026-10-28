/**
 * The layouts lane of the renderer seam (ADR-009): one Svelte renderer per
 * catalog layout, each imported on first use. `layoutRenderers` is a
 * `DeckRenderers` table for `<DeckStage renderers={…}>`: it answers `layout`
 * for the 20 props layouts and warms their chunks in `prefetch`. `free`
 * slides (and the 8 v1 masters on them) stay with the stage's built-in
 * block renderer, and backgrounds with the stage's layer painter.
 *
 * Every renderer receives the validated slide and the render context
 * (`DeckSlideRendererProps`), reads its steps from `getDeckStepContext()`,
 * paints text as text (never HTML), and holds media and links to the URL
 * policy at the host's tier.
 */
import type { DeckCatalogLayoutId, DeckSlide } from '@texuli/deck/model';
import type {
  DeckLazyRenderer,
  DeckRenderers,
  DeckSlideRendererProps,
} from '../stage/renderers.ts';

type Lazy = DeckLazyRenderer<DeckSlideRendererProps>;

function lazy(load: () => Promise<{ default: unknown }>): Lazy {
  // Each module's default export is a renderer for its own layouts' props.
  return { load } as Lazy;
}

const mediaSide = lazy(() => import('./MediaSide.svelte'));
const mediaCentered = lazy(() => import('./MediaCentered.svelte'));

/** One lazy renderer per catalog layout (some components serve several layouts). */
export const LAYOUT_RENDERER_ENTRIES: Readonly<Record<DeckCatalogLayoutId, Lazy>> = Object.freeze({
  'title-hero': lazy(() => import('./TitleHero.svelte')),
  'section-divider': lazy(() => import('./SectionDivider.svelte')),
  'two-column-split': lazy(() => import('./TwoColumnSplit.svelte')),
  'three-column-cards': lazy(() => import('./ThreeColumnCards.svelte')),
  'image-left': mediaSide,
  'image-right': mediaSide,
  'image-centered': mediaCentered,
  'image-full-bleed': lazy(() => import('./ImageFullBleed.svelte')),
  quote: lazy(() => import('./Quote.svelte')),
  'code-with-callout': lazy(() => import('./CodeWithCallout.svelte')),
  'big-stat': lazy(() => import('./BigStat.svelte')),
  'comparison-table': lazy(() => import('./ComparisonTable.svelte')),
  'process-steps': lazy(() => import('./ProcessSteps.svelte')),
  timeline: lazy(() => import('./Timeline.svelte')),
  'team-avatars': lazy(() => import('./TeamAvatars.svelte')),
  'closing-cta': lazy(() => import('./ClosingCta.svelte')),
  'video-centered': mediaCentered,
  'video-left': mediaSide,
  'video-right': mediaSide,
  chart: lazy(() => import('./ChartSlide.svelte')),
});

/** The layout ids this table renders (the 20 catalog layouts with props). */
export const LAYOUT_RENDERER_IDS = Object.freeze(
  Object.keys(LAYOUT_RENDERER_ENTRIES) as DeckCatalogLayoutId[]
);

function entryFor(slide: Pick<DeckSlide, 'layout'>): Lazy | undefined {
  return Object.hasOwn(LAYOUT_RENDERER_ENTRIES, slide.layout)
    ? LAYOUT_RENDERER_ENTRIES[slide.layout as DeckCatalogLayoutId]
    : undefined;
}

const table: DeckRenderers = {
  layout: (slide) => entryFor(slide),
  prefetch: (slide) => entryFor(slide)?.load(),
};

/** The layouts renderer table for `DeckStage` (`renderers={layoutRenderers}`). */
export const layoutRenderers: DeckRenderers = Object.freeze(table);

export {
  fitContent,
  fitFontSize,
  fitScale,
  fitText,
  LAYOUT_TEXT_MINIMUMS,
  textOverflows,
} from './fit.ts';
export {
  avatarId,
  initials,
  LAYOUT_MEDIA_DEFAULT_SIZE,
  layoutChartBlock,
  layoutCodeBlock,
  layoutCtaBlock,
  layoutImageSrc,
  layoutVideoSrc,
} from './media.ts';
export { DECK_LAYOUT_MESSAGES, type DeckLayoutMessageKey, layoutMessage } from './messages.ts';
export {
  type LayoutRendererProps,
  type LayoutSlideOf,
  type LayoutSteps,
  layoutSteps,
  type PropPath,
  useLayoutSteps,
} from './steps.ts';
