# Command palette

**Package:** `texuli` · **Import:** `texuli/command`

Styled command list and modal palette on `@texuli/primitives/command` and
`@texuli/primitives/dialog`. Groups, filtering, recent items, and a ⌘/Ctrl+K
trigger.

## Compound `Command`

```svelte
<script lang="ts">
  import { Command } from 'texuli/command';
</script>

<Command.Root label="Search commands" onSelect={(value) => console.info(value)}>
  <Command.Input placeholder="Type to search" />
  <Command.List>
    <Command.Empty>No results</Command.Empty>
    <Command.Group value="Navigation">
      <Command.GroupHeading>Navigation</Command.GroupHeading>
      <Command.GroupItems>
        <Command.Item value="open-inbox" keywords={['mail']}>Open inbox</Command.Item>
      </Command.GroupItems>
    </Command.Group>
  </Command.List>
</Command.Root>
```

| Part | Role |
| --- | --- |
| `Root` | Filter, keyboard nav, `size` / `variant` chrome |
| `Input` | Combobox with search icon and Esc hint |
| `List` | Scrollable listbox |
| `Group` / `GroupHeading` / `GroupItems` | Grouped options |
| `Item` | Option with optional description |
| `Empty` / `Loading` | Zero-result and pending states |
| `Trigger` | Button with ⌘K keys (opens a host-controlled palette) |
| `Palette` | Modal dialog + shortcut + recent / search |

Sizes: `sm` \| `md` \| `lg`. Variants: `outline` \| `soft`.

## `CommandPalette`

```svelte
<script lang="ts">
  import { Command, CommandPalette, type CommandItemData } from 'texuli/command';

  let open = $state(false);
  const recent: CommandItemData[] = [
    { id: 'inbox', label: 'Open inbox', group: 'Navigation' },
  ];

  function search(query: string): CommandItemData[] {
    return recent.filter((item) => item.label.toLowerCase().includes(query.toLowerCase()));
  }
</script>

<Command.Trigger label="Search commands…" onclick={() => (open = true)} />
<CommandPalette
  bind:open
  recentItems={recent}
  {search}
  onSelect={(item) => console.info(item.id)}
/>
```

- Empty query shows `recentItems` under `recentLabel` (default “Recent”).
- Non-empty query calls `search` (sync or Promise) after `debounceMs`.
- ⌘/Ctrl+K toggles the palette when `shortcut` is true (default).
- Selecting an item closes the dialog and restores focus to the opener.

## Examples

`ui-command`, `ui-command-variants`, `ui-command-states`, `ui-command-rtl`,
`ui-command-dark`.
