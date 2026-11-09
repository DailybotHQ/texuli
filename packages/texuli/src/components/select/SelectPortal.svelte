<script lang="ts">
import { Portal as PrimitivePortal } from '@texuli/primitives/select';
import type { Snippet } from 'svelte';

let { children }: { children?: Snippet } = $props();
</script>

<span class="tx-select-portal" data-tx-component="select-portal">
  <PrimitivePortal>{@render children?.()}</PrimitivePortal>
</span>
