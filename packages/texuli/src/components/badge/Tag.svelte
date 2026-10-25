<script lang="ts">
import type { HTMLAttributes } from 'svelte/elements';
import { type BadgeVariant, tagClass } from './variants.ts';
import './badge.css';

type Props = HTMLAttributes<HTMLSpanElement> & {
  /** Visible label (required word; never color alone). */
  label: string;
  variant?: BadgeVariant;
  /** Accessible name for the remove control. */
  removeLabel?: string;
  /** When set, shows a remove button that calls this (may return a promise). */
  onRemove?: () => unknown | Promise<unknown>;
  disabled?: boolean;
  /** The rendered root element (bindable). */
  ref?: HTMLElement | null;
};

let {
  ref = $bindable(null),
  label,
  variant = 'secondary',
  removeLabel = 'Remove',
  onRemove,
  disabled = false,
  class: className,
  ...rest
}: Props = $props();

let pending = $state(false);

async function remove(): Promise<void> {
  if (!onRemove || disabled || pending) return;
  pending = true;
  try {
    await Promise.resolve(onRemove());
  } finally {
    pending = false;
  }
}
</script>

<span bind:this={ref}
  class={tagClass({ variant, class: className })}
  data-tx-tag
  data-variant={variant}
  {...rest}
>
  <span class="tx-tag__label">{label}</span>
  {#if onRemove}
    <button
      type="button"
      class="tx-tag__remove"
      aria-label={`${removeLabel}: ${label}`}
      disabled={disabled || pending}
      aria-busy={pending ? 'true' : undefined}
      onclick={() => void remove()}
      data-tx-tag-remove
    >
      <svg viewBox="0 0 12 12" width="12" height="12" aria-hidden="true" focusable="false">
        <path
          d="M3 3l6 6M9 3L3 9"
          fill="none"
          stroke="currentColor"
          stroke-width="1.5"
          stroke-linecap="round"
        />
      </svg>
    </button>
  {/if}
</span>
