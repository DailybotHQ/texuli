<script lang="ts">
import { List as PrimitiveList } from '@texuli/primitives/command';
import type { Snippet } from 'svelte';
import type { HTMLAttributes } from 'svelte/elements';
import { type ClassValue } from '../../internal/cx.ts';
import { commandListClass } from './variants.ts';
import './command.css';

type Props = Omit<HTMLAttributes<HTMLDivElement>, 'children'> & {
  children?: Snippet;
  class?: ClassValue;
};

let { children, class: className, ...rest }: Props = $props();

const classes = $derived(
  commandListClass({
    class: className,
  })
);
</script>

<PrimitiveList class={classes} data-tx-command-list {...rest}>
  {@render children?.()}
</PrimitiveList>
