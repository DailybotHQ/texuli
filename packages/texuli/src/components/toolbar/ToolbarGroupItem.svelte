<script lang="ts">
import { Toolbar as ToolbarPrimitive } from '@texuli/primitives/toolbar';
import type { Snippet } from 'svelte';
import { getContext } from 'svelte';
import type { HTMLButtonAttributes } from 'svelte/elements';
import { type ClassValue } from '../../internal/cx.ts';
import type { ToolbarStyleContext } from './style-context.ts';
import { TOOLBAR_STYLE } from './style-context.ts';
import { toolbarButtonClass } from './variants.ts';
import './toolbar.css';

type OwnProps = {
  value: string;
  disabled?: boolean;
  class?: ClassValue;
  children?: Snippet;
  'aria-label'?: string;
  /** The rendered root element (bindable). */
  ref?: HTMLElement | null;
};

/** Extra attributes (`data-*`, `aria-*`, handlers…) land on the rendered element. */
type Props = OwnProps & Omit<HTMLButtonAttributes, keyof OwnProps | 'children'>;

let {
  value,
  disabled = false,
  class: className,
  children,
  'aria-label': ariaLabel,
  ref = $bindable(null),
  ...rest
}: Props = $props();

const style = getContext<ToolbarStyleContext | undefined>(TOOLBAR_STYLE);
const classes = $derived(
  toolbarButtonClass({
    size: style?.size ?? 'md',
    class: ['tx-toolbar__group-item', className],
  })
);
</script>

<ToolbarPrimitive.GroupItem
  {...rest}
  bind:ref
  {value}
  {disabled}
  aria-label={ariaLabel}
  class={classes}
>
  {@render children?.()}
</ToolbarPrimitive.GroupItem>
