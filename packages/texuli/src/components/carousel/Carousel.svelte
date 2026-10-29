<script lang="ts">
import { directionOf } from '@texuli/core/dir-locale';
import { getOwnerDocument, getOwnerWindow, listen, matchesMedia } from '@texuli/core/env';
import { localizeLabels } from '@texuli/core/i18n';
import { getNavigationIntent } from '@texuli/core/keyboard';
import { createRovingFocus } from '@texuli/core/roving';
import type { Snippet } from 'svelte';
import type { HTMLAttributes } from 'svelte/elements';
import { useMessages } from '../../i18n/use-messages.ts';
import { chainHandlers, composeHandlers } from '../../internal/handlers.ts';
import './carousel.css';
import { type ClassValue } from '../../internal/cx.ts';
import {
  type CarouselControlsPlacement,
  type CarouselMessages,
  canStep,
  carouselVariants,
  createAutoplay,
  DEFAULT_CAROUSEL_MESSAGES,
  formatMessage,
  resolveCarouselMessages,
  resolveIndex,
  swipeStep,
} from './carousel.ts';
import type { CarouselItem } from './types.ts';

type OwnProps = {
  /** Slides in display order; each `id` is unique. */
  items: CarouselItem[];
  /** 0-based index of the active slide (`bind:index`). */
  index?: number;
  /** Accessible name of the carousel region; defaults to `messages.carousel`. */
  label?: string;
  /** Translated labels; any subset of {@link CarouselMessages}. */
  messages?: Partial<CarouselMessages>;
  /** Renders a slide's content; without it the slide shows its label. */
  children?: Snippet<[CarouselItem, number]>;
  /** Show the previous and next buttons (default `true`). */
  showControls?: boolean;
  /** Show the slide picker (default `true`). */
  showDots?: boolean;
  /** Where the previous and next buttons sit (default `'below'`). */
  controls?: CarouselControlsPlacement;
  /** Wrap from the last slide to the first (default `true`). */
  loop?: boolean;
  /** Minimum horizontal drag, in CSS pixels, that changes the slide (default 48). */
  swipeThreshold?: number;
  /**
   * Rotate the slides automatically (default `false`). A rotation control
   * stops and restarts it; it never starts when the user prefers reduced motion.
   */
  autoplay?: boolean;
  /** Milliseconds between slides while rotating (default 5000, minimum 2000). */
  interval?: number;
  class?: ClassValue;
  /** Fires after the user (or rotation) changes the slide. */
  onIndexChange?: (index: number) => void;
  /** Fires when rotation starts or stops. */
  onPlayingChange?: (playing: boolean) => void;
  /** The rendered root element (bindable). */
  ref?: HTMLElement | null;
};

/**
 * Extra attributes (`data-*`, `aria-*`, `id`…) land on the root element.
 * Caller handlers on the root run first and never replace the carousel's:
 * `event.preventDefault()` in `onkeydown` skips its arrow-key navigation; the
 * focus and pointer bookkeeping (autoplay pause) always runs.
 */
type Props = OwnProps & Omit<HTMLAttributes<HTMLElement>, keyof OwnProps | 'children'>;

let {
  items,
  index = $bindable(0),
  label,
  messages,
  children,
  showControls = true,
  showDots = true,
  controls = 'below',
  loop = true,
  swipeThreshold = 48,
  autoplay = false,
  interval,
  class: className,
  onIndexChange,
  onPlayingChange,
  ref = $bindable(null),
  onkeydown,
  onfocusin,
  onpointerdowncapture,
  onpointerupcapture,
  onpointercancelcapture,
  onpointerenter,
  onpointerleave,
  ...rest
}: Props = $props();
const msg = useMessages();

function bindRef(node: HTMLElement): () => void {
  ref = node;
  return () => {
    if (ref === node) ref = null;
  };
}

const uid = $props.id();
const t = $derived(
  resolveCarouselMessages(
    messages,
    localizeLabels(msg, 'texuli.carousel', DEFAULT_CAROUSEL_MESSAGES)
  )
);
const count = $derived(items.length);
const multiple = $derived(count > 1);
const active = $derived(resolveIndex(index, count, false));
const rootClass = $derived(carouselVariants({ controls, class: className }));
const tabId = (i: number) => `${uid}-tab-${i}`;
const slideId = (i: number) => `${uid}-slide-${i}`;

let root: HTMLElement | undefined = $state();
let tablist: HTMLElement | undefined = $state();
let playing = $state(false);
let dragging = $state(false);
let dragX = $state(0);
let pointerId: number | null = null;
let startX = 0;
let pointerInside = false;

const rotator = createAutoplay({
  onTick: () => go(active + 1, { fromRotation: true }),
  onPlayingChange: (next) => {
    playing = next;
    onPlayingChange?.(next);
  },
});

const roving = createRovingFocus({
  items: () => (tablist ? [...tablist.querySelectorAll<HTMLElement>('[role="tab"]')] : []),
  orientation: 'horizontal',
  // Read on every key, so a `dir` change flips the arrows without remounting.
  get direction() {
    return root ?? 'ltr';
  },
  get wrap() {
    return loop;
  },
  onActiveChange: (i) => go(i),
});

