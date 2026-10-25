<script lang="ts">
// Menubar scenario: @texuli/primitives/menubar only. File (with a Share
// submenu), Edit, a disabled Help and View.
import * as Menubar from '@texuli/primitives/menubar';
import { behaviorEvent } from '../../harness/client/events.ts';

let value = $state('');
</script>

<Menubar.Root bind:value aria-label="Application" class="behavior-menubar" onValueChange={(next) => behaviorEvent('valueChange', next)}>
  <Menubar.Menu value="file">
    <Menubar.Trigger>File</Menubar.Trigger>
    <Menubar.Portal>
      <Menubar.Content class="behavior-menu" data-behavior-layer sideOffset={4}>
        <Menubar.Item onSelect={() => behaviorEvent('select', 'new')}>New</Menubar.Item>
        <Menubar.Item onSelect={() => behaviorEvent('select', 'open')}>Open</Menubar.Item>
        <Menubar.Sub>
          <Menubar.SubTrigger>Share</Menubar.SubTrigger>
          <Menubar.SubContent class="behavior-menu">
            <Menubar.Item onSelect={() => behaviorEvent('select', 'email')}>Email</Menubar.Item>
            <Menubar.Item onSelect={() => behaviorEvent('select', 'link')}>Link</Menubar.Item>
          </Menubar.SubContent>
        </Menubar.Sub>
      </Menubar.Content>
    </Menubar.Portal>
  </Menubar.Menu>
  <Menubar.Menu value="edit">
    <Menubar.Trigger>Edit</Menubar.Trigger>
    <Menubar.Portal>
      <Menubar.Content class="behavior-menu" data-behavior-layer sideOffset={4}>
        <Menubar.Item onSelect={() => behaviorEvent('select', 'undo')}>Undo</Menubar.Item>
        <Menubar.Item onSelect={() => behaviorEvent('select', 'redo')}>Redo</Menubar.Item>
      </Menubar.Content>
    </Menubar.Portal>
  </Menubar.Menu>
  <Menubar.Menu value="help">
    <Menubar.Trigger disabled>Help</Menubar.Trigger>
    <Menubar.Portal>
      <Menubar.Content class="behavior-menu" data-behavior-layer sideOffset={4}>
        <Menubar.Item>About</Menubar.Item>
      </Menubar.Content>
    </Menubar.Portal>
  </Menubar.Menu>
  <Menubar.Menu value="view">
    <Menubar.Trigger>View</Menubar.Trigger>
    <Menubar.Portal>
      <Menubar.Content class="behavior-menu" data-behavior-layer sideOffset={4}>
        <Menubar.Item onSelect={() => behaviorEvent('select', 'zoom-in')}>Zoom in</Menubar.Item>
        <Menubar.Item onSelect={() => behaviorEvent('select', 'zoom-out')}>Zoom out</Menubar.Item>
      </Menubar.Content>
    </Menubar.Portal>
  </Menubar.Menu>
</Menubar.Root>

<style>
  :global(.behavior-menubar) {
    display: flex;
    gap: 0.25rem;
  }
  :global(.behavior-menubar [role='menuitem']) {
    min-block-size: 2rem;
    padding-inline: 0.75rem;
  }
  :global(.behavior-menu) {
    display: grid;
    min-inline-size: 10rem;
    padding: 0.25rem;
    border: 1px solid CanvasText;
    background: Canvas;
    color: CanvasText;
  }
</style>
