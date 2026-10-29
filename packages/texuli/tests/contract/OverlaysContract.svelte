<script lang="ts">
import type { HarnessProps } from '../../../primitives/tests/support/contract.ts';
import { AlertDialog, Dialog } from '../../src/components/dialog/index.ts';
import { HoverCard, Popover } from '../../src/components/popover/index.ts';
import { DetailPanel, Drawer, ResponsiveModal, Sheet } from '../../src/components/sheet/index.ts';
import { Tooltip } from '../../src/components/tooltip/index.ts';

let { p, refs, variant = 'popover' }: HarnessProps = $props();
const k = (name: string) => `components/${name}`;
</script>

{#if variant === 'popover'}
  <Popover.Root open>
    <Popover.Trigger {...p(k('popover/PopoverTrigger'))} bind:ref={refs[k('popover/PopoverTrigger')]}>Open</Popover.Trigger>
    <Popover.Content aria-label="Details" {...p(k('popover/PopoverContent'))} bind:ref={refs[k('popover/PopoverContent')]}>
      <Popover.Close {...p(k('popover/PopoverClose'))} bind:ref={refs[k('popover/PopoverClose')]}>Close</Popover.Close>
    </Popover.Content>
  </Popover.Root>
  <HoverCard.Root open>
    <HoverCard.Trigger {...p(k('popover/HoverCardTrigger'))} bind:ref={refs[k('popover/HoverCardTrigger')]}>Ada</HoverCard.Trigger>
    <HoverCard.Content aria-label="Profile" {...p(k('popover/HoverCardContent'))} bind:ref={refs[k('popover/HoverCardContent')]}>Card</HoverCard.Content>
  </HoverCard.Root>
  <Tooltip content="Saves the file" open {...p(k('tooltip/Tooltip'))} bind:ref={refs[k('tooltip/Tooltip')]}>
    {#snippet children({ props })}<button type="button" {...props}>Save</button>{/snippet}
  </Tooltip>
{:else if variant === 'dialog'}
  <Dialog open title="Edit" {...p(k('dialog/Dialog'))} bind:ref={refs[k('dialog/Dialog')]}>Body</Dialog>
{:else if variant === 'alert'}
  <AlertDialog open title="Delete?" {...p(k('dialog/AlertDialog'))} bind:ref={refs[k('dialog/AlertDialog')]} />
{:else if variant === 'sheet'}
  <Sheet.Root open>
    <Sheet.Portal>
      <Sheet.Overlay {...p(k('sheet/SheetOverlay'))} bind:ref={refs[k('sheet/SheetOverlay')]} />
      <Sheet.Content {...p(k('sheet/SheetContent'))} bind:ref={refs[k('sheet/SheetContent')]}>
        <Sheet.Header title="Filters" {...p(k('sheet/SheetHeader'))} bind:ref={refs[k('sheet/SheetHeader')]} />
        <Sheet.Body {...p(k('sheet/SheetBody'))} bind:ref={refs[k('sheet/SheetBody')]}>Body</Sheet.Body>
        <Sheet.Footer {...p(k('sheet/SheetFooter'))} bind:ref={refs[k('sheet/SheetFooter')]}>
          <Sheet.CloseButton {...p(k('sheet/SheetCloseButton'))} bind:ref={refs[k('sheet/SheetCloseButton')]} />
        </Sheet.Footer>
      </Sheet.Content>
    </Sheet.Portal>
  </Sheet.Root>
{:else if variant === 'drawer'}
  <Drawer.Root open>
    <Drawer.Portal>
      <Drawer.Content {...p(k('sheet/DrawerContent'))} bind:ref={refs[k('sheet/DrawerContent')]}>
        <Drawer.Header title="Filters" />
      </Drawer.Content>
    </Drawer.Portal>
  </Drawer.Root>
{:else if variant === 'panel'}
  <DetailPanel.Root open>
    <DetailPanel.Portal>
      <DetailPanel.Content {...p(k('sheet/DetailPanelContent'))} bind:ref={refs[k('sheet/DetailPanelContent')]}>
        <DetailPanel.Header title="Details" />
      </DetailPanel.Content>
    </DetailPanel.Portal>
  </DetailPanel.Root>
{:else}
  <ResponsiveModal.Root open>
    <ResponsiveModal.Portal>
      <ResponsiveModal.Content {...p(k('sheet/ResponsiveModalContent'))} bind:ref={refs[k('sheet/ResponsiveModalContent')]}>
        <ResponsiveModal.Header title="Share" />
      </ResponsiveModal.Content>
    </ResponsiveModal.Portal>
  </ResponsiveModal.Root>
{/if}
