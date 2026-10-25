<script lang="ts">
import type { Snippet } from 'svelte';
import type { HTMLAttributes } from 'svelte/elements';
import { cx } from '../../internal/cx.ts';
import { Button } from '../button/index.ts';
import './empty.css';

type Props = Omit<HTMLAttributes<HTMLDivElement>, 'title'> & {
  title?: string;
  message?: string;
  /** Shows a retry button; may return a promise (Button pending). */
  onRetry?: () => unknown | Promise<unknown>;
  retryLabel?: string;
  action?: Snippet;
};

let {
  title = 'Something went wrong',
  message,
  onRetry,
  retryLabel = 'Try again',
  action,
  class: className,
  ...rest
}: Props = $props();
</script>

<div
  role="alert"
  class={cx('tx-error', className)}
  data-tx-error
  {...rest}
>
  <div class="tx-error__icon" aria-hidden="true" data-tx-error-icon>
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 8v5" stroke-linecap="round" />
      <circle cx="12" cy="16" r="0.75" fill="currentColor" stroke="none" />
    </svg>
  </div>
  <div class="tx-error__copy">
    <p class="tx-error__title">{title}</p>
    {#if message}
      <p class="tx-error__message">{message}</p>
    {/if}
  </div>
  {#if onRetry || action}
    <div class="tx-error__actions" data-tx-error-actions>
      {#if onRetry}
        <Button variant="outline" onclick={() => onRetry()}>{retryLabel}</Button>
      {/if}
      {@render action?.()}
    </div>
  {/if}
</div>
