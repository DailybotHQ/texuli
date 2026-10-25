<script lang="ts">
// Sheet, Drawer, Panel and ResponsiveModal scenario, held to the WAI-ARIA APG
// dialog pattern.
import { Drawer, Panel, ResponsiveModal, Sheet } from '@texuli/primitives/sheet';
import { behaviorEvent } from '../../harness/client/events.ts';

let snap = $state<number>();
</script>

<div class="actions">
  <Sheet.Root onOpenChange={(open) => behaviorEvent('sheet', open)}>
    <Sheet.Trigger>Open filters</Sheet.Trigger>
    <Sheet.Portal>
      <Sheet.Overlay class="backdrop" />
      <Sheet.Content side="start" class="surface">
        <Sheet.Title>Filters</Sheet.Title>
        <Sheet.Description>Narrow the fictional orders.</Sheet.Description>
        <label>Customer <input name="customer" /></label>
        <Sheet.Close>Apply</Sheet.Close>
      </Sheet.Content>
    </Sheet.Portal>
  </Sheet.Root>

  <Drawer.Root onOpenChange={(open) => behaviorEvent('drawer', open)}>
    <Drawer.Trigger>Open cart</Drawer.Trigger>
    <Drawer.Portal>
      <Drawer.Overlay class="backdrop" />
      <Drawer.Content class="surface surface--bottom" snapPoints={[0.5, 1]} bind:activeSnapPoint={snap}>
        <Drawer.Handle class="grip" label="Resize cart" />
        <Drawer.Title>Cart</Drawer.Title>
        <Drawer.Description>Two fictional items.</Drawer.Description>
        <Drawer.Close>Checkout</Drawer.Close>
      </Drawer.Content>
    </Drawer.Portal>
  </Drawer.Root>

  <Panel.Root onOpenChange={(open) => behaviorEvent('panel', open)}>
    <Panel.Trigger>Show details</Panel.Trigger>
    <Panel.Portal>
      <Panel.Content class="surface surface--right">
        <Panel.Title>Order details</Panel.Title>
        <Panel.Description>Order orbit-001.</Panel.Description>
        <button type="button">Copy id</button>
        <Panel.Close>Close details</Panel.Close>
      </Panel.Content>
    </Panel.Portal>
  </Panel.Root>

  <ResponsiveModal.Root onOpenChange={(open) => behaviorEvent('share', open)}>
    <ResponsiveModal.Trigger>Share</ResponsiveModal.Trigger>
    <ResponsiveModal.Portal>
      <ResponsiveModal.Overlay class="backdrop" />
      <ResponsiveModal.Content class="surface surface--responsive">
        <ResponsiveModal.Handle class="grip" />
        <ResponsiveModal.Title>Share order</ResponsiveModal.Title>
        <ResponsiveModal.Description>Send a fictional link.</ResponsiveModal.Description>
        <ResponsiveModal.Close>Done</ResponsiveModal.Close>
      </ResponsiveModal.Content>
    </ResponsiveModal.Portal>
  </ResponsiveModal.Root>

  <button type="button" onclick={() => behaviorEvent('page')}>Page action</button>

  <!-- Non-modal panels that opt in to dismissal (FIX-sheet-dismiss-outside),
       after Page action so they never push it under an open panel. -->
  <Panel.Root onOpenChange={(open) => behaviorEvent('notes', open)}>
    <Panel.Trigger>Show notes</Panel.Trigger>
    <Panel.Portal>
      <Panel.Content class="surface surface--right" dismissOutside>
        <Panel.Title>Order notes</Panel.Title>
        <Panel.Description>Closes on an outside press or focus.</Panel.Description>
        <button type="button">Pin note</button>
      </Panel.Content>
    </Panel.Portal>
  </Panel.Root>

  <Panel.Root onOpenChange={(open) => behaviorEvent('log', open)}>
    <Panel.Trigger>Show log</Panel.Trigger>
    <Panel.Portal>
      <Panel.Content class="surface surface--right" closeOnEscape>
        <Panel.Title>Order log</Panel.Title>
        <Panel.Description>Closes on Escape anywhere.</Panel.Description>
        <button type="button">Copy log</button>
      </Panel.Content>
    </Panel.Portal>
  </Panel.Root>
</div>

<style>
  .actions {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
  }
  :global(.backdrop) {
    background: rgb(0 0 0 / 0.4);
  }
  :global(.surface) {
    position: fixed;
    margin: 0;
    display: grid;
    align-content: start;
    gap: 0.75rem;
    padding: 1.5rem;
    border: 1px solid CanvasText;
    background: Canvas;
    color: CanvasText;
    transition: transform 150ms ease-out;
  }
  :global(.surface[data-dragging]) {
    transition: none;
  }
  :global(.surface[data-side='left']),
  :global(.surface[data-side='right']) {
    inset-inline: auto;
  }
  :global(.surface[data-side='left'][dir='ltr']) {
    inset-block: 0;
    inset-inline-start: 0;
    inline-size: min(20rem, 85vw);
    block-size: auto;
  }
  :global(.surface[data-side='left'][dir='rtl']) {
    inset-block: 0;
    inset-inline-end: 0;
    inline-size: min(20rem, 85vw);
    block-size: auto;
  }
  :global(.surface[data-side='right'][dir='ltr']) {
    inset-block: 0;
    inset-inline-end: 0;
    inline-size: min(20rem, 85vw);
    block-size: auto;
  }
  :global(.surface[data-side='right'][dir='rtl']) {
    inset-block: 0;
    inset-inline-start: 0;
    inline-size: min(20rem, 85vw);
    block-size: auto;
  }
  :global(.surface--bottom),
  :global(.surface--responsive[data-side='bottom']) {
    inset-block-start: auto;
    inset-inline: 0;
    inset-block-end: 0;
    inline-size: auto;
    block-size: 70vh;
  }
  :global(.surface--responsive[data-side='center']) {
    inset-block-start: 20%;
    inset-inline-start: 50%;
    translate: -50% 0;
  }
  :global(.grip) {
    justify-self: center;
    inline-size: 4rem;
    block-size: 1.5rem;
    border: 1px solid CanvasText;
    border-radius: 999px;
    background: Canvas;
  }
  @media (prefers-reduced-motion: reduce) {
    :global(.surface) {
      transition: none;
    }
  }
</style>
