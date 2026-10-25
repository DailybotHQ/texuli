<script lang="ts">
import type { Theme } from '@texuli/tokens/contract';
import { defineTheme } from '@texuli/tokens/contract';
import { onMount, tick, untrack } from 'svelte';
import type { Deck, DeckSlide } from '../model/index.ts';
import { resolveSlideTheme, resolveSlideTransition, slideStepCount } from '../model/index.ts';
import type { DeckMediaTrust } from './media.ts';
import type { SlideNavigationIntent } from './navigation.ts';
import { createPresenterTimer, formatElapsed } from './presenter.ts';
import SlideContent from './SlideContent.svelte';
import {
  type DeckThemeLoader,
  deckCatalogThemeIds,
  deckThemeVariables,
  loadDeckLibraryTheme,
  resolveDeckThemeMode,
} from './theme.ts';

interface Props {
  deck: Deck;
  initialSlideId?: string;
  /** Open the initial slide at this reveal step, clamped to its steps (default 0). */
  initialStep?: number;
  onSlideChange?: (intent: SlideNavigationIntent) => void;
  /** Presenter layout: current slide, speaker notes, next slide and elapsed timer. */
  presenter?: boolean;
  onPresenterChange?: (open: boolean) => void;
  /**
   * Resolves catalog theme ids to token themes. Defaults to the token theme
   * library; pass `null` when the host loads matching theme CSS itself.
   */
  loadTheme?: DeckThemeLoader | null;
  /**
   * URL policy tier for media sources at paint. Keep `untrusted` (the
   * default) for agent or user decks.
   */
  mediaTrust?: DeckMediaTrust;
  /** Host adapter for `avatar:` image ids. */
  resolveAvatar?: (id: string) => string | undefined;
}

let {
  deck,
  initialSlideId,
  initialStep = 0,
  onSlideChange,
  presenter = $bindable(false),
  onPresenterChange,
  loadTheme = loadDeckLibraryTheme,
  mediaTrust = 'untrusted',
  resolveAvatar,
}: Props = $props();

function initialIndexFor(currentDeck: Deck, slideId: string | undefined): number {
  const matchedIndex = slideId ? currentDeck.slides.findIndex((slide) => slide.id === slideId) : -1;
  return matchedIndex >= 0 ? matchedIndex : currentDeck.settings.startIndex;
}

// The initial slide must be present during SSR; the effect below keeps it
// valid when a consumer swaps the deck prop after mount.
// svelte-ignore state_referenced_locally
let activeIndex = $state(initialIndexFor(deck, initialSlideId));
function initialStepFor(currentDeck: Deck, index: number, step: number): number {
  const slide = currentDeck.slides[index];
  if (!slide || !Number.isInteger(step)) return 0;
  return Math.max(0, Math.min(step, slideStepCount(slide)));
}

