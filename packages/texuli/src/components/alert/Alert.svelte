<script lang="ts">
import type { ComponentProps } from 'svelte';
import AlertSurface from './AlertSurface.svelte';

/** Inline status/alert callout (compact). */
type Props = Omit<ComponentProps<typeof AlertSurface>, 'layout'>;

let { ref = $bindable(null), ...rest }: Props = $props();
</script>

<AlertSurface layout="alert" bind:ref {...rest} />
