<script lang="ts">
// Context-bound parts rendered open, with no `variant` or `size` props, so the
// design defaults (or the built-in defaults) decide them.
import { HoverCard, Popover } from '../../src/components/popover/index.ts';
import { Select } from '../../src/components/select/index.ts';
import { DetailPanel, Drawer, ResponsiveModal, Sheet } from '../../src/components/sheet/index.ts';
import { ToggleGroup, ToggleGroupItem } from '../../src/components/toggle/index.ts';

type Mode =
  | 'popover'
  | 'hover-card'
  | 'select'
  | 'sheet'
  | 'drawer'
  | 'detail-panel'
  | 'responsive-modal'
  | 'toggle-group';

let { mode }: { mode: Mode } = $props();
const items = [{ value: 'pro', label: 'Pro' }];
</script>

{#if mode === 'popover'}
  <Popover.Root open>
    <Popover.Trigger>Open</Popover.Trigger>
    <Popover.Content aria-label="Popover">Body</Popover.Content>
  </Popover.Root>
{:else if mode === 'hover-card'}
  <HoverCard.Root open>
    <HoverCard.Trigger>Jordan</HoverCard.Trigger>
    <HoverCard.Content aria-label="Jordan">Body</HoverCard.Content>
  </HoverCard.Root>
{:else if mode === 'select'}
  <Select.Root name="plan" {items} open>
    <Select.Trigger aria-label="Plan"><Select.Value placeholder="Plan" /></Select.Trigger>
    <Select.Portal>
      <Select.Content>
        <Select.Viewport>
          <Select.Item value="pro" label="Pro">Pro</Select.Item>
        </Select.Viewport>
      </Select.Content>
    </Select.Portal>
  </Select.Root>
{:else if mode === 'sheet'}
  <Sheet.Root open>
    <Sheet.Portal>
      <Sheet.Content><Sheet.Title>Filters</Sheet.Title></Sheet.Content>
    </Sheet.Portal>
  </Sheet.Root>
{:else if mode === 'drawer'}
  <Drawer.Root open>
    <Drawer.Portal>
      <Drawer.Content><Drawer.Title>Cart</Drawer.Title></Drawer.Content>
    </Drawer.Portal>
  </Drawer.Root>
{:else if mode === 'detail-panel'}
  <DetailPanel.Root open>
    <DetailPanel.Portal>
      <DetailPanel.Content><DetailPanel.Title>Order</DetailPanel.Title></DetailPanel.Content>
    </DetailPanel.Portal>
  </DetailPanel.Root>
{:else if mode === 'toggle-group'}
  <ToggleGroup type="single" aria-label="Align">
    <ToggleGroupItem value="left" aria-label="Left">Left</ToggleGroupItem>
  </ToggleGroup>
{:else}
  <ResponsiveModal.Root open>
    <ResponsiveModal.Portal>
      <ResponsiveModal.Content><ResponsiveModal.Title>Edit</ResponsiveModal.Title></ResponsiveModal.Content>
    </ResponsiveModal.Portal>
  </ResponsiveModal.Root>
{/if}
