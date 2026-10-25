<script lang="ts">
import type { HTMLAttributes } from 'svelte/elements';
import { type FeedbackSize, type FeedbackTone, spinnerClass } from './variants.ts';
import './feedback.css';

type Props = Omit<HTMLAttributes<HTMLSpanElement>, 'children'> & {
  /**
   * When set, the spinner is a live status region and the label is announced.
   * Without a label it is decorative (`aria-hidden`).
   */
  label?: string;
  size?: FeedbackSize;
  tone?: FeedbackTone;
};

let { label, size = 'md', tone = 'primary', class: className, ...rest }: Props = $props();

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
