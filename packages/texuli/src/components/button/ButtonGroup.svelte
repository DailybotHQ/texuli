<script lang="ts">
import { type ClassValue, cx } from '../../internal/cx.ts';
import './button.css';

let {
  orientation = 'horizontal' as 'horizontal' | 'vertical',
  attached = true,
  class: className,
  label,
  children,
  ref = $bindable(null),
  ...rest
}: {
  orientation?: 'horizontal' | 'vertical';
  /** Share borders between adjacent buttons. Default true. */
  attached?: boolean;
  class?: ClassValue;
  /** Accessible name for the group (`aria-label`). */
  label?: string;
  children?: import('svelte').Snippet;
  /** The rendered root element (bindable). */
  ref?: HTMLElement | null;
  [key: string]: unknown;
} = $props();

const classes = $derived(cx('tx-button-group', className));
</script>

<div
  bind:this={ref}
  class={classes}
  role="group"
  aria-label={label}
  data-tx-button-group
  data-orientation={orientation}
  data-attached={attached ? 'true' : 'false'}
  {...rest}
>
  {@render children?.()}
</div>
