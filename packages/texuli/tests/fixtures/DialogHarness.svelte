<script lang="ts">
import { Button } from '../../src/components/button/index.ts';
import { Dialog, type DialogSize } from '../../src/components/dialog/index.ts';

let {
  open = $bindable(false),
  title = 'Workspace settings',
  description = 'Update the Harbor Labs workspace name and timezone.',
  size = 'md' as DialogSize,
  hideClose = false,
  closeLabel = 'Close',
  withFooter = true,
  withBody = true,
}: {
  open?: boolean;
  title?: string;
  description?: string;
  size?: DialogSize;
  hideClose?: boolean;
  closeLabel?: string;
  withFooter?: boolean;
  withBody?: boolean;
} = $props();
</script>

{#snippet footer()}
  <Button variant="outline" onclick={() => (open = false)}>Cancel</Button>
  <Button onclick={() => (open = false)}>Save</Button>
{/snippet}

<Dialog
  bind:open
  {title}
  {description}
  {size}
  {hideClose}
  {closeLabel}
  footer={withFooter ? footer : undefined}
>
  {#snippet trigger({ props })}
    <Button {...props}>Open settings</Button>
  {/snippet}
  {#if withBody}
    <p>Name, region and default locale for the Harbor Labs workspace.</p>
  {/if}
</Dialog>