// The active slide's reveal step: 0 shows its static blocks, `stepCount` all of them.
// svelte-ignore state_referenced_locally
let activeStep = $state(initialStepFor(deck, activeIndex, initialStep));
// True while the current step was reached by stepping forward on this slide;
// only those reveals animate.
let revealing = $state(false);
let overview = $state(false);
let stageElement: HTMLElement | undefined = $state();
let slideElement: HTMLElement | undefined = $state();
let overviewButtonElement: HTMLButtonElement | undefined = $state();
let presenterButtonElement: HTMLButtonElement | undefined = $state();
let notesElement: HTMLElement | undefined = $state();
const timer = createPresenterTimer();
let elapsed = $state(0);
let timerRunning = $state(false);
let mounted = $state(false);
let reducedMotion = $state(false);
// Bumped by preference listeners so `system` modes re-resolve.
let preferenceVersion = $state(0);
// The nearest ancestor's explicit data-tx-mode (the host page's mode), if any.
let hostMode = $state<string | null>(null);
// Loaded catalog themes by id; `null` marks an id the loader rejected.
let catalogThemes = $state.raw<Record<string, Theme | null>>({});
const pendingThemes = new Set<string>();
let activeSlide = $derived(deck.slides[activeIndex]);
let themeRef = $derived(activeSlide ? resolveSlideTheme(deck, activeSlide) : deck.meta.themeRef);
let themeId = $derived(themeRef?.kind === 'catalog' ? themeRef.id : themeRef?.theme.id);
// Explicit modes hold during SSR; `system` resolves after mount: the host's
// data-tx-mode when set, otherwise the token engine (prefers-contrast: more
// selects high contrast).
let mode = $derived.by(() => {
  void preferenceVersion;
  const requested = themeRef?.mode ?? 'system';
  if (requested !== 'system') return requested;
  return mounted ? resolveDeckThemeMode(themeRef, undefined, hostMode) : 'light';
});
let activeTheme = $derived(
  themeRef?.kind === 'embedded'
    ? themeRef.theme
    : themeRef?.kind === 'catalog'
      ? (catalogThemes[themeRef.id] ?? undefined)
      : undefined
);
let themeStatus = $derived.by(() => {
  if (!themeRef) return undefined;
  if (themeRef.kind === 'embedded') return 'applied';
  if (!loadTheme) return 'host';
  if (!(themeRef.id in catalogThemes)) return 'loading';
  return catalogThemes[themeRef.id] ? 'applied' : 'unavailable';
});
let nextSlide = $derived(deck.slides[activeIndex + 1]);
let stepCount = $derived(activeSlide ? slideStepCount(activeSlide) : 0);
let revealTransition = $derived(
  activeSlide && mounted && revealing
    ? resolveSlideTransition(deck, activeSlide, { reducedMotion })
    : 'none'
);
// No entry animation on the first paint, and a hard cut under reduced motion.
// Only navigation to another slide animates. Re-mounting the same slide for
// a layout change (presenter view, overview) must not replay its entrance:
// a replayed fade hides content mid-animation from users and checkers alike.
let navigated = $state(false);
let transition = $derived(
  activeSlide && mounted && navigated
    ? resolveSlideTransition(deck, activeSlide, { reducedMotion })
    : 'none'
);

$effect(() => {
  const index = initialIndexFor(deck, initialSlideId);
  activeIndex = index;
  activeStep = initialStepFor(deck, index, initialStep);
  revealing = false;
});

// Load every catalog theme the deck references once, so slide changes do not flash.
$effect(() => {
  const loader = loadTheme;
  const ids = deckCatalogThemeIds(deck);
  if (!loader) return;
  const known = untrack(() => catalogThemes);
  for (const id of ids) {
    if (id in known || pendingThemes.has(id)) continue;
    pendingThemes.add(id);
    loader(id)
      .then(
        (theme) => defineTheme(theme),
        () => null
      )
      .then((theme) => {
        pendingThemes.delete(id);
        catalogThemes = { ...catalogThemes, [id]: theme };
      });
  }
});

// Write the validated token variables for the active theme and resolved mode.
$effect(() => {
  const element = stageElement;
  const theme = activeTheme;
  if (!element || !theme) return;
  const vars = deckThemeVariables(theme, mode, { reducedMotion });
  for (const [name, value] of Object.entries(vars)) element.style.setProperty(name, value);
  return () => {
    for (const name of Object.keys(vars)) element.style.removeProperty(name);
  };
});

// The timer runs while presenter mode is open and keeps its count when it closes.
$effect(() => {
  if (!presenter) {
    timer.pause();
    timerRunning = false;
    elapsed = timer.elapsed();
    return;
  }
  timer.start();
  timerRunning = true;
  elapsed = timer.elapsed();
});

$effect(() => {
  if (!presenter || !timerRunning) return;
  const interval = setInterval(() => {
    elapsed = timer.elapsed();
  }, 1000);
  return () => clearInterval(interval);
});

