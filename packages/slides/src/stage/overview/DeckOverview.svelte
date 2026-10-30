<script module lang="ts">
type Thumbnails = typeof import('./thumbnails.ts');
// The thumbnail painter loads with the first overview (a lazy chunk), once per page.
let loaded: Thumbnails | null = null;
let loading: Promise<Thumbnails> | null = null;

function loadThumbnails(): Promise<Thumbnails> {
  loading ??= import('./thumbnails.ts').then((module) => {
    loaded = module;
    return module;
  });
  return loading;
}
</script>

<script lang="ts">
/**
 * The slide overview (O): every visible slide as a card with its number,
 * title and a real thumbnail (the stage renderers at the slide's last step,
 * scaled down), in a responsive grid.
 *
 * - Windowed: thumbnails mount for the cards within `OVERVIEW_WINDOW_RADIUS`
 *   of the selection and for cards scrolled into view; the rest keep their
 *   number and title only, so a long deck opens fast.
 * - Keyboard (grid pattern on a roving tab stop): arrows move a card or a
 *   row (flipped in right-to-left decks), Home and End jump to the ends,
 *   Enter or Space opens the card, Escape closes through the stage key map.
 *   The cards, titles and keys are in the stage entry; the thumbnail painter
 *   is a lazy chunk loaded with the first overview.
 *   A keyboard open focuses the current slide's card.
 * - Choosing moves the deck once (a double activation never moves twice),
 *   closes the overview and hands focus back to the slide.
 */
import { onMount, tick } from 'svelte';
import { getDeckStageContext } from '../context.ts';
import { deckCssVars } from '../css-vars.ts';
import type { DeckPreviewPaint } from '../presenter/paint.ts';
import {
  isOverviewMoveKey,
  moveOverviewSelection,
  OVERVIEW_WINDOW_RADIUS,
  overviewColumns,
  overviewWindow,
} from './window.ts';

interface Props {
  /** Move focus to the current slide's card on open (keyboard opens). */
  focusCurrent?: boolean;
  /** How to paint thumbnails; without it the cards show numbers and titles only. */
  paint?: DeckPreviewPaint;
  /** Thumbnails mounted on each side of the selection. */
  radius?: number;
}

let { focusCurrent = false, paint, radius = OVERVIEW_WINDOW_RADIUS }: Props = $props();
const stage = getDeckStageContext();

let root: HTMLElement | undefined = $state();
let width = $state(0);
let selected = $state(stage ? stage.position : 0);
let seen = $state.raw<ReadonlySet<number>>(new Set());
let chosen = false;
let thumbnails = $state.raw<Thumbnails | null>(loaded);

let total = $derived(stage ? stage.slides.length : 0);
let columns = $derived(overviewColumns(width));
let range = $derived(overviewWindow(selected, total, radius));
let gridVars = $derived({ '--tx-deck-overview-columns': String(columns) });

function painted(position: number): boolean {
  return (position >= range.start && position < range.end) || seen.has(position);
}

// A card is named by its visible caption ("3 Pricing"), so voice control
// users can say what they see; "slide 3 of 25" is its description. (An
// `aria-label` could not hold the thumbnail's visible text, which axe counts
// as the card's text.)
const uid = $props.id();

function cardPosition(position: number): string {
  return stage?.t('stage.overviewCardPosition', { current: position + 1, total }) ?? '';
}

function cardAt(position: number): HTMLElement | null | undefined {
  return root?.querySelector<HTMLElement>(`[data-tx-deck-overview-position="${position}"]`);
}

function choose(slideId: string) {
  if (!stage || chosen) return;
  chosen = true;
  if (slideId !== stage.state.slideId) stage.goTo(slideId);
  stage.controller.setOverview(false);
  stage.focusSlide();
}

function onKeydown(event: KeyboardEvent) {
  if (!stage || event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) return;
  if (event.key === 'Enter' || event.key === ' ') {
    const entry = stage.slides[selected];
    if (!entry || event.repeat) return;
    // Opened here, once; the button's own click activation is then a no-op.
    event.preventDefault();
    choose(entry.slide.id);
    return;
  }
  if (!isOverviewMoveKey(event.key)) return;
  event.preventDefault();
  selected = moveOverviewSelection(selected, event.key, total, columns, stage.dir);
  void tick().then(() => cardAt(selected)?.focus());
}

onMount(() => {
  const element = root;
  if (!element) return;
  const measure = () => {
    const next = element.getBoundingClientRect().width;
    if (next > 0) width = next;
  };
  measure();
  if (focusCurrent) cardAt(selected)?.focus();
  let sizes: ResizeObserver | null = null;
  if (typeof ResizeObserver === 'function') {
    sizes = new ResizeObserver((records) => {
      const rect = records[records.length - 1]?.contentRect;
      if (rect && rect.width > 0) width = rect.width;
    });
    sizes.observe(element);
  }
  let unobserve: (() => void) | null = null;
  let gone = false;
  if (paint) {
    void loadThumbnails().then(
      (module) => {
        if (gone) return;
        thumbnails = module;
        // Cards scrolled into view paint their thumbnail even far from the selection.
        unobserve = module.observeCards(element, (changes) => {
          const next = new Set(seen);
          for (const [at, visible] of changes) {
            if (visible) next.add(at);
            else next.delete(at);
          }
          seen = next;
        });
      },
      () => undefined
    );
  }
  return () => {
    gone = true;
    sizes?.disconnect();
    unobserve?.();
  };
});
</script>

