<script lang="ts">
import { type ClassValue } from '../../internal/cx.ts';
import Icon from './Icon.svelte';
import type { IconComponent, IconSize } from './types.ts';

interface Props {
  /** Pass an icon component imported by the consumer from `@lucide/svelte`. */
  icon: IconComponent;
  size?: IconSize;
  strokeWidth?: number | string;
  label?: string;
  class?: ClassValue;
}

let { icon, size = 'md', strokeWidth = 2, label, class: className }: Props = $props();
</script>

<Icon icon={icon} {size} {strokeWidth} {label} class={className} />
