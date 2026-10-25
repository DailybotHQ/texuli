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
  disabled?: boolean;
  class?: ClassValue;
  children?: Snippet;
  id?: string;
  'aria-label'?: string;
  'aria-pressed'?: boolean | 'true' | 'false';
  onclick?: (event: MouseEvent) => void;
};

let {
  disabled = false,
  class: className,
  children,
  id,
  'aria-label': ariaLabel,
  'aria-pressed': ariaPressed,
  onclick,
}: Props = $props();

const style = getContext<ToolbarStyleContext | undefined>(TOOLBAR_STYLE);
const classes = $derived(
  toolbarButtonClass({
    size: style?.size ?? 'md',
    class: className,
  })
);
</script>

<ToolbarPrimitive.Button
  {disabled}
  {id}
  {onclick}
  aria-label={ariaLabel}
  aria-pressed={ariaPressed}
  class={classes}
  data-state={ariaPressed === true || ariaPressed === 'true' ? 'on' : undefined}
>
  {@render children?.()}
</ToolbarPrimitive.Button>
