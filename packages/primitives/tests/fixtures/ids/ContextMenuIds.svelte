<script lang="ts">
import { ContextMenu } from '../../../src/context-menu/index.ts';
</script>

<ContextMenu.Root open>
  <ContextMenu.Trigger id="canvas-trigger"><p>Canvas</p></ContextMenu.Trigger>
  <ContextMenu.Content id="canvas-menu">
    <ContextMenu.Item>Cut</ContextMenu.Item>
    <ContextMenu.Item>Copy</ContextMenu.Item>
  </ContextMenu.Content>
</ContextMenu.Root>
