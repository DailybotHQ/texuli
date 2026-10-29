<script lang="ts">
import { Trigger as PrimitiveTrigger } from '@texuli/primitives/select';
import type { ComponentProps, Snippet } from 'svelte';
import { type ClassValue } from '../../internal/cx.ts';
import { type SelectSize, type SelectVariant, selectTriggerClass } from './variants.ts';

type Props = ComponentProps<typeof PrimitiveTrigger> & {
  children?: Snippet;
  class?: ClassValue;
  size?: SelectSize;
  variant?: SelectVariant;
};

let {
  children,
  class: className,
  size = 'md',
  variant = 'outline',
  ref = $bindable(null),
  ...rest
}: Props = $props();

const classes = $derived(
  selectTriggerClass({
    size,
    variant,
    class: className,
  })
);
</script>

<PrimitiveTrigger bind:ref class={classes} data-tx-select-trigger data-size={size} data-variant={variant} {...rest}>
  <span class="tx-select-trigger__body">
    {@render children?.()}
  </span>
  <svg
    class="tx-select-trigger__chevron"
    viewBox="0 0 16 16"
    aria-hidden="true"
    focusable="false"
  >
    <path
      d="M4.5 6.25 8 9.75l3.5-3.5"
      fill="none"
      stroke="currentColor"
      stroke-width="1.5"
      stroke-linecap="round"
      stroke-linejoin="round"
    />
  </svg>
</PrimitiveTrigger>
