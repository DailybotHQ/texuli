<script lang="ts">
import type { SVGAttributes } from 'svelte/elements';
import { type ClassValue } from '../../internal/cx.ts';
import { designDefaults } from '../../internal/design-defaults.ts';
import Icon from './Icon.svelte';
import type { IconComponent, IconSize } from './types.ts';

interface OwnProps {
  /** Pass an icon component imported by the consumer from `@lucide/svelte`. */
  icon: IconComponent;
  size?: IconSize;
  strokeWidth?: number | string;
  label?: string;
  class?: ClassValue;
}

type Props = OwnProps &
  Omit<SVGAttributes<SVGSVGElement>, keyof OwnProps | 'color'> & {
    /** The rendered `<svg>` (bindable). */
    ref?: SVGSVGElement | null;
  };

const txDefaults = designDefaults('icon');
let {
  icon,
  size = txDefaults().size ?? 'md',
  strokeWidth = 2,
  label,
  class: className,
  ref = $bindable(null),
  ...rest
}: Props = $props();
</script>

<Icon bind:ref {...rest} icon={icon} {size} {strokeWidth} {label} class={className} />
