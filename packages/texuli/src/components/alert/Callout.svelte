<script lang="ts">
import type { ComponentProps } from 'svelte';
import AlertSurface from './AlertSurface.svelte';

/** Emphasized documentation-style callout with a strong start edge. */
type Props = Omit<ComponentProps<typeof AlertSurface>, 'layout'>;

let { ref = $bindable(null), ...rest }: Props = $props();
</script>

<AlertSurface layout="callout" bind:ref {...rest} />
