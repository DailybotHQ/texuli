<script lang="ts">
import type { ComponentProps } from 'svelte';
import SheetContent from './SheetContent.svelte';

type Props = Omit<ComponentProps<typeof SheetContent>, 'drag' | 'modal'>;
let { side = 'bottom', activeSnapPoint = $bindable(), ...rest }: Props = $props();
</script>

<!-- A modal sheet that drags toward its edge to dismiss or to change snap point. -->
<SheetContent {...rest} {side} drag bind:activeSnapPoint />
