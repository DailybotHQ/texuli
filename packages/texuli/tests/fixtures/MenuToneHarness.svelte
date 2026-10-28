<script lang="ts">
import { DropdownMenu } from '../../src/components/menus/index.ts';
</script>

<DropdownMenu.Root open>
  <DropdownMenu.Trigger>Board actions</DropdownMenu.Trigger>
  <DropdownMenu.Content>
    <DropdownMenu.Item>Rename</DropdownMenu.Item>
    <DropdownMenu.Item destructive>Delete board</DropdownMenu.Item>
  </DropdownMenu.Content>
</DropdownMenu.Root>
