<script lang="ts">
import { DetailPanel, Drawer, Sheet } from '../../src/components/sheet/index.ts';

interface Props {
  dir?: 'ltr' | 'rtl';
  /** Styled Sheet as a non-modal panel (FIX-sheet-dismiss-outside). */
  sheetModal?: boolean;
  dismissOutside?: boolean;
  closeOnEscape?: boolean;
}
let { dir = 'ltr', sheetModal = true, dismissOutside, closeOnEscape }: Props = $props();
</script>

<main {dir}>
  <Sheet.Root>
    <Sheet.Trigger>Open sheet</Sheet.Trigger>
    <Sheet.Portal>
      {#if sheetModal}<Sheet.Overlay />{/if}
      <Sheet.Content modal={sheetModal} {dismissOutside} {closeOnEscape}>
        <Sheet.Title>Filters</Sheet.Title>
        <Sheet.Description>Filter the orders.</Sheet.Description>
        <Sheet.Close>Apply</Sheet.Close>
      </Sheet.Content>
    </Sheet.Portal>
  </Sheet.Root>
  <Drawer.Root>
    <Drawer.Trigger>Open drawer</Drawer.Trigger>
    <Drawer.Portal>
      <Drawer.Overlay />
      <Drawer.Content snapPoints={[0.5, 1]}>
        <Drawer.Handle label="Resize cart" />
        <Drawer.Title>Cart</Drawer.Title>
        <Drawer.Description>Two items.</Drawer.Description>
        <Drawer.Close>Close cart</Drawer.Close>
      </Drawer.Content>
    </Drawer.Portal>
  </Drawer.Root>
  <DetailPanel.Root>
    <DetailPanel.Trigger>Open details</DetailPanel.Trigger>
    <DetailPanel.Portal>
      <DetailPanel.Content {dismissOutside} {closeOnEscape}>
        <DetailPanel.Title>Order details</DetailPanel.Title>
        <DetailPanel.Description>Order orbit-001.</DetailPanel.Description>
        <DetailPanel.Close>Close details</DetailPanel.Close>
      </DetailPanel.Content>
    </DetailPanel.Portal>
  </DetailPanel.Root>
  <button type="button">Page action</button>
</main>
