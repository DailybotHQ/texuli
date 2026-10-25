<script lang="ts">
import { Toolbar as ToolbarPrimitive } from '@texuli/primitives/toolbar';
import type { Snippet } from 'svelte';
import { type ClassValue, cx } from '../../internal/cx.ts';
import './toolbar.css';

type Props = {
  type?: 'single' | 'multiple';
  value?: string | string[];
  onValueChange?: (value: string | string[]) => void;
  disabled?: boolean;
  class?: ClassValue;
  children?: Snippet;
  'aria-label'?: string;
};

let {
  type = 'single',
  value = $bindable(),
  onValueChange,
  disabled = false,
  class: className,
  children,
  'aria-label': ariaLabel,
}: Props = $props();
</script>

<ToolbarPrimitive.Group
  {type}
  bind:value
  {onValueChange}
  {disabled}
  class={cx('tx-toolbar__group', className)}
  aria-label={ariaLabel}
>
  {@render children?.()}
</ToolbarPrimitive.Group>
