<script lang="ts">
import type { ComponentProps } from 'svelte';
import type { RefProp } from '../internal/ref.ts';
import SheetContent from './SheetContent.svelte';

type Props = RefProp & Omit<ComponentProps<typeof SheetContent>, 'drag' | 'modal'>;
let {
  side = 'bottom',
  activeSnapPoint = $bindable(),
  ref = $bindable(null),
  ...rest
}: Props = $props();
</script>

<!-- A modal sheet that drags toward its edge to dismiss or to change snap point. -->
<SheetContent bind:ref {...rest} {side} drag bind:activeSnapPoint />
