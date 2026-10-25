# Listbox

`@texuli/primitives/listbox` provides a headless, keyboard-operable listbox
with single or multiple selection. The root owns selection, active descendant,
keyboard navigation and typeahead. Options expose `role="option"`,
`aria-selected`, disabled state and `data-state` for consumer styling.

```svelte
<script lang="ts">
import { ListboxOption, ListboxRoot } from '@texuli/primitives/listbox';

const colors = [
  { value: 'amber', label: 'Amber' },
  { value: 'blue', label: 'Blue' },
  { value: 'jade', label: 'Jade' },
];
let value = $state('amber');
</script>

<ListboxRoot aria-label="Colors" items={colors} bind:value>
  {#each colors as color (color.value)}
    <ListboxOption value={color.value} label={color.label}>
      {color.label}
    </ListboxOption>
  {/each}
</ListboxRoot>
```

Set `multiple` to bind a string array and let Space or pointer activation toggle
individual choices. In single mode, moving the active option selects it. Arrow
keys skip disabled items; Home/End move to the first or last enabled item, and
typing searches option labels. `disabled` on the root disables the full list.

For large collections, pass the complete ordered `items` array while rendering
only the visible `ListboxOption` rows. The root uses the full collection for
keyboard order and calls `onActiveChange(value, index)` so a virtualizer can
scroll the active row into view. The active option id is derived from the root
id and option value; keep values unique within a listbox.

`defaultValue` initializes uncontrolled selection. Bind `value` for controlled
selection; `onValueChange` reports the selected string or string array.
`ListboxOption` also accepts a `child` snippet and passes its root props for
custom element composition. The primitive adds no visual theme or colors.