{#if stage}
  {@const t = stage.t}
  <!-- Arrow keys move between the cards (roving tab stop); the buttons do the rest. -->
  <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
  <nav
    bind:this={root}
    class="tx-deck-stage__overview"
    aria-label={t('stage.slides')}
    data-tx-deck-overview
    data-columns={columns}
    onkeydown={onKeydown}
  >
    <p class="tx-deck-overview__hint">{t('stage.overviewHint')}</p>
    <ul class="tx-deck-overview__grid" use:deckCssVars={gridVars}>
      {#each stage.slides as entry (entry.slide.id)}
        {@const current = entry.index === stage.state.slideIndex}
        <li class="tx-deck-overview__cell">
          <button
            type="button"
            class="tx-deck-overview__card"
            tabindex={entry.position === selected ? 0 : -1}
            aria-current={current ? 'step' : undefined}
            aria-describedby={`${uid}-position-${entry.position}`}
            data-tx-deck-overview-item={entry.slide.id}
            data-tx-deck-overview-position={entry.position}
            data-selected={entry.position === selected ? 'true' : undefined}
            onfocus={() => (selected = entry.position)}
            onclick={() => choose(entry.slide.id)}
          >
            {#if thumbnails && paint && painted(entry.position)}
              <thumbnails.DeckSlidePreview
                {paint}
                slide={entry.slide}
                index={entry.index}
                title={entry.title}
              />
            {:else}
              <span class="tx-deck-overview__placeholder" aria-hidden="true"></span>
            {/if}
            <!-- Named by its visible caption; the position is its description. -->
            <span class="tx-deck-overview__caption">
              <span class="tx-deck-overview__number">{entry.position + 1}</span>{' '}<span
                class="tx-deck-overview__title">{entry.title}</span
              >
            </span>
            <span id={`${uid}-position-${entry.position}`} hidden>{cardPosition(entry.position)}</span>
          </button>
        </li>
      {/each}
    </ul>
  </nav>
{/if}

<style>
  .tx-deck-stage__overview {
    display: grid;
    gap: 0.75rem;
    align-content: start;
    min-block-size: 0;
    max-block-size: 100%;
    overflow: auto;
    overscroll-behavior: contain;
    padding: 0.25rem;
  }

  .tx-deck-overview__hint {
    margin: 0;
    color: var(--tx-muted-foreground, var(--tx-foreground));
    font-size: 0.875rem;
  }

  .tx-deck-overview__grid {
    display: grid;
    grid-template-columns: repeat(var(--tx-deck-overview-columns, 3), minmax(0, 1fr));
    gap: 0.75rem;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .tx-deck-overview__cell {
    min-inline-size: 0;
  }

  .tx-deck-overview__card {
    display: grid;
    gap: 0.5rem;
    inline-size: 100%;
    padding: 0.5rem;
    color: var(--tx-foreground);
    text-align: start;
    background: var(--tx-surface, var(--tx-background));
    border: 1px solid var(--tx-border);
    border-radius: var(--tx-shape-radius-lg);
    font: inherit;
    cursor: pointer;
  }

  .tx-deck-overview__card:hover {
    border-color: var(--tx-border-strong, var(--tx-border));
  }

  .tx-deck-overview__card[aria-current] {
    border-color: var(--tx-primary, var(--tx-ring));
    box-shadow: 0 0 0 1px var(--tx-primary, var(--tx-ring));
  }

  .tx-deck-overview__card:focus-visible {
    outline: 2px solid var(--tx-ring);
    outline-offset: 2px;
  }

  .tx-deck-overview__placeholder {
    display: block;
    inline-size: 100%;
    aspect-ratio: var(--tx-deck-aspect-ratio, 16 / 9);
    background: var(--tx-muted, var(--tx-background));
    border: 1px dashed var(--tx-border);
    border-radius: calc(var(--tx-shape-radius-lg) * 0.75);
  }

  .tx-deck-overview__caption {
    display: flex;
    gap: 0.5rem;
    align-items: baseline;
    min-inline-size: 0;
  }

  .tx-deck-overview__number {
    flex: none;
    color: var(--tx-muted-foreground, var(--tx-foreground));
    font-variant-numeric: tabular-nums;
  }

  .tx-deck-overview__title {
    overflow: hidden;
    font-weight: 600;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  @media (prefers-reduced-motion: no-preference) {
    .tx-deck-overview__card {
      transition: border-color 120ms ease;
    }
  }

  @media (forced-colors: active) {
    .tx-deck-overview__card {
      border-color: CanvasText;
    }

    .tx-deck-overview__card[aria-current] {
      border-color: Highlight;
      box-shadow: 0 0 0 1px Highlight;
    }
  }

  @media print {
    .tx-deck-stage__overview {
      display: none;
    }
  }
</style>
