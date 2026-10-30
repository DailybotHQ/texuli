<script lang="ts">
import { type CommandSearch, Root as PrimitiveRoot } from '@texuli/primitives/command';
import type { Snippet } from 'svelte';
import type { HTMLAttributes } from 'svelte/elements';
import { useMessages } from '../../i18n/use-messages.ts';
import { type ClassValue } from '../../internal/cx.ts';
import { type CommandSize, type CommandVariant, commandRootClass } from './variants.ts';
import './command.css';
import { designDefaults } from '../../internal/design-defaults.ts';

type Props = Omit<HTMLAttributes<HTMLDivElement>, 'children'> & {
  /** The rendered root element (bindable). */
  ref?: HTMLElement | null;
  children?: Snippet;
  size?: CommandSize;
  variant?: CommandVariant;
  label?: string;
  /**
   * Busy state from a search you run yourself (no `onSearch`): `CommandLoading`
   * shows its polite status, `CommandEmpty` hides and the list is `aria-busy`.
   */
  loading?: boolean;
  loop?: boolean;
  shouldFilter?: boolean;
  debounceMs?: number;
  onSearch?: CommandSearch;
  onSearchError?: (error: unknown) => void;
  onSelect?: (value: string) => void;
  class?: ClassValue;
};

const txDefaults = designDefaults('command');
let {
  children,
  size = txDefaults().size ?? 'md',
  variant = txDefaults().variant ?? 'outline',
  label: labelProp,
  loading = false,
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
const msg = useMessages();
const label = $derived(labelProp ?? msg('texuli.command-root.label', 'Commands'));

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
    {loading}
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
