<script lang="ts">
import type { SVGAttributes } from 'svelte/elements';

/** A custom SVG icon with the same prop shape as a Lucide icon, so it fits IconComponent. */
type Props = Omit<SVGAttributes<SVGSVGElement>, 'color'> & {
  size?: number | string;
  color?: string;
  strokeWidth?: number | string;
  absoluteStrokeWidth?: boolean;
};

let {
  size = 20,
  strokeWidth = 2,
  color,
  absoluteStrokeWidth: _absolute,
  ...rest
}: Props = $props();
</script>

<svg {...rest} width={size} height={size} viewBox="0 0 24 24" fill="none">
  <path d="M12 3 14.8 9.2 21.5 10l-4.9 4.7 1.2 6.6L12 18.1l-5.8 3.2 1.2-6.6L2.5 10l6.7-.8L12 3Z" stroke={color ?? 'currentColor'} stroke-width={strokeWidth} stroke-linejoin="round" />
</svg>
