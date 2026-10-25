<script lang="ts">
import type { Snippet } from 'svelte';
import type { HTMLAttributes } from 'svelte/elements';
import { cx } from '../../internal/cx.ts';
import { variants } from '../../internal/variants.ts';
import './empty.css';

type Props = Omit<HTMLAttributes<HTMLDivElement>, 'title'> & {
  title: string;
  description?: string;
  /** Optional illustration / icon (decorative; wrapped aria-hidden). */
  illustration?: Snippet;
  /** Primary and secondary actions. */
  action?: Snippet;
  size?: 'sm' | 'md';
};

const emptyClass = variants({
  base: 'tx-empty',
  variants: {
    size: {
      sm: 'tx-empty--sm',
      md: 'tx-empty--md',
    },
  },
  defaultVariants: { size: 'md' },
});

let {
  title,
  description,
  illustration,
  action,
  size = 'md',
  class: className,
  ...rest
}: Props = $props();
</script>

<div
  class={emptyClass({
    size,
    class: className,
  })}
  data-tx-empty
  data-size={size}
  {...rest}
>
  <div class="tx-empty__icon" aria-hidden="true" data-tx-empty-icon>
    {#if illustration}
      {@render illustration()}
    {:else}
      <!-- Default inbox glyph -->
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" aria-hidden="true">
        <path
          d="M4 13h4l2 3h4l2-3h4v5a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-5Z"
          stroke-linejoin="round"
        />
        <path d="M4 13V7a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v6" stroke-linecap="round" />
      </svg>
    {/if}
  </div>
  <div class="tx-empty__copy">
    <p class="tx-empty__title">{title}</p>
    {#if description}
      <p class="tx-empty__description">{description}</p>
    {/if}
  </div>
  {#if action}
    <div class="tx-empty__actions" data-tx-empty-actions>{@render action()}</div>
  {/if}
</div>
