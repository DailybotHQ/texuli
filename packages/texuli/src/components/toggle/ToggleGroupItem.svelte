<script lang="ts">
import { ToggleGroup as ToggleGroupPrimitive } from '@texuli/primitives/toggle';
import type { Snippet } from 'svelte';
import { getContext } from 'svelte';
import type { HTMLButtonAttributes } from 'svelte/elements';
import { type ClassValue } from '../../internal/cx.ts';
import type { RefProp } from '../../internal/ref.ts';
import { TOGGLE_GROUP_STYLE } from './style-context.ts';
import { toggleClass } from './variants.ts';
import './toggle.css';

import type { ToggleGroupStyleContext } from './style-context.ts';

type Props = {
  value: string;
  disabled?: boolean;
  class?: ClassValue;
  children?: Snippet;
  id?: string;
  'aria-label'?: string;
} & Omit<HTMLButtonAttributes, 'value' | 'disabled' | 'class' | 'children' | 'id' | 'type'>;

let {
  value,
  disabled = false,
  class: className,
  children,
  id,
  'aria-label': ariaLabel,
  // aria-*, data-* and handlers go to the item (there is no wrapper).
  ref = $bindable(null),
  ...rest
}: Props & RefProp = $props();

const style = getContext<ToggleGroupStyleContext | undefined>(TOGGLE_GROUP_STYLE);

const classes = $derived(
  toggleClass({
    variant: style?.variant ?? 'default',
    size: style?.size ?? 'md',
    class: className,
  })
);
</script>

<ToggleGroupPrimitive.Item bind:ref {...rest} {value} {disabled} {id} aria-label={ariaLabel} class={classes}>
  {@render children?.()}
</ToggleGroupPrimitive.Item>
