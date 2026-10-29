<script lang="ts">
// A stand-in for a host icon component (a Lucide icon, say).
let { size, ...rest }: { size?: number | string; [key: string]: unknown } = $props();
</script>

<svg data-glyph="rocket" width={size} height={size} {...rest}></svg>
