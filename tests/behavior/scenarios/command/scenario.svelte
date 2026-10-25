<script lang="ts">
import { Command } from '@texuli/primitives/command';
import { behaviorEvent } from '../../harness/client/events.ts';
</script>

<Command.Root label="Search commands" loop onSelect={(value) => behaviorEvent('select', value === 'Open inbox' ? 'inbox' : value === 'Open settings' ? 'settings' : 'task')}>
  <Command.Input placeholder="Type a command" />
  <Command.List>
    <Command.Empty>No results</Command.Empty>
    <Command.Group value="Navigation">
      <Command.GroupHeading>Navigation</Command.GroupHeading>
      <Command.GroupItems>
        <Command.Item value="Open inbox">Open inbox</Command.Item>
        <Command.Item value="Open settings">Open settings</Command.Item>
      </Command.GroupItems>
    </Command.Group>
    <Command.Group value="Actions">
      <Command.GroupHeading>Actions</Command.GroupHeading>
      <Command.GroupItems>
        <Command.Item value="Create task">Create task</Command.Item>
      </Command.GroupItems>
    </Command.Group>
  </Command.List>
</Command.Root>

<style>
  :global([data-command-root]) {
    display: grid;
    gap: 0.5rem;
    max-inline-size: 20rem;
  }
</style>
