<script lang="ts">
/**
 * Mark (ADR-032): an inline highlight for search results, from role soft tokens.
 * Renders a real `<mark>`. Default tone is `warning` (the search-result fill).
 */
import type { HTMLAttributes } from 'svelte/elements';
import { cx } from '../../internal/cx.ts';
import { MARK_TONES, type MarkTone, markClass, oneOf } from './variants.ts';

type Props = HTMLAttributes<HTMLElement> & {
  /** Soft fill: `warning` (default, search), `primary`, `success` or `info`. */
  tone?: MarkTone;
  /** Plain text, escaped; replaces `children` when non-empty. */
  label?: string;
  /** The rendered element (bindable). */
  ref?: HTMLElement | null;
};

let {
  ref = $bindable(null),
  tone: toneProp = 'warning',
  label,
  class: className,
  children,
  ...rest
}: Props = $props();

const tone = $derived(oneOf(MARK_TONES, toneProp, 'warning'));
const hasLabel = $derived(typeof label === 'string' && label.length > 0);
</script>

<mark
  bind:this={ref}
  {...rest}
  class={cx(markClass({ tone }), className)}
  data-tx-component="mark"
  data-tx-tone={tone}
>{#if hasLabel}{label}{:else}{@render children?.()}{/if}</mark>
