<script lang="ts">
import { Drawer, Panel, ResponsiveModal, Sheet } from '../src/sheet/index.ts';

interface Props {
  kind?: 'sheet' | 'drawer' | 'panel' | 'responsive';
  side?: 'top' | 'right' | 'bottom' | 'left' | 'start' | 'end';
  dir?: 'ltr' | 'rtl';
  snapPoints?: number[];
  activeSnapPoint?: number;
  open?: boolean;
  onSnapPointChange?: (snap: number) => void;
  dismissOutside?: boolean;
  closeOnEscape?: boolean;
}
let {
  kind = 'sheet',
  side,
  dir,
  snapPoints,
  activeSnapPoint = $bindable(),
  open = $bindable(false),
  onSnapPointChange,
  dismissOutside,
  closeOnEscape,
}: Props = $props();
let pressed = $state(0);
</script>

<main {dir}>
  {#if kind === 'sheet'}
    <Sheet.Root bind:open>
      <Sheet.Trigger>Open filters</Sheet.Trigger>
      <Sheet.Portal>
        <Sheet.Overlay />
        <Sheet.Content side={side ?? 'start'}>
          <Sheet.Title>Filters</Sheet.Title>
          <Sheet.Description>Narrow the fictional orders.</Sheet.Description>
          <button type="button">Apply</button>
          <Sheet.Close>Close</Sheet.Close>
        </Sheet.Content>
      </Sheet.Portal>
    </Sheet.Root>
  {:else if kind === 'drawer'}
    <Drawer.Root bind:open>
      <Drawer.Trigger>Open cart</Drawer.Trigger>
      <Drawer.Portal>
        <Drawer.Overlay />
        <Drawer.Content side={side ?? 'bottom'} {snapPoints} bind:activeSnapPoint {onSnapPointChange}>
          <Drawer.Handle label="Resize cart" />
          <Drawer.Title>Cart</Drawer.Title>
          <Drawer.Description>Two fictional items.</Drawer.Description>
          <input aria-label="Coupon" />
          <button type="button" onclick={() => pressed++}>Checkout</button>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  {:else if kind === 'panel'}
    <Panel.Root bind:open>
      <Panel.Trigger>Show details</Panel.Trigger>
      <Panel.Portal>
        <Panel.Content {dismissOutside} {closeOnEscape}>
          <Panel.Title>Order details</Panel.Title>
          <Panel.Description>Order orbit-001.</Panel.Description>
          <button type="button">Copy id</button>
          <Panel.Close>Close</Panel.Close>
        </Panel.Content>
      </Panel.Portal>
    </Panel.Root>
  {:else}
    <ResponsiveModal.Root bind:open>
      <ResponsiveModal.Trigger>Share</ResponsiveModal.Trigger>
      <ResponsiveModal.Portal>
        <ResponsiveModal.Overlay />
        <ResponsiveModal.Content>
          <ResponsiveModal.Title>Share</ResponsiveModal.Title>
          <ResponsiveModal.Description>Send a fictional link.</ResponsiveModal.Description>
          <ResponsiveModal.Close>Done</ResponsiveModal.Close>
        </ResponsiveModal.Content>
      </ResponsiveModal.Portal>
    </ResponsiveModal.Root>
  {/if}
  <button type="button">Page action</button>
  <output data-pressed>{pressed}</output>
</main>
