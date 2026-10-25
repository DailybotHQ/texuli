<script lang="ts">
import { GroupHeading as PrimitiveHeading } from '@texuli/primitives/command';
import type { Snippet } from 'svelte';
import type { HTMLAttributes } from 'svelte/elements';
import { type ClassValue } from '../../internal/cx.ts';
import { commandGroupHeadingClass } from './variants.ts';
import './command.css';

type Props = Omit<HTMLAttributes<HTMLDivElement>, 'children'> & {
  children?: Snippet;
  class?: ClassValue;
};

let { children, class: className, ...rest }: Props = $props();

const classes = $derived(
  commandGroupHeadingClass({
    class: className,
  })
);
</script>

<PrimitiveHeading class={classes} data-tx-command-group-heading {...rest}>
  {@render children?.()}
</PrimitiveHeading>
