<script lang="ts">
import { Badge } from '../../src/components/badge/index.ts';
import { Button } from '../../src/components/button/index.ts';
import { Kbd } from '../../src/components/kbd-code/index.ts';

let {
  component,
  label = undefined,
  text = undefined,
  loading = false,
}: {
  component: 'button' | 'badge' | 'kbd';
  label?: string;
  /** Slot text; omitted means no children snippet at all. */
  text?: string;
  loading?: boolean;
} = $props();
</script>

{#if component === 'button'}
  {#if text === undefined}
    <Button {label} {loading} />
  {:else}
    <Button {label} {loading}><em data-slot>{text}</em></Button>
  {/if}
{:else if component === 'badge'}
  {#if text === undefined}
    <Badge {label} />
  {:else}
    <Badge {label}><em data-slot>{text}</em></Badge>
  {/if}
{:else if text === undefined}
  <Kbd {label} />
{:else}
  <Kbd {label}><em data-slot>{text}</em></Kbd>
{/if}
