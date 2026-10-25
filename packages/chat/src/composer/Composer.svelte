<script lang="ts">
import type { Snippet } from 'svelte';
import { Button } from 'texuli/button';
import { type ClassValue, cx } from 'texuli/cx';
import { autosizeTextarea } from 'texuli/input';
import { type ComposerLabels, DEFAULT_COMPOSER_LABELS } from './labels.ts';

interface Props {
  value?: string;
  /** Return false to keep the draft, or reject to show the translated error. */
  onSubmit: (message: string) => unknown;
  labels?: Partial<ComposerLabels>;
  disabled?: boolean;
  /** External pending state, for example while a parent queues a send. */
  sending?: boolean;
  maxRows?: number;
  maxLength?: number;
  /** Attachment and other controls rendered beside the send button. */
  attachments?: Snippet;
  class?: ClassValue;
}

const id = $props.id();
let {
  value = $bindable(''),
  onSubmit,
  labels: labelOverrides = {},
  disabled = false,
  sending = false,
  maxRows = 6,
  maxLength,
  attachments,
  class: className,
}: Props = $props();

let field = $state<HTMLTextAreaElement | null>(null);
let pending = $state(false);
let error = $state(false);
let composing = $state(false);
const labels = $derived({ ...DEFAULT_COMPOSER_LABELS, ...labelOverrides });
const busy = $derived(sending || pending);
const canSend = $derived(!disabled && !busy && value.trim().length > 0);
const hintId = `chat-composer-${id}-hint`;
const errorId = `chat-composer-${id}-error`;

function resize(): void {
  const element = field;
  if (!element) return;
  autosizeTextarea(element);
  const lineHeight = Number.parseFloat(getComputedStyle(element).lineHeight) || 24;
  const maxSize = lineHeight * Math.max(1, maxRows) + 16;
  if (element.scrollHeight > maxSize) {
    element.style.blockSize = `${maxSize}px`;
    element.style.overflowY = 'auto';
  } else {
    element.style.overflowY = 'hidden';
  }
}

$effect(() => {
  void value;
  resize();
});

async function submit(): Promise<void> {
  if (!canSend) return;
  const message = value.trim();
  error = false;
  pending = true;
  try {
    const result = await onSubmit(message);
    if (result !== false) value = '';
  } catch {
    error = true;
  } finally {
    pending = false;
    field?.focus();
  }
}

function onKeydown(event: KeyboardEvent): void {
  if (
    event.key === 'Enter' &&
    !event.shiftKey &&
    !event.isComposing &&
    !composing &&
    event.keyCode !== 229
  ) {
    event.preventDefault();
    void submit();
  }
}
</script>

<form
  class={cx('tx-chat-composer', className)}
  data-tx-chat-composer
  onsubmit={(event) => {
    event.preventDefault();
    void submit();
  }}
>
  <label class="visually-hidden" for={`chat-composer-${id}`}>{labels.input}</label>
  <textarea
    bind:this={field}
    value={value}
    id={`chat-composer-${id}`}
    aria-describedby={error ? `${hintId} ${errorId}` : hintId}
    aria-invalid={error || undefined}
    placeholder={labels.placeholder}
    disabled={disabled || busy}
    rows="1"
    maxlength={maxLength}
    class="tx-chat-composer__field"
    oninput={(event) => {
      value = event.currentTarget.value;
      error = false;
      resize();
    }}
    onkeydown={onKeydown}
    oncompositionstart={() => (composing = true)}
    oncompositionend={() => (composing = false)}
  ></textarea>
  <div class="tx-chat-composer__actions">
    <div class="tx-chat-composer__attachments">{@render attachments?.()}</div>
    <Button
      type="submit"
      variant="outline"
      size="sm"
      disabled={!canSend}
      loading={busy}
      loadingLabel={labels.sending}
    >
      {labels.send}
    </Button>
  </div>
  <span id={hintId} class="visually-hidden">{labels.hint}</span>
  {#if error}<p id={errorId} class="tx-chat-composer__error" role="alert">{labels.sendError}</p>{/if}
</form>

<style>
  @layer tx.components {
    .tx-chat-composer {
      display: grid;
      gap: 0.5rem;
      border: 1px solid var(--tx-border, CanvasText);
      border-radius: var(--tx-radius, 0.75rem);
      background: var(--tx-surface, Canvas);
      padding: 0.75rem;
    }

    .tx-chat-composer:focus-within {
      border-color: var(--tx-ring, Highlight);
    }

    .tx-chat-composer__field {
    box-sizing: border-box;
    inline-size: 100%;
    min-inline-size: 0;
    min-block-size: 2.5rem;
    max-block-size: none;
    margin: 0;
    border: 1px solid var(--tx-input, var(--tx-border, CanvasText));
    border-radius: var(--tx-radius, 0.375rem);
    background: var(--tx-surface, Canvas);
    color: var(--tx-foreground, CanvasText);
    padding: 0.625rem 0.75rem;
    font-family: var(--tx-font-sans, system-ui, sans-serif);
    line-height: 1.4;
    resize: none;
    overflow-y: hidden;
    font-size: 1rem;
    outline: none;
    }

    .tx-chat-composer__field:focus-visible {
      border-color: var(--tx-ring, Highlight);
      box-shadow: 0 0 0 2px color-mix(in oklab, var(--tx-ring, Highlight) 30%, transparent);
    }

    .tx-chat-composer__field:disabled {
      cursor: not-allowed;
      opacity: 0.6;
    }

    .tx-chat-composer__field::placeholder {
      color: var(--tx-muted-foreground, GrayText);
      opacity: 1;
    }

    .tx-chat-composer__actions {
      display: flex;
      align-items: end;
      justify-content: space-between;
      gap: 0.75rem;
    }

    .tx-chat-composer__attachments {
      display: flex;
      min-inline-size: 0;
      flex-wrap: wrap;
      align-items: center;
      gap: 0.5rem;
    }

    .tx-chat-composer__error {
      margin: 0;
      color: var(--tx-destructive, Mark);
      font-size: 0.875rem;
    }

    .visually-hidden {
      position: absolute;
      inline-size: 1px;
      block-size: 1px;
      overflow: hidden;
      clip-path: inset(50%);
      white-space: nowrap;
    }

    @media (min-width: 640px) {
      .tx-chat-composer__field {
        font-size: 0.875rem;
      }
    }
  }
</style>
