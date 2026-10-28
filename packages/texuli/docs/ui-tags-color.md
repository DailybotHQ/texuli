# TagsInput and ColorPicker

**Package:** `texuli` · **Import:** `texuli/tags-color`

Styled tags field and color picker on owned primitives
(`@texuli/primitives/tags-input`, `@texuli/primitives/color-picker`).

| Export | Role |
| --- | --- |
| `TagsInput` | Chip field: type/paste tags, remove chips, live announcements |
| `ColorPicker` | OKLCH area, hue/alpha sliders, format field, preset swatches |

## TagsInput

```svelte
<script lang="ts">
  import { TagsInput } from 'texuli/tags-color';
  let topics = $state(['design', 'research']);
</script>

<TagsInput bind:value={topics} label="Topics" inputLabel="Add a topic" max={8} />
```

Supports delimiter (default `,`), paste split, blur-add, duplicates policy,
`max`, and `validate`. Each refused tag fires `onInvalid({ tag, reason,
message? })` with `reason` `'duplicate'`, `'max'` or `'invalid'` (refused by
`validate`; a returned string is `message`), and the draft stays for
correction.

The draft text is bindable: `bind:inputValue` reads and writes it (cleared
once it becomes tags), and `onInputValueChange(value)` reports every change
the input makes (typing and clearing).

## ColorPicker

```svelte
<script lang="ts">
  import { ColorPicker } from 'texuli/tags-color';
  let brand = $state('#3b82f6');
</script>

<ColorPicker bind:value={brand} label="Brand color" />
```

- `format`: `hex` | `rgb` | `hsl` | `oklch` (bindable)
- `swatches`: optional preset list (`{ value, label }[]`); pass `[]` to hide
- Area is keyboard-operable (arrows, Home, End)

## Styles

`@layer tx.components` in `tags-color.css`. Logical properties. Forced-colors borders on chips and swatches.
