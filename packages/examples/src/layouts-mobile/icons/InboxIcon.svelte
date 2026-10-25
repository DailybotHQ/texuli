<script lang="ts">
import type { SVGAttributes } from 'svelte/elements';

/** A fictional app icon for the mobile layout examples (Lucide-compatible props). */
let { size = 24, ...rest }: SVGAttributes<SVGSVGElement> & { size?: number | string } = $props();
</script>

<svg
  {...rest}
  xmlns="http://www.w3.org/2000/svg"
  width={size}
  height={size}
  viewBox="0 0 24 24"
  fill="none"
  stroke="currentColor"
  stroke-width="2"
  stroke-linecap="round"
  stroke-linejoin="round"><path d="M3 13l3-8h12l3 8v6H3z" /><path d="M3 13h5l1 3h6l1-3h5" /></svg>
