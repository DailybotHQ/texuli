<script lang="ts">
import type { HTMLAttributes } from 'svelte/elements';
import { type ClassValue, cx } from '../../internal/cx.ts';
import { fieldErrorClass } from './variants.ts';
import './field.css';

type Props = HTMLAttributes<HTMLParagraphElement> & {
  /** When false, render nothing (caller still owns aria wiring). Default true when children/message set. */
  show?: boolean;
  class?: ClassValue;
};

let { show = true, class: className, children, ...rest }: Props = $props();

const classes = $derived(cx(fieldErrorClass(), className));
</script>

{#if show}
  <p
    class={classes}
    data-tx-field-error=""
    role="alert"
    {...rest}
  >{@render children?.()}</p>
{/if}
