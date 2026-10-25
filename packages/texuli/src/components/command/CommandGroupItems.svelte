<script lang="ts">
import { GroupItems as PrimitiveItems } from '@texuli/primitives/command';
import type { Snippet } from 'svelte';

type Props = { children?: Snippet };
let { children }: Props = $props();
</script>

<PrimitiveItems>
  {@render children?.()}
</PrimitiveItems>
