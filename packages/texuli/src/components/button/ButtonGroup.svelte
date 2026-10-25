<script lang="ts">
import { type ClassValue, cx } from '../../internal/cx.ts';
import './button.css';

let {
  orientation = 'horizontal' as 'horizontal' | 'vertical',
  attached = true,
  class: className,
  label,
  children,
  ...rest
}: {
  orientation?: 'horizontal' | 'vertical';
  /** Share borders between adjacent buttons. Default true. */
  attached?: boolean;
  class?: ClassValue;
  /** Accessible name for the group (`aria-label`). */
  label?: string;
  children?: import('svelte').Snippet;
  [key: string]: unknown;
} = $props();

const classes = $derived(cx('tx-button-group', className));
</script>

<div
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
