<script lang="ts">
import {
  CollapsibleContent,
  CollapsibleRoot,
  CollapsibleTrigger,
} from '@texuli/primitives/collapsible';
import type { Snippet } from 'svelte';
import type { HTMLAttributes } from 'svelte/elements';
import { useMessages } from '../../i18n/use-messages.ts';
import { type ClassValue, cx } from '../../internal/cx.ts';
import Chevron from './Chevron.svelte';
import './tabs-accordion.css';

type OwnProps = {
  open?: boolean;
  defaultOpen?: boolean;
  disabled?: boolean;
  id?: string;
  /** Trigger label when not providing a custom trigger snippet. */
  label?: string;
  class?: ClassValue;
  onOpenChange?: (open: boolean) => void;
  trigger?: Snippet;
  children?: Snippet;
  /** The rendered root element (bindable). */
  ref?: HTMLElement | null;
};

/** Extra attributes (`data-*`, `aria-*`, handlers…) land on the root element. */
type Props = OwnProps & Omit<HTMLAttributes<HTMLDivElement>, keyof OwnProps>;

let {
  open = $bindable(undefined),
  defaultOpen = false,
  disabled = false,
  id,
  label: labelProp,
  class: className,
  onOpenChange,
  trigger,
  children,
  ref = $bindable(null),
  ...rest
}: Props = $props();
const msg = useMessages();
const label = $derived(labelProp ?? msg('texuli.collapsible.label', 'Details'));
</script>

<CollapsibleRoot
  {...rest}
  bind:ref
  bind:open
  {defaultOpen}
  {disabled}
  {id}
  {onOpenChange}
  class={cx('tx-collapsible', className)}
>
  <CollapsibleTrigger class="tx-collapsible__trigger">
    {#if trigger}
      {@render trigger()}
    {:else}
      {label}
      <Chevron class="tx-collapsible__chevron" />
    {/if}
  </CollapsibleTrigger>
  <CollapsibleContent class="tx-collapsible__content">
    {@render children?.()}
  </CollapsibleContent>
</CollapsibleRoot>
