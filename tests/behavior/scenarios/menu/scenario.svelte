<script lang="ts">
// Menu scenario: @texuli/primitives/menu with items, checkbox and radio items and a submenu.
import * as Menu from '@texuli/primitives/menu';
import { behaviorEvent } from '../../harness/client/events.ts';

let open = $state(false);
let grid = $state(false);
let density = $state('comfortable');
</script>

<Menu.Root bind:open onOpenChange={(next) => behaviorEvent('openChange', next)}>
  <Menu.Trigger>View</Menu.Trigger>
  <Menu.Portal>
    <Menu.Content class="behavior-menu" data-behavior-layer sideOffset={4}>
      <Menu.Item textValue="New file" onSelect={() => behaviorEvent('select', 'new')}>New file</Menu.Item>
      <Menu.Sub>
        <Menu.SubTrigger textValue="Export">Export</Menu.SubTrigger>
        <Menu.SubContent class="behavior-menu" data-behavior-sublayer>
          <Menu.Item textValue="PNG" onSelect={() => behaviorEvent('select', 'png')}>PNG</Menu.Item>
          <Menu.Item textValue="SVG" onSelect={() => behaviorEvent('select', 'svg')}>SVG</Menu.Item>
          <Menu.Item textValue="WebM" onSelect={() => behaviorEvent('select', 'webm')}>WebM</Menu.Item>
        </Menu.SubContent>
      </Menu.Sub>
      <Menu.CheckboxItem
        textValue="Show grid"
        bind:checked={grid}
        closeOnSelect={false}
        onCheckedChange={(next) => behaviorEvent('checked', next)}
      >
        Show grid
      </Menu.CheckboxItem>
      <Menu.Separator />
      <Menu.RadioGroup bind:value={density} onValueChange={(next) => behaviorEvent('density', next)}>
        <Menu.GroupHeading>Density</Menu.GroupHeading>
        <Menu.RadioItem value="compact" textValue="Compact" closeOnSelect={false}>Compact</Menu.RadioItem>
        <Menu.RadioItem value="comfortable" textValue="Comfortable" closeOnSelect={false}>Comfortable</Menu.RadioItem>
        <Menu.RadioItem value="spacious" textValue="Spacious" closeOnSelect={false}>Spacious</Menu.RadioItem>
      </Menu.RadioGroup>
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
  :global(.behavior-menu [role^='menuitem']) {
    padding: 0.375rem 0.5rem;
  }
</style>
