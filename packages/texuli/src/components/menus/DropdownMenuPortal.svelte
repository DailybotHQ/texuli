<script lang="ts">
import { Portal as Primitive } from '@texuli/primitives/menu';
import type { ComponentProps, Snippet } from 'svelte';

type Props = ComponentProps<typeof Primitive> & { children?: Snippet };
let { children, ...rest }: Props = $props();
</script>

<Primitive {...rest}>{@render children?.()}</Primitive>