function setPresenter(open: boolean, focusSlide = false) {
  if (open === presenter) return;
  presenter = open;
  navigated = false;
  revealing = false;
  onPresenterChange?.(open);
  // The slide re-mounts in the new layout: keep keyboard focus on it when the
  // toggle came from inside the slide, otherwise return to the toggle.
  if (focusSlide) void tick().then(() => slideElement?.focus({ preventScroll: true }));
  else if (!open) void tick().then(() => presenterButtonElement?.focus());
}

function toggleTimer() {
  if (timer.running) timer.pause();
  else timer.start();
  timerRunning = timer.running;
  elapsed = timer.elapsed();
}

function resetTimer() {
  timer.reset();
  elapsed = timer.elapsed();
}

/** Go to a slide at a reveal step: 0, or `final` for every step shown. */
function setIndex(index: number, focusSlide = false, step: number | 'final' = 0) {
  const nextIndex = Math.max(0, Math.min(index, deck.slides.length - 1));
  const changed = nextIndex !== activeIndex;
  const target = deck.slides[nextIndex];
  activeIndex = nextIndex;
  activeStep = step === 'final' ? (target ? slideStepCount(target) : 0) : step;
  revealing = false;
  overview = false;
  navigated = changed;
  if (changed) {
    const slide = deck.slides[nextIndex];
    if (slide) onSlideChange?.({ index: nextIndex, slideId: slide.id });
  }
  if (focusSlide && changed) void tick().then(() => slideElement?.focus({ preventScroll: true }));
}

/** Hide the newest reveal, or go back to the previous slide fully revealed. */
function previous(focusSlide = false) {
  if (activeStep > 0) {
    activeStep -= 1;
    revealing = false;
    overview = false;
  } else if (activeIndex > 0) setIndex(activeIndex - 1, focusSlide, 'final');
  else if (deck.settings.loop) setIndex(deck.slides.length - 1, focusSlide, 'final');
}

/** Reveal the next step, or go to the next slide at its first step. */
function next(focusSlide = false) {
  if (activeStep < stepCount) {
    activeStep += 1;
    revealing = true;
    overview = false;
  } else if (activeIndex < deck.slides.length - 1) setIndex(activeIndex + 1, focusSlide);
  else if (deck.settings.loop) setIndex(0, focusSlide);
}

function toggleOverview(fromKeyboard = false) {
  navigated = false;
  revealing = false;
  if (overview) {
    overview = false;
    overviewButtonElement?.focus();
    return;
  }
  overview = true;
  if (fromKeyboard) {
    void tick().then(() => {
      stageElement
        ?.querySelector<HTMLButtonElement>('.tx-deck-stage__overview-item[aria-current]')
        ?.focus();
    });
  }
}

function chooseOverviewSlide(index: number) {
  // The current slide keeps its reveal progress; another opens at its first step.
  if (index === activeIndex) overview = false;
  else setIndex(index);
  overviewButtonElement?.focus();
}

