<script lang="ts">
import { Toolbar as ToolbarPrimitive } from '@texuli/primitives/toolbar';
import type { Snippet } from 'svelte';
import { getContext } from 'svelte';
import { type ClassValue } from '../../internal/cx.ts';
import type { ToolbarStyleContext } from './style-context.ts';
import { TOOLBAR_STYLE } from './style-context.ts';
import { toolbarButtonClass } from './variants.ts';
import './toolbar.css';

type Props = {
  value: string;
  disabled?: boolean;
  class?: ClassValue;
  children?: Snippet;
  'aria-label'?: string;
};

let {
  value,
  disabled = false,
  class: className,
  children,
  'aria-label': ariaLabel,
}: Props = $props();

const style = getContext<ToolbarStyleContext | undefined>(TOOLBAR_STYLE);
const classes = $derived(
  toolbarButtonClass({
    size: style?.size ?? 'md',
    class: ['tx-toolbar__group-item', className],
  })
);
</script>

<ToolbarPrimitive.GroupItem {value} {disabled} aria-label={ariaLabel} class={classes}>
  {@render children?.()}
</ToolbarPrimitive.GroupItem>
