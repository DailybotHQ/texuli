<script lang="ts">
import { ContextMenu } from '../src/context-menu/index.ts';

interface Props {
  open?: boolean;
  disabled?: boolean;
  log?: string[];
}
let { open = $bindable(false), disabled = false, log = [] }: Props = $props();
let snap = $state(true);
</script>

<main>
  <button type="button">Before</button>
  <ContextMenu.Root bind:open>
    <ContextMenu.Trigger {disabled} data-testid="region">
      Canvas
      <button type="button">Selected shape</button>
    </ContextMenu.Trigger>
    <ContextMenu.Content>
      <ContextMenu.Item onSelect={() => log.push('cut')}>Cut</ContextMenu.Item>
      <ContextMenu.Item onSelect={() => log.push('copy')}>Copy</ContextMenu.Item>
      <ContextMenu.Item disabled>Paste</ContextMenu.Item>
      <ContextMenu.CheckboxItem bind:checked={snap}>Snap to grid</ContextMenu.CheckboxItem>
      <ContextMenu.Sub>
        <ContextMenu.SubTrigger>Share</ContextMenu.SubTrigger>
        <ContextMenu.SubContent>
          <ContextMenu.Item onSelect={() => log.push('link')}>Copy link</ContextMenu.Item>
        </ContextMenu.SubContent>
      </ContextMenu.Sub>
    </ContextMenu.Content>
  </ContextMenu.Root>
  <button type="button">Outside</button>
</main>
