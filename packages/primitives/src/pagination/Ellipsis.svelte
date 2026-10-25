<script lang="ts">
import type { HTMLAttributes } from 'svelte/elements';

let { class: className, ...rest }: Omit<HTMLAttributes<HTMLSpanElement>, 'children'> = $props();
</script>

<span {...rest} aria-hidden="true" data-state="inactive" class={className}>…</span>
