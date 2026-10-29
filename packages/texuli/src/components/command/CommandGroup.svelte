<script lang="ts">
import { Group as PrimitiveGroup } from '@texuli/primitives/command';
import type { Snippet } from 'svelte';
import type { HTMLAttributes } from 'svelte/elements';
import { type ClassValue } from '../../internal/cx.ts';
import type { RefProp } from '../../internal/ref.ts';
import { commandGroupClass } from './variants.ts';
import './command.css';

type Props = Omit<HTMLAttributes<HTMLDivElement>, 'children'> & {
  children?: Snippet;
  value: string;
  disabled?: boolean;
  class?: ClassValue;
};

let {
  children,
  value,
  disabled = false,
  class: className,
  ref = $bindable(null),
  ...rest
}: Props & RefProp = $props();

const classes = $derived(
  commandGroupClass({
    class: className,
  })
);
</script>

<PrimitiveGroup bind:ref class={classes} data-tx-command-group {value} {disabled} {...rest}>
  {@render children?.()}
</PrimitiveGroup>