function onStageKeydown(event: KeyboardEvent) {
  const target = event.target;
  if (!(target instanceof Node) || !stageElement?.contains(target)) return;
  if (event.altKey || event.ctrlKey || event.metaKey) return;

  const targetElement = target instanceof HTMLElement ? target : undefined;
  const inSlide = Boolean(targetElement && slideElement?.contains(targetElement));
  if (event.key === 'Escape' && overview) {
    event.preventDefault();
    overview = false;
    navigated = false;
    overviewButtonElement?.focus();
    return;
  }
  if (event.key === 'Escape' && presenter) {
    event.preventDefault();
    setPresenter(false);
    return;
  }
  if (
    targetElement &&
    (targetElement.isContentEditable ||
      /^(INPUT|TEXTAREA|SELECT)$/.test(targetElement.tagName) ||
      targetElement.closest('button, a, [role="button"]'))
  ) {
    return;
  }

  if (event.key === 'ArrowLeft' || event.key === 'PageUp' || event.key === 'Backspace') {
    event.preventDefault();
    previous(inSlide);
  } else if (
    event.key === 'ArrowRight' ||
    event.key === 'PageDown' ||
    event.key === 'Enter' ||
    event.key === ' ' ||
    event.key === 'Spacebar'
  ) {
    event.preventDefault();
    next(inSlide);
  } else if (event.key === 'Home') {
    event.preventDefault();
    setIndex(0, inSlide);
  } else if (event.key === 'End') {
    event.preventDefault();
    setIndex(deck.slides.length - 1, inSlide, 'final');
  } else if (event.key.toLowerCase() === 'o') {
    event.preventDefault();
    toggleOverview(true);
  } else if (event.key.toLowerCase() === 'p') {
    event.preventDefault();
    setPresenter(!presenter, inSlide);
  } else if (event.key.toLowerCase() === 's' && presenter) {
    event.preventDefault();
    notesElement?.focus();
  }
}

function slideLabel(slide: DeckSlide, index: number): string {
  return slide.title ?? `Slide ${index + 1}`;
}

function revealProgress(step: number, count: number): string {
  return `${step} of ${count} revealed`;
}

onMount(() => {
  const motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)');
  const colorPreference = window.matchMedia('(prefers-color-scheme: dark)');
  const contrastPreference = window.matchMedia('(prefers-contrast: more)');
  const root = document.documentElement;
  // Reduced motion follows the OS preference or a host-set data-tx-motion="reduce" on the root.
  const updateMotion = () => {
    reducedMotion = motionPreference.matches || root.dataset.txMotion === 'reduce';
    if (reducedMotion) stageElement?.setAttribute('data-motion', 'reduce');
    else stageElement?.removeAttribute('data-motion');
  };
  const updateColor = () => {
    hostMode =
      stageElement?.parentElement?.closest('[data-tx-mode]')?.getAttribute('data-tx-mode') ?? null;
    preferenceVersion += 1;
  };
  updateMotion();
  updateColor();
  mounted = true;
  motionPreference.addEventListener('change', updateMotion);
  const rootObserver = new MutationObserver(() => {
    updateMotion();
    updateColor();
  });
  rootObserver.observe(root, {
    attributes: true,
    attributeFilter: ['data-tx-motion', 'data-tx-mode'],
  });
  colorPreference.addEventListener('change', updateColor);
  contrastPreference.addEventListener('change', updateColor);
  window.addEventListener('keydown', onStageKeydown);
  return () => {
    motionPreference.removeEventListener('change', updateMotion);
    rootObserver.disconnect();
    colorPreference.removeEventListener('change', updateColor);
    contrastPreference.removeEventListener('change', updateColor);
    window.removeEventListener('keydown', onStageKeydown);
  };
});
</script>

<div
  bind:this={stageElement}
  class="tx-deck-stage"
  data-tx-theme={themeId}
  data-tx-mode={mode}
  data-tx-surface={activeTheme?.style.surface}
  data-tx-motion={activeTheme ? (reducedMotion ? 'reduce' : 'full') : undefined}
  data-theme-status={themeStatus}
  data-transition={transition}
  data-presenter={presenter ? 'true' : undefined}
  role="region"
  aria-label={`Presentation: ${deck.meta.title}`}
