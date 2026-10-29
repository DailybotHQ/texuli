<script lang="ts">
import { type CommandSearch, Root as PrimitiveRoot } from '@texuli/primitives/command';
import type { Snippet } from 'svelte';
import type { HTMLAttributes } from 'svelte/elements';
import { type ClassValue } from '../../internal/cx.ts';
import { type CommandSize, type CommandVariant, commandRootClass } from './variants.ts';
import './command.css';

type Props = Omit<HTMLAttributes<HTMLDivElement>, 'children'> & {
  /** The rendered root element (bindable). */
  ref?: HTMLElement | null;
  children?: Snippet;
  size?: CommandSize;
  variant?: CommandVariant;
  label?: string;
  loop?: boolean;
  shouldFilter?: boolean;
  debounceMs?: number;
  onSearch?: CommandSearch;
  onSearchError?: (error: unknown) => void;
  onSelect?: (value: string) => void;
  class?: ClassValue;
};

let {
  children,
  size = 'md',
  variant = 'outline',
  label = 'Commands',
  loop = true,
  shouldFilter = true,
  debounceMs = 0,
  onSearch,
  onSearchError,
  onSelect,
  class: className,
  ref = $bindable(null),
  ...rest
}: Props = $props();

const classes = $derived(
  commandRootClass({
    size,
    variant,
    class: className,
  })
);
</script>

<div bind:this={ref} class={classes} data-tx-command data-size={size} data-variant={variant} {...rest}>
  <PrimitiveRoot
    {label}
    {loop}
    {shouldFilter}
    {debounceMs}
    {onSearch}
    {onSearchError}
    {onSelect}
  >
    {@render children?.()}
  </PrimitiveRoot>
</div>
