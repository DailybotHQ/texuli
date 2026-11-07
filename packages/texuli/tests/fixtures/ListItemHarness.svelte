<script lang="ts">
import type { ComponentProps } from 'svelte';
import { ListItem } from '../../src/components/list-item/index.ts';

let { items, trailingLabel }: { items: ComponentProps<typeof ListItem>[]; trailingLabel?: string } =
  $props();
</script>

<ul role="list" class="tx-list" aria-label="Inbox">
  {#each items as item, index (index)}
    <ListItem {...item}>
      {#snippet trailing()}
        {#if trailingLabel}<button type="button">{trailingLabel}</button>{/if}
      {/snippet}
    </ListItem>
  {/each}
</ul>
