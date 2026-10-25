<script lang="ts">
import { Portal as PrimitivePortal } from '@texuli/primitives/select';
import type { Snippet } from 'svelte';

let { children }: { children?: Snippet } = $props();
</script>

<PrimitivePortal>
  {@render children?.()}
</PrimitivePortal>
