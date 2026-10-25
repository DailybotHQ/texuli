# Primitive: Slider and range slider

**Package:** `@texuli/primitives` · **Subpath:** `@texuli/primitives/slider` ·
**Path:** `src/slider/` · **Task:** T-prim-slider

An owned, headless Svelte 5 slider that follows the APG
[Slider](https://www.w3.org/WAI/ARIA/apg/patterns/slider/) and
[multi-thumb Slider](https://www.w3.org/WAI/ARIA/apg/patterns/slider-multithumb/)
patterns. It supports one or more thumbs, steps, a minimum distance between
thumbs, orientation, RTL, keyboard, pointer and touch, and native form
submission. Its parts are composed as `Slider.*`.

```svelte
<script lang="ts">
import { Slider } from '@texuli/primitives/slider';
let price = $state([200, 800]);
</script>

<Slider.Root type="multiple" bind:value={price} min={0} max={1000} step={10} name="price">
  {#snippet children({ thumbItems })}
    <Slider.Range />
    {#each thumbItems as thumb (thumb.index)}
      <Slider.Thumb index={thumb.index} aria-label={thumb.index === 0 ? 'Minimum price' : 'Maximum price'} />
    {/each}
  {/snippet}
</Slider.Root>
```

## Parts and props

| Part | Renders | Props |
| --- | --- | --- |
| `Slider.Root` | `span` (the track) | `type` (`single` default, or `multiple`), `value` (bindable `number` or ascending `number[]`), `onValueChange`, `onValueCommit`, `min` (0), `max` (100), `step` (1), `largeStep` (10 × step), `minStepsBetweenThumbs` (0), `orientation` (`horizontal` or `vertical`), `dir`, `disabled`, `getValueText(value, index)`, `name`, `form`, `required`, `ref` |
| `Slider.Range` | `span` | The filled part: from `min` for one thumb, or between the outer thumbs |
| `Slider.Thumb` | `span role="slider"` | `index` (default 0). Name it with `aria-label` or `aria-labelledby` |
| `Slider.Tick` | `span aria-hidden="true"` | `index` (from the root's `tickItems`). `data-selected` when inside the range |

- The root's `children` snippet receives `{ thumbItems, tickItems }`.
  `tickItems` lists one tick per step for scales of at most 100 steps, and is
  empty otherwise.
- Every part takes a `child` snippet (`{#snippet child({ props })}`). The
  position and the form field come along in `props` as attachments, so a
  custom element still moves and submits.

## Behavior

- **Values:** values snap to `step`, counted from `min`. Decimal steps stay
  exact: 0.2 + 0.1 gives 0.3. `onValueChange` fires on every change.
  `onValueCommit` fires after a keyboard change and when a pointer drag ends.
- **Thumbs never cross.** A thumb's `aria-valuemin` and `aria-valuemax` are
  its neighbors, plus the minimum gap of `minStepsBetweenThumbs × step`. A
  drag stops at the neighbor (Bits' `autoSort` swaps thumbs instead).
- **Keyboard (APG):**
  - ArrowRight and ArrowUp increase; ArrowLeft and ArrowDown decrease.
  - In an RTL horizontal slider, Left and Right swap.
  - PageUp and PageDown move `largeStep`. Home and End go to the thumb's
    bounds.
  - Keys held with Ctrl, Meta or Alt are left to the platform. The page does
    not scroll for keys the slider handles.
- **Pointer and touch:**
  - A press on the track moves the nearest thumb there (on a tie, the one on
    the pointer's side), focuses it, and captures the pointer for the drag.
  - The root sets `touch-action: none`, so a touch drag doesn't scroll.
  - The right mouse button is ignored.
- **Disabled:** the thumbs leave the Tab order (`tabindex="-1"`) and get
  `aria-disabled="true"`. Keys and the pointer do nothing, and the form field
  is disabled.
- **Forms:**
  - With `name`, each thumb adds one native input (`@texuli/core/form-bridge`),
    so a range submits two values under the same name; read them with
    `FormData.getAll(name)`.
  - A form reset restores the values the slider started with.
  - `required` and `form` are passed through.
- **Positioning:** thumbs, the range and ticks are placed with logical
  properties (`inset-inline-start`/`-end`, `inset-block-end`/`-start` when
  vertical), so RTL needs no extra CSS. They are written through
  `style.setProperty`, which a strict CSP allows, and never as a `style`
  attribute.

## State attributes

| Attribute | On | Meaning |
| --- | --- | --- |
| `data-orientation` | every part | `horizontal` or `vertical` |
| `data-disabled` | root, range, thumb | present when disabled |
| `data-state` | thumb | `active` while dragged, otherwise `inactive` |
| `data-index`, `data-value` | thumb | its index and value |
| `data-selected`, `data-value` | tick | inside the range; the tick's value |

Center a thumb on its point with `translate: -50% -50%` (horizontal) or
`translate: -50% 50%` (vertical). The same rule works in RTL, because the
anchor flips with the logical property.

## Verified

- `pnpm vitest run packages/primitives/tests/slider.test.ts`: 28 tests.
  - The math: snapping with decimals, bounds and gaps, pointer to value in
    every orientation and RTL, nearest thumb, the key mapping.
  - Roles and values, positions, vertical layout and ticks.
  - Every key, RTL, decimal steps and `preventDefault`.
  - Range bounds and the minimum gap, and drags that stop at the neighbor.
  - Disabled, both keys and pointer.
  - Pointer and touch: press, drag, a single commit, capture, cancel, the
    right button, the nearest range thumb, RTL.
  - Form submit, reset and disabled; the child snippet.
  - Nine deliberate mutations of the implementation each fail a test.
- **Behavior:** `pnpm exec playwright test tests/behavior/scenarios/slider.spec.ts`
  runs 10 rows: roles, keyboard, Tab order, range order, RTL, click, drag
  with a single commit, touch tap, disabled, and axe.
  - It passes 30/30 in Chromium, WebKit and the Pixel 7.
  - The touch row taps only where the project has touch (the Pixel 7).

## Size

`pnpm size` measures `@texuli/primitives/slider` at **4,257 B gzip**
(2026-10-24): 161 B over the 4 KiB default for a primitive and the task's
≤ 4 KB target, within the slider's own 4,608 B budget. `Slider.Tick`
accounts for 221 B. It was kept in the entry, as one of the slider's parts,
instead of being split onto its own subpath.

## Limits

- No thumb or tick labels (Bits' `ThumbLabel` and `TickLabel`): render text
  next to the parts.
- A drag stops at the neighboring thumb instead of swapping thumbs.
- `tickItems` is empty for scales of more than 100 steps.
- The start values for form reset are read once, when the slider is created.
