<script lang="ts">
import { Portal as PrimitivePortal } from '@texuli/primitives/combobox';
import type { ComponentProps, Snippet } from 'svelte';

type Props = ComponentProps<typeof PrimitivePortal> & {
  children?: Snippet;
};

let { children, ...rest }: Props = $props();
</script>

<PrimitivePortal {...rest}>
  {@render children?.()}
</PrimitivePortal>
