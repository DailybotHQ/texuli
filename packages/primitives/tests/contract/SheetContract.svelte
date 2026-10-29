<script lang="ts">
import { Drawer, Panel, ResponsiveModal, Sheet } from '../../src/sheet/index.ts';
import type { HarnessProps } from '../support/contract.ts';

let { p, refs, variant = 'sheet' }: HarnessProps = $props();
</script>

{#if variant === 'sheet'}
  <Sheet.Root open>
    <Sheet.Portal>
      <Sheet.Content side="end" {...p('sheet/SheetContent')} bind:ref={refs['sheet/SheetContent']}>
        <Sheet.Title>Filters</Sheet.Title>
      </Sheet.Content>
    </Sheet.Portal>
  </Sheet.Root>
{:else if variant === 'drawer'}
  <Drawer.Root open>
    <Drawer.Portal>
      <Drawer.Content {...p('sheet/DrawerContent')} bind:ref={refs['sheet/DrawerContent']}>
        <Drawer.Handle {...p('sheet/Handle')} bind:ref={refs['sheet/Handle']} />
        <Drawer.Title>Filters</Drawer.Title>
      </Drawer.Content>
    </Drawer.Portal>
  </Drawer.Root>
{:else if variant === 'panel'}
  <Panel.Root open>
    <Panel.Content {...p('sheet/PanelContent')} bind:ref={refs['sheet/PanelContent']}>
      <Panel.Title>Details</Panel.Title>
    </Panel.Content>
  </Panel.Root>
{:else}
  <ResponsiveModal.Root open>
    <ResponsiveModal.Portal>
      <ResponsiveModal.Content {...p('sheet/ResponsiveContent')} bind:ref={refs['sheet/ResponsiveContent']}>
        <ResponsiveModal.Title>Share</ResponsiveModal.Title>
      </ResponsiveModal.Content>
    </ResponsiveModal.Portal>
  </ResponsiveModal.Root>
{/if}
