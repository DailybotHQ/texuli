<script lang="ts">
import type { Snippet } from 'svelte';
import type { HTMLAttributes } from 'svelte/elements';
import ContentImpl from './ContentImpl.svelte';
import { menuLevelContext } from './context.ts';

type Props = Omit<HTMLAttributes<HTMLDivElement>, 'children'> & {
  sideOffset?: number;
  children?: Snippet;
};

let { sideOffset = 2, children, ...rest }: Props = $props();
const level = menuLevelContext.get();
</script>

<!-- Opens toward the inline end: right-start, mirrored to left-start in RTL. -->
<ContentImpl {...rest} {level} placement="right-start" {sideOffset}>{@render children?.()}</ContentImpl>
