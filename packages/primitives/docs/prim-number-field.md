# Primitive: NumberField

**Package:** `@texuli/primitives` · **Path:** `src/number-field/` · **Subpath:**
`@texuli/primitives/number-field` · **Task:** T-prim-number-field

A headless, locale-aware number input with steppers, following the WAI-ARIA
Authoring Practices **spinbutton** pattern. Owned code, checked by its
behavior scenario.

```svelte
<script lang="ts">
import { Label } from '@texuli/primitives/label';
import { NumberField } from '@texuli/primitives/number-field';

let price = $state<number | null>(1234.5);
</script>

<Label.Root for="price-input">Price</Label.Root>
<NumberField.Root
  id="price"
  bind:value={price}
  locale="de-DE"
  step={0.01}
  min={0}
  formatOptions={{ style: 'currency', currency: 'EUR' }}
  name="price"
>
  <NumberField.Decrement />
  <NumberField.Input />
  <NumberField.Increment />
</NumberField.Root>
```

## Parts

**`NumberField.Root`** owns the value (`number | null`; `null` is an empty
field) and the context. It has no role and sets `data-disabled`,
`data-readonly`, `data-required` and `data-empty`. Props:

- `value` (bindable), `defaultValue`, `onValueChange`;
- `min`, `max`, `step` (default 1), `largeStep` (default `step × 10`),
  `snapOnStep`;
- `locale`, `formatOptions` (any `Intl.NumberFormatOptions`);
- `disabled`, `readOnly`, `required`;
- `allowWheel`;
- `name`, `form`;
- `id` (the input gets `<id>-input`);
- `incrementLabel` and `decrementLabel` (translatable, default "Increase"
  and "Decrease").

**`NumberField.Input`** is the spinbutton: `<input type="text"
role="spinbutton">`.
- Sets `aria-valuenow`, `aria-valuemin`, `aria-valuemax` and
  `aria-valuetext` (the formatted value).
- An empty field has no `aria-valuenow` or `aria-valuetext`.
- `inputmode` is `numeric` for whole numbers ≥ 0, else `decimal`.
- `autocomplete` and `autocorrect` are off, with no spellcheck.
- Name it with a label `for` its id, or with `aria-label`.

**`NumberField.Increment`** and **`NumberField.Decrement`** are steppers:
`<button type="button" tabindex="-1">` with `aria-label`, `aria-controls`
the input, and `disabled` (plus `data-disabled`) at the bound. They set
`data-pressed` while held, and `touch-action: manipulation`.

Every part accepts a `child` snippet that receives `props` to spread on any
element. For the input, the spread props carry a Svelte attachment, so a
custom `<input>` registers itself for focus and the form bridge.

## Behavior

**Keyboard** (on the input, APG):

| Key | Action |
| --- | --- |
| ArrowUp / ArrowDown | ± `step`. Off the grid, the first press lands on the grid in that direction (1.5 → 2 or 1). An empty field starts at `min` (or 0), within range. |
| PageUp / PageDown | ± `largeStep` from the value, snapped to the `step` grid, clamped |
| Home / End | `min` / `max`; left alone when the bound is undefined |
| Enter | Commit the typed text |
| With Alt, Ctrl or Meta, or during IME composition | Ignored |

**Typing.** Edits are a draft; Enter or blur commits. The draft is parsed
**for the locale and options**, then clamped, and snapped to the grid with
`snapOnStep`. Text that does not parse reverts, and an empty field commits
`null`. A keystroke that cannot lead to a number (`beforeinput`) is refused.
Partial text such as `-`, `12.` or `1,` is allowed.

**Parsing** (`parseNumber`, the inverse of `Intl.NumberFormat` for the same
locale and options). Symbols come from `formatToParts`, so it follows the
locale:

- grouping, optional and lenient: `1234,5` and `1.234,5` in de-DE, lakh
  grouping in en-IN;
