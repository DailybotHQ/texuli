<script lang="ts">
import {
  Command,
  type CommandItemData,
  CommandPalette,
} from '../../src/components/command/index.ts';

interface Props {
  mode?: 'panel' | 'palette';
  open?: boolean;
  onSelect?: (value: string) => void;
  onPaletteSelect?: (item: CommandItemData) => void;
  recentItems?: readonly CommandItemData[];
  searchItems?: readonly CommandItemData[];
  size?: 'sm' | 'md' | 'lg';
  variant?: 'outline' | 'soft';
  shortcut?: boolean;
}

let {
  mode = 'panel',
  open = $bindable(false),
  onSelect,
  onPaletteSelect,
  recentItems = [
    { id: 'open-inbox', label: 'Open inbox', group: 'Navigation', keywords: ['mail'] },
    { id: 'create-task', label: 'Create task', group: 'Actions' },
  ],
  searchItems = [
    { id: 'open-settings', label: 'Open settings', group: 'Navigation', keywords: ['preferences'] },
    { id: 'invite-member', label: 'Invite member', group: 'Actions' },
    { id: 'disabled-action', label: 'Disabled action', group: 'Actions', disabled: true },
  ],
  size = 'md',
  variant = 'outline',
  shortcut = false,
}: Props = $props();

function runSearch(query: string): CommandItemData[] {
  const needle = query.toLocaleLowerCase();
  return searchItems.filter(
    (item) =>
      item.label.toLocaleLowerCase().includes(needle) ||
      item.keywords?.some((keyword) => keyword.toLocaleLowerCase().includes(needle))
  );
}
</script>

{#if mode === 'palette'}
  <Command.Trigger
    label="Search commands…"
    keys={['⌘', 'K']}
    {size}
    {variant}
    onclick={() => (open = true)}
  />
  <CommandPalette
    bind:open
    {size}
    {variant}
    {shortcut}
    {recentItems}
    search={runSearch}
    onSelect={(item) => onPaletteSelect?.(item)}
  />
{:else}
  <Command.Root label="Search commands" {size} {variant} onSelect={(value) => onSelect?.(value)}>
    <Command.Input placeholder="Type to search" />
    <Command.List>
      <Command.Empty>No results</Command.Empty>
      <Command.Group value="Navigation">
        <Command.GroupHeading>Navigation</Command.GroupHeading>
        <Command.GroupItems>
          <Command.Item value="open-inbox" keywords={['mail']}>Open inbox</Command.Item>
          <Command.Item value="open-settings">Open settings</Command.Item>
        </Command.GroupItems>
      </Command.Group>
      <Command.Group value="Actions">
        <Command.GroupHeading>Actions</Command.GroupHeading>
        <Command.GroupItems>
          <Command.Item value="create-task">Create task</Command.Item>
          <Command.Item value="disabled-action" disabled>Disabled action</Command.Item>
        </Command.GroupItems>
      </Command.Group>
    </Command.List>
  </Command.Root>
{/if}
