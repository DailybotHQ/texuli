# PinInput primitive

`@texuli/primitives/pin-input` is a headless one-time-code input: one real
`<input>` drawn as a row of cells. The input does the work:
- focus, typing, paste, SMS autofill (`autocomplete="one-time-code"`);
- the mobile keyboard (`inputmode="numeric"` for digit codes);
- touch;
- assistive tech, which hears one named text field.

The cells only draw the code and are `aria-hidden`. Its parts are composed as
`PinInput.*`. Added by T-prim-pin-input.

```svelte
<script lang="ts">
  import { PinInput, REGEXP_ONLY_DIGITS } from '@texuli/primitives/pin-input';

  let code = $state('');
</script>

<label for="otp">Verification code</label>
<PinInput.Root
  bind:value={code}
  inputId="otp"
  maxlength={6}
  pattern={REGEXP_ONLY_DIGITS}
  onComplete={(value) => verify(value)}
>
  {#snippet children({ cells })}
    {#each cells as cell, index (index)}
      <PinInput.Cell {cell} />
    {/each}
  {/snippet}
</PinInput.Root>
```

## Parts

| Part | Notes |
| --- | --- |
| `Root` | Renders a container `div` and the real input. Props:<br>`bind:value`, `onValueChange`;<br>`maxlength` (1–32, default 6);<br>`pattern`, a whole-value regex source such as `REGEXP_ONLY_DIGITS`, `REGEXP_ONLY_CHARS` or `REGEXP_ONLY_DIGITS_AND_CHARS`;<br>`pasteTransformer`;<br>`onComplete(value)`;<br>`disabled`, `inputId`, `bind:inputRef`, `mask`, `class`.<br>Other attributes (`name`, `aria-label`, `form`, …) go to the input. `children` receives `{ cells, isFocused, isHovering }`. The container and input carry `data-state` (`complete` or `incomplete`); the container also has `data-disabled`. |
| `Cell` | `cell` is one of the `cells`: `{ char, isActive, hasFakeCaret }`. Renders an `aria-hidden` `div` with `data-state` (`filled` or `empty`), `data-active` and `data-fake-caret`, showing `char` unless you pass children. Supports a `child` snippet. |

The pure helpers are exported too: `acceptsValue`, `pastedValue`,
`pinCells`, `clampLength` and `MAX_PIN_LENGTH`.

## Behavior

- **Typing:** a change that breaks the pattern or the length is refused at
  once, and the code stays as it was. A code never exceeds `maxlength`.
- **Completion:** `onComplete` runs once each time the last cell is filled,
  not again for an event that changes nothing.
- **Paste:**
  - The clipboard text is cleaned: whitespace is removed by default, so
    "123 456" pastes as `123456`. A `pasteTransformer` replaces that cleanup.
  - The cleaned text replaces the selection and is cut to the length.
  - A paste that would break the pattern is refused as a whole.
- **Caret:** focus puts it at the end of the code. A click or tap puts it on
  the cell under the pointer, never past the code, and the active cell
  (`isActive`, `hasFakeCaret`) follows it.
- **Masking:** with `mask`, the cells show `•` and the input becomes
  `type="password"`, so the code is not read aloud either.
- **Style:** the input sits over the cells, transparent, with no visible caret.
  Draw focus and the caret on the cells with `data-active` and
  `data-fake-caret`.

## Size

Measured with `pnpm size` (gzip -9, Svelte external) on 2026-10-24:
**2.64 KiB** (CSS 218 B). That is within the 4 KiB `@texuli/primitives/*`
budget, but 0.14 KiB above the task's 2.5 KB design target.

## Behavior

`tests/behavior/scenarios/pin-input.spec.ts` has 10 rows, passing on
Chromium, WebKit and the Pixel 7. Among them:

| Row | Behavior |
| --- | --- |
| `paste-spaced-code` | Pasting "123 456" against the digits pattern fills `123456`. |
| `length-limit` | Typing past the end stops at the code's length (`123456`). |

The paste rows use the real system clipboard and the paste shortcut, the way
a user pastes. axe reports no violations on the component, empty or filled, in
all three projects.

## Limits

- **No per-cell overwrite:** to change a middle character, move the caret and
  delete. Once the code is full, typing does nothing until a character is
  removed.
- **`pattern` is a string source tested against the whole value.** An invalid
  regular expression accepts nothing.
