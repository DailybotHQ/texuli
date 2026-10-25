<script lang="ts">
import * as MenubarPrimitive from '@texuli/primitives/menubar';
import type { ComponentProps, Snippet } from 'svelte';

type Props = ComponentProps<typeof MenubarPrimitive.Menu> & {
  children?: Snippet;
};

let { children, ...rest }: Props = $props();
</script>

<MenubarPrimitive.Menu {...rest}>{@render children?.()}</MenubarPrimitive.Menu>
