<script lang="ts">
import {
  type AutocompleteMatch,
  applyAutocomplete,
  autocompleteKeyAction,
  findAutocompleteTrigger,
  moveAutocompleteActive,
} from '@texuli/core/autocomplete-trigger';
import { type Snippet, tick } from 'svelte';
import type { HTMLFormAttributes } from 'svelte/elements';
import { Button } from 'texuli/button';
import { type ClassValue, chainHandlers, cx } from 'texuli/cx';
import { autosizeTextarea } from 'texuli/input';
import {
  type ComposerActionContext,
  type ComposerLabels,
  DEFAULT_COMPOSER_LABELS,
} from './labels.ts';
import {
  COMPOSER_MAX_SUGGESTIONS,
  type ComposerSuggestion,
  type ComposerSuggestionSource,
} from './suggestions.ts';

interface OwnProps {
  value?: string;
  /** Return false to keep the draft, or reject to show the translated error. */
  onSubmit: (message: string) => unknown;
  labels?: Partial<ComposerLabels>;
  disabled?: boolean;
  /** External pending state, for example while a parent queues a send. */
  sending?: boolean;
  maxRows?: number;
  maxLength?: number;
  /** Attachment and other controls rendered at the start of the action row. */
  attachments?: Snippet;
  /**
   * Host controls (a model choice, a custom send) rendered just before the
   * send or stop button, with the composer state and its `submit`/`stop`.
   */
  actions?: Snippet<[ComposerActionContext]>;
  /** A reply is streaming: the send button becomes Stop and Escape stops it. */
  streaming?: boolean;
  /** Called by the Stop button, or Escape in the field, while `streaming`. */
  onStop?: () => void;
  /**
   * Runs before the built-in keys (Enter to send, Escape to stop); call
   * `event.preventDefault()` to take the key over, for example for a
   * suggestion list or history.
   */
  onkeydown?: (event: KeyboardEvent & { currentTarget: HTMLTextAreaElement }) => void;
  class?: ClassValue;
  /**
   * `stack` (default) puts the actions row under the field; `row` keeps a
   * single row with the field first and the actions (attachments, then the
   * send or stop button) inline after it.
   */
  layout?: 'stack' | 'row';
  /**
   * `label` (default) shows the send text; `icon` draws an icon-only send
   * button whose name is still `labels.send` (`labels.sending` while
   * pending), as visually hidden text. For another glyph, render a custom
   * send in `actions` with its `submit`.
   */
  sendButton?: 'label' | 'icon';
  /** The composer's root `form` (bindable). */
  ref?: HTMLFormElement | null;
  /**
   * Inline autocomplete sources, one per trigger character (`@` people, `/`
   * commands, `:` emoji): typing the trigger opens a listbox under the APG
   * combobox list-autocomplete pattern (Up and Down choose, Enter or Tab
   * inserts, Escape closes).
   */
  suggestions?: readonly ComposerSuggestionSource[];
}
/**
 * Other attributes (`id`, `aria-*`, `data-*`, `style`, handlers) land on the
 * root `form`. A caller `onsubmit` runs first; the composer's own submit
 * always runs after it (it prevents the page navigation itself).
 * `onkeydown` is the exception: it reaches the textarea (see above).
 */
type Props = OwnProps & Omit<HTMLFormAttributes, keyof OwnProps | 'children'>;

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
  actions,
  streaming = false,
  onStop,
  onkeydown,
  layout,
  sendButton,
  class: className,
  ref = $bindable(null),
  suggestions = [],
  onsubmit: callerSubmit,
  ...rest
}: Props = $props();

let field = $state<HTMLTextAreaElement | null>(null);
let pending = $state(false);
let error = $state(false);
let composing = $state(false);
const labels = $derived({ ...DEFAULT_COMPOSER_LABELS, ...labelOverrides });
const busy = $derived(sending || pending);
const iconOnly = $derived(sendButton === 'icon');
const canSend = $derived(!disabled && !busy && !streaming && value.trim().length > 0);
const hintId = `chat-composer-${id}-hint`;
const errorId = `chat-composer-${id}-error`;
const listId = `chat-composer-${id}-suggestions`;
const optionId = (index: number) => `${listId}-${index}`;

