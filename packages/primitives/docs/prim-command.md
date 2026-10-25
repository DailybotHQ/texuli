# Command

`@texuli/primitives/command` exports a headless, keyboard-first command list for
search palettes and grouped action menus. Compose `Command.Root`, `Input`,
`List`, `Group`, `GroupHeading`, `GroupItems`, `Item`, `Empty`, and `Loading`
with snippets. It does not open a dialog; combine it with the dialog primitive
when a modal palette is needed.

```svelte
<script lang="ts">
import { Command } from '@texuli/primitives/command';

function runCommand(value: string): void {
  console.info(value);
}
</script>

<Command.Root label="Search commands" onSelect={(value) => runCommand(value)}>
  <Command.Input placeholder="Search actions" />
  <Command.List>
    <Command.Loading>Searching…</Command.Loading>
    <Command.Empty>No matching actions</Command.Empty>
    <Command.Group value="Workspace">
      <Command.GroupHeading>Workspace</Command.GroupHeading>
      <Command.GroupItems>
        <Command.Item value="open-settings" keywords={['preferences']}>
          Open settings
        </Command.Item>
      </Command.GroupItems>
    </Command.Group>
  </Command.List>
</Command.Root>
```

The root filters item labels and optional `keywords` using case-insensitive
substring scoring (exact match, prefix, then substring). `shouldFilter={false}`
leaves result visibility to the caller. `onSearch` optionally starts a debounced
async search; the list reports `aria-busy`, `Command.Loading` is exposed while
the latest request is pending, and stale request completions cannot clear the
latest loading state. The host controls its own dynamic item snippets and can
render `Command.Empty` for a zero-result state.

Arrow Up and Down move the active option, wrapping by default (`loop={false}`
clamps at either end), and Enter selects the active enabled item. `onSelect`
receives its value; an item-level `onSelect` can handle an individual action.
The input is a named combobox, the result container is a listbox, and groups
and options expose their accessible roles and state attributes. Styling and
dialog behavior are deliberately left to the consuming interface.

## Input attributes

`Command.Input` is typed as the native input attributes (`maxlength`, `placeholder`, `spellcheck`, `inputmode`, `enterkeyhint`, `name`…) except the ones the part owns: `role`, `value`, `oninput`, `onkeydown`, `autocomplete` and the combobox ARIA (`aria-autocomplete`, `aria-expanded`, `aria-controls`, `aria-activedescendant`). Use `value` / `onValueChange` for the query. The type is exported as `CommandInputProps`.

