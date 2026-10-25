<script lang="ts">
// Toolbar scenario: @texuli/primitives' Toolbar, held to the WAI-ARIA APG
// toolbar pattern.
import { Toolbar } from '@texuli/primitives/toolbar';
import { behaviorEvent } from '../../harness/client/events.ts';

let styles = $state<string[]>([]);
let align = $state('left');
</script>

<div class="stack">
  <Toolbar.Root aria-label="Formatting" class="bar">
    <Toolbar.Group type="multiple" aria-label="Text style" bind:value={styles} onValueChange={(v) => behaviorEvent('styles', v)}>
      <Toolbar.GroupItem value="bold" class="item">Bold</Toolbar.GroupItem>
      <Toolbar.GroupItem value="italic" class="item">Italic</Toolbar.GroupItem>
    </Toolbar.Group>
    <Toolbar.Separator class="sep" />
    <Toolbar.Group type="single" aria-label="Alignment" bind:value={align} onValueChange={(v) => behaviorEvent('align', v)}>
      <Toolbar.GroupItem value="left" class="item">Left</Toolbar.GroupItem>
      <Toolbar.GroupItem value="center" class="item">Center</Toolbar.GroupItem>
      <Toolbar.GroupItem value="right" disabled class="item">Right</Toolbar.GroupItem>
    </Toolbar.Group>
    <Toolbar.Separator class="sep" />
    <Toolbar.Button class="item" onclick={() => behaviorEvent('save')}>Save</Toolbar.Button>
    <Toolbar.Button class="item" disabled onclick={() => behaviorEvent('publish')}>Publish</Toolbar.Button>
    <Toolbar.Link class="item" href="https://example.com/help">Help</Toolbar.Link>
  </Toolbar.Root>

  <Toolbar.Root aria-label="Zoom" orientation="vertical" class="bar bar--vertical">
    <Toolbar.Button class="item" onclick={() => behaviorEvent('zoom', 'in')}>Zoom in</Toolbar.Button>
    <Toolbar.Button class="item" onclick={() => behaviorEvent('zoom', 'out')}>Zoom out</Toolbar.Button>
  </Toolbar.Root>

  <div dir="rtl" lang="ar">
    <Toolbar.Root aria-label="أدوات" class="bar">
      <Toolbar.Button class="item">نسخ</Toolbar.Button>
      <Toolbar.Button class="item">لصق</Toolbar.Button>
    </Toolbar.Root>
  </div>
</div>

<style>
  .stack {
    display: grid;
    gap: 1rem;
  }
  :global(.bar) {
    display: flex;
    flex-wrap: wrap;
    gap: 0.25rem;
    align-items: center;
    padding: 0.25rem;
    border: 1px solid CanvasText;
  }
  :global(.bar--vertical) {
    flex-direction: column;
    align-items: stretch;
    inline-size: max-content;
  }
  :global(.item) {
    min-block-size: 2.75rem;
    min-inline-size: 2.75rem;
    padding-inline: 0.75rem;
    border: 1px solid CanvasText;
    background: Canvas;
    color: CanvasText;
    font: inherit;
  }
  :global(.item[data-state='on']) {
    background: CanvasText;
    color: Canvas;
  }
  :global(.item[aria-disabled='true']) {
    opacity: 0.6;
  }
  :global(.item:focus-visible) {
    outline: 2px solid Highlight;
    outline-offset: 2px;
  }
  :global(a.item) {
    display: inline-flex;
    align-items: center;
    color: LinkText;
  }
  :global(.sep) {
    align-self: stretch;
    inline-size: 1px;
    background: CanvasText;
  }
</style>