// Inline autocomplete: the trigger the caret is in, the options found for it,
// and the active one. A late answer for an old query is dropped (`request`).
let match = $state<AutocompleteMatch | null>(null);
let source = $state<ComposerSuggestionSource | null>(null);
let options = $state<readonly ComposerSuggestion[]>([]);
let active = $state(-1);
/** The trigger the reader closed with Escape: it stays closed until it is deleted. */
let dismissed = $state<{ start: number; char: string } | null>(null);
let request = 0;
const open = $derived(match !== null && options.length > 0);
const announcement = $derived(
  open ? labels.suggestions.replace('{count}', String(options.length)) : ''
);

function closeSuggestions(): void {
  request += 1;
  match = null;
  source = null;
  options = [];
  active = -1;
}

async function updateSuggestions(): Promise<void> {
  const element = field;
  const caret = element?.selectionStart ?? value.length;
  if (!element || suggestions.length === 0 || composing || element.selectionEnd !== caret) {
    closeSuggestions();
    return;
  }
  const found = findAutocompleteTrigger(
    value,
    caret,
    suggestions.map((entry) => ({
      char: entry.trigger,
      ...(entry.lineStart ? { lineStart: true } : {}),
      ...(entry.minQuery !== undefined ? { minQuery: entry.minQuery } : {}),
      ...(entry.maxQuery !== undefined ? { maxQuery: entry.maxQuery } : {}),
    }))
  );
  const entry = found && suggestions.find((candidate) => candidate.trigger === found.trigger.char);
  if (!found || !entry || found.start === dismissed?.start) {
    closeSuggestions();
    return;
  }
  const ticket = ++request;
  let results: readonly ComposerSuggestion[] = [];
  try {
    results = await entry.search(found.query);
  } catch {
    results = [];
  }
  if (ticket !== request) return;
  match = found;
  source = entry;
  options = (Array.isArray(results) ? results : []).slice(0, COMPOSER_MAX_SUGGESTIONS);
  active = options.length > 0 ? 0 : -1;
}

async function accept(index: number): Promise<void> {
  const option = options[index];
  const current = match;
  if (!option || !current) return;
  const next = applyAutocomplete(value, current, option.insert);
  value = next.text;
  closeSuggestions();
  await tick();
  field?.focus();
  field?.setSelectionRange(next.caret, next.caret);
  resize();
}

function onSuggestionKey(event: KeyboardEvent): boolean {
  if (!open || event.isComposing || composing) return false;
  const action = autocompleteKeyAction(event.key, event);
  if (!action) return false;
  event.preventDefault();
  if (action === 'accept') void accept(active < 0 ? 0 : active);
  else if (action === 'close') {
    dismissed = match ? { start: match.start, char: match.trigger.char } : null;
    closeSuggestions();
  } else active = moveAutocompleteActive(active, options.length, action);
  return true;
}

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

function stop(): void {
  if (!streaming || !onStop) return;
  onStop();
  // The Stop button leaves with the stream; keep focus in the composer.
  field?.focus();
}

