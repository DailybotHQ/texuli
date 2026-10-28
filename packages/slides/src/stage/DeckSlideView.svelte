<script lang="ts">
/**
 * One mounted slide on the canvas (the stage mounts at most three: the
 * active slide and its neighbours). It provides the slide's step context,
 * paints the background layers with their contrast scrim, and asks the
 * renderer list for the body; the built-in free-slide renderer and the
 * labelled placeholder are the fallbacks. Inactive slides are `inert` and
 * `aria-hidden`, so only the active one is reachable.
 */
import type { Deck, DeckBackgroundPalette, DeckSlide, FreeSlide } from '@texuli/deck/model';
import { resolveDeckBackground } from '@texuli/deck/model';
import { setDeckStepContext } from './context.ts';
import { deckCssVars } from './css-vars.ts';
import FreeSlideRenderer from './FreeSlide.svelte';
import type { DeckMediaTrust } from './media.ts';
import type { DeckTranslate } from './messages.ts';
import RendererHost from './RendererHost.svelte';
import {
  type DeckRenderers,
  type DeckSlideRenderContext,
  resolveBackgroundRenderer,
  resolveSlideRenderer,
} from './renderers.ts';
import SlideBackground from './SlideBackground.svelte';
import SlidePlaceholder from './SlidePlaceholder.svelte';
import { createDeckStepContext, deckSlideSteps } from './steps.ts';

interface Props {
  deck: Deck;
  slide: DeckSlide;
  index: number;
  active: boolean;
  /** The step this slide shows (its neighbours show their first or last state). */
  step: number;
  direction: 'forward' | 'backward' | 'none';
  title: string;
  tier: DeckMediaTrust;
  t: DeckTranslate;
  renderers: readonly DeckRenderers[];
  palette: DeckBackgroundPalette;
  canvas: { width: number; height: number };
  resolveAvatar?: (id: string) => string | undefined;
  /** The CSS-fallback entrance (`fade`, `slide`, …) when this slide just became active. */
  enter?: string;
  enterDirection?: 'forward' | 'backward';
  element?: HTMLElement;
}

let {
  deck,
  slide,
  index,
  active,
  step,
  direction,
  title,
  tier,
  t,
  renderers,
  palette,
  canvas,
  resolveAvatar,
  enter,
  enterDirection,
  element = $bindable(),
}: Props = $props();

let steps = $derived(deckSlideSteps(slide));
const stepContext = createDeckStepContext(() => ({ slide, steps, step, active, direction }));
setDeckStepContext(stepContext);

let background = $derived(
  resolveDeckBackground(slide.background ?? deck.style?.background, palette, {
    slideId: slide.id,
    path: ['slides', index, 'background'],
  })
);
let lookup = $derived({ tier });
let context: DeckSlideRenderContext = {
  get deck() {
    return deck;
  },
  get index() {
    return index;
  },
  get active() {
    return active;
  },
  get tier() {
    return tier;
  },
  get t() {
    return t;
  },
  step: stepContext,
  get canvas() {
    return canvas;
  },
  get resolveAvatar() {
    return resolveAvatar;
  },
  get renderers() {
    return renderers;
  },
};
let renderer = $derived(resolveSlideRenderer(renderers, slide, lookup));
let backgroundRenderer = $derived(resolveBackgroundRenderer(renderers, background, lookup));
</script>

<!-- The active slide takes programmatic focus only (tabindex -1). -->
<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
<section
  bind:this={element}
  class="tx-deck-stage__slide"
  role="group"
  aria-roledescription="slide"
  aria-label={title}
  aria-hidden={active ? undefined : 'true'}
  inert={!active}
  tabindex={active ? -1 : undefined}
  data-slide-id={slide.id}
  data-tx-deck-slide={slide.id}
  data-tx-deck-layout={slide.layout}
  data-tx-deck-active={active ? 'true' : 'false'}
  data-tx-deck-bg-tone={background.textTone}
  data-tx-deck-enter={enter}
  data-tx-deck-direction={enter ? enterDirection : undefined}
  data-step={stepContext.step}
  data-step-count={steps.count}
  use:deckCssVars={background.cssVars}
>
  {#if backgroundRenderer}
    <RendererHost entry={backgroundRenderer} props={{ background, tier, slide }} {t} />
  {:else}
    <SlideBackground {background} {tier} />
  {/if}
  <div class="tx-deck-stage__slide-body">
    {#if renderer}
      <RendererHost entry={renderer} props={{ slide, context }} {t} />
    {:else if slide.layout === 'free'}
      <FreeSlideRenderer slide={slide as FreeSlide} {context} />
    {:else}
      <SlidePlaceholder {t} {slide} {title} />
    {/if}
  </div>
</section>
