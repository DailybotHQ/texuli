<script lang="ts">
import { Command } from '../../../src/command/index.ts';
</script>

<label for="command-input">Search commands</label>
<Command.Root label="Commands">
  <Command.Input id="command-input" />
  <Command.List id="command-list">
    <Command.Group value="Navigation">
      <Command.GroupHeading id="nav-heading">Navigation</Command.GroupHeading>
      <Command.GroupItems>
        <Command.Item value="inbox" id="command-inbox">Open inbox</Command.Item>
        <Command.Item value="settings" id="command-settings">Open settings</Command.Item>
      </Command.GroupItems>
    </Command.Group>
  </Command.List>
</Command.Root>
