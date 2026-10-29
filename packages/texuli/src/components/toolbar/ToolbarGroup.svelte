<script lang="ts">
import { Toolbar as ToolbarPrimitive } from '@texuli/primitives/toolbar';
import type { Snippet } from 'svelte';
import type { HTMLAttributes } from 'svelte/elements';
import { type ClassValue, cx } from '../../internal/cx.ts';
import './toolbar.css';

type OwnProps = {
  type?: 'single' | 'multiple';
  value?: string | string[];
  onValueChange?: (value: string | string[]) => void;
  disabled?: boolean;
  class?: ClassValue;
  children?: Snippet;
  'aria-label'?: string;
  /** The rendered root element (bindable). */
  ref?: HTMLElement | null;
};

/** Extra attributes (`data-*`, `aria-*`, handlers…) land on the rendered element. */
type Props = OwnProps & Omit<HTMLAttributes<HTMLDivElement>, keyof OwnProps | 'children'>;

let {
  type = 'single',
  value = $bindable(),
  onValueChange,
  disabled = false,
  class: className,
  children,
  'aria-label': ariaLabel,
  ref = $bindable(null),
  ...rest
}: Props = $props();

function bindRef(node: HTMLElement): () => void {
  ref = node;
  return () => {
    if (ref === node) ref = null;
  };
}
</script>

<ToolbarPrimitive.Group
  {...rest}
  {@attach bindRef}
  {type}
  bind:value
  {onValueChange}
  {disabled}
  class={cx('tx-toolbar__group', className)}
  aria-label={ariaLabel}
>
  {@render children?.()}
</ToolbarPrimitive.Group>
