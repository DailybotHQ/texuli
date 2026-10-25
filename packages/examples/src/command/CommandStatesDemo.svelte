<script lang="ts">
import { Command } from 'texuli/command';

let query = $state('zzzz');
</script>

<section data-example="ui-command-states" aria-labelledby="command-states-title">
  <h2 id="command-states-title">Command states</h2>
  <h3>Empty</h3>
  <Command.Root label="Empty search">
    <Command.Input bind:value={query} placeholder="Search…" showEscHint={false} />
    <Command.List>
      <Command.Empty>No matching actions</Command.Empty>
      <Command.Group value="Actions">
        <Command.GroupHeading>Actions</Command.GroupHeading>
        <Command.GroupItems>
          <Command.Item value="create-task">Create task</Command.Item>
        </Command.GroupItems>
      </Command.Group>
    </Command.List>
  </Command.Root>

  <h3>Disabled item</h3>
  <Command.Root label="Disabled item list" shouldFilter={false}>
    <Command.Input placeholder="Browse…" showEscHint={false} />
    <Command.List>
      <Command.Group value="Actions">
        <Command.GroupHeading>Actions</Command.GroupHeading>
        <Command.GroupItems>
          <Command.Item value="create-task">Create task</Command.Item>
          <Command.Item value="archive" disabled description="Requires admin">
            Archive workspace
          </Command.Item>
        </Command.GroupItems>
      </Command.Group>
    </Command.List>
  </Command.Root>

  <h3>Trigger</h3>
  <Command.Trigger label="Search commands…" keys={['⌘', 'K']} />
</section>

<style>
  h3 {
    margin-block: 1.25rem 0.5rem;
    font-size: var(--tx-font-size-sm, 0.875rem);
    color: var(--tx-muted-foreground, GrayText);
  }
  section {
    color: var(--tx-foreground, CanvasText);
  }
</style>
