<script lang="ts">
import type { ComponentProps } from 'svelte';
import AlertSurface from './AlertSurface.svelte';

/** Full-width page or section banner. */
type Props = Omit<ComponentProps<typeof AlertSurface>, 'layout'>;

let { ref = $bindable(null), ...rest }: Props = $props();
</script>

<AlertSurface layout="banner" bind:ref {...rest} />