function directionNow(): 'ltr' | 'rtl' {
  return root ? directionOf(root) : 'ltr';
}

function go(target: number, options: { fromRotation?: boolean } = {}): void {
  if (!multiple) return;
  const next = resolveIndex(target, count, options.fromRotation ? true : loop);
  if (next === active) return;
  index = next;
  onIndexChange?.(next);
  if (!options.fromRotation) rotator.restart();
}

function step(delta: -1 | 1): void {
  if (canStep(active, count, loop, delta)) go(active + delta);
}

function onRootKeydown(event: KeyboardEvent): void {
  if (event.defaultPrevented || !multiple) return;
  const target = event.target as HTMLElement | null;
  // Arrows move slides only from the carousel's own surface and buttons, never from
  // slide content (text fields, nested widgets) or the picker (it roves itself).
  if (target !== root && !target?.closest('[data-tx-carousel-button]')) return;
  const intent = getNavigationIntent(event, {
    orientation: 'horizontal',
    direction: directionNow(),
  });
  if (!intent) return;
  event.preventDefault();
  if (intent === 'next') step(1);
  else if (intent === 'previous') step(-1);
  else if (intent === 'first') go(0);
  else if (intent === 'last') go(count - 1);
}

function onTablistKeydown(event: KeyboardEvent): void {
  // APG tabbed carousel: arrows move focus between picker tabs and show that slide.
  roving.handleKeydown(event);
}

function onFocusIn(event: FocusEvent): void {
  roving.handleFocusIn(event);
  const from = event.relatedTarget as Node | null;
  const entering = !from || !root?.contains(from);
  // APG: keyboard focus entering the carousel stops rotation for good; a click does not.
  if (entering && !pointerInside) rotator.stop();
}

function onPointerDownCapture(): void {
  pointerInside = true;
}

function onPointerUpCapture(): void {
  pointerInside = false;
}

function onViewportPointerDown(event: PointerEvent): void {
  if (event.button !== 0 || !multiple) return;
  if ((event.target as HTMLElement | null)?.closest('button, a, input, select, textarea')) return;
  pointerId = event.pointerId;
  startX = event.clientX;
  dragX = 0;
  dragging = true;
  (event.currentTarget as HTMLElement).setPointerCapture?.(event.pointerId);
}

function onViewportPointerMove(event: PointerEvent): void {
  if (!dragging || event.pointerId !== pointerId) return;
  dragX = event.clientX - startX;
}

function endDrag(event: PointerEvent, commit: boolean): void {
  if (!dragging || event.pointerId !== pointerId) return;
  const delta = dragX;
  dragging = false;
  pointerId = null;
  dragX = 0;
  if (!commit) return;
  const move = swipeStep(delta, swipeThreshold, directionNow());
  if (move !== 0) step(move);
}

function toggleRotation(): void {
  rotator.toggle();
}

// Keep the bound index in range when the list shrinks.
$effect(() => {
  if (count > 0 && (index < 0 || index >= count || !Number.isInteger(index))) index = active;
});

// Keep the picker's tab stop on the active slide.
$effect(() => {
  void active;
  void count;
  if (tablist) roving.setActive(active, { focus: false });
});

// Autoplay: start only for more than one slide and without a reduced-motion preference.
$effect(() => {
  const ownerWindow = getOwnerWindow(root);
  const reduced = matchesMedia('(prefers-reduced-motion: reduce)', ownerWindow, true);
  if (autoplay && multiple && !reduced) rotator.play();
  else rotator.stop();
});

$effect(() => {
  rotator.setInterval(interval);
});

// A hidden page holds rotation.
$effect(() => {
  const ownerDocument = getOwnerDocument(root);
  if (!ownerDocument) return;
  const sync = () => {
    if (ownerDocument.visibilityState === 'hidden') rotator.hold('hidden');
    else rotator.release('hidden');
  };
  sync();
  return listen(ownerDocument, 'visibilitychange', sync);
});

$effect(() => () => rotator.destroy());

const status = $derived(formatMessage(t.status, { index: active + 1, total: count }));
</script>

<!-- APG carousel: a labelled region; with a picker it is the tabbed variant. -->
<!-- The region takes focus only when it renders no controls, so arrows still reach it. -->
<!-- svelte-ignore a11y_no_noninteractive_element_interactions, a11y_no_noninteractive_tabindex -->
<section
  {...rest}
  {@attach bindRef}
  bind:this={root}
  class={rootClass}
  aria-roledescription="carousel"
  aria-label={label ?? t.carousel}
  tabindex={multiple && !showControls && !showDots ? 0 : undefined}
  data-tx-carousel
  data-controls={controls}
  data-index={active}
  data-playing={playing ? 'true' : undefined}
  onkeydown={composeHandlers(onkeydown, onRootKeydown)}
  onfocusin={chainHandlers(onfocusin, onFocusIn)}
  onpointerdowncapture={chainHandlers(onpointerdowncapture, onPointerDownCapture)}
  onpointerupcapture={chainHandlers(onpointerupcapture, onPointerUpCapture)}
  onpointercancelcapture={chainHandlers(onpointercancelcapture, onPointerUpCapture)}
  onpointerenter={chainHandlers(onpointerenter, () => rotator.hold('hover'))}
  onpointerleave={chainHandlers(onpointerleave, () => rotator.release('hover'))}
