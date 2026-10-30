# Carousel

A carousel of slides with previous and next buttons, a slide picker,
optional autoplay, and swipe. It follows the
[APG carousel pattern](https://www.w3.org/WAI/ARIA/apg/patterns/carousel/).
With a picker, it is the tabbed variant (picker tabs control slide tab
panels). Without one, it is the basic variant (slides are groups with the
`slide` role description). It was ported from `@protoyard/ui`'s `Carousel` and
keeps its props. Added by T-ui-carousel.

## Entry points

| Import | What it gives you | Measured gzip (`pnpm size`, 2026-10-24) |
| --- | --- | --- |
| `texuli/carousel` | `Carousel`, plus the framework-free helpers below and the types | 6.39 KiB JS + 1.45 KiB CSS (budget `texuli/*`: 12 KiB) |
| `texuli` | `Carousel`, `carouselVariants`, `DEFAULT_CAROUSEL_MESSAGES` and the `CarouselItem`, `CarouselMessages` and `CarouselControlsPlacement` types | included in the root (6.34 KiB with only the carousel exported, measured when it landed) |

For comparison, Protoyard's `Carousel` built on its own measured 28.1 KB gzip
(`INVENTORY_UI.md`). Most of that was its class-merging stack and Lucide icons.
Texuli's carousel uses inline SVG icons and the core texels.

```svelte
<script lang="ts">
import { Carousel, type CarouselItem } from 'texuli/carousel';

const items: CarouselItem[] = [
  { id: 'harbor', label: 'Harbor at dawn' },
  { id: 'market', label: 'Night market' },
];
let index = $state(0);
</script>

<Carousel {items} label="Featured destinations" bind:index>
  {#snippet children(item)}
    <p>{item.label}</p>
  {/snippet}
</Carousel>
```

## Props

| Prop | Default | What it does |
| --- | --- | --- |
| `items` | required | `{ id, label }[]` in display order. Each `id` is unique; `label` names the slide for assistive tech. |
| `index` | `0` | The active slide, bindable. An out-of-range value is clamped and written back. |
| `label` | `messages.carousel` | Accessible name of the carousel region. |
| `children` | the slide's label | `Snippet<[item, index]>` that renders a slide. |
| `showControls` | `true` | Shows the previous and next buttons. |
| `showDots` | `true` | Shows the slide picker (the tabbed variant). |
| `controls` | `'below'` | `'below'` puts the buttons in the bar under the slides; `'overlay'` places them on the slides' inline start and end edges. |
| `loop` | `true` | Wraps from the last slide to the first. Without it, the buttons disable at the ends. |
| `swipeThreshold` | `48` | The horizontal drag, in CSS pixels, that changes the slide. |
| `autoplay` | `false` | Rotates the slides; see [Autoplay](#autoplay). |
| `interval` | `5000` | Milliseconds between slides; values below 2000 are raised to 2000. |
| `messages` | English | Any subset of the labels below. |
| `class` | — | Merged last onto the root, so it wins (see [Styling](#styling)). |
| `onIndexChange(index)` | — | Fires after any change: buttons, picker, keys, swipe or rotation. |
| `onPlayingChange(playing)` | — | Fires when rotation starts or stops. |
| `ref`, other attributes | — | `bind:ref` is the root `section`; `id`, `aria-*`, `data-*` and handlers land on it. A caller `onkeydown` runs first (`event.preventDefault()` skips the arrow-key navigation); caller focus and pointer handlers run before the autoplay bookkeeping, which always runs. |

A single slide renders no controls. An empty list renders the labelled
region with nothing to move.

## Keyboard and pointer

- **Picker (tabbed variant):** one tab stop. ArrowLeft and ArrowRight move
  focus and show that slide; Home and End jump to the ends. The arrows flip in
  RTL. This is roving focus from `@texuli/core/roving`.
- **Buttons:** previous and next, and the arrows also work while a button has
  focus. They never fire from slide content, so text fields and nested widgets
  keep their keys.
- **No controls:** with both `showControls` and `showDots` off, the region
  itself takes focus and answers the arrows.
- **Hidden slides** are `inert`, so their links and fields leave the tab order
  and the accessibility tree.
- **Swipe:** a horizontal drag past `swipeThreshold`. Dragging toward the inline
  start shows the next slide (left in LTR, right in RTL), and the track
  follows the finger. Vertical scrolling stays with the page (`touch-action: pan-y`).

## Autoplay

Per the APG pattern:

- **Rotation control:** a "Stop/Start automatic slide show" button is the
  first control in the carousel, above the slides, so the visual order
  matches the tab order.
- **Hover:** pointer hover pauses rotation until the pointer leaves.
- **Keyboard focus:** when focus moves into the carousel from the keyboard,
  rotation stops until the user restarts it. Focus from a click (the rotation
  control itself) does not stop it.
- **Hidden page:** rotation holds while the page is hidden
  (`visibilitychange`).
- **Reduced motion:** with `prefers-reduced-motion: reduce`, rotation never
  starts on its own; the control still lets the user start it.
- **Live region:** the status ("Slide 2 of 4") is announced politely, but
  only while rotation is stopped. While rotating, the live region is `off`.

The controller is framework-free: `createAutoplay({ interval, onTick,
onPlayingChange, setTimer?, clearTimer? })` returns `play`, `stop`, `toggle`,
`hold(reason)`, `release(reason)`, `restart`, `setInterval` and `destroy`.

## Labels

`DEFAULT_CAROUSEL_MESSAGES`, overridable through `messages`. Placeholders are
filled as plain text.

| Key | English default |
| --- | --- |
| `carousel` | `Carousel` |
| `slides` | `Slides` |
| `previous` / `next` | `Previous slide` / `Next slide` |
| `goTo` | `Go to slide {index}: {label}` |
| `slide` | `{index} of {total}: {label}` |
| `status` | `Slide {index} of {total}` |
| `count` | `{index} / {total}` (the visible position) |
| `play` / `pause` | `Start automatic slide show` / `Stop automatic slide show` |

## Styling

- **Layer:** component CSS lives in `@layer tx.components`, so any unlayered
  consumer rule, whatever its specificity, overrides it.
- **Root classes:** `tx-carousel`, plus `tx-carousel--controls-below` or
  `tx-carousel--controls-overlay` (`carouselVariants`), then your `class`.
  `data-index`, `data-controls` and `data-playing` are set on the root.
- **Tokens, each with a fallback:** `--tx-foreground`, `--tx-muted`,
  `--tx-muted-foreground`, `--tx-primary`, `--tx-surface`, `--tx-elevated`,
  `--tx-border-strong`, `--tx-border-width`, `--tx-ring`,
  `--tx-focus-ring-width`, `--tx-focus-ring-offset`, `--tx-radius`,
  `--tx-shadow-float`, `--tx-density`, `--tx-motion-base`,
  `--tx-motion-fast` and `--tx-motion-easing`.
- **Unthemed pages:** fallbacks use `light-dark()`, so they follow
  `color-scheme`.
- **No style strings:** the track is positioned only through
  `--tx-carousel-index` and `--tx-carousel-drag`.
- **RTL:** `:dir(rtl)` flips the track direction and the chevrons, and every
  edge uses logical properties.
- **Motion and forced colors:** reduced motion removes the transitions.
  Forced colors use system colors (`ButtonText`, `CanvasText`, `Highlight`,
  `GrayText`).

The carousel renders no links or images of its own. Content you put in a
slide follows the URL policy where it renders (`safeHref` and
`safeImageSrc` from `@texuli/core`).

## Helpers (`texuli/carousel`)

- `resolveIndex(target, count, loop)`: wraps or clamps an index.
- `canStep(index, count, loop, ±1)`: whether a move is possible.
- `swipeStep(deltaX, threshold, direction)`: `1`, `-1` or `0`.
- `resolveCarouselMessages(partial)`: merges translations over the defaults.
- `formatMessage(template, values)`: fills the placeholders.
- `resolveInterval(ms)`: the interval rule.
- `MIN_AUTOPLAY_INTERVAL`, `DEFAULT_AUTOPLAY_INTERVAL`.

## Examples

In `@texuli/examples`:

- `ui-carousel`: the default carousel.
- `ui-carousel-overlay`: overlay controls.
- `ui-carousel-autoplay`: autoplay.
- `ui-carousel-states`: no loop, buttons only, a single slide and translated labels.
- `ui-carousel-rtl`: Arabic labels in an RTL layout.
- `ui-carousel-dark`: a dark color scheme.

## Verified

On 2026-10-23:

- **Unit and component:** `pnpm vitest run packages/texuli/tests/display.test.ts -t carousel`
  runs 12 tests (the model, inert hidden slides, arrows, swipe in RTL, the
  track without a style string, and autoplay: live region, focus stop,
  reduced motion, hidden page).
- **axe:** every example has zero violations, also after moving to the second
  slide, in light and dark, with and without forced colors, on Chromium,
  WebKit and the Pixel 7. No rule is disabled.
- **Real-browser behavior:** RTL track and arrows, swipe, Tab order, and
  autoplay with real timers (hover pause, keyboard stop, reduced motion).
- **Visual baselines:** captured for all six examples.

**Not covered:** Firefox (Playwright's Firefox does not launch on this macOS),
and screen-reader transcripts.

<!-- tokens:start (generated by `pnpm exec tsx packages/tokens/scripts/generate.ts`; do not edit by hand) -->
## Tokens

Set these on any element above the component (a theme scope, a design
system scope or `data-tx-scope`); each defaults to the system or theme token
shown, so nothing changes until one is set. The full list, with the exact
read expressions, is in
[tokens-components](../../tokens/docs/tokens-components.md#component-tokens).

| Token | Default | Meaning |
| --- | --- | --- |
| `--tx-carousel-radius` | `var(--tx-shape-radius-lg)` | Corner radius of the carousel and viewport. |
| `--tx-carousel-fallback-padding` | `var(--tx-space-4)` | Padding of the no-slides fallback. |

<!-- tokens:end -->
