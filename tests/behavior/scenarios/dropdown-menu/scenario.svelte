<script lang="ts">
// DropdownMenu scenario: @texuli/primitives/menu as a dropdown menu.
import * as Menu from '@texuli/primitives/menu';
import { behaviorEvent } from '../../harness/client/events.ts';

let open = $state(false);
</script>

<Menu.Root bind:open onOpenChange={(next) => behaviorEvent('openChange', next)}>
  <Menu.Trigger>Actions</Menu.Trigger>
  <Menu.Portal>
    <Menu.Content class="behavior-menu" data-behavior-layer sideOffset={4}>
      <Menu.Item textValue="Rename" onSelect={() => behaviorEvent('select', 'rename')}>Rename</Menu.Item>
      <Menu.Item textValue="Duplicate" onSelect={() => behaviorEvent('select', 'duplicate')}>Duplicate</Menu.Item>
      <Menu.Item textValue="Archive" disabled onSelect={() => behaviorEvent('select', 'archive')}>Archive</Menu.Item>
      <Menu.Separator />
      <Menu.Group>
        <Menu.GroupHeading>Danger zone</Menu.GroupHeading>
        <Menu.Item textValue="Delete" onSelect={() => behaviorEvent('select', 'delete')}>Delete</Menu.Item>
      </Menu.Group>
    </Menu.Content>
  </Menu.Portal>
</Menu.Root>

<style>
  :global(.behavior-menu) {
    display: grid;
    min-inline-size: 10rem;
    padding: 0.25rem;
    border: 1px solid CanvasText;
    background: Canvas;
    color: CanvasText;
  }
</style>
