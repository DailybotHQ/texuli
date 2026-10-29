<script lang="ts">
import type { HTMLAttributes } from 'svelte/elements';
import type { RefProp } from '../internal/ref.ts';

let { ref = $bindable(null), ...rest }: HTMLAttributes<HTMLDivElement> & RefProp = $props();
</script>

<div bind:this={ref} {...rest} role="separator" aria-orientation="horizontal"></div>
