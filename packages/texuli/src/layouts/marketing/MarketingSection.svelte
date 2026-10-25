<script lang="ts">
import type { Snippet } from 'svelte';
import { type ClassValue, cx } from '../../internal/cx.ts';
import type { MarketingSectionAlign } from './types.ts';
import './marketing.css';

/**
 * A labelled marketing content block (features, social proof, FAQ…).
 */
type Props = {
  title?: string;
  description?: string;
  eyebrow?: string;
  align?: MarketingSectionAlign;
  /** Accessible name when title is absent. */
  label?: string;
  children?: Snippet;
  class?: ClassValue;
};

let {
  title,
  description,
  eyebrow,
  align = 'start',
  label,
  children,
  class: className,
}: Props = $props();

const sectionLabel = $derived(label ?? title);
</script>

<section
  class={cx('tx-marketing-section', className)}
  data-tx-marketing-section=""
  data-align={align}
  aria-label={sectionLabel}
>
  {#if eyebrow}
    <p class="tx-marketing-section__eyebrow">{eyebrow}</p>
  {/if}
  {#if title}
    <h2 class="tx-marketing-section__title">{title}</h2>
  {/if}
  {#if description}
    <p class="tx-marketing-section__description">{description}</p>
  {/if}
  {#if children}
    <div class="tx-marketing-section__body">{@render children()}</div>
  {/if}
</section>
