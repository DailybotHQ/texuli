# Rating

**Package:** `texuli` · **Path:** `src/components/rating/` · **Subpath:**
`texuli/rating` · **Task:** T-ui-rating

A styled star rating on the token contract. It works as an **input** (a
WAI-ARIA radio group on the owned `@texuli/primitives/radio-group`) or as a
**display** (a labeled image of any value, such as an average). Ported from
Protoyard's `StarRating`.

```svelte
<script lang="ts">
import { Rating } from 'texuli/rating';
let score = $state(0);
</script>

<Rating bind:value={score} allowHalf clearable showValue labels={{ label: 'Rate your stay' }} />
<Rating display value={4.3} showValue />
```

## Props

| Prop | Default | Notes |
| --- | --- | --- |
| `value` | `0` | Bindable. 0 means not rated. Input values snap to whole stars (or halves). |
| `onValueChange` | — | Called with the new value (0 when cleared). |
| `max` | `5` | Number of stars, clamped to 1–10. |
| `allowHalf` | `false` | Half-star steps: each star holds two radios. |
| `display` | `false` | A read-only image showing any fraction (4.3 fills 30% of the fifth star). |
| `clearable` | `false` | Pressing the selected star again, or Delete/Backspace, clears to 0. |
| `readonly`, `disabled`, `required`, `name` | — | As the radio group; `name` submits the value through the primitive's form bridge. |
| `size` | `md` | `sm`, `md` or `lg`. |
| `tone` | `warning` | `warning`, `primary` or `neutral` (`--tx-warning`, `--tx-primary`, `--tx-foreground`). |
| `showValue` | `false` | A visible "3.5 of 5" summary. For input it is announced politely; for display it is decorative, since the image already says it. |
| `hideLabel` | `false` | Hides the group label visually but keeps it for assistive tech. |
| `locale` | runtime | Number formatting in labels (`2,5` in de-DE, Arabic-Indic digits in ar-EG). |
| `labels` | English | Translatable templates (see below). |
| `class` | — | Merged with `cx`; consumer classes win through `@layer tx.components`. |

**Label templates** (`{value}` and `{max}` are filled and formatted for
`locale`):

| Key | Default |
| --- | --- |
| `label` | `Rating` |
| `item` | `{value} of {max} stars` |
| `summary` | `{value} of {max}` |
| `none` | `Not rated` |
| `display` | `Rated {value} out of {max}` |

## Behavior

**Input** (APG radio group):
- **Keyboard:** one Tab stop, on the checked star (or the first). Arrow
  keys move and select. In right-to-left text they are mirrored, so
  ArrowLeft goes to a higher value.
- **Labels:** each radio is named "3 of 5 stars", or "2.5 of 5 stars" with
  halves.
- **Mouse hover** previews the fill; touch does not, since there is no
  hover.
- **Half stars:** the half radios sit on the inline start and end of each
  star, so they mirror in RTL. Half-star mode enlarges stars so each half
  target is at least 24 px wide (WCAG 2.5.8).
- **Fills** are clipped from the inline start (a `style:` directive sets
  the width; there is no static `style=`), so halves and fractions read
  correctly in RTL.
- **Clear on second press:** the previous value is read at pointerdown,
  because a press focuses the radio and the group selects on focus before
  the click. A click with no pointer press (assistive tech) reads it at
  click capture.

**Display:** `role="img"` named by the `display` template; no radios and
no focus.

**Styling**
- Token colors; logical properties only.
- The focus ring is drawn on the whole star (`:has(:focus-visible)`).
- Forced colors map to `CanvasText`, with `GrayText` when disabled and the
  `Highlight` ring.
- No motion.
- The stars are an owned inline SVG (`aria-hidden`); the icon set has no
  star.

## Primitive fix included

`@texuli/primitives/radio-group` did not pass a `direction` to its roving
focus, so its arrow keys never mirrored in RTL (its doc promised they
would). It now passes `direction: root`, read on every key press. That is
two lines in `RadioGroup.svelte`, guarded by this component's RTL test,
which fails without the fix. The primitive's own tests still pass.

## Verified

- **Unit tests:** `pnpm vitest run packages/texuli/tests/forms.test.ts -t rating`,
  9 tests:
  - helpers: locale templates;
  - input: the Tab stop following an outside value, **RTL arrows**, half
    values, clearable, **no clear on the first press when focus selects
    first**, read-only and disabled, form submission;
  - display: an image showing a fraction.
- **Browser** (a scratch Playwright spec, not committed; the example on
  `TEXULI_E2E_PORT=4830`, chromium, webkit and Pixel 7): **18 passed.**
  - axe found 0 violations in light and dark, with and without forced
    colors, with the WCAG 2.2 AA tags included (target size);
  - the keyboard selects, with a visible ring;
  - RTL ArrowLeft goes up a half star, and the half fill is anchored right;
  - half targets are at least 24 px; click or tap selects;
  - clear on the second press; the display image is named.
- **Visual baselines:** `texuli-rating` in light and dark, on chromium and
  mobile.

## Limits

- **Half steps at most;** an input never takes finer values (display does).
- **No custom icon slot yet:** the star glyph is built in.
- **No precision tooltip** on hover.

<!-- tokens:start (generated by `pnpm exec tsx packages/tokens/scripts/generate.ts`; do not edit by hand) -->
## Tokens

Set these on any element above the component (a theme scope, a design
system scope or `data-tx-scope`); each defaults to the system or theme token
shown, so nothing changes until one is set. The full list, with the exact
read expressions, is in
[tokens-components](../../tokens/docs/tokens-components.md#component-tokens).

| Token | Default | Meaning |
| --- | --- | --- |
| `--tx-rating-stars-gap` | `calc(var(--tx-space-unit) * 0.5)` | Gap between stars. |
| `--tx-rating-label-font-size` | `var(--tx-type-label-size)` | Label font size. |
| `--tx-rating-label-font-weight` | `var(--tx-type-label-weight)` | Label font weight. |
| `--tx-rating-star-radius` | `var(--tx-shape-radius-lg)` | Star focus box corner radius. |

<!-- tokens:end -->
