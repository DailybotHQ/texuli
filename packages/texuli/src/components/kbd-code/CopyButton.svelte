<script lang="ts">
import type { HTMLButtonAttributes } from 'svelte/elements';
import { useMessages } from '../../i18n/use-messages.ts';
import { type ClassValue } from '../../internal/cx.ts';
import { type ClipboardLike, copyText } from './copy-text.ts';
import { type CopyButtonSize, copyButtonClass } from './variants.ts';
import './kbd-code.css';
import { designDefaults, withDefault } from '../../internal/design-defaults.ts';

type Props = HTMLButtonAttributes & {
  /** The rendered root element (bindable). */
  ref?: HTMLElement | null;
  /** Plain text written to the clipboard. */
  value: string;
  /** Visible / accessible label while idle. */
  label?: string;
  /** Label while the copied feedback is shown. */
  copiedLabel?: string;
  /** How long the copied state stays, in ms. */
  feedbackMs?: number;
  size?: CopyButtonSize;
  /** Test seam for clipboard. */
  clipboard?: ClipboardLike | null;
  /** Runs after the text reached the clipboard, with the copied text. */
  onCopy?: (value: string) => void;
  /** Runs when the clipboard write failed (no clipboard access, denied permission…). */
  onCopyError?: (value: string) => void;
  class?: ClassValue;
  children?: import('svelte').Snippet;
};

let {
  value,
  label: labelProp,
  copiedLabel: copiedLabelProp,
  feedbackMs = 1500,
  size: sizeProp,
  clipboard = undefined,
  onCopy,
  onCopyError,
  onclick,
  disabled = false,
  class: className,
  children,
  ref = $bindable(null),
  ...rest
}: Props = $props();
const txDefaults = designDefaults('copy-button');
const size = $derived(withDefault(sizeProp, txDefaults().size, 'md'));
const msg = useMessages();
const label = $derived(labelProp ?? msg('texuli.copy-button.label', 'Copy'));
const copiedLabel = $derived(copiedLabelProp ?? msg('texuli.copy-button.copied-label', 'Copied'));

type CopyFeedback = 'idle' | 'copied' | 'error';

let copyState = $state<CopyFeedback>('idle');
let pending = $state(false);
let timer: ReturnType<typeof setTimeout> | undefined;

const classes = $derived(
  copyButtonClass({
    size,
    class: className,
  })
);

const displayLabel = $derived(copyState === 'copied' ? copiedLabel : label);
const busy = $derived(pending);

function clearTimer(): void {
  if (timer !== undefined) {
    clearTimeout(timer);
    timer = undefined;
  }
}

/**
 * The caller's `onclick` runs first; calling `event.preventDefault()` in it
 * skips the copy. A caller handler never replaces the copy behavior.
 */
async function onClick(
  event: MouseEvent & { currentTarget: EventTarget & HTMLButtonElement }
): Promise<void> {
  onclick?.(event);
  if (event.defaultPrevented) return;
  if (disabled || pending) {
    event.preventDefault();
    return;
  }
  pending = true;
  const ok = await copyText(value, {
    clipboard: clipboard === undefined ? undefined : clipboard,
  });
  pending = false;
  copyState = ok ? 'copied' : 'error';
  if (ok) onCopy?.(value);
  else onCopyError?.(value);
  clearTimer();
  timer = setTimeout(
    () => {
      copyState = 'idle';
      timer = undefined;
    },
    Math.max(0, feedbackMs)
  );
}
</script>

<button
  bind:this={ref}
  type="button"
  class={classes}
  data-tx-copy-button
  data-state={copyState}
  data-size={size}
  disabled={Boolean(disabled) || busy}
  aria-busy={busy || undefined}
  aria-live="polite"
  {...rest}
  onclick={onClick}
>
  {#if children}
    {@render children()}
  {:else}
    <svg class="tx-copy-button__icon" viewBox="0 0 16 16" aria-hidden="true">
      {#if copyState === 'copied'}
        <path
          fill="currentColor"
          d="M6.5 11.2 3.3 8l1.1-1.1 2.1 2.1 4.6-4.6L12.2 5.5 6.5 11.2z"
        ></path>
      {:else}
        <path
          fill="currentColor"
          d="M6 2h6a1 1 0 0 1 1 1v7h-1.5V3.5H6V2zm-2 3h6a1 1 0 0 1 1 1v7a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1zm.5 1.5v6h5v-6h-5z"
        ></path>
      {/if}
    </svg>
    <span>{displayLabel}</span>
  {/if}
  <span class="tx-copy-button__sr-only" data-tx-copy-status>{displayLabel}</span>
</button>
