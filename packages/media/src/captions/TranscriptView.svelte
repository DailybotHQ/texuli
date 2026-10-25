<script lang="ts">
import { type ClassValue, cx } from 'texuli/cx';
import { cuesAtTime, formatCaptionTime } from './model.ts';
import type { TranscriptViewProps } from './types.ts';
import './captions.css';

/**
 * Scrollable plain-text transcript. Click or Enter seeks to the cue start.
 * Cue payload is never rendered as HTML.
 */
let {
  cues,
  currentTime = 0,
  label = 'Transcript',
  disabled = false,
  class: className,
  onSeek,
}: TranscriptViewProps & { class?: ClassValue } = $props();

const activeIds = $derived(new Set(cuesAtTime(cues, currentTime).map((c) => c.id)));
const listId = $props.id();

function seekTo(index: number): void {
  if (disabled || !onSeek) return;
  const cue = cues[index];
  if (cue) onSeek(cue.start);
}

function onKeydown(event: KeyboardEvent, index: number): void {
  if (disabled || cues.length === 0) return;
  let next = index;
  if (event.key === 'ArrowDown') {
    event.preventDefault();
    next = Math.min(cues.length - 1, index + 1);
  } else if (event.key === 'ArrowUp') {
    event.preventDefault();
    next = Math.max(0, index - 1);
  } else if (event.key === 'Home') {
    event.preventDefault();
    next = 0;
  } else if (event.key === 'End') {
    event.preventDefault();
    next = cues.length - 1;
  } else if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    seekTo(index);
    return;
  } else {
    return;
  }
  const target = (event.currentTarget as HTMLElement)
    .closest('[data-tx-captions-transcript]')
    ?.querySelectorAll<HTMLButtonElement>('[data-tx-transcript-button]')[next];
  target?.focus();
}
</script>

<section
  class={cx('tx-captions-transcript', className)}
  data-tx-captions-transcript=""
  aria-label={label}
>
  <p class="tx-captions-transcript__title" id="{listId}-title">{label}</p>
  {#if cues.length === 0}
    <p class="tx-captions__message" role="status">No cues</p>
  {:else}
    <ul class="tx-captions-transcript__list" aria-labelledby="{listId}-title" role="list">
      {#each cues as cue, index (cue.id)}
        <li class="tx-captions-transcript__item">
          <button
            type="button"
            class="tx-captions-transcript__button"
            data-tx-transcript-button=""
            data-cue-id={cue.id}
            aria-current={activeIds.has(cue.id) ? 'true' : undefined}
            {disabled}
            onclick={() => seekTo(index)}
            onkeydown={(event) => onKeydown(event, index)}
          >
            <span class="tx-captions-transcript__time">{formatCaptionTime(cue.start)}</span>
            <span class="tx-captions-transcript__text">{cue.text}</span>
          </button>
        </li>
      {/each}
    </ul>
  {/if}
</section>
