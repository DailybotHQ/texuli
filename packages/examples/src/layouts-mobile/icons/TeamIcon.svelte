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
  stroke-linejoin="round"><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20a6.5 6.5 0 0 1 13 0" /><path d="M16 4.5a3.5 3.5 0 0 1 0 7" /><path d="M18.5 14a6.5 6.5 0 0 1 3 6" /></svg>