function onKeydown(event: KeyboardEvent & { currentTarget: HTMLTextAreaElement }): void {
  if (onSuggestionKey(event)) return;
  onkeydown?.(event);
  if (event.defaultPrevented) return;
  if (event.key === 'Escape' && streaming && onStop) {
    event.preventDefault();
    stop();
  } else if (
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
  {...rest}
  bind:this={ref}
  class={cx('tx-chat-composer', className)}
  data-tx-chat-composer
  data-tx-component="composer"
  data-layout={layout}
  onsubmit={chainHandlers(callerSubmit, (event: SubmitEvent) => {
    event.preventDefault();
    void submit();
  })}
>
  <label class="visually-hidden" for={`chat-composer-${id}`}>{labels.input}</label>
  <textarea
    bind:this={field}
    value={value}
    id={`chat-composer-${id}`}
    aria-describedby={error ? `${hintId} ${errorId}` : hintId}
    aria-invalid={error || undefined}
    aria-autocomplete={suggestions.length > 0 ? 'list' : undefined}
    aria-controls={open ? listId : undefined}
    aria-activedescendant={open && active >= 0 ? optionId(active) : undefined}
    placeholder={labels.placeholder}
    disabled={disabled || busy}
    rows="1"
    maxlength={maxLength}
    class="tx-chat-composer__field"
    oninput={(event) => {
      value = event.currentTarget.value;
      error = false;
      resize();
      if (dismissed && value.charAt(dismissed.start) !== dismissed.char) dismissed = null;
      void updateSuggestions();
    }}
    onkeydown={onKeydown}
    onkeyup={(event) => {
      if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) void updateSuggestions();
    }}
    onclick={() => void updateSuggestions()}
    onblur={closeSuggestions}
    oncompositionstart={() => (composing = true)}
    oncompositionend={() => {
      composing = false;
      void updateSuggestions();
    }}
  ></textarea>
  {#if open && source}
    <ul id={listId} class="tx-chat-composer__suggestions" role="listbox" aria-label={source.label} data-tx-chat-suggestions>
      {#each options as option, index (option.id)}
        <!-- Pointer choice keeps focus in the field: the field owns the keyboard (aria-activedescendant). -->
        <!-- svelte-ignore a11y_click_events_have_key_events -->
        <li
          id={optionId(index)}
          class="tx-chat-composer__suggestion"
          role="option"
          aria-selected={index === active}
          onpointerdown={(event) => event.preventDefault()}
          onclick={() => void accept(index)}
        >
          {#if option.glyph}<span class="tx-chat-composer__glyph" aria-hidden="true">{option.glyph}</span>{/if}
          <span class="tx-chat-composer__suggestion-text">
            <span class="tx-chat-composer__suggestion-label">{option.label}</span>
            {#if option.description}<span class="tx-chat-composer__suggestion-description">{option.description}</span>{/if}
          </span>
        </li>
      {/each}
    </ul>
  {/if}
  <!-- A live region without role="status": the thread's typing indicator owns that role. -->
  <span class="visually-hidden" aria-live="polite" aria-atomic="true" data-tx-chat-suggestions-status>{announcement}</span>
  <div class="tx-chat-composer__actions">
    <div class="tx-chat-composer__attachments">{@render attachments?.()}</div>
    <div class="tx-chat-composer__end">
      {@render actions?.({ canSend, busy, streaming, submit, stop })}
      {#if streaming && onStop}
        <Button type="button" variant="outline" size="sm" aria-keyshortcuts="Escape" onclick={stop} data-tx-chat-stop>
          {labels.stop}
        </Button>
      {:else}
        <Button
          type="submit"
          variant="outline"
          size={iconOnly ? 'icon' : 'sm'}
          disabled={!canSend}
          loading={busy}
          loadingLabel={labels.sending}
          data-icon-only={iconOnly || undefined}
        >
          {#if iconOnly}<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 19V5m-7 7 7-7 7 7" /></svg><span class="visually-hidden">{labels.send}</span>{:else}{labels.send}{/if}
        </Button>
      {/if}
    </div>
  </div>
  <span id={hintId} class="visually-hidden">{labels.hint}</span>
  {#if error}<p id={errorId} class="tx-chat-composer__error" role="alert">{labels.sendError}</p>{/if}
</form>

<style>
  @layer tx.components {
    .tx-chat-composer {
      position: relative;
      display: grid;
      gap: var(--tx-chat-composer-gap, var(--tx-space-2));
      border: var(--tx-border-width-thin) solid var(--tx-border, CanvasText);
      border-radius: var(--tx-chat-composer-radius, var(--tx-shape-radius-lg));
      background: var(--tx-surface, Canvas);
      padding: var(--tx-chat-composer-padding, var(--tx-space-3));
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
    border: var(--tx-border-width-thin) solid var(--tx-input, var(--tx-border, CanvasText));
    border-radius: var(--tx-chat-composer-radius, var(--tx-shape-radius-lg));
    background: var(--tx-surface, Canvas);
    color: var(--tx-foreground, CanvasText);
    padding: calc(var(--tx-space-unit) * 2.5) var(--tx-space-3);
    font-family: var(--tx-font-sans, system-ui, sans-serif);
    line-height: 1.4;
    resize: none;
    overflow-y: hidden;
    font-size: var(--tx-type-body-size);
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
      gap: var(--tx-space-3);
    }

    .tx-chat-composer__end {
      display: flex;
      align-items: center;
      gap: var(--tx-space-2);
    }

    .tx-chat-composer__attachments {
      display: flex;
      min-inline-size: 0;
      flex-wrap: wrap;
      align-items: center;
      gap: var(--tx-space-2);
    }

    .tx-chat-composer[data-layout='row'] {
      display: flex;
      flex-wrap: wrap;
      align-items: end;
    }

    .tx-chat-composer[data-layout='row'] .tx-chat-composer__field {
      flex: 1 1 12rem;
      inline-size: auto;
    }

    .tx-chat-composer[data-layout='row'] .tx-chat-composer__actions {
      flex: 0 0 auto;
      justify-content: end;
      gap: var(--tx-space-2);
      padding-block-end: var(--tx-space-1);
    }

    .tx-chat-composer[data-layout='row'] .tx-chat-composer__attachments:empty {
      display: none;
    }

    .tx-chat-composer[data-layout='row'] .tx-chat-composer__error {
      flex-basis: 100%;
    }

    svg {
      inline-size: 1rem;
      block-size: 1rem;
      fill: none;
      stroke: currentColor;
      stroke-width: 2;
    }

    .tx-chat-composer__suggestions {
      position: absolute;
      z-index: 1;
      inset-block-end: calc(100% + var(--tx-space-1));
      inset-inline: 0;
      display: grid;
      gap: var(--tx-space-1);
      margin: 0;
      border: var(--tx-border-width-thin) solid var(--tx-border, CanvasText);
      border-radius: var(--tx-shape-radius-md);
      background: var(--tx-elevated, var(--tx-surface, Canvas));
      color: var(--tx-elevated-foreground, var(--tx-surface-foreground, CanvasText));
      box-shadow: var(--tx-elevation-3, none);
      padding: var(--tx-space-1);
      list-style: none;
      max-block-size: 16rem;
      overflow-y: auto;
    }

    .tx-chat-composer__suggestion {
      display: flex;
      align-items: center;
      gap: var(--tx-space-2);
      border-radius: var(--tx-shape-radius-sm);
      padding: var(--tx-space-1) var(--tx-space-2);
      cursor: pointer;
    }

    .tx-chat-composer__suggestion[aria-selected='true'] {
      background: var(--tx-accent, Highlight);
      color: var(--tx-accent-foreground, HighlightText);
      outline: var(--tx-border-width-thin) solid var(--tx-ring, Highlight);
    }

    .tx-chat-composer__glyph {
      display: inline-grid;
      place-items: center;
      inline-size: 1.5rem;
      block-size: 1.5rem;
      flex: none;
    }

    .tx-chat-composer__suggestion-text {
      display: grid;
      min-inline-size: 0;
    }

    .tx-chat-composer__suggestion-description {
      color: var(--tx-muted-foreground, GrayText);
      font-size: var(--tx-type-label-size);
    }

    .tx-chat-composer__suggestion[aria-selected='true'] .tx-chat-composer__suggestion-description {
      color: inherit;
    }

    .tx-chat-composer__error {
      margin: 0;
      color: var(--tx-destructive, Mark);
      font-size: var(--tx-type-label-size);
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
        font-size: var(--tx-type-label-size);
      }
    }
  }
</style>
