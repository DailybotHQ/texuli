<script lang="ts">
import type { HTMLAttributes } from 'svelte/elements';
import { type BadgeVariant, badgeClass } from './variants.ts';
import './badge.css';
import { designDefaults, withDefault } from '../../internal/design-defaults.ts';

type Props = HTMLAttributes<HTMLSpanElement> & {
  /** Semantic fill. Filled pairs use token foregrounds for AA on small text. */
  variant?: BadgeVariant;
  /**
   * Plain-text label, rendered as escaped text. A non-empty `label`
   * replaces `children` when both are given.
   */
  label?: string;
  /** The rendered root element (bindable). */
  ref?: HTMLElement | null;
};

let {
  ref = $bindable(null),
  variant: variantProp,
  label,
  class: className,
  children,
  ...rest
}: Props = $props();
const txDefaults = designDefaults('badge');
const variant = $derived(withDefault(variantProp, txDefaults().variant, 'default'));

const hasLabel = $derived(typeof label === 'string' && label.length > 0);
</script>

<span bind:this={ref} class={badgeClass({ variant, class: className })} data-tx-badge data-variant={variant} {...rest}
  >{#if hasLabel}{label}{:else}{@render children?.()}{/if}</span
>
