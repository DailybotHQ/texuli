<script lang="ts">
import { type ClassValue, cx } from 'texuli/cx';
import type { TypingLabels } from './typing-labels.ts';

const DEFAULT_LABELS: TypingLabels = {
  one: (name) => `${name} is typing`,
  two: (first, second) => `${first} and ${second} are typing`,
  many: (count) => `${count} people are typing`,
};

interface Props {
  names: readonly string[];
  labels?: Partial<TypingLabels>;
  showLabel?: boolean;
  class?: ClassValue;
}

let { names, labels: labelOverrides = {}, showLabel = false, class: className }: Props = $props();
const labels = $derived({ ...DEFAULT_LABELS, ...labelOverrides });
const message = $derived.by(() => {
  if (names.length === 0) return '';
  if (names.length === 1) return labels.one(names[0] ?? '');
  if (names.length === 2) return labels.two(names[0] ?? '', names[1] ?? '');
  return labels.many(names.length);
});
</script>

<div class={cx('tx-chat-typing', className)} role="status" aria-live="polite" aria-atomic="true">
  {#if message}
    <span class={cx('tx-chat-typing__label', !showLabel && 'visually-hidden')}>{message}</span>
    <span class="tx-chat-typing__dots" aria-hidden="true">
      <span></span><span></span><span></span>
    </span>
  {/if}
</div>

<style>
  @layer tx.components {
    .tx-chat-typing {
      display: flex;
      min-block-size: 1.5rem;
      align-items: center;
      color: var(--tx-muted-foreground, GrayText);
      font-size: 0.875rem;
    }

    .tx-chat-typing__dots {
      display: inline-flex;
      gap: 0.25rem;
      margin-inline-start: 0.5rem;
    }

    .tx-chat-typing__dots span {
      inline-size: 0.375rem;
      block-size: 0.375rem;
      border-radius: 50%;
      background: currentColor;
      animation: tx-chat-pulse 1s ease-in-out infinite alternate;
    }

    .tx-chat-typing__dots span:nth-child(2) {
      animation-delay: 150ms;
    }

    .tx-chat-typing__dots span:nth-child(3) {
      animation-delay: 300ms;
    }

    .visually-hidden {
      position: absolute;
      inline-size: 1px;
      block-size: 1px;
      overflow: hidden;
      clip-path: inset(50%);
      white-space: nowrap;
    }

    @keyframes tx-chat-pulse {
      to {
        opacity: 0.35;
      }
    }

    @media (prefers-reduced-motion: reduce) {
      .tx-chat-typing__dots span {
        animation: none;
      }
    }
  }
</style>
