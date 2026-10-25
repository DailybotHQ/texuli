<script lang="ts">
import { Group as PrimitiveGroup } from '@texuli/primitives/command';
import type { Snippet } from 'svelte';
import type { HTMLAttributes } from 'svelte/elements';
import { type ClassValue } from '../../internal/cx.ts';
import { commandGroupClass } from './variants.ts';
import './command.css';

type Props = Omit<HTMLAttributes<HTMLDivElement>, 'children'> & {
  children?: Snippet;
  value: string;
  disabled?: boolean;
  class?: ClassValue;
};

let { children, value, disabled = false, class: className, ...rest }: Props = $props();

const classes = $derived(
  commandGroupClass({
    class: className,
  })
);
</script>

<PrimitiveGroup class={classes} data-tx-command-group {value} {disabled} {...rest}>
  {@render children?.()}
</PrimitiveGroup>
