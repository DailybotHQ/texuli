<script lang="ts">
/**
 * The labelled stand-in the stage paints for a slide (or a component item)
 * no renderer answers yet: catalog layouts until the layouts lane lands,
 * whole-slide and inline components until the registry lane lands, custom
 * slides without a host renderer. It names what is missing; it never
 * guesses at the content.
 */
import { DECK_LAYOUTS, type DeckSlide, isCatalogLayoutId } from '@texuli/deck/model';
import type { DeckTranslate } from './messages.ts';

interface Props {
  t: DeckTranslate;
  /** A whole slide, or omitted for an inline component item. */
  slide?: DeckSlide;
  /** The component id of an inline item. */
  component?: string;
  title?: string;
}

let { t, slide, component, title }: Props = $props();

let message = $derived.by(() => {
  if (component !== undefined) return t('stage.componentPending', { component });
  if (!slide) return t('layout.contentUnavailable');
  if (slide.layout === 'component') {
    return t('stage.componentPending', { component: slide.component.component });
  }
  if (slide.layout === 'custom')
    return t('stage.customPending', { component: slide.props.component });
  if (isCatalogLayoutId(slide.layout)) {
    return t('stage.layoutPending', { layout: DECK_LAYOUTS[slide.layout].label });
  }
  return t('layout.contentUnavailable');
});
let kind = $derived(component !== undefined ? 'component' : (slide?.layout ?? 'unknown'));
</script>

<div class="tx-deck-stage__placeholder" data-tx-deck-placeholder={kind} role="note">
  {#if title}
    <h2 class="tx-deck-stage__slide-title">{title}</h2>
  {/if}
  <p class="tx-deck-stage__placeholder-text">{message}</p>
</div>
