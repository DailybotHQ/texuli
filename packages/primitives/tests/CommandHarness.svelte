<script lang="ts">
import { Command } from '@texuli/primitives/command';
import type { CommandSearch } from '../src/command/index.ts';

interface Props {
  debounceMs?: number;
  onSearch?: CommandSearch;
  onSelect?: (value: string) => void;
}

let { debounceMs = 0, onSearch, onSelect }: Props = $props();
</script>

<Command.Root label="Search commands" {debounceMs} {onSearch} {onSelect}>
  <Command.Input placeholder="Type to search" maxlength={40} spellcheck={false} inputmode="search" />
  <Command.List>
    <Command.Loading>Searching…</Command.Loading>
    <Command.Empty>No results</Command.Empty>
    <Command.Group value="Navigation">
      <Command.GroupHeading>Navigation</Command.GroupHeading>
      <Command.GroupItems>
        <Command.Item value="Open inbox" keywords={['mail']}>Open inbox</Command.Item>
        <Command.Item value="Open settings">Open settings</Command.Item>
          <Command.Item value="Settings">Settings</Command.Item>
      </Command.GroupItems>
    </Command.Group>
    <Command.Group value="Actions">
      <Command.GroupHeading>Actions</Command.GroupHeading>
      <Command.GroupItems>
        <Command.Item value="Create task">Create task</Command.Item>
        <Command.Item value="Disabled action" disabled>Disabled action</Command.Item>
      </Command.GroupItems>
    </Command.Group>
  </Command.List>
</Command.Root>
