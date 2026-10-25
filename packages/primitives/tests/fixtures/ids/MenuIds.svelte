<script lang="ts">
import * as Menu from '../../../src/menu/index.ts';
</script>

<Menu.Root>
  <Menu.Trigger id="view-trigger">View</Menu.Trigger>
  <Menu.Portal>
    <Menu.Content id="view-menu">
      <Menu.Item>New file</Menu.Item>
      <Menu.Group>
        <Menu.GroupHeading id="view-heading">Layout</Menu.GroupHeading>
        <Menu.Item>Grid</Menu.Item>
      </Menu.Group>
      <Menu.Sub>
        <Menu.SubTrigger id="export-trigger">Export</Menu.SubTrigger>
        <Menu.SubContent id="export-menu">
          <Menu.Item>PNG</Menu.Item>
        </Menu.SubContent>
      </Menu.Sub>
    </Menu.Content>
  </Menu.Portal>
</Menu.Root>
