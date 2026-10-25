<script lang="ts">
import { Sub as Primitive } from '@texuli/primitives/menu';
import type { ComponentProps, Snippet } from 'svelte';

type Props = ComponentProps<typeof Primitive> & {
  children?: Snippet;
};

let { children, open = $bindable(false), ...rest }: Props = $props();
</script>

<Primitive bind:open {...rest}>{@render children?.()}</Primitive>
