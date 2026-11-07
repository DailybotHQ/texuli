<script lang="ts">
import type { SVGAttributes } from 'svelte/elements';

/** A stand-in for a Lucide icon a host registers. */
let { size = 24, ...rest }: SVGAttributes<SVGSVGElement> & { size?: number | string } = $props();
</script>

<svg {...rest} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" data-zap>
  <path d="M13 2 3 14h9l-1 8 10-12h-9z" />
</svg>
