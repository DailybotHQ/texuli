<script lang="ts">
import type { HTMLAttributes } from 'svelte/elements';
import type { RefProp } from '../internal/ref.ts';
import { separatorAttributes } from '../separator/attributes.ts';
import { toolbarContext } from './context.ts';

type Props = RefProp & Omit<HTMLAttributes<HTMLDivElement>, 'role' | 'children'>;

let { ref = $bindable(null), ...rest }: Props = $props();
const toolbar = toolbarContext.get();
// A separator runs across the toolbar: vertical in a horizontal toolbar.
const attrs = $derived(
  separatorAttributes({
    orientation: toolbar.orientation === 'horizontal' ? 'vertical' : 'horizontal',
  })
);
</script>

<div bind:this={ref} {...rest} {...attrs} data-toolbar-separator=""></div>