- the decimal mark;
- localized digits (Arabic-Indic in ar-EG);
- minus in its common forms, `+`, and accounting `(12.5)`;
- currency, percent (divided by 100, as `Intl` multiplies) and unit text;
- RTL direction marks stripped, written as `\u` escapes in the source.

**Steppers**
- **Press:** one step on press; held, a step every 60 ms after 400 ms,
  stopping at the bound or on release, cancel or lost capture.
- **Mouse press** moves focus to the input.
- **Touch** does not, so no on-screen keyboard pops up.
- **Assistive-technology activation** (a click without a pointer press)
  steps once, and a pointer click after a press does not step twice.
- **Wheel:** with `allowWheel`, steps only while the input is focused.

**Forms.** With `name`, the **number** (not the formatted text) is
submitted through `createFormBridge` from `@texuli/core/form-bridge`. The
bridge input sits after the visible input, which has no `name`. Native form
reset restores the default value, and `required` takes part in validation.

**Disabled / read-only:** no stepping or editing; the steppers are
disabled, and the input is `disabled` or `readonly`.

**Exported helpers** (framework-free): `parseNumber`, `formatNumber`,
`numberFormatter`, `isPartialNumber`, `stepNumber`, `largeStepNumber`,
`snapToStep`, `clampNumber`, `roundToPrecision`, `decimalPlaces`,
`inputModeFor`, `createPressRepeat`. Stepping is free of float noise: three
0.1 steps give 0.3.

## Verified

- **Unit tests:** `pnpm vitest run packages/primitives/tests/models.test.ts packages/primitives/tests/forms.test.ts`,
  10 tests (`-t number-field`):
  - round trips in en-US, de-DE, fr-FR, ar-EG, en-IN, ja-JP and de-CH,
    plus currency and percent; typed variants;
  - stepping math on the grid without float noise, PageUp/PageDown;
  - the component: revert and empty, refused keystrokes, mouse vs touch
    focus, hold-to-repeat and AT clicks, the wheel, and form submission
    and reset.
- **Browser:** `pnpm exec playwright test tests/behavior/scenarios/number-field.spec.ts`,
  6 tests on chromium, webkit and Pixel 7 (15 passed; the mouse and touch
  tests skip on the other kind of project by design):
  - the APG keys, and Tab skipping the steppers;
  - de-DE currency typing with refused letters and revert;
  - mouse click and hold-to-repeat, focus kept in the field;
  - touch taps with no focus moved (no keyboard);
  - the form submitting raw numbers;
  - axe clean at rest and at a bound.

  Mutation checks: forcing focus on touch presses fails the touch test;
  making the steppers tabbable fails the keyboard test.

## Size (gzip)

`pnpm size` for `@texuli/primitives/number-field` is **5.70 KiB** (2026-10-24),
within its own 6 KiB budget but **over the default 4 KiB cap and the task's
4 KB budget.** The breakdown, measured separately when it landed (the form
bridge is 0.58 KiB today):

| Piece | Size |
| --- | --- |
| Locale parser and formatter (`number.ts`) | 1.48 KiB |
| Native form bridge (`@texuli/core/form-bridge`) | 0.53 KiB |
| The `child` composition helper | 0.35 KiB |
| Press-repeat | 0.28 KiB |
| The five Svelte parts | ~3.0 KiB |

## Limits

- **Lenient grouping:** a misplaced group separator is accepted
  (`1.2.3` reads as 123 in de-DE) rather than rejected.
- **No scientific notation or compact input** (`1e3`, `1K`); they are
  refused while typing.
- **The value is a JavaScript `number`:** very large or very precise
  decimals are subject to float limits. For money, keep integer cents in
  your model and convert to and from the field's decimal value at that
  boundary; stepping by `0.01` stays exact thanks to precision rounding.
- **Stepper glyphs** are `+` and `−` by default (`aria-hidden`); pass
  children for icons.
