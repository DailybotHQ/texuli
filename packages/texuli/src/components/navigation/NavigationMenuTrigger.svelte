<script lang="ts">
import { NavigationMenu as Primitive } from '@texuli/primitives/navigation-menu';
import type { ComponentProps, Snippet } from 'svelte';
import { type ClassValue } from '../../internal/cx.ts';
import { navigationMenuTriggerClass } from './variants.ts';

type Props = ComponentProps<typeof Primitive.Trigger> & {
  children?: Snippet;
  class?: ClassValue;
  /** Hide the chevron affordance. */
  hideChevron?: boolean;
};

let { children, class: className, hideChevron = false, ...rest }: Props = $props();
</script>

<Primitive.Trigger
  class={navigationMenuTriggerClass({
    class: className,
  })}
  {...rest}
>
  {@render children?.()}
  {#if !hideChevron}
    <svg
      class="tx-nav-menu__trigger-chevron"
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
  {/if}
</Primitive.Trigger>
