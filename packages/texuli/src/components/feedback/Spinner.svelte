<script lang="ts">
import type { HTMLAttributes } from 'svelte/elements';
import { type FeedbackSize, type FeedbackTone, spinnerClass } from './variants.ts';
import './feedback.css';
import { designDefaults, withDefault } from '../../internal/design-defaults.ts';

type Props = Omit<HTMLAttributes<HTMLSpanElement>, 'children'> & {
  /** The rendered root element (bindable). */
  ref?: HTMLElement | null;
  /**
   * When set, the spinner is a live status region and the label is announced.
   * Without a label it is decorative (`aria-hidden`).
   */
  label?: string;
  size?: FeedbackSize;
  tone?: FeedbackTone;
};

let {
  label,
  size: sizeProp,
  tone = 'primary',
  class: className,
  ref = $bindable(null),
  ...rest
}: Props = $props();
const txDefaults = designDefaults('spinner');
const size = $derived(withDefault(sizeProp, txDefaults().size, 'md'));

const classes = $derived(
  spinnerClass({
    size,
    tone,
    class: className,
  })
);
</script>

{#if label}
  <span
    bind:this={ref}
    class={classes}
    role="status"
    data-tx-spinner
    data-size={size}
    data-tone={tone}
    {...rest}
  >
    <span class="tx-spinner__icon" aria-hidden="true"></span>
    <span class="tx-sr-only">{label}</span>
  </span>
{:else}
  <span
    bind:this={ref}
    class={classes}
    aria-hidden="true"
    data-tx-spinner
    data-size={size}
    data-tone={tone}
    {...rest}
  >
    <span class="tx-spinner__icon"></span>
  </span>
{/if}
