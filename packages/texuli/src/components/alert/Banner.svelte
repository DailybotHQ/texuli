<script lang="ts">
import type { ComponentProps } from 'svelte';
import AlertSurface from './AlertSurface.svelte';

/** Full-width page or section banner. */
type Props = Omit<ComponentProps<typeof AlertSurface>, 'layout'>;

let { ...rest }: Props = $props();
</script>

<AlertSurface layout="banner" {...rest} />
