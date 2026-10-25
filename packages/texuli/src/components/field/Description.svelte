<script lang="ts">
import type { HTMLAttributes } from 'svelte/elements';
import { type ClassValue, cx } from '../../internal/cx.ts';
import { descriptionClass } from './variants.ts';
import './field.css';

type Props = HTMLAttributes<HTMLParagraphElement> & {
  class?: ClassValue;
};

let { class: className, children, ...rest }: Props = $props();

const classes = $derived(cx(descriptionClass(), className));
</script>

<p class={classes} data-tx-description="" {...rest}>{@render children?.()}</p>
