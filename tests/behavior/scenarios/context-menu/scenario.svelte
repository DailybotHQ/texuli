<script lang="ts">
// ContextMenu scenario: @texuli/primitives' ContextMenu, which shares the
// Menu machinery and opens at the pointer (right click, Ctrl+click, a touch
// long press) or from the keyboard (the Menu key, Shift+F10).
import { ContextMenu } from '@texuli/primitives/context-menu';
import { behaviorEvent } from '../../harness/client/events.ts';

let snap = $state(true);
</script>

<ContextMenu.Root onOpenChange={(open) => behaviorEvent('openChange', open)}>
  <ContextMenu.Trigger class="canvas">
    <p>Canvas</p>
    <button type="button">Selected shape</button>
  </ContextMenu.Trigger>
  <ContextMenu.Content class="menu">
    <ContextMenu.Item class="item" onSelect={() => behaviorEvent('select', 'cut')}>Cut</ContextMenu.Item>
    <ContextMenu.Item class="item" onSelect={() => behaviorEvent('select', 'copy')}>Copy</ContextMenu.Item>
    <ContextMenu.Item class="item" disabled>Paste</ContextMenu.Item>
    <ContextMenu.Separator class="sep" />
    <ContextMenu.CheckboxItem class="item" bind:checked={snap}>Snap to grid</ContextMenu.CheckboxItem>
    <ContextMenu.Sub>
      <ContextMenu.SubTrigger class="item">Share</ContextMenu.SubTrigger>
      <ContextMenu.SubContent class="menu">
        <ContextMenu.Item class="item" onSelect={() => behaviorEvent('select', 'link')}>Copy link</ContextMenu.Item>
      </ContextMenu.SubContent>
    </ContextMenu.Sub>
  </ContextMenu.Content>
</ContextMenu.Root>

<style>
  :global(.canvas) {
    display: grid;
    place-content: center;
    gap: 0.5rem;
    block-size: 16rem;
    border: 2px dashed CanvasText;
    user-select: none;
  }
  :global(.menu) {
    margin: 0;
    padding: 0.25rem;
    min-inline-size: 10rem;
    border: 1px solid CanvasText;
    background: Canvas;
    color: CanvasText;
  }
  :global(.item) {
    display: block;
    padding: 0.5rem 0.75rem;
    min-block-size: 2.75rem;
    box-sizing: border-box;
  }
  :global(.item:focus) {
    outline: 2px solid Highlight;
    outline-offset: -2px;
  }
  :global(.item[aria-disabled='true']) {
    opacity: 0.6;
  }
  :global(.sep) {
    block-size: 1px;
    margin-block: 0.25rem;
    background: CanvasText;
  }
</style>