>
  {#if autoplay && multiple}
    <div class="tx-carousel-top">
      <button
        type="button"
        class="tx-carousel-button"
        aria-label={playing ? t.pause : t.play}
        data-tx-carousel-button="rotation"
        onclick={toggleRotation}
      >
        {#if playing}
          <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">
            <rect x="4" y="3" width="3" height="10" rx="0.5" />
            <rect x="9" y="3" width="3" height="10" rx="0.5" />
          </svg>
        {:else}
          <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false" class="tx-carousel-flip">
            <path d="M5 3.5v9l7.5-4.5z" />
          </svg>
        {/if}
      </button>
    </div>
  {/if}

  <div class="tx-carousel-stage">
    {#if showControls && multiple && controls === 'overlay'}
      <button
        type="button"
        class="tx-carousel-button tx-carousel-edge"
        data-edge="start"
        aria-label={t.previous}
        disabled={!canStep(active, count, loop, -1)}
        data-tx-carousel-button="previous"
        onclick={() => step(-1)}
      >
        <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false" class="tx-carousel-flip tx-carousel-chevron">
          <path d="M10 3.5 5.5 8l4.5 4.5" />
        </svg>
      </button>
    {/if}

    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div
      class="tx-carousel-viewport"
      onpointerdown={onViewportPointerDown}
      onpointermove={onViewportPointerMove}
      onpointerup={(event) => endDrag(event, true)}
      onpointercancel={(event) => endDrag(event, false)}
    >
      <div
        class="tx-carousel-track"
        style:--tx-carousel-index={active}
        style:--tx-carousel-drag={`${dragX}px`}
        data-dragging={dragging ? 'true' : undefined}
      >
        {#each items as item, i (item.id)}
          <div
            id={slideId(i)}
            class="tx-carousel-slide"
            role={showDots && multiple ? 'tabpanel' : 'group'}
            aria-roledescription={showDots && multiple ? undefined : 'slide'}
            aria-label={formatMessage(t.slide, { index: i + 1, total: count, label: item.label })}
            inert={i !== active}
            data-tx-carousel-slide={item.id}
            data-active={i === active ? 'true' : undefined}
          >
            {#if children}
              {@render children(item, i)}
            {:else}
              <p class="tx-carousel-fallback">{item.label}</p>
            {/if}
          </div>
        {/each}
      </div>
    </div>

    {#if showControls && multiple && controls === 'overlay'}
      <button
        type="button"
        class="tx-carousel-button tx-carousel-edge"
        data-edge="end"
        aria-label={t.next}
        disabled={!canStep(active, count, loop, 1)}
        data-tx-carousel-button="next"
        onclick={() => step(1)}
      >
        <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false" class="tx-carousel-flip tx-carousel-chevron">
          <path d="M6 3.5 10.5 8 6 12.5" />
        </svg>
      </button>
    {/if}
  </div>

  {#if multiple && (showDots || (showControls && controls === 'below'))}
    <div class="tx-carousel-bar">
      {#if showControls && controls === 'below'}
        <div class="tx-carousel-buttons">
          <button
            type="button"
            class="tx-carousel-button"
            aria-label={t.previous}
            disabled={!canStep(active, count, loop, -1)}
            data-tx-carousel-button="previous"
            onclick={() => step(-1)}
          >
            <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false" class="tx-carousel-flip tx-carousel-chevron">
              <path d="M10 3.5 5.5 8l4.5 4.5" />
            </svg>
          </button>
          <button
            type="button"
            class="tx-carousel-button"
            aria-label={t.next}
            disabled={!canStep(active, count, loop, 1)}
            data-tx-carousel-button="next"
            onclick={() => step(1)}
          >
            <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false" class="tx-carousel-flip tx-carousel-chevron">
              <path d="M6 3.5 10.5 8 6 12.5" />
            </svg>
          </button>
        </div>
      {/if}

      {#if showDots}
        <!-- svelte-ignore a11y_interactive_supports_focus -->
        <div
          bind:this={tablist}
          class="tx-carousel-dots"
          role="tablist"
          aria-label={t.slides}
          onkeydown={onTablistKeydown}
        >
          {#each items as item, i (item.id)}
            <button
              type="button"
              role="tab"
              id={tabId(i)}
              class="tx-carousel-dot"
              aria-controls={slideId(i)}
              aria-selected={i === active}
              aria-label={formatMessage(t.goTo, { index: i + 1, label: item.label })}
              tabindex={i === active ? 0 : -1}
              onclick={() => go(i)}
            ></button>
          {/each}
        </div>
      {/if}

      <span class="tx-carousel-count" aria-hidden="true">
        {formatMessage(t.count, { index: active + 1, total: count })}
      </span>
    </div>
  {/if}

  <p class="tx-carousel-status" aria-live={playing ? 'off' : 'polite'} aria-atomic="true">
    {status}
  </p>
</section>