>
  <div class="tx-deck-stage__toolbar" role="group" aria-label="Presentation controls">
    <button
      type="button"
      class="tx-deck-stage__control"
      onclick={() => previous()}
      aria-label={activeStep > 0 ? 'Previous step' : 'Previous slide'}
    >
      Previous
    </button>
    <span class="tx-deck-stage__progress" aria-live="polite" aria-atomic="true">
      Slide {activeIndex + 1} of {deck.slides.length}: {activeSlide ? slideLabel(activeSlide, activeIndex) : ''}{stepCount > 0 ? `, ${revealProgress(activeStep, stepCount)}` : ''}
    </span>
    <button
      type="button"
      class="tx-deck-stage__control"
      onclick={() => next()}
      aria-label={activeStep < stepCount ? 'Next step' : 'Next slide'}
    >
      Next
    </button>
    <button
      bind:this={overviewButtonElement}
      type="button"
      class="tx-deck-stage__control"
      aria-pressed={overview}
      onclick={() => toggleOverview()}
    >
      {overview ? 'Close overview' : 'Overview'}
    </button>
    <button
      bind:this={presenterButtonElement}
      type="button"
      class="tx-deck-stage__control"
      aria-pressed={presenter}
      onclick={() => setPresenter(!presenter)}
    >
      Presenter
    </button>
  </div>

  {#if presenter}
    <div class="tx-deck-stage__presenter">
      <div class="tx-deck-stage__presenter-main">{@render content()}</div>
      <div class="tx-deck-stage__presenter-side">
        <div class="tx-deck-stage__timer">
          <span role="timer" aria-label="Elapsed time" class="tx-deck-stage__timer-value">
            {formatElapsed(elapsed)}
          </span>
          <button type="button" class="tx-deck-stage__control" onclick={toggleTimer}>
            {timerRunning ? 'Pause timer' : 'Resume timer'}
          </button>
          <button type="button" class="tx-deck-stage__control" onclick={resetTimer}>
            Reset timer
          </button>
        </div>
        <aside
          bind:this={notesElement}
          class="tx-deck-stage__notes"
          aria-label="Speaker notes"
          tabindex="-1"
        >
          <h2 class="tx-deck-stage__pane-title">Speaker notes</h2>
          {#if stepCount > 0}
            <p class="tx-deck-stage__step-progress">
              Reveal step {activeStep} of {stepCount}
            </p>
          {/if}
          {#if activeSlide?.notes}
            <p class="tx-deck-stage__notes-text">{activeSlide.notes}</p>
          {:else}
            <p class="tx-deck-stage__empty">No notes for this slide.</p>
          {/if}
        </aside>
        <section class="tx-deck-stage__next" aria-label="Up next">
          <h2 class="tx-deck-stage__pane-title">Up next</h2>
          <p class="tx-deck-stage__next-title">
            {#if activeStep < stepCount}
              Reveal step {activeStep + 1} of {stepCount} on this slide
            {:else}
              {nextSlide ? slideLabel(nextSlide, activeIndex + 1) : 'End of presentation'}
            {/if}
          </p>
        </section>
      </div>
    </div>
  {:else}
    {@render content()}
  {/if}
</div>

{#snippet content()}

  {#if overview}
    <nav class="tx-deck-stage__overview" aria-label="Slides">
      {#each deck.slides as slide, index (slide.id)}
        <button
          type="button"
          class="tx-deck-stage__overview-item"
          aria-current={index === activeIndex ? 'step' : undefined}
          onclick={() => chooseOverviewSlide(index)}
        >
          <span class="tx-deck-stage__overview-number">{index + 1}</span>
          <span>{slideLabel(slide, index)}</span>
        </button>
      {/each}
    </nav>
  {:else if activeSlide}
    {#key activeSlide.id}
      <article
        bind:this={slideElement}
        class="tx-deck-stage__slide"
        data-slide-id={activeSlide.id}
        data-transition={transition}
        data-step={activeStep}
        data-step-count={stepCount}
        tabindex="-1"
        aria-label={slideLabel(activeSlide, activeIndex)}
      >
        {#if activeSlide.title}
          <h2 class="tx-deck-stage__slide-title">{activeSlide.title}</h2>
        {/if}
        <SlideContent
          slide={activeSlide}
          {mediaTrust}
          {resolveAvatar}
          step={activeStep}
          {revealTransition}
        />
      </article>
    {/key}
  {/if}
{/snippet}
