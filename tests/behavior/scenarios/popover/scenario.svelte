<script lang="ts">
// Popover scenario: a non-modal filters panel anchored below its trigger,
// and a modal share panel.

import {
  Close,
  Content,
  Root,
  Trigger,
} from '../../../../packages/primitives/src/popover/index.ts';
import { behaviorEvent } from '../../harness/client/events.ts';

let open = $state(false);
let share = $state(false);
</script>

<Root bind:open onOpenChange={(next) => behaviorEvent('openChange', next)} sideOffset={6}>
  <Trigger>Filters</Trigger>
  <Content
    class="behavior-popover"
    data-behavior-layer
    aria-label="Filter tasks"
  >
    <label>
      <input type="checkbox" name="mine" />
      Assigned to me
    </label>
    <Close>Apply</Close>
  </Content>
</Root>

<!-- A modal popover: focus is trapped inside and returns to its trigger. -->
<Root modal bind:open={share} onOpenChange={(next) => behaviorEvent('shareChange', next)} sideOffset={6}>
  <Trigger>Share</Trigger>
  <Content class="behavior-popover" data-behavior-layer aria-label="Share task">
    <label>
      Email
      <input type="email" name="email" />
    </label>
    <Close>Send</Close>
  </Content>
</Root>

<style>
  :global(.behavior-popover) {
    display: grid;
    gap: 0.5rem;
    padding: 0.75rem;
    border: 1px solid CanvasText;
    background: Canvas;
    color: CanvasText;
  }
</style>
