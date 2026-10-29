<script lang="ts">
import { DetailPanel, Drawer, ResponsiveModal, Sheet } from '../../src/components/sheet/index.ts';

let {
  surface = 'sheet',
  force,
  host,
  breakpoint,
  open = $bindable(true),
}: {
  surface?: 'sheet' | 'drawer' | 'panel' | 'responsive';
  force?: 'auto' | 'dialog' | 'sheet';
  host?: Element | null;
  breakpoint?: number;
  open?: boolean;
} = $props();
</script>

{#snippet parts(P: Pick<typeof Sheet, 'Header' | 'Body' | 'Footer' | 'Close'>)}
  <P.Header title="Filters" description="Narrow the orders." closeLabel="Close filters" />
  <P.Body><p>Body copy</p></P.Body>
  <P.Footer><P.Close>Apply</P.Close></P.Footer>
{/snippet}

{#if surface === 'sheet'}
  <Sheet.Root bind:open>
    <Sheet.Portal>
      <Sheet.Content>{@render parts(Sheet)}</Sheet.Content>
    </Sheet.Portal>
  </Sheet.Root>
{:else if surface === 'drawer'}
  <Drawer.Root bind:open>
    <Drawer.Portal>
      <Drawer.Content>{@render parts(Drawer)}</Drawer.Content>
    </Drawer.Portal>
  </Drawer.Root>
{:else if surface === 'panel'}
  <DetailPanel.Root bind:open>
    <DetailPanel.Portal>
      <DetailPanel.Content>{@render parts(DetailPanel)}</DetailPanel.Content>
    </DetailPanel.Portal>
  </DetailPanel.Root>
{:else}
  <ResponsiveModal.Root bind:open>
    <ResponsiveModal.Portal>
      <ResponsiveModal.Content {force} {host} {breakpoint}>{@render parts(ResponsiveModal)}</ResponsiveModal.Content>
    </ResponsiveModal.Portal>
  </ResponsiveModal.Root>
{/if}
