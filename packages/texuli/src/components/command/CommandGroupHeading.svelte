<script lang="ts">
import { GroupHeading as PrimitiveHeading } from '@texuli/primitives/command';
import type { Snippet } from 'svelte';
import type { HTMLAttributes } from 'svelte/elements';
import { type ClassValue } from '../../internal/cx.ts';
import type { RefProp } from '../../internal/ref.ts';
import { commandGroupHeadingClass } from './variants.ts';
import './command.css';

type Props = Omit<HTMLAttributes<HTMLDivElement>, 'children'> & {
  children?: Snippet;
  class?: ClassValue;
};

let { children, class: className, ref = $bindable(null), ...rest }: Props & RefProp = $props();

const classes = $derived(
  commandGroupHeadingClass({
    class: className,
  })
);
</script>

<PrimitiveHeading bind:ref class={classes} data-tx-command-group-heading {...rest}>
  {@render children?.()}
</PrimitiveHeading>
