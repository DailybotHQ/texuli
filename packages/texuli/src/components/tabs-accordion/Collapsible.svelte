<script lang="ts">
import {
  CollapsibleContent,
  CollapsibleRoot,
  CollapsibleTrigger,
} from '@texuli/primitives/collapsible';
import type { Snippet } from 'svelte';
import { type ClassValue, cx } from '../../internal/cx.ts';
import Chevron from './Chevron.svelte';
import './tabs-accordion.css';

type Props = {
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
};

let {
  open = $bindable(undefined),
  defaultOpen = false,
  disabled = false,
  id,
  label = 'Details',
  class: className,
  onOpenChange,
  trigger,
  children,
}: Props = $props();
</script>

<CollapsibleRoot
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
