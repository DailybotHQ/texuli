<script lang="ts">
import type { Snippet } from 'svelte';
import type { HTMLAttributes } from 'svelte/elements';
import { useMessages } from '../../i18n/use-messages.ts';
import { cx } from '../../internal/cx.ts';
import { Button } from '../button/index.ts';
import './empty.css';

type Props = Omit<HTMLAttributes<HTMLDivElement>, 'title'> & {
  /** The rendered root element (bindable). */
  ref?: HTMLElement | null;
  title?: string;
  message?: string;
  /** Shows a retry button; may return a promise (Button pending). */
  onRetry?: () => unknown | Promise<unknown>;
  retryLabel?: string;
  action?: Snippet;
};

let {
  title: titleProp,
  message,
  onRetry,
  retryLabel: retryLabelProp,
  action,
  class: className,
  ref = $bindable(null),
  ...rest
}: Props = $props();
const msg = useMessages();
const title = $derived(titleProp ?? msg('texuli.error-state.title', 'Something went wrong'));
const retryLabel = $derived(retryLabelProp ?? msg('texuli.error-state.retry-label', 'Try again'));
</script>

<div
  bind:this={ref}
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
