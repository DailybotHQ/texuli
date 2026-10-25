<script lang="ts">
import type { HTMLAttributes } from 'svelte/elements';

let { ...rest }: HTMLAttributes<HTMLDivElement> = $props();
</script>

<div {...rest} role="separator" aria-orientation="horizontal"></div>
