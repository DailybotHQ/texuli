<script lang="ts">
import { ContextMenu } from '../src/context-menu/index.ts';
import * as Menu from '../src/menu/index.ts';

interface Props {
  log?: string[];
}
let { log = [] }: Props = $props();
</script>

<Menu.Root>
  <Menu.Trigger>
    {#snippet child({ props })}
      <button {...props} class="custom-trigger">Actions</button>
    {/snippet}
  </Menu.Trigger>
  <Menu.Content>
    <Menu.Item onSelect={() => log.push('rename')}>Rename</Menu.Item>
    <Menu.Item onSelect={() => log.push('delete')}>Delete</Menu.Item>
  </Menu.Content>
</Menu.Root>

<ContextMenu.Root>
  <ContextMenu.Trigger>
    {#snippet child({ props })}
      <button {...props} type="button" class="custom-region">Canvas</button>
    {/snippet}
  </ContextMenu.Trigger>
  <ContextMenu.Content>
    <ContextMenu.Item onSelect={() => log.push('paste')}>Paste</ContextMenu.Item>
  </ContextMenu.Content>
</ContextMenu.Root>
