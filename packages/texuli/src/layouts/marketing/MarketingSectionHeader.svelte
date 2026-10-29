<script lang="ts">
import type { Snippet } from 'svelte';
import type { HTMLAttributes } from 'svelte/elements';
import { type ClassValue, cx } from '../../internal/cx.ts';
import type { MarketingSectionAlign } from './types.ts';
import './marketing.css';

/**
 * A heading-only marketing section header (G84): eyebrow, heading and
 * description with the `MarketingSection` type scale, but no landmark, no
 * label and no block padding. Use it inside a section the host already
 * labels (`aria-labelledby` its `headingId`), at any heading level.
 * Attributes it does not consume land on its root `div`; `bind:ref` binds it.
 */
type Props = Omit<HTMLAttributes<HTMLDivElement>, 'class' | 'title'> & {
  /** The heading text. */
  title: string;
  /** Heading level, 2 to 6 (default 2). */
  level?: 2 | 3 | 4 | 5 | 6;
  /** `id` of the heading, for the host section's `aria-labelledby`. */
  headingId?: string;
  eyebrow?: string;
  description?: string;
  align?: MarketingSectionAlign;
  /** Extra content after the description (actions, badges). */
  children?: Snippet;
  class?: ClassValue;
  ref?: HTMLElement | null;
};

let {
  title,
  level = 2,
  headingId,
  eyebrow,
  description,
  align = 'start',
  children,
  class: className,
  ref = $bindable(null),
  ...rest
}: Props = $props();

const tag = $derived(`h${level >= 2 && level <= 6 ? level : 2}`);
</script>

<div
  bind:this={ref}
  {...rest}
  class={cx('tx-marketing-section-header', className)}
  data-tx-marketing-section-header=""
  data-align={align}
>
  {#if eyebrow}
    <p class="tx-marketing-section__eyebrow">{eyebrow}</p>
  {/if}
  <svelte:element this={tag} id={headingId} class="tx-marketing-section__title">{title}</svelte:element>
  {#if description}
    <p class="tx-marketing-section__description">{description}</p>
  {/if}
  {#if children}
    {@render children()}
  {/if}
</div>
